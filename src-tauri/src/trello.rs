use serde::{Deserialize, Serialize};

use crate::provider::{Person, Provider, TaskInput, TaskRef, TaskSummary, Template};
use crate::settings::Settings;

const BASE: &str = "https://api.trello.com/1";

#[derive(Serialize, Deserialize)]
pub struct Board {
    pub id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize)]
pub struct List {
    pub id: String,
    pub name: String,
}

#[derive(Serialize)]
pub struct Card {
    pub id: String,
    pub name: String,
    pub url: String,
}

#[derive(Deserialize)]
struct CardResp {
    id: String,
    name: String,
    url: String,
}

fn client() -> reqwest::Client {
    reqwest::Client::new()
}

/// Map network errors to generic messages. Crucially, never include the request
/// URL (which carries the secret token) in the surfaced string.
fn net_err(e: reqwest::Error) -> String {
    if e.is_timeout() {
        "Network timeout — check your connection".into()
    } else if e.is_connect() {
        "Could not reach Trello".into()
    } else {
        "Network error talking to Trello".into()
    }
}

/// Turn a non-2xx response into a readable, token-free error.
fn status_err(status: reqwest::StatusCode) -> String {
    match status.as_u16() {
        401 => "Check your key/token".into(),
        403 => "Not authorized — re-check your token's permissions".into(),
        404 => "Board or list not found".into(),
        429 => "Trello rate limit hit — try again shortly".into(),
        _ => format!("Trello error ({status})"),
    }
}

pub async fn get_boards(key: &str, token: &str) -> Result<Vec<Board>, String> {
    let resp = client()
        .get(format!("{BASE}/members/me/boards"))
        .query(&[("key", key), ("token", token), ("fields", "name")])
        .send()
        .await
        .map_err(net_err)?;
    if !resp.status().is_success() {
        return Err(status_err(resp.status()));
    }
    resp.json::<Vec<Board>>().await.map_err(|_| "Unexpected response from Trello".into())
}

pub async fn get_lists(key: &str, token: &str, board_id: &str) -> Result<Vec<List>, String> {
    let resp = client()
        .get(format!("{BASE}/boards/{board_id}/lists"))
        .query(&[("key", key), ("token", token), ("fields", "name")])
        .send()
        .await
        .map_err(net_err)?;
    if !resp.status().is_success() {
        return Err(status_err(resp.status()));
    }
    resp.json::<Vec<List>>().await.map_err(|_| "Unexpected response from Trello".into())
}

/// Card templates on a board are ordinary cards flagged `isTemplate` — there's no
/// dedicated endpoint. Fetch the board's cards (minimal fields) and keep the live
/// (non-archived) templates.
pub async fn get_templates(
    key: &str,
    token: &str,
    board_id: &str,
) -> Result<Vec<Template>, String> {
    if board_id.is_empty() {
        return Ok(Vec::new());
    }
    let resp = client()
        .get(format!("{BASE}/boards/{board_id}/cards"))
        .query(&[
            ("key", key),
            ("token", token),
            ("filter", "all"),
            ("fields", "name,isTemplate,closed"),
        ])
        .send()
        .await
        .map_err(net_err)?;
    if !resp.status().is_success() {
        return Err(status_err(resp.status()));
    }
    #[derive(Deserialize)]
    struct Row {
        id: String,
        name: String,
        #[serde(rename = "isTemplate", default)]
        is_template: bool,
        #[serde(default)]
        closed: bool,
    }
    let rows = resp
        .json::<Vec<Row>>()
        .await
        .map_err(|_| "Unexpected response from Trello".to_string())?;
    Ok(rows
        .into_iter()
        .filter(|r| r.is_template && !r.closed)
        .map(|r| Template { id: r.id, name: r.name })
        .collect())
}

/// Board members, for the default-assignee picker. Trello doesn't expose member
/// emails via the API, so the secondary line is the @username.
pub async fn get_members(
    key: &str,
    token: &str,
    board_id: &str,
) -> Result<Vec<Person>, String> {
    if board_id.is_empty() {
        return Ok(Vec::new());
    }
    let resp = client()
        .get(format!("{BASE}/boards/{board_id}/members"))
        .query(&[
            ("key", key),
            ("token", token),
            ("fields", "fullName,username"),
        ])
        .send()
        .await
        .map_err(net_err)?;
    if !resp.status().is_success() {
        return Err(status_err(resp.status()));
    }
    #[derive(Deserialize)]
    struct Row {
        id: String,
        #[serde(rename = "fullName", default)]
        full_name: String,
        #[serde(default)]
        username: String,
    }
    let rows = resp
        .json::<Vec<Row>>()
        .await
        .map_err(|_| "Unexpected response from Trello".to_string())?;
    Ok(rows
        .into_iter()
        .map(|r| Person {
            name: if r.full_name.is_empty() {
                r.username.clone()
            } else {
                r.full_name
            },
            detail: if r.username.is_empty() {
                String::new()
            } else {
                format!("@{}", r.username)
            },
            id: r.id,
        })
        .collect())
}

