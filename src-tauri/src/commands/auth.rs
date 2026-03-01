use serde::Serialize;
use tauri::AppHandle;

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

/// Start GitHub OAuth device flow authentication
#[tauri::command]
pub async fn start_device_flow() -> Result<DeviceFlowInfo, AppError> {
    let client = GitHubClient::new();
    let response = client.start_device_flow().await?;

    Ok(DeviceFlowInfo {
        device_code: response.device_code,
        user_code: response.user_code,
        verification_uri: response.verification_uri,
        expires_in: response.expires_in,
        interval: response.interval,
    })
}

/// Poll for access token during device flow
#[tauri::command]
pub async fn poll_device_flow(
    app: AppHandle,
    device_code: String,
) -> Result<TokenVerification, AppError> {
    let client = GitHubClient::new();
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

        // Verify and get user info
        let client = GitHubClient::with_token(token);
        let verification = client.verify_token().await?;
        return Ok(verification);
    }

    Ok(TokenVerification {
        valid: false,
        login: None,
        avatar_url: None,
    })
}

/// Save and verify a GitHub token (for PAT fallback)
#[tauri::command]
pub async fn save_github_token(
    app: AppHandle,
    token: String,
) -> Result<TokenVerification, AppError> {
    let client = GitHubClient::with_token(token.clone());
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

/// Verify the stored token
#[tauri::command]
pub async fn verify_github_token(app: AppHandle) -> Result<TokenVerification, AppError> {
    let token = storage::get_token(&app)?;

    match token {
        Some(t) => {
            let client = GitHubClient::with_token(t);
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
