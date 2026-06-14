use serde::{Deserialize, Serialize};

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
