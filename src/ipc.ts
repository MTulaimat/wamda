/* Typed wrappers over Tauri's invoke() — the single surface the UI uses to talk to Rust. */
import { invoke } from "@tauri-apps/api/core";
import type {
  Board,
  Card,
  List,
  ProviderStatus,
  Reminder,
  Settings,
  TaskInput,
  TaskRef,
  TaskSummary,
  Team,
  Template,
  Person,
} from "./types";

export const getSettings = () => invoke<Settings>("get_settings");

export const saveSettings = (settings: Settings) =>
  invoke<void>("save_settings", { settings });

/* ---- Trello (settings pickers) ---- */
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

export const trelloGetTemplates = (key: string, token: string, boardId: string) =>
  invoke<Template[]>("trello_get_templates", { key, token, boardId });

export const trelloGetMembers = (key: string, token: string, boardId: string) =>
  invoke<Person[]>("trello_get_members", { key, token, boardId });

/* ---- Linear (settings picker) ---- */
export const linearGetTeams = (apiKey: string) =>
  invoke<Team[]>("linear_get_teams", { apiKey });

export const linearGetUsers = (apiKey: string) =>
  invoke<Person[]>("linear_get_users", { apiKey });

/* ---- Generic provider surface ---- */
export const providerCreateTask = (providerId: string, input: TaskInput) =>
  invoke<TaskRef>("provider_create_task", { providerId, input });

export const providerDeleteTask = (providerId: string, taskId: string) =>
  invoke<void>("provider_delete_task", { providerId, taskId });

export const providerListDue = (providerId: string, limit: number) =>
  invoke<TaskSummary[]>("provider_list_due", { providerId, limit });

export const providerListTemplates = (providerId: string) =>
  invoke<Template[]>("provider_list_templates", { providerId });

export const providerStatus = (providerId: string) =>
  invoke<ProviderStatus>("provider_status", { providerId });

export const listProviders = () =>
  invoke<ProviderStatus[]>("list_providers");

/* ---- Local reminders ---- */
export const reminderSchedule = (phrase: string, message: string) =>
  invoke<Reminder>("reminder_schedule", { phrase, message });

export const reminderRemove = (id: string) =>
  invoke<void>("reminder_remove", { id });

export const reminderList = () => invoke<Reminder[]>("reminder_list");

/* ---- Background timers ---- */
export const timerStart = (spec: string, label?: string) =>
  invoke<string>("timer_start", { spec, label: label ?? null });

/* ---- System ---- */
/** Re-register the global capture shortcut. Rejects with a readable string on conflict/invalid. */
export const registerShortcut = (accelerator: string) =>
  invoke<void>("register_shortcut", { accelerator });

export const setAutostart = (enabled: boolean) =>
  invoke<void>("set_autostart", { enabled });

export const showCapture = () => invoke<void>("show_capture");
export const hideCapture = () => invoke<void>("hide_capture");
export const openSettings = () => invoke<void>("open_settings");
