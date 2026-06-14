/* Typed wrappers over Tauri's invoke() — the single surface the UI uses to talk to Rust. */
import { invoke } from "@tauri-apps/api/core";
import type { Board, Card, List, Settings } from "./types";

export const getSettings = () => invoke<Settings>("get_settings");

export const saveSettings = (settings: Settings) =>
  invoke<void>("save_settings", { settings });

export const trelloGetBoards = (key: string, token: string) =>
  invoke<Board[]>("trello_get_boards", { key, token });

export const trelloGetLists = (key: string, token: string, boardId: string) =>
  invoke<List[]>("trello_get_lists", { key, token, boardId });

export const trelloCreateCard = (
  key: string,
  token: string,
  listId: string,
  name: string,
) => invoke<Card>("trello_create_card", { key, token, listId, name });

/** Re-register the global capture shortcut. Rejects with a readable string on conflict/invalid. */
export const registerShortcut = (accelerator: string) =>
  invoke<void>("register_shortcut", { accelerator });

export const setAutostart = (enabled: boolean) =>
  invoke<void>("set_autostart", { enabled });

export const showCapture = () => invoke<void>("show_capture");
export const hideCapture = () => invoke<void>("hide_capture");
export const openSettings = () => invoke<void>("open_settings");
