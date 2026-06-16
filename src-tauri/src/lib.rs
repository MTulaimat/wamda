mod commands;
mod linear;
mod notes;
mod provider;
mod reminders;
mod settings;
mod shortcut;
mod timers;
mod trello;
mod windows;

use std::sync::Mutex;
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_global_shortcut::Shortcut;

/// Runtime state: the currently-armed shortcut and whether it's paused.
pub struct AppState {
    pub shortcut: Mutex<Shortcut>,
    pub paused: Mutex<bool>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // single-instance MUST be registered first so a second launch is caught
    // before any other plugin initializes.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            windows::show_capture(app);
        }));
    }

    builder
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(shortcut::plugin())
        .setup(|app| {
            let handle = app.handle();

            // Load persisted settings → seed runtime state with the saved shortcut.
            let saved = settings::load(handle);
            let sc = shortcut::parse(&saved.shortcut).unwrap_or_else(|_| shortcut::default_shortcut());
            app.manage(AppState {
                shortcut: Mutex::new(sc),
                paused: Mutex::new(false),
            });

            // Reminder scheduler: manage its wake handle, then fire missed
            // reminders + reschedule the rest and start the background loop.
            app.manage(reminders::Scheduler::new());
            reminders::bootstrap(handle);

            // A hotkey conflict must NOT prevent startup — the user needs the
            // tray + settings to pick a different combo. Degrade gracefully.
            if let Err(e) = shortcut::register_current(handle) {
                eprintln!("Wamda: could not register global shortcut at startup: {e}");
            }
            windows::build_tray(handle)?;

            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Capture bar dismisses when it loses focus (spotlight behavior).
            WindowEvent::Focused(false) if window.label() == "capture" => {
                // Reset the bar to its entrance start frame so the next
                // open animates cleanly instead of flashing the old frame.
                let _ = window.emit("capture:reset", ());
                let _ = window.hide();
            }
            // Settings close button hides instead of quitting the app.
            WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "settings" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::trello_get_boards,
            commands::trello_get_lists,
            commands::trello_get_templates,
            commands::trello_get_members,
            commands::trello_create_card,
            commands::register_shortcut,
            commands::set_autostart,
            commands::show_capture,
            commands::hide_capture,
            commands::open_settings,
            commands::provider_create_task,
            commands::provider_delete_task,
            commands::provider_list_due,
            commands::provider_status,
            commands::list_providers,
            commands::provider_list_templates,
            commands::linear_get_teams,
            commands::linear_get_users,
            commands::reminder_schedule,
            commands::reminder_remove,
            commands::reminder_list,
            commands::note_create,
            commands::note_list,
            commands::note_remove,
            commands::timer_start,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Wamda");
}
