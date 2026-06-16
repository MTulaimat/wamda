//! Linear integration via GraphQL.
//!
//! Auth: a **personal API key** sent as `Authorization: <key>` with **no**
//! `Bearer` prefix (Bearer is for OAuth tokens and fails here). Linear returns
//! errors in the JSON body even on HTTP 200, so we check the `errors` array and
//! the operation's `success` flag, not just the status code. As with Trello,
//! surfaced error strings never include the API key.

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use crate::provider::{Person, Provider, TaskInput, TaskRef, TaskSummary, Template};
use crate::settings::Settings;

const ENDPOINT: &str = "https://api.linear.app/graphql";

pub struct LinearProvider {
    api_key: String,
    team_id: String,
    assignee_id: String,
}

impl LinearProvider {
    pub fn from_settings(s: &Settings) -> Self {
        Self {
            api_key: s.providers.linear.api_key.clone(),
            team_id: s.providers.linear.team_id.clone(),
            assignee_id: s.providers.linear.assignee_id.clone(),
        }
    }
}

fn net_err(e: reqwest::Error) -> String {
    if e.is_timeout() {
        "Network timeout — check your connection".into()
    } else if e.is_connect() {
        "Could not reach Linear".into()
    } else {
        "Network error talking to Linear".into()
    }
}

/// Trim a Linear error message to a single safe line (defensive; messages are
/// already key-free).
fn sanitize(m: String) -> String {
    let one = m.lines().next().unwrap_or("Linear error").trim().to_string();
    if one.chars().count() > 140 {
        let cut: String = one.chars().take(140).collect();
        format!("{cut}…")
    } else {
        one
    }
}

#[derive(Deserialize)]
struct GqlResp<T> {
    data: Option<T>,
    errors: Option<Vec<GqlError>>,
}

#[derive(Deserialize)]
struct GqlError {
    message: String,
}

/// POST a GraphQL operation with variables (never string interpolation) and
/// decode the strict envelope.
async fn graphql<T: DeserializeOwned>(
    api_key: &str,
    query: &str,
    variables: serde_json::Value,
) -> Result<T, String> {
    let resp = reqwest::Client::new()
        .post(ENDPOINT)
        // CRITICAL: raw personal API key, NOT "Bearer <key>".
        .header("Authorization", api_key)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "query": query, "variables": variables }))
        .send()
        .await
        .map_err(net_err)?;

    if resp.status() == reqwest::StatusCode::UNAUTHORIZED
        || resp.status() == reqwest::StatusCode::FORBIDDEN
    {
        return Err("Check your Linear API key".into());
    }

    let body: GqlResp<T> = resp
        .json()
        .await
        .map_err(|_| "Unexpected response from Linear".to_string())?;

    if let Some(errs) = body.errors {
        let msg = errs
            .into_iter()
            .next()
            .map(|e| e.message)
            .unwrap_or_else(|| "Linear request failed".into());
        return Err(sanitize(msg));
    }
    body.data.ok_or_else(|| "Linear returned no data".to_string())
}

const ISSUE_CREATE: &str = r#"
mutation Create($input: IssueCreateInput!) {
  issueCreate(input: $input) { success issue { id url identifier } }
}"#;

const TEAMS: &str = r#"
query Teams { teams(first: 100) { nodes { id name key } } }"#;

const USERS: &str = r#"
query Users { users(first: 250) { nodes { id name displayName email } } }"#;

const ASSIGNED: &str = r#"
query Assigned($first: Int!) {
  viewer {
    assignedIssues(
      first: $first,
      filter: { state: { type: { nin: ["completed", "canceled"] } } }
    ) {
      nodes { title url dueDate }
    }
  }
}"#;

impl Provider for LinearProvider {
    fn id(&self) -> &str {
        "linear"
    }
    fn label(&self) -> &str {
        "Linear"
    }
    fn is_configured(&self) -> bool {
        !self.api_key.is_empty() && !self.team_id.is_empty()
    }

