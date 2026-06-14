/* Mirrors the Rust serde structs (camelCase). */

export type Settings = {
  shortcut: string; // e.g. "Ctrl+Alt+Space"
  trelloKey: string;
  trelloToken: string;
  boardId: string;
  boardName: string;
  listId: string;
  listName: string;
  launchAtStartup: boolean;
  soundOnCapture: boolean;
  prefillFromClipboard: boolean;
  accent: string; // hex, default "#6E7BFF"
};

export type Board = { id: string; name: string };
export type List = { id: string; name: string };
export type Card = { id: string; name: string; url: string };

export const DEFAULT_SETTINGS: Settings = {
  shortcut: "Ctrl+Alt+.",
  trelloKey: "",
  trelloToken: "",
  boardId: "",
  boardName: "",
  listId: "",
  listName: "",
  launchAtStartup: false,
  soundOnCapture: true,
  prefillFromClipboard: false,
  accent: "#6E7BFF",
};
