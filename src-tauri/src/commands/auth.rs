use serde::Serialize;
use tauri::AppHandle;

use crate::background::AppState;
use crate::error::AppError;
use crate::github::client::GitHubClient;
use crate::github::types::TokenVerification;
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
) -> Result<TokenVerification, AppError> {
    // トークン取得前のため空トークンでClientのみ共有する
    let client = GitHubClient::with_shared_client(state.http_client.clone(), String::new());
    let response = client.poll_for_token(&device_code).await?;

    // Check if we got an error
    if let Some(error) = response.error {
        if error == "authorization_pending" {
            return Ok(TokenVerification {
                valid: false,
                login: None,
                avatar_url: None,
            });
        }
        if error == "slow_down" {
            return Ok(TokenVerification {
                valid: false,
                login: None,
                avatar_url: None,
            });
        }
        if error == "expired_token" {
            return Err(AppError::Auth(
                "Device code expired. Please restart authentication.".to_string(),
            ));
        }
        if error == "access_denied" {
            return Err(AppError::Auth("Access was denied by user.".to_string()));
        }
        return Err(AppError::Auth(format!(
            "Authentication error: {}",
            response.error_description.unwrap_or(error)
        )));
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
    })
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
        }),
    }
}

/// Clear the stored GitHub token
#[tauri::command]
pub fn clear_github_token(app: AppHandle) -> Result<(), AppError> {
    storage::clear_token(&app)
}
