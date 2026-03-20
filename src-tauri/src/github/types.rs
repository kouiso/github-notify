use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// GitHub user information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubUser {
    pub login: String,
    #[serde(default)]
    pub avatar_url: Option<String>,
}

/// Repository information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub name: String,
    pub owner: RepositoryOwner,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepositoryOwner {
    pub login: String,
}

/// Label information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Label {
    pub name: String,
    pub color: String,
}

/// Issue or PR state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ItemState {
    Open,
    Closed,
    Merged,
}

/// Notification item type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum NotificationType {
    Issue,
    PullRequest,
}

/// A notification item (Issue or PR)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationItem {
    pub id: String,
    pub number: i32,
    pub title: String,
    pub url: String,
    pub state: ItemState,
    pub item_type: NotificationType,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub author: Option<GitHubUser>,
    pub repository: Repository,
    pub labels: Vec<Label>,
    #[serde(default)]
    pub is_read: bool,
    #[serde(default)]
    pub is_draft: Option<bool>,
    #[serde(default)]
    pub review_decision: Option<String>,
}

/// GraphQL search response
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResponse {
    pub data: SearchData,
}

#[derive(Debug, Deserialize)]
pub struct SearchData {
    pub search: SearchResult,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub nodes: Vec<Option<SearchNode>>,
}

