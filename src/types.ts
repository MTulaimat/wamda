/* Mirrors the Rust serde structs (camelCase). */

export type TrelloConfig = {
  key: string;
  token: string;
  boardId: string;
  boardName: string;
  listId: string;
  listName: string;
  templateId: string;
  templateName: string;
  assigneeId: string;
  assigneeName: string;
  connected: boolean;
};

export type LinearConfig = {
  apiKey: string;
  teamId: string;
  teamName: string;
  templateId: string;
  templateName: string;
  assigneeId: string;
  assigneeName: string;
  connected: boolean;
};

export type Providers = {
  trello: TrelloConfig;
  linear: LinearConfig;
};

export type ProviderId = "trello" | "linear";

export type Settings = {
  shortcut: string; // e.g. "Ctrl+Alt+."
  launchAtStartup: boolean;
  soundOnCapture: boolean;
  prefillFromClipboard: boolean;
  accent: string; // hex, default "#6E7BFF"
  defaultProvider: ProviderId;
  providers: Providers;
};

export type Board = { id: string; name: string };
export type List = { id: string; name: string };
export type Card = { id: string; name: string; url: string };
export type Team = { id: string; name: string; key: string };
export type Template = { id: string; name: string };
export type Person = { id: string; name: string; detail: string };

/* Provider-agnostic DTOs (mirror provider.rs). */
export type TaskInput = {
  title: string;
  description?: string | null;
  due?: string | null; // ISO yyyy-mm-dd
  templateId?: string | null; // provider-native template to base the task on
};
export type TaskRef = { id: string; url: string };
export type TaskSummary = { title: string; url: string; due: string | null };
export type ProviderStatus = { id: string; configured: boolean; label: string };

export type Reminder = {
  id: string;
  fireAt: string;
  message: string;
  createdAt: string;
};

export type Note = {
  id: string;
  text: string;
  createdAt: string;
};

export type UpdateInfo = {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  url: string;
};

export const DEFAULT_SETTINGS: Settings = {
  shortcut: "Ctrl+Alt+.",
  launchAtStartup: false,
  soundOnCapture: true,
  prefillFromClipboard: false,
  accent: "#6E7BFF",
  defaultProvider: "trello",
  providers: {
    trello: {
      key: "",
      token: "",
      boardId: "",
      boardName: "",
      listId: "",
      listName: "",
      templateId: "",
      templateName: "",
      assigneeId: "",
      assigneeName: "",
      connected: false,
    },
    linear: {
      apiKey: "",
      teamId: "",
      teamName: "",
      templateId: "",
      templateName: "",
      assigneeId: "",
      assigneeName: "",
      connected: false,
    },
  },
};

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  trello: "Trello",
  linear: "Linear",
};
