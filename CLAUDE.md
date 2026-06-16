# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Wamda** — a background quick-capture desktop app for Windows. A global hotkey
(`Ctrl+Alt+.`, configurable) toggles a centered "capture bar"; type a task, hit
Enter, and it becomes a card on a configured Trello list. Lives in the system
tray with no window on launch.

Stack: **Tauri 2** (Rust backend) + **React 18 + Vite + TypeScript** frontend.

## Commands

```bash
npm install
npm run tauri dev      # run the app (tray icon; no window until hotkey/tray click)
npm run tauri build    # release installer → src-tauri/target/release/bundle/
npm run build          # frontend only: tsc --noEmit type-check + vite build
```

There is no test suite or linter configured. `npm run build` (which runs
`tsc --noEmit`) is the type-check gate. For Rust changes, `cargo check` /
`cargo clippy` from `src-tauri/`.

## Architecture

### Two windows, two HTML entry points
This is a Vite multi-page app. Each Tauri window maps to its own HTML entry:
- `index.html` → `src/capture/main.tsx` → capture bar (window label `"capture"`)
- `settings.html` → `src/settings/main.tsx` → settings (window label `"settings"`)

Both windows are declared in [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json)
(transparent, decorationless, `visible: false`) and built via the `rollupOptions.input`
map in [vite.config.ts](vite.config.ts). Window labels are referenced by string
throughout the Rust backend — changing a label means changing it in tauri.conf.json,
the capability file, and `windows.rs`.

### The IPC boundary
The UI talks to Rust **only** through [src/ipc.ts](src/ipc.ts) — typed `invoke()`
wrappers, one per `#[tauri::command]`. The command surface is defined in
[src-tauri/src/commands.rs](src-tauri/src/commands.rs) and registered in the
`invoke_handler!` macro in [src-tauri/src/lib.rs](src-tauri/src/lib.rs). To add a
command: write it in `commands.rs`, register it in `lib.rs`, add a typed wrapper in
`ipc.ts`. Shared DTOs live in [src/types.ts](src/types.ts) and must stay in sync with
the `serde` structs (camelCase via `#[serde(rename_all = "camelCase")]`).

### Trello calls go through Rust, never the webview
[src-tauri/src/trello.rs](src-tauri/src/trello.rs) makes all Trello API calls with
`reqwest`. This is deliberate security design: the API token never touches the
webview's network surface. **Errors are mapped to readable, token-free strings**
(`net_err` / `status_err`) — never surface the raw request URL, which carries the
secret token in its query string. Preserve this invariant when editing.

### Settings flow
Persisted via `tauri-plugin-store` to `settings.json` ([settings.rs](src-tauri/src/settings.rs),
single `Settings` struct, the source of truth). On the frontend,
[src/useSettings.ts](src/useSettings.ts) loads on mount and saves debounced (250ms).
Each window mounts its own copy — they converge through the persisted store on next
open (the capture window re-fetches settings on every `capture:opened` event). Accent
color is applied live via CSS variables ([src/accent.ts](src/accent.ts)).

### Global shortcut: live re-registration
[src-tauri/src/shortcut.rs](src-tauri/src/shortcut.rs). The plugin handler reads the
*current* shortcut + paused flag from managed `AppState` (a `Mutex<Shortcut>`) at fire
time, so re-registering or pausing works without rebuilding the plugin. A shortcut
conflict at startup must NOT block launch — it degrades gracefully so the user can pick
another combo from the tray/settings. `register_current` clears stale registrations
first so a crashed prior instance can't cause "already registered".

### Window lifecycle (windows.rs + lib.rs event handler)
- Capture bar **shows centered on the monitor under the cursor**, focuses, and emits
  `capture:opened` (with optional clipboard prefill).
- On **focus loss** (`WindowEvent::Focused(false)`) the capture window emits
  `capture:reset` and hides — spotlight behavior. The reset returns the bar to its
  entrance start frame so the next open animates cleanly (see the entrance-via-
  animation-controls note in [src/capture/Capture.tsx](src/capture/Capture.tsx) —
  it deliberately does NOT remount, to avoid flicker).
- The **settings** window's close button hides instead of quitting (`prevent_close`).
- `tauri-plugin-single-instance` is registered **first** in the builder; a second
  launch just shows the capture bar instead of starting a new process.
- Tray left-click opens capture; the tray menu has Capture / Settings / Pause / Quit.

### Permissions
New Tauri APIs must be allowlisted in
[src-tauri/capabilities/default.json](src-tauri/capabilities/default.json) for the
`capture` and `settings` windows, or `invoke` will be denied at runtime.

## Conventions

- Design tokens and global CSS live in [src/tokens.ts](src/tokens.ts) (ported from
  `design/QuickCapture.jsx`, the original design mockup — reference only, not built).
- Styling is mostly inline styles + the accent CSS variable; animations use `motion`
  (Framer Motion). Icons are `lucide-react`.
- The capture input ([src/capture/CaptureInput.tsx](src/capture/CaptureInput.tsx)) is
  isolated with a `trailing` slot so a future mic/dictate button can be added without
  touching capture logic. Voice dictation is intentionally out of scope; no audio
  code exists by design.
- **Slash commands** are defined in [src/capture/commands.ts](src/capture/commands.ts)
  (`buildRegistry`) and handled in `run()` in
  [src/capture/Capture.tsx](src/capture/Capture.tsx). Whenever you add, remove, or
  change a slash command **or a keyboard shortcut**, ALWAYS update the hand-maintained
  reference lists in the Shortcuts settings pane
  ([src/settings/panes/Shortcuts.tsx](src/settings/panes/Shortcuts.tsx)) — they are not
  generated and drift silently otherwise.
- **App version**: the About pane ([src/settings/panes/About.tsx](src/settings/panes/About.tsx))
  reads it at runtime via `getVersion()` from
  [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) — never hardcode it. On a
  release bump, update the version in `tauri.conf.json` **and**
  [src-tauri/Cargo.toml](src-tauri/Cargo.toml) (keep the two in sync); the About pane
  then shows it automatically.
