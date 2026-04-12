use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};
use tokio::time::sleep;

use crate::error::AppError;
use crate::github::client::GitHubClient;
use crate::github::types::InboxItem;
use crate::storage;

/// 初回ポーリング間隔（秒）。GitHub の X-Poll-Interval が返ってきたらそれに更新される。
/// アサイン通知への反応速度のため、デフォルトの 60 秒より短く設定している。
const INITIAL_POLL_INTERVAL_SECS: u64 = 20;

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
        let poll_interval_secs: Arc<Mutex<u64>> = Arc::new(Mutex::new(INITIAL_POLL_INTERVAL_SECS));

        let app_handle = app.clone();

        tauri::async_runtime::spawn(async move {
            // 共有Clientを使ってGitHubClientを生成（接続プール再利用）
            let client = GitHubClient::with_shared_client(http_client, token);

            // viewer login をキャッシュ。アサイン解除検知の比較に使う。
            // 取得失敗時もポーリング自体は継続するため、Optionで保持する。
            let viewer_login: Option<String> = match client.verify_token().await {
                Ok(v) => v.login,
                Err(e) => {
                    log::warn!("viewer login の取得に失敗（アサイン解除検知は無効化）: {}", e);
                    None
                }
            };

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

                                    let mut items = response.items;

                                    // アサイン解除検知: GitHubはunassignを通知に出さないため、
                                    // assign reasonの未読Issueについて現在のアサイン状況を確認し、
                                    // 自分が外れていたら該当通知を既読化してリストからも除く。
                                    if let Some(login) = viewer_login.as_deref() {
                                        let removed = verify_assignments(&client, &mut items, login).await;
                                        if removed > 0 {
                                            log::info!("アサイン解除を{}件検出して既読化", removed);
                                        }
                                    }

                                    if let Err(e) = app_handle.emit("inbox-updated", &items) {
                                        log::error!("inbox-updatedイベントの送信に失敗: {}", e);
                                    } else {
                                        log::info!("inbox-updatedを{}件で送信", items.len());
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

/// assign reason の未読通知について、実際のアサイン状況を API で確認し、
/// 自分がアサインされていなければ該当通知を既読化してリストから除外する。
/// 戻り値は除外した件数。
async fn verify_assignments(
    client: &GitHubClient,
    items: &mut Vec<InboxItem>,
    viewer_login: &str,
) -> usize {
    let mut to_remove: Vec<String> = Vec::new();

    for item in items.iter() {
        if item.reason != "assign" || !item.unread {
            continue;
        }

        let parts: Vec<&str> = item.repository_full_name.splitn(2, '/').collect();
        if parts.len() != 2 {
            continue;
        }
        let (owner, repo) = (parts[0], parts[1]);

        // URL から Issue 番号を抽出 (e.g. ".../issues/42" or ".../pull/42")
        let issue_number = item
            .url
            .as_deref()
            .and_then(|u| u.rsplit('/').next())
            .and_then(|n| n.parse::<u64>().ok());

        let Some(number) = issue_number else {
            continue;
        };

        match client.fetch_issue_assignees(owner, repo, number).await {
            Ok(assignees) => {
                let still_assigned = assignees
                    .iter()
                    .any(|a| a.eq_ignore_ascii_case(viewer_login));
                if !still_assigned {
                    log::info!(
                        "アサイン解除を検知: {}/{}#{} (viewer={})",
                        owner,
                        repo,
                        number,
                        viewer_login
                    );
                    // 既読化を試みる（失敗しても除外は続行）
                    let _ = client.mark_notification_read(&item.id).await;
                    to_remove.push(item.id.clone());
                }
            }
            Err(e) => {
                log::warn!(
                    "アサイン確認に失敗 ({}/{}#{}): {}",
                    owner,
                    repo,
                    number,
                    e
                );
            }
        }
    }

    let removed_count = to_remove.len();
    items.retain(|item| !to_remove.contains(&item.id));
    removed_count
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
