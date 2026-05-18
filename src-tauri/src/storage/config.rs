use chrono::Utc;
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ReadItem {
    id: String,
    marked_at: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ReadItems {
    items: Vec<ReadItem>,
}

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

/// リポジトリグループ（案件単位でリポジトリをまとめる）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryGroup {
    pub id: String,
    pub name: String,
    pub repositories: Vec<String>,
    pub color: Option<String>,
    #[serde(default)]
    pub enable_desktop_notification: bool,
    #[serde(default)]
    pub notify_reasons: Vec<String>,
    #[serde(default)]
    pub enable_sound: bool,
    #[serde(default = "default_sound_type")]
    pub sound_type: String,
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
    #[serde(default = "default_settings_version")]
    pub version: u32,
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
    #[serde(default)]
    pub onboarding_completed: bool,
    #[serde(default)]
    pub repository_groups: Vec<RepositoryGroup>,
    #[serde(default = "default_global_exclude_reasons")]
    pub global_exclude_reasons: Vec<String>,
}

fn default_true() -> bool {
    true
}

fn default_settings_version() -> u32 {
    1
}

fn default_global_exclude_reasons() -> Vec<String> {
    vec!["subscribed".to_string()]
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            version: default_settings_version(),
            theme: "system".to_string(),
            notification_preset: "none".to_string(),
            custom_reasons: vec![],
            desktop_notifications: true,
            sound_enabled: true,
            custom_filters: default_initial_filters(),
            active_filter_id: Some("dashboard".to_string()),
            onboarding_completed: false,
            repository_groups: vec![],
            global_exclude_reasons: default_global_exclude_reasons(),
        }
    }
}

/// 将来の設定マイグレーションは version を見てここで分岐する。
fn migrate(value: serde_json::Value) -> serde_json::Value {
    value
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

const KEYRING_SERVICE: &str = "github-notify";
const KEYRING_USER: &str = "github_token";

/// tauri-plugin-storeに保存された旧トークンをOS Keychainへ移行する
pub fn migrate_token_to_keychain(app: &tauri::AppHandle) -> Result<(), AppError> {
    // Keychainにアクセスできない場合（dev/sandboxモード等）は移行をスキップ
    match get_token(app) {
        Ok(Some(_)) => return Ok(()),
        Ok(None) => {}
        Err(_) => return Ok(()),
    }

    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Storage(e.to_string()))?;

    if let Some(token) = store
        .get(TOKEN_KEY)
        .and_then(|v| v.as_str().map(|s| s.to_string()))
    {
        save_token(app, &token)?;
        store.delete(TOKEN_KEY);
        let _ = store.save();
        log::info!("トークンをOS Keychainへ移行しました");
    }

    Ok(())
}

/// Keychainが利用可能かどうかを判定する（publicでコマンドからも呼べるようにする）
pub fn is_keychain_available() -> bool {
    match keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        Ok(entry) => {
            // 読み取りテストで利用可能性を確認
            match entry.get_password() {
                Ok(_) | Err(keyring::Error::NoEntry) => true,
                Err(_) => false,
            }
        }
        Err(_) => false,
    }
}

/// Save the GitHub token (Keychain優先、失敗時はtauri-plugin-storeにフォールバック)
pub fn save_token(app: &tauri::AppHandle, token: &str) -> Result<(), AppError> {
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        if entry.set_password(token).is_ok() {
            return Ok(());
        }
        log::warn!("Keychain保存に失敗しました。tauri-plugin-storeにフォールバックします");
    }

    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Storage(e.to_string()))?;
    store.set(TOKEN_KEY, serde_json::json!(token));
    store.save().map_err(|e| AppError::Storage(e.to_string()))?;
    Ok(())
}

/// Get the GitHub token (Keychain優先、なければtauri-plugin-storeから読み取り)
pub fn get_token(app: &tauri::AppHandle) -> Result<Option<String>, AppError> {
    if is_keychain_available() {
        if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER) {
            match entry.get_password() {
                Ok(token) => return Ok(Some(token)),
                Err(keyring::Error::NoEntry) => {}
                Err(_) => {}
            }
        }
    }

    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Storage(e.to_string()))?;
    Ok(store
        .get(TOKEN_KEY)
        .and_then(|v| v.as_str().map(|s| s.to_string())))
}

/// Clear the GitHub token (両方のストレージから削除)
pub fn clear_token(app: &tauri::AppHandle) -> Result<(), AppError> {
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(_) => {}
        }
    }

    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Storage(e.to_string()))?;
    store.delete(TOKEN_KEY);
    let _ = store.save();
    Ok(())
}