/// Search node (can be Issue or PullRequest)
#[derive(Debug, Deserialize)]
#[serde(tag = "__typename")]
pub enum SearchNode {
    Issue(IssueNode),
    PullRequest(PullRequestNode),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueNode {
    pub id: String,
    pub number: i32,
    pub title: String,
    pub url: String,
    pub state: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub author: Option<AuthorNode>,
    pub repository: RepositoryNode,
    pub labels: LabelsConnection,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestNode {
    pub id: String,
    pub number: i32,
    pub title: String,
    pub url: String,
    pub state: String,
    #[serde(default)]
    pub is_draft: Option<bool>,
    #[serde(default)]
    pub review_decision: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub author: Option<AuthorNode>,
    pub repository: RepositoryNode,
    pub labels: LabelsConnection,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorNode {
    pub login: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RepositoryNode {
    pub name: String,
    pub owner: OwnerNode,
}

#[derive(Debug, Deserialize)]
pub struct OwnerNode {
    pub login: String,
}

#[derive(Debug, Deserialize)]
pub struct LabelsConnection {
    pub nodes: Vec<LabelNode>,
}

#[derive(Debug, Deserialize)]
pub struct LabelNode {
    pub name: String,
    pub color: String,
}

// ============================================
// Linked Issues Status Types (Projects V2)
// ============================================

/// Response for PR linked issues status query
#[derive(Debug, Deserialize)]
pub struct LinkedIssuesResponse {
    pub data: LinkedIssuesData,
}

#[derive(Debug, Deserialize)]
pub struct LinkedIssuesData {
    pub nodes: Vec<Option<PRWithClosingIssues>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PRWithClosingIssues {
    pub id: String,
    pub closing_issues_references: ClosingIssuesConnection,
}

#[derive(Debug, Deserialize)]
pub struct ClosingIssuesConnection {
    pub nodes: Vec<LinkedIssueNode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkedIssueNode {
    pub project_items: ProjectItemsConnection,
}

#[derive(Debug, Deserialize)]
pub struct ProjectItemsConnection {
    pub nodes: Vec<ProjectItemNode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectItemNode {
    pub field_value_by_name: Option<ProjectFieldValue>,
}

#[derive(Debug, Deserialize)]
pub struct ProjectFieldValue {
    pub name: Option<String>,
}

/// OAuth Device Flow response
#[derive(Debug, Deserialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: i32,
    pub interval: i32,
}

/// OAuth token response
#[derive(Debug, Deserialize)]
pub struct AccessTokenResponse {
    pub access_token: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

/// Token verification response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenVerification {
    pub valid: bool,
    pub login: Option<String>,
    pub avatar_url: Option<String>,
}

impl SearchNode {
    pub fn to_notification_item(&self) -> NotificationItem {
        match self {
            SearchNode::Issue(issue) => NotificationItem {
                id: issue.id.clone(),
                number: issue.number,
                title: issue.title.clone(),
                url: issue.url.clone(),
                state: parse_state(&issue.state),
                item_type: NotificationType::Issue,
                created_at: issue.created_at,
                updated_at: issue.updated_at,
                author: issue.author.as_ref().map(|a| GitHubUser {
                    login: a.login.clone(),
                    avatar_url: a.avatar_url.clone(),
                }),
                repository: Repository {
                    name: issue.repository.name.clone(),
                    owner: RepositoryOwner {
                        login: issue.repository.owner.login.clone(),
                    },
                },
                labels: issue
                    .labels
                    .nodes
                    .iter()
                    .map(|l| Label {
                        name: l.name.clone(),
                        color: l.color.clone(),
                    })
                    .collect(),
                is_read: false,
                is_draft: None,
                review_decision: None,
            },
            SearchNode::PullRequest(pr) => NotificationItem {
                id: pr.id.clone(),
                number: pr.number,
                title: pr.title.clone(),
                url: pr.url.clone(),
                state: parse_pr_state(&pr.state),
                item_type: NotificationType::PullRequest,
                created_at: pr.created_at,
                updated_at: pr.updated_at,
                author: pr.author.as_ref().map(|a| GitHubUser {
                    login: a.login.clone(),
                    avatar_url: a.avatar_url.clone(),
                }),
                repository: Repository {
                    name: pr.repository.name.clone(),
                    owner: RepositoryOwner {
                        login: pr.repository.owner.login.clone(),
                    },
                },
                labels: pr
                    .labels
                    .nodes
                    .iter()
                    .map(|l| Label {
                        name: l.name.clone(),
                        color: l.color.clone(),
                    })
                    .collect(),
                is_read: false,
                is_draft: pr.is_draft,
                review_decision: pr.review_decision.clone(),
            },
        }
    }

}

fn parse_state(state: &str) -> ItemState {
    match state.to_uppercase().as_str() {
        "OPEN" => ItemState::Open,
        "CLOSED" => ItemState::Closed,
        _ => ItemState::Open,
    }
}

fn parse_pr_state(state: &str) -> ItemState {
    match state.to_uppercase().as_str() {
        "OPEN" => ItemState::Open,
        "CLOSED" => ItemState::Closed,
        "MERGED" => ItemState::Merged,
        _ => ItemState::Open,
    }
}

// ============================================
// GitHub REST API Notification Types (Inbox)
// ============================================

/// GitHub REST API notification (from /notifications endpoint)
#[derive(Debug, Deserialize)]
pub struct GitHubNotification {
    pub id: String,
    pub unread: bool,
    pub reason: String,
    pub updated_at: DateTime<Utc>,
    pub subject: NotificationSubject,
    pub repository: NotificationRepository,
}

#[derive(Debug, Deserialize)]
pub struct NotificationSubject {
    pub title: String,
    pub url: Option<String>,
    #[serde(rename = "type")]
    pub subject_type: String,
}

#[derive(Debug, Deserialize)]
pub struct NotificationRepository {
    pub name: String,
    pub full_name: String,
    pub owner: NotificationOwner,
}

#[derive(Debug, Deserialize)]
pub struct NotificationOwner {
    pub login: String,
    pub avatar_url: String,
}

/// Inbox notification item for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxItem {
    pub id: String,
    pub title: String,
    pub url: Option<String>,
    pub reason: String,
    pub unread: bool,
    pub updated_at: DateTime<Utc>,
    pub item_type: String,
    pub repository_name: String,
    pub repository_full_name: String,
    pub owner_login: String,
    pub owner_avatar: String,
}

/// Response wrapper for inbox fetch with ETag support
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxResponse {
    pub items: Vec<InboxItem>,
    pub etag: Option<String>,
    pub poll_interval: u64,
    pub not_modified: bool,
}

impl InboxResponse {
    pub fn not_modified() -> Self {
        Self {
            items: vec![],
            etag: None,
            poll_interval: 60,
            not_modified: true,
        }
    }

    pub fn new(items: Vec<InboxItem>, etag: Option<String>, poll_interval: u64) -> Self {
        Self {
            items,
            etag,
            poll_interval,
            not_modified: false,
        }
    }
}

impl GitHubNotification {
    pub fn to_inbox_item(&self) -> InboxItem {
        // Convert API URL to web URL
        let web_url = self.subject.url.as_ref().map(|url| {
            url.replace("api.github.com/repos", "github.com")
                .replace("/pulls/", "/pull/")
        });

        InboxItem {
            id: self.id.clone(),
            title: self.subject.title.clone(),
            url: web_url,
            reason: self.reason.clone(),
            unread: self.unread,
            updated_at: self.updated_at,
            item_type: self.subject.subject_type.clone(),
            repository_name: self.repository.name.clone(),
            repository_full_name: self.repository.full_name.clone(),
            owner_login: self.repository.owner.login.clone(),
            owner_avatar: self.repository.owner.avatar_url.clone(),
        }
    }
}