pub async fn create_card(key: &str, token: &str, list_id: &str, name: &str) -> Result<Card, String> {
    // reqwest `.query` url-encodes the card name for us.
    let resp = client()
        .post(format!("{BASE}/cards"))
        .query(&[("key", key), ("token", token), ("idList", list_id), ("name", name)])
        .send()
        .await
        .map_err(net_err)?;
    if !resp.status().is_success() {
        return Err(status_err(resp.status()));
    }
    let c = resp
        .json::<CardResp>()
        .await
        .map_err(|_| "Card created but response was unexpected".to_string())?;
    Ok(Card { id: c.id, name: c.name, url: c.url })
}

/// Trello as a generic provider. Targets the single configured list.
pub struct TrelloProvider {
    key: String,
    token: String,
    board_id: String,
    list_id: String,
    assignee_id: String,
}

impl TrelloProvider {
    pub fn from_settings(s: &Settings) -> Self {
        Self {
            key: s.providers.trello.key.clone(),
            token: s.providers.trello.token.clone(),
            board_id: s.providers.trello.board_id.clone(),
            list_id: s.providers.trello.list_id.clone(),
            assignee_id: s.providers.trello.assignee_id.clone(),
        }
    }
}

impl Provider for TrelloProvider {
    fn id(&self) -> &str {
        "trello"
    }
    fn label(&self) -> &str {
        "Trello"
    }
    fn is_configured(&self) -> bool {
        !self.key.is_empty() && !self.token.is_empty() && !self.list_id.is_empty()
    }

    async fn create_task(&self, input: TaskInput) -> Result<TaskRef, String> {
        // `.query` url-encodes everything; the token-bearing URL is never surfaced.
        let mut q: Vec<(&str, String)> = vec![
            ("key", self.key.clone()),
            ("token", self.token.clone()),
            ("idList", self.list_id.clone()),
            ("name", input.title),
        ];
        if let Some(d) = input.description {
            if !d.is_empty() {
                q.push(("desc", d));
            }
        }
        if let Some(due) = input.due {
            // Trello wants an ISO datetime; pin to 17:00 UTC so the date sticks.
            q.push(("due", format!("{due}T17:00:00.000Z")));
        }
        if let Some(tid) = input.template_id {
            if !tid.is_empty() {
                // Create from a card template: copy its checklists/labels/etc.
                // The explicit name (and any desc/due above) still override.
                q.push(("idCardSource", tid));
                // `all` also copies the template's members, which would overwrite
                // the explicit default assignee below. When we have an assignee,
                // copy everything EXCEPT members so idMembers sticks.
                let keep = if self.assignee_id.is_empty() {
                    "all"
                } else {
                    "attachments,checklists,comments,customFields,due,start,labels,stickers"
                };
                q.push(("keepFromSource", keep.into()));
            }
        }
        if !self.assignee_id.is_empty() {
            // Default assignee: add the configured board member to the card.
            q.push(("idMembers", self.assignee_id.clone()));
        }
        let resp = client()
            .post(format!("{BASE}/cards"))
            .query(&q)
            .send()
            .await
            .map_err(net_err)?;
        if !resp.status().is_success() {
            return Err(status_err(resp.status()));
        }
        let c = resp
            .json::<CardResp>()
            .await
            .map_err(|_| "Card created but response was unexpected".to_string())?;
        Ok(TaskRef { id: c.id, url: c.url })
    }

    async fn list_due(&self, limit: usize) -> Result<Vec<TaskSummary>, String> {
        let resp = client()
            .get(format!("{BASE}/lists/{}/cards", self.list_id))
            .query(&[
                ("key", self.key.as_str()),
                ("token", self.token.as_str()),
                ("fields", "name,url,due"),
            ])
            .send()
            .await
            .map_err(net_err)?;
        if !resp.status().is_success() {
            return Err(status_err(resp.status()));
        }
        #[derive(Deserialize)]
        struct Row {
            name: String,
            url: String,
            due: Option<String>,
        }
        let mut rows = resp
            .json::<Vec<Row>>()
            .await
            .map_err(|_| "Unexpected response from Trello".to_string())?;
        // Only cards with a due date, soonest first (ISO strings sort correctly).
        rows.retain(|r| r.due.is_some());
        rows.sort_by(|a, b| a.due.cmp(&b.due));
        Ok(rows
            .into_iter()
            .take(limit)
            .map(|r| TaskSummary {
                title: r.name,
                url: r.url,
                due: r.due,
            })
            .collect())
    }

    async fn list_templates(&self) -> Result<Vec<Template>, String> {
        get_templates(&self.key, &self.token, &self.board_id).await
    }
}
