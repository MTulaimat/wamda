use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";
const KEY: &str = "settings";

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrelloConfig {
    pub key: String,
    pub token: String,
    pub board_id: String,
    pub board_name: String,
    pub list_id: String,
    pub list_name: String,
    pub connected: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct LinearConfig {
    pub api_key: String,
    pub team_id: String,
    pub team_name: String,
    pub connected: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Providers {
    pub trello: TrelloConfig,
    pub linear: LinearConfig,
}

fn default_provider() -> String {
    "trello".into()
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    // System settings (unchanged across the update).
    pub shortcut: String,
    pub launch_at_startup: bool,
    pub sound_on_capture: bool,
    pub prefill_from_clipboard: bool,
    pub accent: String,

    // New, provider-agnostic model.
    #[serde(default = "default_provider")]
    pub default_provider: String,
    #[serde(default)]
    pub providers: Providers,

    // ---- Legacy flat Trello fields ----
    // Accepted on read from a pre-update settings.json, folded into
    // providers.trello by migrate(), and never re-serialized (skip_serializing).
    #[serde(default, skip_serializing, rename = "trelloKey")]
    legacy_trello_key: Option<String>,
    #[serde(default, skip_serializing, rename = "trelloToken")]
    legacy_trello_token: Option<String>,
    #[serde(default, skip_serializing, rename = "boardId")]
    legacy_board_id: Option<String>,
    #[serde(default, skip_serializing, rename = "boardName")]
    legacy_board_name: Option<String>,
    #[serde(default, skip_serializing, rename = "listId")]
    legacy_list_id: Option<String>,
    #[serde(default, skip_serializing, rename = "listName")]
    legacy_list_name: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            shortcut: "Ctrl+Alt+.".into(),
            launch_at_startup: false,
            sound_on_capture: true,
            prefill_from_clipboard: false,
            accent: "#6E7BFF".into(),
            default_provider: default_provider(),
            providers: Providers::default(),
            legacy_trello_key: None,
            legacy_trello_token: None,
            legacy_board_id: None,
            legacy_board_name: None,
            legacy_list_id: None,
            legacy_list_name: None,
        }
    }
}

impl Settings {
    /// Fold any legacy flat Trello fields (from a pre-update settings.json) into
    /// providers.trello. Only fills empty nested fields, so a newer nested value
    /// always wins. serde aliases can't reach across nesting, so this manual step
    /// is the real migration mechanism. The next save() writes a clean nested doc.
    fn migrate(mut self) -> Self {
        {
            let t = &mut self.providers.trello;
            if t.key.is_empty() {
                if let Some(v) = self.legacy_trello_key.take() {
                    t.key = v;
                }
            }
            if t.token.is_empty() {
                if let Some(v) = self.legacy_trello_token.take() {
                    t.token = v;
                }
            }
            if t.board_id.is_empty() {
                if let Some(v) = self.legacy_board_id.take() {
                    t.board_id = v;
                }
            }
            if t.board_name.is_empty() {
                if let Some(v) = self.legacy_board_name.take() {
                    t.board_name = v;
                }
            }
            if t.list_id.is_empty() {
                if let Some(v) = self.legacy_list_id.take() {
                    t.list_id = v;
                }
            }
            if t.list_name.is_empty() {
                if let Some(v) = self.legacy_list_name.take() {
                    t.list_name = v;
                }
            }
            // A migrated config with creds + a destination list is "connected".
            if !t.key.is_empty() && !t.token.is_empty() && !t.list_id.is_empty() {
                t.connected = true;
            }
        }
        // Clear the holders so they can never re-serialize.
        self.legacy_trello_key = None;
        self.legacy_trello_token = None;
        self.legacy_board_id = None;
        self.legacy_board_name = None;
        self.legacy_list_id = None;
        self.legacy_list_name = None;
        self
    }
}

pub fn load<R: Runtime>(app: &AppHandle<R>) -> Settings {
    match app.store(STORE_FILE) {
        Ok(store) => store
            .get(KEY)
            .and_then(|v| serde_json::from_value::<Settings>(v).ok())
            .map(Settings::migrate)
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
