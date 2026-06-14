# Wamda

A background quick-capture app for Windows. A global hotkey pops a centered
"capture bar"; type a task, hit **Enter**, and it lands as a card on a configured
Trello list. Lives in the system tray — no window on launch.

Built with **Tauri 2** (Rust backend) + **React 18 + Vite + TypeScript** frontend.

## Features

- Global hotkey (default `Ctrl+Alt+.`, configurable live) toggles the capture bar.
- Centers on the monitor under your cursor; `Esc` or focus-loss dismisses it.
- Creates Trello cards via Rust (`reqwest`) — the token never touches the webview's
  network surface and is never logged.
- Settings window: change the hotkey, connect Trello, pick board/list, launch-at-startup,
  capture sound, clipboard prefill, accent color.
- Signature "card flies to the tray" success animation + toast.

## Prerequisites

- **Node.js** 18+ and npm
- **Rust** (stable, MSVC toolchain) — https://rustup.rs
- **Microsoft C++ Build Tools** (MSVC) and the **WebView2** runtime (preinstalled on Win10/11)

## Develop

```bash
npm install
npm run tauri dev      # launches the app (tray icon; no window until hotkey/tray click)
```

## Build a release installer

```bash
npm run tauri build    # outputs to src-tauri/target/release/bundle/
```

## Project layout

```
src/                      React frontend
  tokens.ts               design tokens + global CSS (from design/QuickCapture.jsx)
  ipc.ts / types.ts       typed invoke() wrappers + shared types
  useSettings.ts          load-on-mount + debounced-save hook
  capture/                capture bar window (Capture.tsx, CaptureInput.tsx)
  settings/               settings window (sidebar + General/Trello/Appearance panes)
src-tauri/src/            Rust backend
  lib.rs                  builder wiring (single-instance first, plugins, tray, events)
  settings.rs             persisted Settings (tauri-plugin-store)
  trello.rs               reqwest calls + readable, token-free error mapping
  shortcut.rs             register/re-register/pause the global shortcut
  windows.rs              show/hide/center + tray + window-vibrancy
  commands.rs             #[tauri::command] surface
```

## Connecting Trello (manual test checklist)

You need your own Trello **API key** and **token**:

1. Open the Settings window (tray → Settings).
2. Go to the **Trello** tab. Click **"Where do I get this?"** — it opens
   https://trello.com/power-ups/admin. Create a Power-Up and copy its **API key**.
3. On the same page, generate a **token** (authorizes Wamda against your account).
   Paste both into the fields.
4. Click **Test connection** → it should turn green ("Connected") and load your boards.
5. Pick a **Board** → lists load → pick a **List**. The selection is persisted.
6. Close Settings. Press `Ctrl+Alt+.`, type a task, hit **Enter** — a card should
   appear on the chosen list, with the fly + "Added to {list}" toast.

### Definition-of-done checklist

- [ ] Launch shows only a tray icon — no window flashes.
- [ ] `Ctrl+Alt+.` and tray left-click open the centered bar with the input focused.
- [ ] `Esc` and clicking away (blur) dismiss it.
- [ ] Enter creates a real card on the chosen list, then dismisses.
- [ ] Unconfigured Trello shows an inline "Connect Trello in Settings" state (no crash).
- [ ] API errors surface as readable inline messages and keep your typed text.
- [ ] Settings persist across restart; changing the hotkey re-registers it live.
- [ ] Launch-at-startup actually registers/removes the OS autostart entry.

## Out of scope

Voice dictation. The capture input (`CaptureInput.tsx`) is isolated with a `trailing`
slot so a mic/dictate button can be added later without touching capture logic. No
audio code exists yet by design.
