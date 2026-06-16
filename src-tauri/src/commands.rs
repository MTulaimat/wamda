use tauri::{AppHandle, Runtime};

use crate::provider::{self, ProviderKind, ProviderStatus, TaskInput, TaskRef, TaskSummary};
use crate::settings::Settings;
use crate::{linear, reminders, settings, shortcut, timers, trello, windows};

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
pub async fn trello_get_templates(
    key: String,
    token: String,
    board_id: String,
) -> Result<Vec<provider::Template>, String> {
    trello::get_templates(&key, &token, &board_id).await
}

#[tauri::command]
pub async fn trello_get_members(
    key: String,
    token: String,
    board_id: String,
) -> Result<Vec<provider::Person>, String> {
    trello::get_members(&key, &token, &board_id).await
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

// ---- Generic provider surface ----

#[tauri::command]
pub async fn provider_create_task<R: Runtime>(
    app: AppHandle<R>,
    provider_id: String,
    input: TaskInput,
) -> Result<TaskRef, String> {
    let s = settings::load(&app);
    let p = ProviderKind::from_settings(&provider_id, &s)?;
    if !p.is_configured() {
        return Err(format!("{} isn't connected yet", p.label()));
    }
    p.create_task(input).await
}

#[tauri::command]
pub async fn provider_delete_task<R: Runtime>(
    app: AppHandle<R>,
    provider_id: String,
    task_id: String,
) -> Result<(), String> {
    let s = settings::load(&app);
    let p = ProviderKind::from_settings(&provider_id, &s)?;
    if !p.is_configured() {
        return Err(format!("{} isn't connected yet", p.label()));
    }
    p.delete_task(&task_id).await
}

#[tauri::command]
pub async fn provider_list_due<R: Runtime>(
    app: AppHandle<R>,
    provider_id: String,
    limit: usize,
) -> Result<Vec<TaskSummary>, String> {
    let s = settings::load(&app);
    let p = ProviderKind::from_settings(&provider_id, &s)?;
    if !p.is_configured() {
        return Err(format!("{} isn't connected yet", p.label()));
    }
    p.list_due(limit).await
}

#[tauri::command]
pub fn provider_status<R: Runtime>(
    app: AppHandle<R>,
    provider_id: String,
) -> Result<ProviderStatus, String> {
    let s = settings::load(&app);
    let p = ProviderKind::from_settings(&provider_id, &s)?;
    Ok(ProviderStatus {
        id: p.id().into(),
        configured: p.is_configured(),
        label: p.label().into(),
    })
}

#[tauri::command]
pub fn list_providers<R: Runtime>(app: AppHandle<R>) -> Vec<ProviderStatus> {
    let s = settings::load(&app);
    provider::PROVIDER_IDS
        .iter()
        .filter_map(|id| {
            ProviderKind::from_settings(id, &s)
                .ok()
                .map(|p| ProviderStatus {
                    id: p.id().into(),
                    configured: p.is_configured(),
                    label: p.label().into(),
                })
        })
        .collect()
}

#[tauri::command]
pub async fn provider_list_templates<R: Runtime>(
    app: AppHandle<R>,
    provider_id: String,
) -> Result<Vec<provider::Template>, String> {
    let s = settings::load(&app);
    let p = ProviderKind::from_settings(&provider_id, &s)?;
    if !p.is_configured() {
        return Err(format!("{} isn't connected yet", p.label()));
    }
    p.list_templates().await
}

#[tauri::command]
pub async fn linear_get_teams(api_key: String) -> Result<Vec<linear::Team>, String> {
    linear::get_teams(&api_key).await
}

#[tauri::command]
pub async fn linear_get_users(api_key: String) -> Result<Vec<provider::Person>, String> {
    linear::get_users(&api_key).await
}

// ---- Local reminders ----

#[tauri::command]
pub fn reminder_schedule<R: Runtime>(
    app: AppHandle<R>,
    phrase: String,
    message: String,
) -> Result<reminders::Reminder, String> {
    reminders::schedule(&app, phrase, message)
}

#[tauri::command]
pub fn reminder_remove<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    reminders::remove(&app, id)
}

#[tauri::command]
pub fn reminder_list<R: Runtime>(app: AppHandle<R>) -> Vec<reminders::Reminder> {
    reminders::list(&app)
}

// ---- Background timers ----

#[tauri::command]
pub fn timer_start<R: Runtime>(
    app: AppHandle<R>,
    spec: String,
    label: Option<String>,
) -> Result<String, String> {
    timers::start(&app, spec, label)
}
