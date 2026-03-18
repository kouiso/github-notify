use rodio::{Decoder, OutputStream, Sink};
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use tauri::{AppHandle, Manager};

use crate::error::AppError;

/// Available notification sounds
#[derive(Debug, Clone, Copy, Default)]
pub enum NotificationSound {
    #[default]
    Default,
    Soft,
    Chime,
}

impl NotificationSound {
    pub fn filename(&self) -> &'static str {
        match self {
            NotificationSound::Default => "notification.mp3",
            NotificationSound::Soft => "notification-soft.mp3",
            NotificationSound::Chime => "notification-chime.mp3",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "soft" => NotificationSound::Soft,
            "chime" => NotificationSound::Chime,
            _ => NotificationSound::Default,
        }
    }
}

/// Play a notification sound
pub fn play_notification_sound(app: &AppHandle, sound: NotificationSound) -> Result<(), AppError> {
    let resource_path = app
        .path()
        .resource_dir()
        .map_err(|e| AppError::Audio(format!("Failed to get resource dir: {}", e)))?
        .join("resources")
        .join("sounds")
        .join(sound.filename());

    play_sound_file(&resource_path)
}

/// Play a sound file from the given path
fn play_sound_file(path: &Path) -> Result<(), AppError> {
    // Check if file exists
    if !path.exists() {
        return Err(AppError::Audio(format!(
            "Sound file not found: {}",
            path.display()
        )));
    }

    // Spawn a thread for audio playback to avoid blocking
    let path = path.to_path_buf();
    std::thread::spawn(move || {
        if let Err(e) = play_sound_blocking(&path) {
            log::error!("Failed to play sound: {}", e);
        }
    });

    Ok(())
}

/// Blocking sound playback (run in separate thread)
fn play_sound_blocking(path: &Path) -> Result<(), AppError> {
    let (_stream, stream_handle) = OutputStream::try_default()
        .map_err(|e| AppError::Audio(format!("Failed to get audio output: {}", e)))?;

    let file = File::open(path)
        .map_err(|e| AppError::Audio(format!("Failed to open sound file: {}", e)))?;

    let source = Decoder::new(BufReader::new(file))
        .map_err(|e| AppError::Audio(format!("Failed to decode audio: {}", e)))?;

    let sink = Sink::try_new(&stream_handle)
        .map_err(|e| AppError::Audio(format!("Failed to create audio sink: {}", e)))?;

    sink.append(source);
    sink.sleep_until_end();

    Ok(())
}
