//! Local reminders - never sent to any provider.
//!
//! In-process scheduler: a single background task sleeps until the soonest
//! reminder and wakes early (via `Notify`) whenever one is added/removed. The
//! store is the source of truth. On launch, missed reminders fire immediately
//! with a "(missed)" prefix and are dropped, then the rest are rescheduled.

use std::sync::Arc;

use chrono::{DateTime, Local, Utc};
use interim::{parse_date_string, Dialect};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;
use tokio::sync::Notify;

const STORE_FILE: &str = "settings.json"; // same file, different key
const KEY: &str = "reminders";

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Reminder {
    pub id: String,
    pub fire_at: String, // RFC3339
    pub message: String,
    pub created_at: String,
}

/// Managed alongside `AppState`; the background loop waits on `wake`.
pub struct Scheduler {
    pub wake: Arc<Notify>,
}

impl Scheduler {
    pub fn new() -> Self {
        Self {
            wake: Arc::new(Notify::new()),
        }
    }
}

impl Default for Scheduler {
    fn default() -> Self {
        Self::new()
    }
}

fn load<R: Runtime>(app: &AppHandle<R>) -> Vec<Reminder> {
    app.store(STORE_FILE)
        .ok()
        .and_then(|s| s.get(KEY))
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

fn persist<R: Runtime>(app: &AppHandle<R>, items: &[Reminder]) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(KEY, serde_json::to_value(items).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())
}

fn parse_iso(iso: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(iso)
        .ok()
        .map(|d| d.with_timezone(&Utc))
}

fn toast<R: Runtime>(app: &AppHandle<R>, title: &str, body: &str) {
    let _ = app.notification().builder().title(title).body(body).show();
}

/// Resolve a natural-language phrase ("in 10 minutes", "tomorrow at 9",
/// "friday 5pm") into an absolute RFC3339 timestamp relative to now.
///
/// Relative durations ("in 2 minutes", "in 2h", "90 seconds", "1h30m") are
/// parsed deterministically here, since `interim` doesn't accept the "in …"
/// phrasing. Calendar/absolute phrases fall through to `interim`.
pub fn resolve_phrase(phrase: &str) -> Result<String, String> {
    let phrase = phrase.trim();
    if phrase.is_empty() {
        return Err("When should I remind you?".into());
    }
    let base = Local::now();

    // 1. Relative durations.
    if let Some(dur) = parse_relative(phrase) {
        if dur <= chrono::Duration::zero() {
            return Err("That time is already in the past".into());
        }
        return Ok((base + dur).to_rfc3339());
    }

    // 2. Calendar / absolute phrases - try as-is, then a connector-stripped form.
    for candidate in [phrase.to_string(), normalize_for_interim(phrase)] {
        if let Ok(dt) = parse_date_string(&candidate, base, Dialect::Us) {
            if dt <= base {
                return Err("That time is already in the past".into());
            }
            return Ok(dt.to_rfc3339());
        }
    }
    Err(format!("I couldn't understand the time \"{phrase}\""))
}

/// Parse a relative duration phrase ("in 2 minutes", "2h", "90 seconds",
/// "1 hour 30 min", "1h30m") into a Duration. Returns None for non-duration
/// (calendar) phrases so `interim` can handle those instead.
fn parse_relative(phrase: &str) -> Option<chrono::Duration> {
    let lower = phrase.to_lowercase();
    let mut s = lower.trim();
    if let Some(rest) = s.strip_prefix("in ") {
        s = rest.trim();
    }
    if let Some(rest) = s.strip_suffix(" from now") {
        s = rest.trim();
    }
    if s.is_empty() {
        return None;
    }

    let tokens: Vec<&str> = s.split_whitespace().collect();
    let mut total: i64 = 0;
    let mut matched = false;
    let mut i = 0;
    while i < tokens.len() {
        if let Some(secs) = parse_compact(tokens[i]) {
            total += secs;
            matched = true;
            i += 1;
            continue;
        }
        if let Ok(n) = tokens[i].parse::<i64>() {
            let unit = tokens.get(i + 1).and_then(|u| unit_secs(u))?;
            total += n.saturating_mul(unit);
            matched = true;
            i += 2;
            continue;
        }
        return None; // a non-duration token → let interim try
    }
    if matched {
        Some(chrono::Duration::seconds(total))
    } else {
        None
    }
}

/// Compact glued duration token: "2h", "30m", "90s", "1h30m". None otherwise.
fn parse_compact(tok: &str) -> Option<i64> {
    let mut total: i64 = 0;
    let mut num = String::new();
    let mut any = false;
    for c in tok.chars() {
        if c.is_ascii_digit() {
            num.push(c);
            continue;
        }
        let n: i64 = num.parse().ok()?;
        num.clear();
        total += n.saturating_mul(match c {
            's' => 1,
            'm' => 60,
            'h' => 3600,
            'd' => 86400,
            'w' => 604800,
            _ => return None,
        });
        any = true;
    }
    if !num.is_empty() || !any {
        return None; // trailing number without a unit, or no unit at all
    }
    Some(total)
}

