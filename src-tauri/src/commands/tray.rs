use tauri::AppHandle;

use crate::error::AppError;

/// Update the system tray tooltip with the unread count
#[tauri::command]
pub fn update_tray_badge(app: AppHandle, count: i32) -> Result<(), AppError> {
    if let Some(tray) = app.tray_by_id("main") {
        let tooltip = if count > 0 {
            format!("GitHub Notify - {}件の未読", count)
        } else {
            "GitHub Notify".to_string()
        };
        tray.set_tooltip(Some(&tooltip))
            .map_err(|e| AppError::Notification(format!("Failed to update tray: {}", e)))?;
    }
    Ok(())
}
