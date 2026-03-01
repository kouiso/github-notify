use crate::error::AppError;
use crate::storage::config::{self, AppSettings};

/// Get application settings
#[tauri::command]
pub async fn get_app_settings(app: tauri::AppHandle) -> Result<AppSettings, AppError> {
    config::get_settings(&app)
}

/// Save application settings
#[tauri::command]
pub async fn save_app_settings(
    app: tauri::AppHandle,
    settings: AppSettings,
) -> Result<(), AppError> {
    config::save_settings(&app, &settings)
}