/// Seconds per time-unit word ("min(s)", "hour(s)", "h", "m", …).
fn unit_secs(word: &str) -> Option<i64> {
    match word {
        "s" => return Some(1),
        "m" => return Some(60),
        "h" => return Some(3600),
        "d" => return Some(86400),
        "w" => return Some(604800),
        _ => {}
    }
    Some(match word.trim_end_matches('s') {
        "second" | "sec" => 1,
        "minute" | "min" => 60,
        "hour" | "hr" => 3600,
        "day" => 86400,
        "week" | "wk" => 604800,
        _ => return None,
    })
}

/// Drop connector words `interim` dislikes, for a fallback parse attempt.
fn normalize_for_interim(phrase: &str) -> String {
    let mut s = phrase.trim().to_lowercase();
    for pre in ["in ", "on ", "at ", "by "] {
        if let Some(rest) = s.strip_prefix(pre) {
            s = rest.to_string();
            break;
        }
    }
    s.replace(" at ", " ").trim().to_string()
}

fn new_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static N: AtomicU64 = AtomicU64::new(0);
    format!(
        "rem_{}_{}",
        Utc::now().timestamp_millis(),
        N.fetch_add(1, Ordering::Relaxed)
    )
}

/// Called once from `.setup`: fire missed reminders, reschedule the rest, and
/// start the background loop.
pub fn bootstrap<R: Runtime>(app: &AppHandle<R>) {
    let now = Utc::now();
    let mut keep = Vec::new();
    for r in load(app) {
        match parse_iso(&r.fire_at) {
            Some(t) if t <= now => toast(app, "Reminder (missed)", &r.message),
            Some(_) => keep.push(r),
            None => { /* corrupt entry: drop */ }
        }
    }
    let _ = persist(app, &keep);

    let app = app.clone();
    let wake = app.state::<Scheduler>().wake.clone();
    tauri::async_runtime::spawn(async move {
        run_loop(app, wake).await;
    });
}

async fn run_loop<R: Runtime>(app: AppHandle<R>, wake: Arc<Notify>) {
    loop {
        // The store is the source of truth; recompute the soonest target each pass.
        let next = load(&app)
            .into_iter()
            .filter_map(|r| parse_iso(&r.fire_at).map(|t| (t, r)))
            .min_by_key(|(t, _)| *t);

        match next {
            None => wake.notified().await, // nothing scheduled - park until woken
            Some((fire_at, _)) => {
                let dur = (fire_at - Utc::now())
                    .to_std()
                    .unwrap_or(std::time::Duration::ZERO);
                let sleep = tokio::time::sleep(dur);
                tokio::pin!(sleep);
                tokio::select! {
                    _ = &mut sleep => fire_due(&app),
                    _ = wake.notified() => {} // added/removed → loop recomputes
                }
            }
        }
    }
}

fn fire_due<R: Runtime>(app: &AppHandle<R>) {
    let now = Utc::now();
    let mut keep = Vec::new();
    for r in load(app) {
        match parse_iso(&r.fire_at) {
            Some(t) if t <= now => toast(app, "Reminder", &r.message),
            _ => keep.push(r),
        }
    }
    let _ = persist(app, &keep);
}

/// Add an already-resolved reminder and wake the scheduler.
pub fn add<R: Runtime>(
    app: &AppHandle<R>,
    fire_at: String,
    message: String,
) -> Result<Reminder, String> {
    if parse_iso(&fire_at).is_none() {
        return Err("Invalid reminder time".into());
    }
    let r = Reminder {
        id: new_id(),
        fire_at,
        message,
        created_at: Utc::now().to_rfc3339(),
    };
    let mut items = load(app);
    items.push(r.clone());
    persist(app, &items)?;
    app.state::<Scheduler>().wake.notify_one();
    Ok(r)
}

/// Parse a natural-language phrase, then schedule it.
pub fn schedule<R: Runtime>(
    app: &AppHandle<R>,
    phrase: String,
    message: String,
) -> Result<Reminder, String> {
    let msg = message.trim();
    if msg.is_empty() {
        return Err("What should I remind you about?".into());
    }
    let fire_at = resolve_phrase(&phrase)?;
    add(app, fire_at, msg.to_string())
}

pub fn remove<R: Runtime>(app: &AppHandle<R>, id: String) -> Result<(), String> {
    let items: Vec<Reminder> = load(app).into_iter().filter(|r| r.id != id).collect();
    persist(app, &items)?;
    app.state::<Scheduler>().wake.notify_one();
    Ok(())
}

pub fn list<R: Runtime>(app: &AppHandle<R>) -> Vec<Reminder> {
    load(app)
}
