use std::str::FromStr;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

use crate::{windows, AppState};

pub fn default_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::Period)
}

pub fn parse(accel: &str) -> Result<Shortcut, String> {
    Shortcut::from_str(accel).map_err(|_| format!("\"{accel}\" is not a valid shortcut"))
}

/// The global-shortcut plugin, wired to toggle the capture window. The handler
/// reads the *current* shortcut + paused flag from managed state at fire time,
/// so live re-registration and pausing work without rebuilding the plugin.
pub fn plugin<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
            // Handler fires on both Pressed and Released — act on Pressed only.
            if event.state() != ShortcutState::Pressed {
                return;
            }
            let state = app.state::<AppState>();
            if *state.paused.lock().unwrap() {
                return;
            }
            let current = state.shortcut.lock().unwrap();
            if *shortcut == *current {
                drop(current);
                windows::toggle_capture(app);
            }
        })
        .build()
}

/// Register the shortcut currently held in state (called once at startup).
/// Clears any stale registrations first so a crashed prior instance can't make
/// us fail with "already registered".
pub fn register_current<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    let sc = *app.state::<AppState>().shortcut.lock().unwrap();
    gs.register(sc).map_err(|e| e.to_string())
}

/// Swap to a new accelerator live: validate, unregister the old, register the
/// new, and persist it in state. Restores the old one if the new fails.
pub fn re_register<R: Runtime>(app: &AppHandle<R>, accel: &str) -> Result<(), String> {
    let new_sc = parse(accel)?;
    let gs = app.global_shortcut();
    let state = app.state::<AppState>();

    let old = *state.shortcut.lock().unwrap();
    let _ = gs.unregister(old);

    if let Err(e) = gs.register(new_sc) {
        let _ = gs.register(old); // best-effort restore
        return Err(format!("Could not register \"{accel}\" (maybe in use): {e}"));
    }

    *state.shortcut.lock().unwrap() = new_sc;
    Ok(())
}

/// Pause (unregister) or resume (register) the current shortcut.
pub fn set_paused<R: Runtime>(app: &AppHandle<R>, paused: bool) {
    let state = app.state::<AppState>();
    *state.paused.lock().unwrap() = paused;
    let sc = *state.shortcut.lock().unwrap();
    let gs = app.global_shortcut();
    if paused {
        let _ = gs.unregister(sc);
    } else {
        let _ = gs.register(sc);
    }
}
