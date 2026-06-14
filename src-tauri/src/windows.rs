use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewWindow};
use tauri_plugin_positioner::{Position, WindowExt};

/// Show the capture bar centered on the monitor under the cursor, focus it, and
/// tell the webview to (re)play its entrance + optionally prefill from clipboard.
pub fn show_capture<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window("capture") {
        center_on_cursor_monitor(app, &win);
        let _ = win.show();
        let _ = win.set_focus();
        let prefill = compute_prefill(app);
        let _ = win.emit("capture:opened", serde_json::json!({ "prefill": prefill }));
    }
}

pub fn hide_capture<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window("capture") {
        let _ = win.hide();
        let _ = win.emit("capture:reset", ());
    }
}

pub fn toggle_capture<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window("capture") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
            let _ = win.emit("capture:reset", ());
        } else {
            show_capture(app);
        }
    }
}

pub fn open_settings<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

/// Move the window onto the monitor containing the cursor, then center it there.
fn center_on_cursor_monitor<R: Runtime>(app: &AppHandle<R>, win: &WebviewWindow<R>) {
    if let (Ok(cursor), Ok(monitors)) = (app.cursor_position(), win.available_monitors()) {
        for m in monitors {
            let pos = m.position();
            let size = m.size();
            let in_x = cursor.x >= pos.x as f64 && cursor.x < pos.x as f64 + size.width as f64;
            let in_y = cursor.y >= pos.y as f64 && cursor.y < pos.y as f64 + size.height as f64;
            if in_x && in_y {
                let _ = win.set_position(tauri::PhysicalPosition::new(pos.x, pos.y));
                break;
            }
        }
    }
    // Center within whichever monitor the window now sits on.
    let _ = win.move_window(Position::Center);
}

/// Clipboard text for prefill, only if the setting is on and the clipboard holds text.
fn compute_prefill<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    if !crate::settings::load(app).prefill_from_clipboard {
        return None;
    }
    let text = arboard::Clipboard::new().ok()?.get_text().ok()?;
    if text.trim().is_empty() {
        None
    } else {
        Some(text)
    }
}

/// Build the tray icon + menu. Left-click opens capture; menu items map to actions.
pub fn build_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    use tauri::menu::{MenuBuilder, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let capture_i = MenuItem::with_id(app, "capture", "Capture a thought", true, Some("Ctrl+Alt+."))?;
    let settings_i = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let pause_i = MenuItem::with_id(app, "pause", "Pause shortcut", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit Wamda", true, None::<&str>)?;
    let menu = MenuBuilder::new(app)
        .items(&[&capture_i, &settings_i])
        .separator()
        .items(&[&pause_i, &quit_i])
        .build()?;

    let pause_item = pause_i.clone();
    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Wamda")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "capture" => show_capture(app),
            "settings" => open_settings(app),
            "pause" => {
                let next = {
                    let state = app.state::<crate::AppState>();
                    let cur = *state.paused.lock().unwrap();
                    !cur
                };
                crate::shortcut::set_paused(app, next);
                let _ = pause_item.set_text(if next { "Resume shortcut" } else { "Pause shortcut" });
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_capture(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}
