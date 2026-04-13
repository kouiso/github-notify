use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;
use wildmatch::WildMatch;

use crate::background::AppState;
use crate::error::AppError;
use crate::github::client::GitHubClient;
use crate::github::types::{InboxItem, LinkedIssueNode, NotificationItem};
use crate::storage;
use crate::storage::config::IssueStatusRule;

/// 指定クエリでGitHub通知を取得する
#[tauri::command]
pub async fn fetch_notifications(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    query: String,
    issue_status_rules: Option<Vec<IssueStatusRule>>,
) -> Result<Vec<NotificationItem>, AppError> {
    let token = storage::get_token(&app)?
        .ok_or_else(|| AppError::Auth("No GitHub token configured".to_string()))?;

    // AppStateの共有Clientを使い接続プールを再利用する
    let client = GitHubClient::with_shared_client(state.http_client.clone(), token);
    let mut items = client.fetch_notifications(&query, 50).await?;

    // Mark items as read based on stored read state
    let read_items = storage::get_read_items(&app)?;
    for item in &mut items {
        item.is_read = read_items.contains(&item.id);
    }

    // Issue Statusルールによるフィルタリング
    let active_rules: Vec<&IssueStatusRule> = issue_status_rules
        .as_ref()
        .map(|rules| rules.iter().filter(|r| r.enabled).collect())
        .unwrap_or_default();

    if !active_rules.is_empty() {
        items = filter_by_issue_status(&client, items, &active_rules).await;
    }

    Ok(items)
}

/// Issue Statusルールに基づいてPRをフィルタリングする。
/// APIエラー時はフォールバックとして全アイテムを返す。
async fn filter_by_issue_status(
    client: &GitHubClient,
    items: Vec<NotificationItem>,
    rules: &[&IssueStatusRule],
) -> Vec<NotificationItem> {
    // 各アイテムにマッチするルールを特定し、チェック対象のPR node IDを収集
    let mut check_targets: Vec<(usize, &IssueStatusRule)> = Vec::new();
    let mut check_ids: Vec<String> = Vec::new();

    for (idx, item) in items.iter().enumerate() {
        let repo_full_name = format!("{}/{}", item.repository.owner.login, item.repository.name);
        if let Some(rule) = find_matching_rule(&repo_full_name, rules) {
            check_targets.push((idx, rule));
            check_ids.push(item.id.clone());
        }
    }

    if check_ids.is_empty() {
        return items;
    }

    // 紐づきissueのステータスを一括取得
    let linked_issues_map = match client.fetch_pr_linked_issue_statuses(&check_ids).await {
        Ok(map) => map,
        Err(e) => {
            log::warn!(
                "Issue Statusの取得に失敗しました。フィルタリングをスキップします: {}",
                e
            );
            return items;
        }
    };

    // フィルタリング: チェック対象でないアイテムは常に保持
    let check_indices: std::collections::HashSet<usize> =
        check_targets.iter().map(|(idx, _)| *idx).collect();

    items
        .into_iter()
        .enumerate()
        .filter(|(idx, item)| {
            if !check_indices.contains(idx) {
                return true; // ルール非対象 → 表示
            }

            let rule = check_targets
                .iter()
                .find(|(i, _)| i == idx)
                .map(|(_, r)| *r)
                .unwrap();

            let linked_issues = linked_issues_map.get(&item.id);

            match linked_issues {
                None => {
                    // クエリ結果に含まれなかった → フォールバックで表示
                    true
                }
                Some(issues) => pr_passes_issue_status_check(issues, &rule.required_statuses),
            }
        })
        .map(|(_, item)| item)
        .collect()
}

/// リポジトリ名にマッチする最初の有効ルールを返す
fn find_matching_rule<'a>(
    repo_full_name: &str,
    rules: &[&'a IssueStatusRule],
) -> Option<&'a IssueStatusRule> {
    rules
        .iter()
        .find(|r| WildMatch::new(&r.repository_pattern).matches(repo_full_name))
        .copied()
}

