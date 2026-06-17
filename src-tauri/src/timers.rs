//! Background countdown timers. Lighter than reminders: in-memory only, no
//! persistence (a timer that doesn't survive a quit is acceptable).

use std::time::Duration;

use tauri::{AppHandle, Runtime};
use tauri_plugin_notification::NotificationExt;

/// Parse a duration spec into seconds. Supports `s`/`m`/`h` and combos
/// (`60s`, `5m`, `1h30m`, `1h 30m`). A bare integer means minutes.
pub fn parse_duration(spec: &str) -> Result<u64, String> {
    let s = spec.trim().to_lowercase();
    if s.is_empty() {
        return Err("Enter a duration, e.g. 25m".into());
    }
    // Bare integer = minutes.
    if let Ok(mins) = s.parse::<u64>() {
        if mins == 0 {
            return Err("Duration must be greater than zero".into());
        }
        return Ok(mins.saturating_mul(60));
    }

    let mut total: u64 = 0;
    let mut num = String::new();
    let mut matched = false;
    for c in s.chars() {
        if c.is_ascii_digit() {
            num.push(c);
            continue;
        }
        if c == ' ' {
            continue;
        }
        let n: u64 = num
            .parse()
            .map_err(|_| "Duration needs a number before each unit".to_string())?;
        num.clear();
        total += match c {
            's' => n,
            'm' => n.saturating_mul(60),
            'h' => n.saturating_mul(3600),
            _ => return Err(format!("Unknown unit '{c}' - use s, m, or h")),
        };
        matched = true;
    }
    if !num.is_empty() {
        return Err("Duration needs a unit (s, m, or h)".into());
    }
    if !matched || total == 0 {
        return Err("Duration must be greater than zero".into());
    }
    Ok(total)
}

/// Human-readable countdown target, e.g. "1h 30m", "90s", "25m".
pub fn human(secs: u64) -> String {
    let (h, m, s) = (secs / 3600, (secs % 3600) / 60, secs % 60);
    let mut parts = Vec::new();
    if h > 0 {
        parts.push(format!("{h}h"));
    }
    if m > 0 {
        parts.push(format!("{m}m"));
    }
    if s > 0 && h == 0 {
        parts.push(format!("{s}s"));
    }
    if parts.is_empty() {
        parts.push("0s".into());
    }
    parts.join(" ")
}

/// Start a background timer; returns a confirmation string for the in-bar toast.
pub fn start<R: Runtime>(
    app: &AppHandle<R>,
    spec: String,
    label: Option<String>,
) -> Result<String, String> {
    let secs = parse_duration(&spec)?;
    let label = label.map(|l| l.trim().to_string()).filter(|l| !l.is_empty());
    let title = label.clone().unwrap_or_else(|| "Timer".into());
    let confirm = match &label {
        Some(l) => format!("Timer started for {} - {l}", human(secs)),
        None => format!("Timer started for {}", human(secs)),
    };

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(secs)).await;
        let _ = app
            .notification()
            .builder()
            .title(&title)
            .body("Time's up")
            .show();
    });
    Ok(confirm)
}
