use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";
const KEY: &str = "settings";

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub shortcut: String,
    pub trello_key: String,
    pub trello_token: String,
    pub board_id: String,
    pub board_name: String,
    pub list_id: String,
    pub list_name: String,
    pub launch_at_startup: bool,
    pub sound_on_capture: bool,
    pub prefill_from_clipboard: bool,
    pub accent: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            shortcut: "Ctrl+Alt+.".into(),
            trello_key: String::new(),
            trello_token: String::new(),
            board_id: String::new(),
            board_name: String::new(),
            list_id: String::new(),
            list_name: String::new(),
            launch_at_startup: false,
            sound_on_capture: true,
            prefill_from_clipboard: false,
            accent: "#6E7BFF".into(),
        }
    }
}

pub fn load<R: Runtime>(app: &AppHandle<R>) -> Settings {
    match app.store(STORE_FILE) {
        Ok(store) => store
            .get(KEY)
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default(),
        Err(_) => Settings::default(),
    }
}

pub fn save<R: Runtime>(app: &AppHandle<R>, settings: &Settings) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let value = serde_json::to_value(settings).map_err(|e| e.to_string())?;
    store.set(KEY, value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}
