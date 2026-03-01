use reqwest::Client;
use serde_json::json;

use crate::error::AppError;

use super::queries::{SEARCH_QUERY, VIEWER_QUERY};
use super::types::{
    AccessTokenResponse, DeviceCodeResponse, GitHubNotification, InboxItem, InboxResponse,
    NotificationItem, SearchResponse, TokenVerification,
};

const GITHUB_API_BASE: &str = "https://api.github.com";
const GITHUB_GRAPHQL_API: &str = "https://api.github.com/graphql";
const GITHUB_DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";

// GitHub OAuth App Client ID for device flow
// You need to create your own OAuth App at https://github.com/settings/developers
const GITHUB_CLIENT_ID: &str = "Ov23libJfBYqGMHw9FWk";

pub struct GitHubClient {
    client: Client,
    token: Option<String>,
}

impl GitHubClient {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            token: None,
        }
    }

    pub fn with_token(token: String) -> Self {
        Self {
            client: Client::new(),
            token: Some(token),
        }
    }

    /// Start OAuth device flow authentication
    pub async fn start_device_flow(&self) -> Result<DeviceCodeResponse, AppError> {
        let response = self
            .client
            .post(GITHUB_DEVICE_CODE_URL)
            .header("Accept", "application/json")
            .form(&[("client_id", GITHUB_CLIENT_ID), ("scope", "repo read:org")])
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::Auth(format!(
                "Failed to start device flow: {}",
                error_text
            )));
        }

        let device_response: DeviceCodeResponse = response.json().await?;
        Ok(device_response)
    }

    /// Poll for access token during device flow
    pub async fn poll_for_token(&self, device_code: &str) -> Result<AccessTokenResponse, AppError> {
        let response = self
            .client
            .post(GITHUB_ACCESS_TOKEN_URL)
            .header("Accept", "application/json")
            .form(&[
                ("client_id", GITHUB_CLIENT_ID),
                ("device_code", device_code),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ])
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::Auth(format!(
                "Failed to poll for token: {}",
                error_text
            )));
        }

        let token_response: AccessTokenResponse = response.json().await?;
        Ok(token_response)
    }

    /// Verify a token and get user info
    pub async fn verify_token(&self) -> Result<TokenVerification, AppError> {
        let token = self
            .token
            .as_ref()
            .ok_or_else(|| AppError::Auth("No token set".to_string()))?;

        let response = self
            .client
            .post(GITHUB_GRAPHQL_API)
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", "github-notify")
            .json(&json!({
                "query": VIEWER_QUERY
            }))
            .send()
            .await?;

        if !response.status().is_success() {
            return Ok(TokenVerification {
                valid: false,
                login: None,
                avatar_url: None,
            });
        }

        let body: serde_json::Value = response.json().await?;

        if body.get("errors").is_some() {
            return Ok(TokenVerification {
                valid: false,
                login: None,
                avatar_url: None,
            });
        }

        let login = body["data"]["viewer"]["login"]
            .as_str()
            .map(|s| s.to_string());
        let avatar_url = body["data"]["viewer"]["avatarUrl"]
            .as_str()
            .map(|s| s.to_string());

        Ok(TokenVerification {
            valid: login.is_some(),
            login,
            avatar_url,
        })
    }

    /// Fetch notifications using a search query
    pub async fn fetch_notifications(
        &self,
        query: &str,
        limit: i32,
    ) -> Result<Vec<NotificationItem>, AppError> {
        let token = self
            .token
            .as_ref()
            .ok_or_else(|| AppError::Auth("No token set".to_string()))?;

        let response = self
            .client
            .post(GITHUB_GRAPHQL_API)
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", "github-notify")
            .json(&json!({
                "query": SEARCH_QUERY,
                "variables": {
                    "query": query,
                    "first": limit
                }
            }))
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::GitHubApi(format!(
                "GraphQL request failed: {}",
                error_text
            )));
        }

        let search_response: SearchResponse = response.json().await.map_err(|e| {
            AppError::Serialization(format!("Failed to parse search response: {}", e))
        })?;

        let viewer_login = &search_response.data.viewer.login;

        // Convert nodes to NotificationItems, filtering out self-authored items
        let items: Vec<NotificationItem> = search_response
            .data
            .search
            .nodes
            .into_iter()
            .filter(|node| {
                // Exclude items authored by the current user
                node.author_login()
                    .map(|author| author != viewer_login)
                    .unwrap_or(true)
            })
            .map(|node| node.to_notification_item())
            .collect();

        Ok(items)
    }

    // ============================================
    // Inbox (REST API) Methods
    // ============================================

    /// Fetch inbox notifications from GitHub REST API (no query needed!)
    pub async fn fetch_inbox(&self, all: bool) -> Result<Vec<InboxItem>, AppError> {
        let response = self.fetch_inbox_with_etag(all, None).await?;
        Ok(response.items)
    }

    /// Fetch inbox notifications with ETag support for conditional requests
    /// Returns InboxResponse with not_modified=true if content hasn't changed (304)
    pub async fn fetch_inbox_with_etag(
        &self,
        all: bool,
        etag: Option<&str>,
    ) -> Result<InboxResponse, AppError> {
        let token = self
            .token
            .as_ref()
            .ok_or_else(|| AppError::Auth("No token set".to_string()))?;

        let url = if all {
            format!("{}/notifications?all=true&per_page=50", GITHUB_API_BASE)
        } else {
            format!("{}/notifications?per_page=50", GITHUB_API_BASE)
        };

        let mut request = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", "github-notify")
            .header("Accept", "application/vnd.github+json");

        // Add If-None-Match header for conditional request
        if let Some(etag_value) = etag {
            request = request.header("If-None-Match", etag_value);
        }

        let response = request.send().await?;

        // Handle 304 Not Modified
        if response.status() == reqwest::StatusCode::NOT_MODIFIED {
            log::debug!("GitHub API returned 304 Not Modified");
            return Ok(InboxResponse::not_modified());
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::GitHubApi(format!(
                "Failed to fetch notifications: {}",
                error_text
            )));
        }

        // Extract ETag from response headers
        let new_etag = response
            .headers()
            .get("etag")
            .and_then(|v| v.to_str().ok())
            .map(String::from);

        // Extract X-Poll-Interval (GitHub's recommended polling interval)
        let poll_interval = response
            .headers()
            .get("x-poll-interval")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse().ok())
            .unwrap_or(60);

        let notifications: Vec<GitHubNotification> = response.json().await.map_err(|e| {
            AppError::Serialization(format!("Failed to parse notifications: {}", e))
        })?;

        let items: Vec<InboxItem> = notifications
            .into_iter()
            .map(|n| n.to_inbox_item())
            .collect();

        Ok(InboxResponse::new(items, new_etag, poll_interval))
    }

    /// Mark a notification as read
    pub async fn mark_notification_read(&self, thread_id: &str) -> Result<(), AppError> {
        let token = self
            .token
            .as_ref()
            .ok_or_else(|| AppError::Auth("No token set".to_string()))?;

        let url = format!("{}/notifications/threads/{}", GITHUB_API_BASE, thread_id);

        let response = self
            .client
            .patch(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", "github-notify")
            .header("Accept", "application/vnd.github+json")
            .send()
            .await?;

        // 205 Reset Content is the expected success response
        if !response.status().is_success() && response.status().as_u16() != 205 {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::GitHubApi(format!(
                "Failed to mark as read: {}",
                error_text
            )));
        }

        Ok(())
    }

    /// Mark all notifications as read
    pub async fn mark_all_notifications_read(&self) -> Result<(), AppError> {
        let token = self
            .token
            .as_ref()
            .ok_or_else(|| AppError::Auth("No token set".to_string()))?;

        let url = format!("{}/notifications", GITHUB_API_BASE);

        let response = self
            .client
            .put(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", "github-notify")
            .header("Accept", "application/vnd.github+json")
            .json(&json!({}))
            .send()
            .await?;

        // 205 Reset Content is the expected success response
        if !response.status().is_success() && response.status().as_u16() != 205 {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::GitHubApi(format!(
                "Failed to mark all as read: {}",
                error_text
            )));
        }

        Ok(())
    }
}

impl Default for GitHubClient {
    fn default() -> Self {
        Self::new()
    }
}