fn load_read_items(app: &tauri::AppHandle) -> Result<ReadItems, AppError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Storage(e.to_string()))?;

    let items = store.get(READ_ITEMS_KEY).and_then(|v| {
        match serde_json::from_value::<ReadItems>(v.clone()) {
            Ok(items) => Some(items),
            Err(struct_error) => match serde_json::from_value::<Vec<String>>(v.clone()) {
                Ok(ids) => Some(ReadItems {
                    items: ids
                        .into_iter()
                        .enumerate()
                        .map(|(index, id)| ReadItem {
                            id,
                            marked_at: index as i64,
                        })
                        .collect(),
                }),
                Err(vec_error) => {
                    // デシリアライズ失敗時は警告を出しデフォルト値にフォールバック
                    log::warn!(
                        "read_itemsのデシリアライズに失敗しました（デフォルト値を使用）: {}, {}",
                        struct_error,
                        vec_error
                    );
                    None
                }
            },
        }
    });

    Ok(truncate_read_items(items.unwrap_or_default()))
}

fn truncate_read_items(mut read_items: ReadItems) -> ReadItems {
    let item_count = read_items.items.len();
    if item_count <= MAX_READ_ITEMS {
        return read_items;
    }

    read_items.items.sort_by_key(|item| item.marked_at);
    read_items.items = read_items
        .items
        .into_iter()
        .skip(item_count - MAX_READ_ITEMS)
        .collect();
    read_items
}

/// Get the set of read item IDs
pub fn get_read_items(app: &tauri::AppHandle) -> Result<Vec<String>, AppError> {
    let read_items = load_read_items(app)?;
    Ok(read_items.items.into_iter().map(|item| item.id).collect())
}

/// Add an item to the read items set
pub fn mark_item_as_read(app: &tauri::AppHandle, item_id: &str) -> Result<(), AppError> {
    let mut read_items = load_read_items(app)?;

    if !read_items.items.iter().any(|item| item.id == item_id) {
        read_items.items.push(ReadItem {
            id: item_id.to_string(),
            marked_at: Utc::now().timestamp_millis(),
        });

        save_read_items(app, &truncate_read_items(read_items))?;
    }

    Ok(())
}

/// Mark multiple items as read
pub fn mark_items_as_read(app: &tauri::AppHandle, item_ids: &[String]) -> Result<(), AppError> {
    let mut read_items = load_read_items(app)?;
    let mut marked_at = Utc::now().timestamp_millis();

    for id in item_ids {
        if !read_items.items.iter().any(|item| item.id == *id) {
            read_items.items.push(ReadItem {
                id: id.clone(),
                marked_at,
            });
            marked_at += 1;
        }
    }

    save_read_items(app, &truncate_read_items(read_items))?;
    Ok(())
}

/// Save read items to the store
fn save_read_items(app: &tauri::AppHandle, items: &ReadItems) -> Result<(), AppError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Storage(e.to_string()))?;

    store.set(READ_ITEMS_KEY, serde_json::json!(items));
    store.save().map_err(|e| AppError::Storage(e.to_string()))?;

    Ok(())
}

/// Clear all read items
pub fn clear_read_items(app: &tauri::AppHandle) -> Result<(), AppError> {
    save_read_items(app, &ReadItems::default())
}

/// Get application settings
pub fn get_settings(app: &tauri::AppHandle) -> Result<AppSettings, AppError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| AppError::Storage(e.to_string()))?;

    let settings = store.get(SETTINGS_KEY).and_then(|v| {
        // デシリアライズ失敗時は警告を出しデフォルト値にフォールバック
        match serde_json::from_value::<AppSettings>(migrate(v.clone())) {
            Ok(s) => Some(s),
            Err(e) => {
                log::warn!(
                    "app_settingsのデシリアライズに失敗しました（デフォルト値を使用）: {}",
                    e
                );
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncate_read_items_keeps_newest_by_marked_at() {
        let read_items = ReadItems {
            items: (0..(MAX_READ_ITEMS + 50))
                .map(|index| ReadItem {
                    id: format!("item-{index}"),
                    marked_at: index as i64,
                })
                .collect(),
        };

        let truncated = truncate_read_items(read_items);

        assert_eq!(truncated.items.len(), MAX_READ_ITEMS);
        assert!(truncated.items.iter().all(|item| item.marked_at >= 50));
        assert!(truncated.items.iter().any(|item| item.id == "item-50"));
        assert!(truncated
            .items
            .iter()
            .any(|item| item.id == format!("item-{}", MAX_READ_ITEMS + 49)));
    }
}
