use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};
use tokio::time::interval;

use crate::error::AppError;
use crate::github::client::GitHubClient;
use crate::storage;

/// Background polling service for GitHub notifications
pub struct PollingService {
    stop_tx: Option<mpsc::Sender<()>>,
}

impl PollingService {
    pub fn new() -> Self {
        Self { stop_tx: None }
    }

    /// Start the background polling service
    pub async fn start(&mut self, app: AppHandle) -> Result<(), AppError> {
        // Get token from storage
        let token = storage::get_token(&app)?
            .ok_or_else(|| AppError::Auth("No token available".to_string()))?;

        let (stop_tx, mut stop_rx) = mpsc::channel::<()>(1);
        self.stop_tx = Some(stop_tx);

        // Shared state for ETag and poll interval
        let last_etag: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
        let poll_interval: Arc<Mutex<u64>> = Arc::new(Mutex::new(60));

        let app_handle = app.clone();

        tauri::async_runtime::spawn(async move {
            let client = GitHubClient::with_token(token);

            loop {
                let current_interval = *poll_interval.lock().await;
                let mut timer = interval(Duration::from_secs(current_interval));

                tokio::select! {
                    _ = timer.tick() => {
                        // Perform the fetch with ETag
                        let etag = last_etag.lock().await.clone();
                        match client.fetch_inbox_with_etag(false, etag.as_deref()).await {
                            Ok(response) => {
                                // Update poll interval from GitHub's recommendation
                                *poll_interval.lock().await = response.poll_interval;

                                if response.not_modified {
                                    log::debug!("No changes detected (304 Not Modified)");
                                } else {
                                    // Update ETag
                                    if let Some(new_etag) = response.etag {
                                        *last_etag.lock().await = Some(new_etag);
                                    }

                                    // Emit event to frontend with new items
                                    if let Err(e) = app_handle.emit("inbox-updated", &response.items) {
                                        log::error!("Failed to emit inbox-updated event: {}", e);
                                    } else {
                                        log::info!("Emitted inbox-updated with {} items", response.items.len());
                                    }
                                }
                            }
                            Err(e) => {
                                log::error!("Polling error: {}", e);
                            }
                        }
                    }
                    _ = stop_rx.recv() => {
                        log::info!("Polling service stopped");
                        break;
                    }
                }
            }
        });

        log::info!("Background polling service started");
        Ok(())
    }

    /// Stop the background polling service
    pub fn stop(&mut self) {
        if let Some(tx) = self.stop_tx.take() {
            let _ = tx.try_send(());
            log::info!("Polling service stop signal sent");
        }
    }

    /// Check if the polling service is running
    pub fn is_running(&self) -> bool {
        self.stop_tx.is_some()
    }
}

impl Default for PollingService {
    fn default() -> Self {
        Self::new()
    }
}

/// Application state for managing background services
pub struct AppState {
    pub polling: Arc<Mutex<PollingService>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            polling: Arc::new(Mutex::new(PollingService::new())),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// Tauri command to start the polling service
#[tauri::command]
pub async fn start_polling(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut polling = state.polling.lock().await;
    if polling.is_running() {
        return Ok(());
    }
    polling.start(app).await.map_err(|e| e.to_string())
}

/// Tauri command to stop the polling service
#[tauri::command]
pub async fn stop_polling(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut polling = state.polling.lock().await;
    polling.stop();
    Ok(())
}

/// Tauri command to check polling status
#[tauri::command]
pub async fn is_polling_running(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let polling = state.polling.lock().await;
    Ok(polling.is_running())
}
