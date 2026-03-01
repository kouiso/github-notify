use tauri::AppHandle;

use crate::error::AppError;
use crate::storage::{self, Stream};

/// Get all streams
#[tauri::command]
pub fn get_streams(app: AppHandle) -> Result<Vec<Stream>, AppError> {
    storage::get_streams(&app)
}

/// Create a new stream
#[tauri::command]
pub fn create_stream(app: AppHandle, name: String, query: String) -> Result<Stream, AppError> {
    let mut streams = storage::get_streams(&app)?;
    let stream = Stream::new(name, query);
    streams.push(stream.clone());
    storage::save_streams(&app, &streams)?;
    Ok(stream)
}

/// Update an existing stream
#[tauri::command]
pub fn update_stream(
    app: AppHandle,
    id: String,
    name: String,
    query: String,
    icon: Option<String>,
    color: Option<String>,
) -> Result<Stream, AppError> {
    let mut streams = storage::get_streams(&app)?;

    let stream = streams
        .iter_mut()
        .find(|s| s.id == id)
        .ok_or_else(|| AppError::Storage(format!("Stream not found: {}", id)))?;

    stream.name = name;
    stream.query = query;
    stream.icon = icon;
    stream.color = color;

    let updated = stream.clone();
    storage::save_streams(&app, &streams)?;

    Ok(updated)
}

/// Delete a stream
#[tauri::command]
pub fn delete_stream(app: AppHandle, id: String) -> Result<(), AppError> {
    let mut streams = storage::get_streams(&app)?;
    streams.retain(|s| s.id != id);
    storage::save_streams(&app, &streams)?;
    Ok(())
}

/// Reorder streams
#[tauri::command]
pub fn reorder_streams(app: AppHandle, ids: Vec<String>) -> Result<Vec<Stream>, AppError> {
    let streams = storage::get_streams(&app)?;

    // Reorder based on provided IDs
    let mut reordered: Vec<Stream> = Vec::new();
    for id in &ids {
        if let Some(stream) = streams.iter().find(|s| &s.id == id) {
            reordered.push(stream.clone());
        }
    }

    // Add any streams not in the provided IDs (shouldn't happen, but safety)
    for stream in &streams {
        if !ids.contains(&stream.id) {
            reordered.push(stream.clone());
        }
    }

    storage::save_streams(&app, &reordered)?;
    Ok(reordered)
}

/// Update unread count for a stream
#[tauri::command]
pub fn update_stream_unread_count(app: AppHandle, id: String, count: i32) -> Result<(), AppError> {
    let mut streams = storage::get_streams(&app)?;

    if let Some(stream) = streams.iter_mut().find(|s| s.id == id) {
        stream.unread_count = count;
        storage::save_streams(&app, &streams)?;
    }

    Ok(())
}
