//! Provider abstraction: a single path both Trello and Linear satisfy.
//!
//! Rust's async-fn-in-trait is stable but not object-safe, so we dispatch through
//! an enum (`ProviderKind`) rather than `Box<dyn Provider>`. The `Provider` trait
//! is the shared shape contract both concrete providers implement.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::settings::Settings;
use crate::{linear, trello};

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    /// ISO `yyyy-mm-dd` from the UI (or null), parsed straight into a NaiveDate.
    #[serde(default)]
    pub due: Option<NaiveDate>,
}

#[derive(Serialize, Debug)]
pub struct TaskRef {
    pub id: String,
    pub url: String,
}

#[derive(Serialize, Debug)]
pub struct TaskSummary {
    pub title: String,
    pub url: String,
    /// Provider-native due string (ISO), kept as text for the read-only UI.
    pub due: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub id: String,
    pub configured: bool,
    pub label: String,
}

/// Shared contract. Both providers implement it; the enum below forwards to them.
/// Never used as `dyn` (async fns aren't object-safe) — hence the allow.
#[allow(async_fn_in_trait)]
pub trait Provider {
    fn id(&self) -> &str;
    fn label(&self) -> &str;
    fn is_configured(&self) -> bool;
    async fn create_task(&self, input: TaskInput) -> Result<TaskRef, String>;
    async fn list_due(&self, limit: usize) -> Result<Vec<TaskSummary>, String>;
}

/// Static dispatch over the known providers, built per-call from live settings.
pub enum ProviderKind {
    Trello(trello::TrelloProvider),
    Linear(linear::LinearProvider),
}

impl ProviderKind {
    pub fn from_settings(id: &str, s: &Settings) -> Result<Self, String> {
        match id {
            "trello" => Ok(Self::Trello(trello::TrelloProvider::from_settings(s))),
            "linear" => Ok(Self::Linear(linear::LinearProvider::from_settings(s))),
            other => Err(format!("Unknown provider \"{other}\"")),
        }
    }

    pub fn id(&self) -> &str {
        match self {
            Self::Trello(p) => p.id(),
            Self::Linear(p) => p.id(),
        }
    }
    pub fn label(&self) -> &str {
        match self {
            Self::Trello(p) => p.label(),
            Self::Linear(p) => p.label(),
        }
    }
    pub fn is_configured(&self) -> bool {
        match self {
            Self::Trello(p) => p.is_configured(),
            Self::Linear(p) => p.is_configured(),
        }
    }
    pub async fn create_task(&self, input: TaskInput) -> Result<TaskRef, String> {
        match self {
            Self::Trello(p) => p.create_task(input).await,
            Self::Linear(p) => p.create_task(input).await,
        }
    }
    pub async fn list_due(&self, limit: usize) -> Result<Vec<TaskSummary>, String> {
        match self {
            Self::Trello(p) => p.list_due(limit).await,
            Self::Linear(p) => p.list_due(limit).await,
        }
    }
}

/// Every provider the app knows about — drives `list_providers()` and the
/// frontend's `/trello` · `/linear` route commands.
pub const PROVIDER_IDS: [&str; 2] = ["trello", "linear"];
