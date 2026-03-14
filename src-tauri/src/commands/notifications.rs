use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::background::AppState;
use crate::error::AppError;
use crate::github::client::GitHubClient;
use crate::github::types::{InboxItem, NotificationItem};
use crate::storage;

/// 指定クエリでGitHub通知を取得する
#[tauri::command]
pub async fn fetch_notifications(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    query: String,
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

    Ok(items)
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
