use std::collections::HashMap;

use reqwest::Client;
use serde_json::json;

use crate::error::AppError;

use super::queries::{PR_LINKED_ISSUES_STATUS_QUERY, SEARCH_QUERY, VIEWER_QUERY};
use super::types::{
    AccessTokenResponse, DeviceCodeResponse, GitHubNotification, InboxItem, InboxResponse,
    LinkedIssueNode, LinkedIssuesResponse, NotificationItem, SearchResponse, TokenVerification,
};

const GITHUB_API_BASE: &str = "https://api.github.com";
const GITHUB_GRAPHQL_API: &str = "https://api.github.com/graphql";
const GITHUB_DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";

use super::secrets::GITHUB_CLIENT_ID;

pub struct GitHubClient {
    client: Client,
    token: Option<String>,
    /// API base URL. Defaults to GITHUB_API_BASE. Overridable for testing.
    base_url: String,
}

impl GitHubClient {
    /// AppStateが保持する共有Clientを受け取るコンストラクタ。
    /// Clientの再生成を避け、接続プールを再利用する。
    pub fn with_shared_client(client: Client, token: String) -> Self {
        Self {
            client,
            // 空文字列はトークン未設定を示す（デバイスフロー完了前など）
            token: if token.is_empty() { None } else { Some(token) },
            base_url: GITHUB_API_BASE.to_string(),
        }
    }

    #[cfg(test)]
    pub fn with_base_url(client: Client, token: String, base_url: String) -> Self {
        Self {
            client,
            token: if token.is_empty() { None } else { Some(token) },
            base_url,
        }
    }

    /// Start OAuth device flow authentication
    pub async fn start_device_flow(&self) -> Result<DeviceCodeResponse, AppError> {
        let response = self
            .client
            .post(GITHUB_DEVICE_CODE_URL)
            .header("Accept", "application/json")
            .header("User-Agent", "github-notify")
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
            .header("User-Agent", "github-notify")
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

        // Convert nodes to NotificationItems, filtering out null nodes
        // (null nodes appear when the authenticated user lacks access to a search result)
        let items: Vec<NotificationItem> = search_response
            .data
            .search
            .nodes
            .into_iter()
            .flatten()
            .map(|node| node.to_notification_item())
            .collect();

        Ok(items)
    }

