use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};
use tokio::time::sleep;

use crate::error::AppError;
use crate::github::client::GitHubClient;
use crate::storage;

/// バックグラウンドポーリングサービス
pub struct PollingService {
    stop_tx: Option<mpsc::Sender<()>>,
    /// タスクが実際に生存しているかを追跡するフラグ。
    /// stop_txの有無だけでは送信後の終了遅延を検知できないため、別途管理する。
    is_alive: Arc<AtomicBool>,
}

impl PollingService {
    pub fn new() -> Self {
        Self {
            stop_tx: None,
            is_alive: Arc::new(AtomicBool::new(false)),
        }
    }

    /// バックグラウンドポーリングを開始する
    pub async fn start(&mut self, app: AppHandle, http_client: reqwest::Client) -> Result<(), AppError> {
        // ストレージからトークンを取得
        let token = storage::get_token(&app)?
            .ok_or_else(|| AppError::Auth("No token available".to_string()))?;

        let (stop_tx, mut stop_rx) = mpsc::channel::<()>(1);
        self.stop_tx = Some(stop_tx);

        // 生存フラグを立てる
        let is_alive = Arc::clone(&self.is_alive);
        is_alive.store(true, Ordering::SeqCst);

        // ETagとポーリング間隔の共有状態
        let last_etag: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
        let poll_interval_secs: Arc<Mutex<u64>> = Arc::new(Mutex::new(60));

        let app_handle = app.clone();

        tauri::async_runtime::spawn(async move {
            // 共有Clientを使ってGitHubClientを生成（接続プール再利用）
            let client = GitHubClient::with_shared_client(http_client, token);

            loop {
                let current_interval = *poll_interval_secs.lock().await;

                tokio::select! {
                    // interval()の代わりにsleepを使い、毎ループで間隔を再評価できるようにする
                    _ = sleep(Duration::from_secs(current_interval)) => {
                        let etag = last_etag.lock().await.clone();
                        match client.fetch_inbox_with_etag(false, etag.as_deref()).await {
                            Ok(response) => {
                                // GitHubが推奨するポーリング間隔に更新
                                *poll_interval_secs.lock().await = response.poll_interval;

                                if response.not_modified {
                                    log::debug!("変更なし (304 Not Modified)");
                                } else {
                                    if let Some(new_etag) = response.etag {
                                        *last_etag.lock().await = Some(new_etag);
                                    }

                                    if let Err(e) = app_handle.emit("inbox-updated", &response.items) {
                                        log::error!("inbox-updatedイベントの送信に失敗: {}", e);
                                    } else {
                                        log::info!("inbox-updatedを{}件で送信", response.items.len());
                                    }
                                }
                            }
                            Err(e) => {
                                log::error!("ポーリングエラー: {}", e);
                            }
                        }
                    }
                    _ = stop_rx.recv() => {
                        log::info!("ポーリングサービスを停止");
                        break;
                    }
                }
            }

            // ループ終了時に生存フラグを下ろす
            is_alive.store(false, Ordering::SeqCst);
        });

        log::info!("バックグラウンドポーリングサービスを開始");
        Ok(())
    }

    /// バックグラウンドポーリングを停止する
    pub fn stop(&mut self) {
        if let Some(tx) = self.stop_tx.take() {
            let _ = tx.try_send(());
            log::info!("ポーリング停止シグナルを送信");
        }
    }

    /// ポーリングタスクが実際に生存しているか確認する。
    /// stop_txの有無ではなくAtomicBoolで判定するため、停止遷移中の状態も正確に反映する。
    pub fn is_running(&self) -> bool {
        self.is_alive.load(Ordering::SeqCst)
    }
}

impl Default for PollingService {
    fn default() -> Self {
        Self::new()
    }
}

/// アプリケーション状態。共有reqwest::Clientを保持し接続プールを再利用する。
pub struct AppState {
    pub polling: Arc<Mutex<PollingService>>,
    /// 全コマンドで共有するHTTPクライアント（接続プール・TLS設定を共有）
    pub http_client: reqwest::Client,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            polling: Arc::new(Mutex::new(PollingService::new())),
            http_client: reqwest::Client::new(),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// ポーリングサービスを開始するTauriコマンド
#[tauri::command]
pub async fn start_polling(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let mut polling = state.polling.lock().await;
    if polling.is_running() {
        return Ok(());
    }
    polling.start(app, state.http_client.clone()).await
}

/// ポーリングサービスを停止するTauriコマンド
#[tauri::command]
pub async fn stop_polling(state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let mut polling = state.polling.lock().await;
    polling.stop();
    Ok(())
}

/// ポーリング稼働状態を確認するTauriコマンド
#[tauri::command]
pub async fn is_polling_running(state: tauri::State<'_, AppState>) -> Result<bool, AppError> {
    let polling = state.polling.lock().await;
    Ok(polling.is_running())
}