/// PRが Issue Status チェックをパスするかを判定する。
/// - 紐づくissueが0件 → false（非表示）
/// - 各issueがいずれかのProjectで required_statuses に一致 → true
/// - 1つでもNGなissueがあれば → false
fn pr_passes_issue_status_check(issues: &[LinkedIssueNode], required_statuses: &[String]) -> bool {
    if issues.is_empty() {
        return false;
    }

    issues.iter().all(|issue| {
        issue.project_items.nodes.iter().any(|pi| {
            pi.field_value_by_name
                .as_ref()
                .and_then(|fv| fv.name.as_ref())
                .is_some_and(|status_name| required_statuses.contains(status_name))
        })
    })
}

/// Mark a single item as read
#[tauri::command]
pub fn mark_as_read(app: AppHandle, item_id: String) -> Result<(), AppError> {
    storage::mark_item_as_read(&app, &item_id)
}

/// Mark multiple items as read
#[tauri::command]
pub fn mark_all_as_read(app: AppHandle, item_ids: Vec<String>) -> Result<(), AppError> {
    storage::mark_items_as_read(&app, &item_ids)
}

/// Clear all read items
#[tauri::command]
pub fn clear_read_items(app: AppHandle) -> Result<(), AppError> {
    storage::clear_read_items(&app)
}

/// Send an OS native notification
#[tauri::command]
pub fn send_notification(app: AppHandle, title: String, body: String) -> Result<(), AppError> {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| AppError::Notification(e.to_string()))?;

    Ok(())
}

/// Send an OS native notification with optional sound
#[tauri::command]
pub fn send_notification_with_sound(
    app: AppHandle,
    title: String,
    body: String,
    play_sound: bool,
    sound_type: Option<String>,
) -> Result<(), AppError> {
    // Send OS notification
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| AppError::Notification(e.to_string()))?;

    // Play sound if enabled
    if play_sound {
        let sound =
            crate::audio::NotificationSound::from_str(sound_type.as_deref().unwrap_or("default"));
        if let Err(e) = crate::audio::play_notification_sound(&app, sound) {
            log::warn!("Failed to play notification sound: {}", e);
            // Don't fail the whole command if sound fails
        }
    }

    Ok(())
}

/// Play a notification sound only (no OS notification)
#[tauri::command]
pub fn play_sound(app: AppHandle, sound_type: Option<String>) -> Result<(), AppError> {
    let sound =
        crate::audio::NotificationSound::from_str(sound_type.as_deref().unwrap_or("default"));
    crate::audio::play_notification_sound(&app, sound)
}

// ============================================
// Inbox Commands (REST API - no query needed!)
// ============================================

/// インボックス通知を取得する
#[tauri::command]
pub async fn fetch_inbox(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    all: Option<bool>,
) -> Result<Vec<InboxItem>, AppError> {
    let token = storage::get_token(&app)?
        .ok_or_else(|| AppError::Auth("No GitHub token configured".to_string()))?;

    // AppStateの共有Clientを使い接続プールを再利用する
    let client = GitHubClient::with_shared_client(state.http_client.clone(), token);
    let items = client.fetch_inbox(all.unwrap_or(false)).await?;

    Ok(items)
}

/// インボックスの特定通知を既読にする
#[tauri::command]
pub async fn mark_inbox_read(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    thread_id: String,
) -> Result<(), AppError> {
    let token = storage::get_token(&app)?
        .ok_or_else(|| AppError::Auth("No GitHub token configured".to_string()))?;

    // AppStateの共有Clientを使い接続プールを再利用する
    let client = GitHubClient::with_shared_client(state.http_client.clone(), token);
    client.mark_notification_read(&thread_id).await?;

    Ok(())
}

/// インボックスの全通知を既読にする
#[tauri::command]
pub async fn mark_all_inbox_read(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let token = storage::get_token(&app)?
        .ok_or_else(|| AppError::Auth("No GitHub token configured".to_string()))?;

    // AppStateの共有Clientを使い接続プールを再利用する
    let client = GitHubClient::with_shared_client(state.http_client.clone(), token);
    client.mark_all_notifications_read().await?;

    Ok(())
}