    /// 複数PRの紐づきissueとそのProjects V2 Statusを一括取得する。
    /// 戻り値: PR node ID → Vec<LinkedIssueNode> のマップ。
    pub async fn fetch_pr_linked_issue_statuses(
        &self,
        pr_node_ids: &[String],
    ) -> Result<HashMap<String, Vec<LinkedIssueNode>>, AppError> {
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
                "query": PR_LINKED_ISSUES_STATUS_QUERY,
                "variables": {
                    "ids": pr_node_ids
                }
            }))
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::GitHubApi(format!(
                "GraphQL request for linked issues failed: {}",
                error_text
            )));
        }

        let linked_response: LinkedIssuesResponse = response.json().await.map_err(|e| {
            AppError::Serialization(format!("Failed to parse linked issues response: {}", e))
        })?;

        let mut result = HashMap::new();
        for node in linked_response.data.nodes.into_iter().flatten() {
            result.insert(node.id, node.closing_issues_references.nodes);
        }

        Ok(result)
    }

    // ============================================
    // Inbox (REST API) Methods
    // ============================================

    /// Fetch inbox notifications from GitHub REST API (no query needed!)
    pub async fn fetch_inbox(&self, all: bool) -> Result<Vec<InboxItem>, AppError> {
        let response = self.fetch_inbox_with_etag(all, None).await?;
        Ok(response.items)
    }

    /// Fetch inbox notifications with ETag support for conditional requests.
    /// Paginates through all pages (up to MAX_PAGES) to get the full notification list.
    pub async fn fetch_inbox_with_etag(
        &self,
        all: bool,
        etag: Option<&str>,
    ) -> Result<InboxResponse, AppError> {
        const MAX_PAGES: usize = 10; // Safety limit: 10 pages × 50 = 500 notifications max

        let token = self
            .token
            .as_ref()
            .ok_or_else(|| AppError::Auth("No token set".to_string()))?;

        let base_url = if all {
            format!("{}/notifications?all=true&per_page=50", self.base_url)
        } else {
            format!("{}/notifications?per_page=50", self.base_url)
        };

        // First page request (with ETag for conditional caching)
        let mut request = self
            .client
            .get(&base_url)
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", "github-notify")
            .header("Accept", "application/vnd.github+json");

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

        // Extract ETag and poll interval from first response
        let new_etag = response
            .headers()
            .get("etag")
            .and_then(|v| v.to_str().ok())
            .map(String::from);

        let poll_interval = response
            .headers()
            .get("x-poll-interval")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse().ok())
            .unwrap_or(60);

        let next_url = parse_next_link(response.headers());

        let notifications: Vec<GitHubNotification> = response.json().await.map_err(|e| {
            AppError::Serialization(format!("Failed to parse notifications: {}", e))
        })?;

        let mut all_items: Vec<InboxItem> =
            notifications.into_iter().map(|n| n.to_inbox_item()).collect();

        // Paginate through remaining pages
        let mut current_next = next_url;
        let mut page = 1;

        while let Some(url) = current_next {
            page += 1;
            if page > MAX_PAGES {
                log::warn!("Reached max pagination limit ({} pages)", MAX_PAGES);
                break;
            }

            log::debug!("Fetching notification page {} ...", page);

            let resp = self
                .client
                .get(&url)
                .header("Authorization", format!("Bearer {}", token))
                .header("User-Agent", "github-notify")
                .header("Accept", "application/vnd.github+json")
                .send()
                .await?;

            if !resp.status().is_success() {
                break;
            }

            current_next = parse_next_link(resp.headers());

            let page_notifications: Vec<GitHubNotification> =
                resp.json().await.map_err(|e| {
                    AppError::Serialization(format!("Failed to parse notifications page {}: {}", page, e))
                })?;

            if page_notifications.is_empty() {
                break;
            }

            all_items.extend(page_notifications.into_iter().map(|n| n.to_inbox_item()));
        }

        log::info!(
            "Fetched {} notifications across {} page(s)",
            all_items.len(),
            page
        );

        Ok(InboxResponse::new(all_items, new_etag, poll_interval))
    }

    /// 指定 Issue の現在のアサイン状況を取得する。
    /// アサイン解除検知（GitHubはunassignを通知しない）のために使う。
    pub async fn fetch_issue_assignees(
        &self,
        owner: &str,
        repo: &str,
        issue_number: u64,
    ) -> Result<Vec<String>, AppError> {
        let token = self
            .token
            .as_ref()
            .ok_or_else(|| AppError::Auth("No token set".to_string()))?;

        let url = format!(
            "{}/repos/{}/{}/issues/{}",
            self.base_url, owner, repo, issue_number
        );

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", "github-notify")
            .header("Accept", "application/vnd.github+json")
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::GitHubApi(format!(
                "Failed to fetch issue {}/{}#{}: {} - {}",
                owner, repo, issue_number, status, error_text
            )));
        }

        let body: serde_json::Value = response.json().await?;
        let assignees = body
            .get("assignees")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|a| a.get("login").and_then(|l| l.as_str()).map(String::from))
                    .collect()
            })
            .unwrap_or_default();

        Ok(assignees)
    }

    /// Mark a notification as read
    pub async fn mark_notification_read(&self, thread_id: &str) -> Result<(), AppError> {
        let token = self
            .token
            .as_ref()
            .ok_or_else(|| AppError::Auth("No token set".to_string()))?;

        let url = format!("{}/notifications/threads/{}", self.base_url, thread_id);

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

        let url = format!("{}/notifications", self.base_url);

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

/// Parse the GitHub `Link` header to extract the `rel="next"` URL.
/// Format: `<https://api.github.com/...?page=2>; rel="next", <...>; rel="last"`
fn parse_next_link(headers: &reqwest::header::HeaderMap) -> Option<String> {
    let link_header = headers.get("link")?.to_str().ok()?;
    for part in link_header.split(',') {
        let part = part.trim();
        if part.contains("rel=\"next\"") {
            // Extract URL between < and >
            let start = part.find('<')? + 1;
            let end = part.find('>')?;
            return Some(part[start..end].to_string());
        }
    }
    None
}
