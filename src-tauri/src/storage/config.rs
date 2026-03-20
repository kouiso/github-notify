use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;

use crate::error::AppError;

const STORE_FILE: &str = "github-notify.json";
const TOKEN_KEY: &str = "github_token";
const READ_ITEMS_KEY: &str = "read_items";
const SETTINGS_KEY: &str = "app_settings";

/// Maximum number of read items to keep in storage (retain last N days worth)
/// GitHub API keeps notifications for 30 days, so we keep 60 days worth for safety
const MAX_READ_ITEMS: usize = 10_000;

/// リポジトリ別Issue Status条件ルール
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueStatusRule {
    /// リポジトリパターン (e.g. "getozinc/mypappy-*")。ワイルドカード `*` サポート
    pub repository_pattern: String,
    /// 紐づく全issueに要求するGitHub Projects V2 Statusフィールド値
    pub required_statuses: Vec<String>,
    /// ルール有効/無効
    pub enabled: bool,
}

/// Custom filter group (user-created)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFilter {
    pub id: String,
    pub name: String,
    pub reasons: Vec<String>,
    pub enable_desktop_notification: bool,
    #[serde(default)]
    pub enable_sound: bool,
    #[serde(default = "default_sound_type")]
    pub sound_type: String,
    #[serde(default)]
    pub repositories: Vec<String>,
    #[serde(default)]
    pub search_query: Option<String>,
    #[serde(default)]
    pub issue_status_rules: Vec<IssueStatusRule>,
}

fn default_sound_type() -> String {
    "default".to_string()
}

/// Application settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub notification_preset: String,
    pub custom_reasons: Vec<String>,
    pub desktop_notifications: bool,
    #[serde(default = "default_true")]
    pub sound_enabled: bool,
    #[serde(default = "default_initial_filters")]
    pub custom_filters: Vec<CustomFilter>,
    #[serde(default)]
    pub active_filter_id: Option<String>,
}

fn default_true() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            notification_preset: "none".to_string(),
            custom_reasons: vec![],
            desktop_notifications: true,
            sound_enabled: true,
            custom_filters: default_initial_filters(),
            active_filter_id: Some("dashboard".to_string()),
        }
    }
}

/// Default views matching frontend DEFAULT_INITIAL_FILTERS (settings.ts)
fn default_initial_filters() -> Vec<CustomFilter> {
    vec![
        CustomFilter {
            id: "default-important".to_string(),
            name: "重要な通知".to_string(),
            reasons: vec![
                "review_requested".to_string(),
                "mention".to_string(),
                "team_mention".to_string(),
                "assign".to_string(),
                "author".to_string(),
            ],
            enable_desktop_notification: true,
            enable_sound: true,
            sound_type: "default".to_string(),
            repositories: vec![],
            search_query: None,
            issue_status_rules: vec![],
        },
        CustomFilter {
            id: "default-needs-review".to_string(),
            name: "Needs My Review".to_string(),
            reasons: vec![],
            enable_desktop_notification: false,
            enable_sound: false,
            sound_type: "default".to_string(),
            repositories: vec![],
            search_query: Some("is:open is:pr review-requested:@me -reviewed-by:@me".to_string()),
            issue_status_rules: vec![],
        },
        CustomFilter {
            id: "default-my-prs".to_string(),
            name: "My PRs".to_string(),
            reasons: vec![],
            enable_desktop_notification: false,
            enable_sound: false,
            sound_type: "default".to_string(),
            repositories: vec![],
            search_query: Some("is:open is:pr author:@me".to_string()),
            issue_status_rules: vec![],
        },
    ]
}

/// Save the GitHub token to the store
pub fn save_token(app: &tauri::AppHandle, token: &str) -> Result<(), AppError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Storage(e.to_string()))?;

    store.set(TOKEN_KEY, serde_json::json!(token));
    store.save().map_err(|e| AppError::Storage(e.to_string()))?;

    Ok(())
}

/// Get the GitHub token from the store
pub fn get_token(app: &tauri::AppHandle) -> Result<Option<String>, AppError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Storage(e.to_string()))?;

    let token = store
        .get(TOKEN_KEY)
        .and_then(|v| v.as_str().map(|s| s.to_string()));

    Ok(token)
}

/// Clear the GitHub token from the store
pub fn clear_token(app: &tauri::AppHandle) -> Result<(), AppError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Storage(e.to_string()))?;

    store.delete(TOKEN_KEY);
    store.save().map_err(|e| AppError::Storage(e.to_string()))?;

    Ok(())
}

/// Get the set of read item IDs
pub fn get_read_items(app: &tauri::AppHandle) -> Result<Vec<String>, AppError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Storage(e.to_string()))?;

    let items = store.get(READ_ITEMS_KEY).and_then(|v| {
        // デシリアライズ失敗時は警告を出しデフォルト値にフォールバック
        match serde_json::from_value::<Vec<String>>(v.clone()) {
            Ok(items) => Some(items),
            Err(e) => {
                log::warn!("read_itemsのデシリアライズに失敗しました（デフォルト値を使用）: {}", e);
                None
            }
        }
    });

    Ok(items.unwrap_or_default())
}

/// Add an item to the read items set
pub fn mark_item_as_read(app: &tauri::AppHandle, item_id: &str) -> Result<(), AppError> {
    let mut read_items = get_read_items(app)?;

    if !read_items.contains(&item_id.to_string()) {
        read_items.push(item_id.to_string());

        // Trim to max size (keep most recent items)
        if read_items.len() > MAX_READ_ITEMS {
            let start = read_items.len() - MAX_READ_ITEMS;
            read_items = read_items[start..].to_vec();
        }

        save_read_items(app, &read_items)?;
    }

    Ok(())
}

/// Mark multiple items as read
pub fn mark_items_as_read(app: &tauri::AppHandle, item_ids: &[String]) -> Result<(), AppError> {
    let mut read_items = get_read_items(app)?;

    for id in item_ids {
        if !read_items.contains(id) {
            read_items.push(id.clone());
        }
    }

    // Trim to max size (keep most recent items)
    if read_items.len() > MAX_READ_ITEMS {
        let start = read_items.len() - MAX_READ_ITEMS;
        read_items = read_items[start..].to_vec();
    }

    save_read_items(app, &read_items)?;
    Ok(())
}

/// Save read items to the store
fn save_read_items(app: &tauri::AppHandle, items: &[String]) -> Result<(), AppError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Storage(e.to_string()))?;

    store.set(READ_ITEMS_KEY, serde_json::json!(items));
    store.save().map_err(|e| AppError::Storage(e.to_string()))?;

    Ok(())
}

/// Clear all read items
pub fn clear_read_items(app: &tauri::AppHandle) -> Result<(), AppError> {
    save_read_items(app, &[])
}

/// Get application settings
pub fn get_settings(app: &tauri::AppHandle) -> Result<AppSettings, AppError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Storage(e.to_string()))?;

    let settings = store.get(SETTINGS_KEY).and_then(|v| {
        // デシリアライズ失敗時は警告を出しデフォルト値にフォールバック
        match serde_json::from_value::<AppSettings>(v.clone()) {
            Ok(s) => Some(s),
            Err(e) => {
                log::warn!("app_settingsのデシリアライズに失敗しました（デフォルト値を使用）: {}", e);
                None
            }
        }
    });

    Ok(settings.unwrap_or_default())
}

/// Save application settings
pub fn save_settings(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), AppError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Storage(e.to_string()))?;

    store.set(SETTINGS_KEY, serde_json::json!(settings));
    store.save().map_err(|e| AppError::Storage(e.to_string()))?;

    Ok(())
}