    async fn create_task(&self, input: TaskInput) -> Result<TaskRef, String> {
        let mut issue = serde_json::json!({ "teamId": self.team_id, "title": input.title });
        if let Some(d) = input.description {
            if !d.is_empty() {
                issue["description"] = d.into();
            }
        }
        if let Some(due) = input.due {
            issue["dueDate"] = due.to_string().into(); // "yyyy-mm-dd"
        }
        if !self.assignee_id.is_empty() {
            issue["assigneeId"] = self.assignee_id.clone().into();
        }

        #[derive(Deserialize)]
        struct Data {
            #[serde(rename = "issueCreate")]
            create: Create,
        }
        #[derive(Deserialize)]
        struct Create {
            success: bool,
            issue: Option<Issue>,
        }
        #[derive(Deserialize)]
        struct Issue {
            id: String,
            url: String,
        }

        let data: Data = graphql(
            &self.api_key,
            ISSUE_CREATE,
            serde_json::json!({ "input": issue }),
        )
        .await?;
        if !data.create.success {
            return Err("Linear declined to create the issue".into());
        }
        let issue = data
            .create
            .issue
            .ok_or("Issue created but no id was returned")?;
        Ok(TaskRef {
            id: issue.id,
            url: issue.url,
        })
    }

    async fn list_due(&self, limit: usize) -> Result<Vec<TaskSummary>, String> {
        #[derive(Deserialize)]
        struct Data {
            viewer: Viewer,
        }
        #[derive(Deserialize)]
        struct Viewer {
            #[serde(rename = "assignedIssues")]
            issues: Conn,
        }
        #[derive(Deserialize)]
        struct Conn {
            nodes: Vec<Node>,
        }
        #[derive(Deserialize)]
        struct Node {
            title: String,
            url: String,
            #[serde(rename = "dueDate")]
            due: Option<String>,
        }

        let data: Data = graphql(
            &self.api_key,
            ASSIGNED,
            serde_json::json!({ "first": limit as i64 }),
        )
        .await?;
        Ok(data
            .viewer
            .issues
            .nodes
            .into_iter()
            .take(limit)
            .map(|n| TaskSummary {
                title: n.title,
                url: n.url,
                due: n.due,
            })
            .collect())
    }

    async fn list_templates(&self) -> Result<Vec<Template>, String> {
        // Linear has issue templates, but `issueCreate` exposes no server-side
        // `templateId` — applying one means reading the template's `templateData`
        // JSON and mapping its fields here. Until that's built (and verified
        // against a real key), expose none so the /template UI degrades
        // gracefully: Linear shows an empty template list rather than erroring.
        Ok(Vec::new())
    }
}

/// Team picker support for Settings (parallels `trello::get_boards`).
#[derive(Serialize, Deserialize)]
pub struct Team {
    pub id: String,
    pub name: String,
    pub key: String,
}

pub async fn get_teams(api_key: &str) -> Result<Vec<Team>, String> {
    #[derive(Deserialize)]
    struct Data {
        teams: Conn,
    }
    #[derive(Deserialize)]
    struct Conn {
        nodes: Vec<Team>,
    }
    let data: Data = graphql(api_key, TEAMS, serde_json::json!({})).await?;
    Ok(data.teams.nodes)
}

/// Workspace users, for the default-assignee picker (secondary line is email).
pub async fn get_users(api_key: &str) -> Result<Vec<Person>, String> {
    #[derive(Deserialize)]
    struct Data {
        users: Conn,
    }
    #[derive(Deserialize)]
    struct Conn {
        nodes: Vec<Node>,
    }
    #[derive(Deserialize)]
    struct Node {
        id: String,
        #[serde(default)]
        name: String,
        #[serde(rename = "displayName", default)]
        display_name: String,
        #[serde(default)]
        email: String,
    }
    let data: Data = graphql(api_key, USERS, serde_json::json!({})).await?;
    Ok(data
        .users
        .nodes
        .into_iter()
        .map(|n| Person {
            name: if n.display_name.is_empty() {
                n.name
            } else {
                n.display_name
            },
            detail: n.email,
            id: n.id,
        })
        .collect())
}
