use tauri::{AppHandle, Runtime};

use crate::settings::Settings;
use crate::{settings, shortcut, trello, windows};

#[tauri::command]
pub fn get_settings<R: Runtime>(app: AppHandle<R>) -> Settings {
    settings::load(&app)
}

#[tauri::command]
pub fn save_settings<R: Runtime>(app: AppHandle<R>, settings: Settings) -> Result<(), String> {
    crate::settings::save(&app, &settings)?;
    // Keep the OS autostart entry in sync with the persisted preference.
    sync_autostart(&app, settings.launch_at_startup);
    Ok(())
}

#[tauri::command]
pub async fn trello_get_boards(key: String, token: String) -> Result<Vec<trello::Board>, String> {
    trello::get_boards(&key, &token).await
}

#[tauri::command]
pub async fn trello_get_lists(
    key: String,
    token: String,
    board_id: String,
) -> Result<Vec<trello::List>, String> {
    trello::get_lists(&key, &token, &board_id).await
}

#[tauri::command]
pub async fn trello_create_card(
    key: String,
    token: String,
    list_id: String,
    name: String,
) -> Result<trello::Card, String> {
    trello::create_card(&key, &token, &list_id, &name).await
}

#[tauri::command]
pub fn register_shortcut<R: Runtime>(app: AppHandle<R>, accelerator: String) -> Result<(), String> {
    shortcut::re_register(&app, &accelerator)?;
    let mut s = settings::load(&app);
    s.shortcut = accelerator;
    settings::save(&app, &s)?;
    Ok(())
}

#[tauri::command]
pub fn set_autostart<R: Runtime>(app: AppHandle<R>, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let mgr = app.autolaunch();
    if enabled {
        mgr.enable().map_err(|e| e.to_string())
    } else {
        mgr.disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn show_capture<R: Runtime>(app: AppHandle<R>) {
    windows::show_capture(&app);
}

#[tauri::command]
pub fn hide_capture<R: Runtime>(app: AppHandle<R>) {
    windows::hide_capture(&app);
}

#[tauri::command]
pub fn open_settings<R: Runtime>(app: AppHandle<R>) {
    windows::open_settings(&app);
}

fn sync_autostart<R: Runtime>(app: &AppHandle<R>, enabled: bool) {
    use tauri_plugin_autostart::ManagerExt;
    let mgr = app.autolaunch();
    let current = mgr.is_enabled().unwrap_or(false);
    if enabled && !current {
        let _ = mgr.enable();
    } else if !enabled && current {
        let _ = mgr.disable();
    }
}
