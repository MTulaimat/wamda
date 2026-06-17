//! Lightweight update check. Ask GitHub for the latest published release and
//! compare its tag to the running version. Notify-only - we never download or
//! install, just surface a "newer version exists" flag + the release page URL
//! for the About pane. Failures (offline, rate-limited) return an Err the UI
//! quietly ignores, so a flaky connection never nags the user.

use serde::{Deserialize, Serialize};

/// GitHub "latest release" endpoint for this repo (newest non-draft,
/// non-prerelease release).
const LATEST_API: &str = "https://api.github.com/repos/MTulaimat/wamda/releases/latest";
/// Human-facing fallback if the API response somehow lacks an html_url.
const LATEST_PAGE: &str = "https://github.com/MTulaimat/wamda/releases/latest";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    /// True when the latest release tag is strictly newer than `current_version`.
    pub available: bool,
    pub current_version: String,
    pub latest_version: String,
    /// Release page to open in the browser.
    pub url: String,
}

/// Parse a tag like "v0.4.1" / "0.4.1-beta" into a comparable (major, minor,
/// patch). Strips a leading v/V and any -prerelease/+build suffix; missing or
/// non-numeric parts collapse to 0.
fn semver_tuple(v: &str) -> (u64, u64, u64) {
    let core = v.trim().trim_start_matches(|c| c == 'v' || c == 'V');
    let core = core.split(|c| c == '-' || c == '+').next().unwrap_or(core);
    let mut parts = core.split('.').map(|p| p.trim().parse::<u64>().unwrap_or(0));
    (
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
    )
}

/// Hit the GitHub releases API and compare against `current` (e.g. "0.4.0").
pub async fn check(current: &str) -> Result<UpdateInfo, String> {
    // GitHub rejects API requests that lack a User-Agent header.
    let resp = reqwest::Client::new()
        .get(LATEST_API)
        .header("User-Agent", "Wamda")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|_| "Could not reach GitHub".to_string())?;
    if !resp.status().is_success() {
        return Err(format!("GitHub error ({})", resp.status()));
    }

    #[derive(Deserialize)]
    struct Release {
        tag_name: String,
        #[serde(default)]
        html_url: String,
    }
    let rel = resp
        .json::<Release>()
        .await
        .map_err(|_| "Unexpected response from GitHub".to_string())?;

    let latest = rel
        .tag_name
        .trim_start_matches(|c| c == 'v' || c == 'V')
        .to_string();
    let available = semver_tuple(&latest) > semver_tuple(current);

    Ok(UpdateInfo {
        available,
        current_version: current.to_string(),
        latest_version: latest,
        url: if rel.html_url.is_empty() {
            LATEST_PAGE.to_string()
        } else {
            rel.html_url
        },
    })
}
