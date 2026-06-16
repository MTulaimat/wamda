//! Local notes — quick text captures that aren't tasks, never sent to a provider.
//!
//! Simpler than reminders: no scheduler, just CRUD over the shared store (the
//! store is the source of truth). Kept newest-first so the list view shows the
//! most recent on top.

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json"; // same file as settings/reminders, own key
const KEY: &str = "notes";

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub text: String,
    pub created_at: String,
}

fn load<R: Runtime>(app: &AppHandle<R>) -> Vec<Note> {
    app.store(STORE_FILE)
        .ok()
        .and_then(|s| s.get(KEY))
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

fn persist<R: Runtime>(app: &AppHandle<R>, items: &[Note]) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(KEY, serde_json::to_value(items).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())
}

fn new_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static N: AtomicU64 = AtomicU64::new(0);
    format!(
        "note_{}_{}",
        Utc::now().timestamp_millis(),
        N.fetch_add(1, Ordering::Relaxed)
    )
}

/// Save a note (newest-first). Empty text is rejected.
pub fn add<R: Runtime>(app: &AppHandle<R>, text: String) -> Result<Note, String> {
    let text = text.trim();
    if text.is_empty() {
        return Err("Nothing to note".into());
    }
    let note = Note {
        id: new_id(),
        text: text.to_string(),
        created_at: Utc::now().to_rfc3339(),
    };
    let mut items = load(app);
    items.insert(0, note.clone());
    persist(app, &items)?;
    Ok(note)
}

pub fn remove<R: Runtime>(app: &AppHandle<R>, id: String) -> Result<(), String> {
    let items: Vec<Note> = load(app).into_iter().filter(|n| n.id != id).collect();
    persist(app, &items)
}

pub fn list<R: Runtime>(app: &AppHandle<R>) -> Vec<Note> {
    load(app)
}
