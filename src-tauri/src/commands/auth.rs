use serde::Serialize;
use tauri::AppHandle;

use crate::background::AppState;
use crate::error::AppError;
use crate::github::client::GitHubClient;
use crate::github::types::TokenVerification;
use crate::log_sanitizer;
use crate::storage;

/// Device flow response returned to frontend
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFlowInfo {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: i32,
    pub interval: i32,
}

/// GitHub OAuthデバイスフロー認証を開始する
#[tauri::command]
pub async fn start_device_flow(
    state: tauri::State<'_, AppState>,
) -> Result<DeviceFlowInfo, AppError> {
    // トークン取得前のため空トークンでClientのみ共有する
    let client = GitHubClient::with_shared_client(state.http_client.clone(), String::new());
    let response = client.start_device_flow().await?;

    Ok(DeviceFlowInfo {
        device_code: response.device_code,
        user_code: response.user_code,
        verification_uri: response.verification_uri,
        expires_in: response.expires_in,
        interval: response.interval,
    })
}

/// デバイスフローのアクセストークンをポーリングする
#[tauri::command]
pub async fn poll_device_flow(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    device_code: String,
    interval: Option<i32>,
) -> Result<TokenVerification, AppError> {
    // トークン取得前のため空トークンでClientのみ共有する
    let client = GitHubClient::with_shared_client(state.http_client.clone(), String::new());
    let response = client.poll_for_token(&device_code).await?;

    // Check if we got an error
    if let Some(error) = response.error {
        return handle_device_flow_error(error, response.error_description, interval.unwrap_or(5));
    }

    // Check if we got a token
    if let Some(token) = response.access_token {
        // Save the token
        storage::save_token(&app, &token)?;

        // トークン取得完了後は共有Clientを使って検証する
        let client = GitHubClient::with_shared_client(state.http_client.clone(), token);
        let verification = client.verify_token().await?;
        return Ok(verification);
    }

    Ok(TokenVerification {
        valid: false,
        login: None,
        avatar_url: None,
        poll_interval: None,
    })
}

fn pending_verification(poll_interval: Option<i32>) -> TokenVerification {
    TokenVerification {
        valid: false,
        login: None,
        avatar_url: None,
        poll_interval,
    }
}

fn handle_device_flow_error(
    error: String,
    error_description: Option<String>,
    current_interval: i32,
) -> Result<TokenVerification, AppError> {
    match error.as_str() {
        "authorization_pending" => Ok(pending_verification(None)),
        "slow_down" => {
            let next_interval = current_interval.saturating_add(5);
            log::info!("oauth slow_down received; polling interval bumped to {next_interval}s");
            Ok(pending_verification(Some(next_interval)))
        }
        "expired_token" => Err(AppError::Auth(
            "Device code expired. Please restart authentication.".to_string(),
        )),
        "access_denied" => Err(AppError::Auth("Access was denied by user.".to_string())),
        _ => Err(AppError::Auth(format!(
            "Authentication error: {}",
            error_description.unwrap_or(error)
        ))),
    }
}

/// GitHubトークンを保存・検証する（PAT入力時）
#[tauri::command]
pub async fn save_github_token(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    token: String,
) -> Result<TokenVerification, AppError> {
    // AppStateの共有Clientを使い接続プールを再利用する
    let client = GitHubClient::with_shared_client(state.http_client.clone(), token.clone());
    let verification = client.verify_token().await?;

    if verification.valid {
        storage::save_token(&app, &token)?;
    }

    Ok(verification)
}

/// Get the current GitHub token
#[tauri::command]
pub fn get_github_token(app: AppHandle) -> Result<Option<String>, AppError> {
    storage::get_token(&app)
}

/// 保存済みトークンを検証する
#[tauri::command]
pub async fn verify_github_token(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<TokenVerification, AppError> {
    let token = storage::get_token(&app)?;

    match token {
        Some(t) => {
            // AppStateの共有Clientを使い接続プールを再利用する
            let client = GitHubClient::with_shared_client(state.http_client.clone(), t);
            client.verify_token().await
        }
        None => Ok(TokenVerification {
            valid: false,
            login: None,
            avatar_url: None,
            poll_interval: None,
        }),
    }
}

/// Clear the stored GitHub token
#[tauri::command]
pub fn clear_github_token(app: AppHandle) -> Result<(), AppError> {
    storage::clear_token(&app)?;
    log_sanitizer::clear_remembered_token();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::handle_device_flow_error;

    #[test]
    fn slow_down_returns_bumped_poll_interval() {
        let result = handle_device_flow_error("slow_down".to_string(), None, 5).unwrap();

        assert!(!result.valid);
        assert_eq!(result.poll_interval, Some(10));
    }
}
