/* Capture-bar command parsing + registry. Pure functions, no side effects. */
import type { ProviderId, ProviderStatus } from "../types";

export type CommandId =
  | "remind"
  | "timer"
  | "sup"
  | "template"
  | "note"
  | "notes"
  | "reminders"
  | "undo"
  | "provider";

export type CommandSpec = {
  id: CommandId;
  /** Trigger token without the leading slash, e.g. "remind" or a provider id. */
  token: string;
  title: string;
  hint: string;
  /** Carried for the dynamic /trello · /linear route entries. */
  providerId?: string;
};

export type ParsedCommand = {
  isCommand: boolean; // text starts with "/"
  token: string; // first word after "/", lowercased ("" while typing just "/")
  rest: string; // everything after the first space
  raw: string;
};

export function parseCommand(text: string): ParsedCommand {
  if (!text.startsWith("/")) {
    return { isCommand: false, token: "", rest: "", raw: text };
  }
  const body = text.slice(1);
  const sp = body.indexOf(" ");
  const token = (sp === -1 ? body : body.slice(0, sp)).toLowerCase();
  const rest = sp === -1 ? "" : body.slice(sp + 1);
  return { isCommand: true, token, rest, raw: text };
}

/** Static commands + one route entry per provider from list_providers(). */
export function buildRegistry(providers: ProviderStatus[]): CommandSpec[] {
  const base: CommandSpec[] = [
    { id: "remind", token: "remind", title: "Remind me", hint: "in 10 minutes to send email" },
    { id: "timer", token: "timer", title: "Start a timer", hint: "25m focus" },
    { id: "sup", token: "sup", title: "What's due", hint: "your upcoming tasks" },
    { id: "template", token: "template", title: "From a template", hint: "start from a saved template · Trello only" },
    { id: "note", token: "note", title: "Save a note", hint: "jot something — stays local, not a task" },
    { id: "notes", token: "notes", title: "Your notes", hint: "list & delete saved notes" },
    { id: "reminders", token: "reminders", title: "Your reminders", hint: "list & delete reminders" },
    { id: "undo", token: "undo", title: "Undo last", hint: "delete the last task & bring it back to edit" },
  ];
  const routes = providers.map<CommandSpec>((p) => ({
    id: "provider",
    token: p.id,
    providerId: p.id,
    title: `Send to ${p.label}`,
    hint: p.configured ? "set as default, or one-off send" : `${p.label} — not connected`,
  }));
  return [...base, ...routes];
}

/** Prefix-filter the registry as the user types "/re…". */
export function matchCommands(reg: CommandSpec[], token: string): CommandSpec[] {
  if (!token) return reg;
  return reg.filter((c) => c.token.startsWith(token));
}

const cleanMessage = (m: string) => m.replace(/^to\s+/i, "").trim();

// A trailing natural-language time phrase, used only when there's no " to "
// separator. e.g. "buy milk at 5pm", "call mom tomorrow", "ship it in 2h".
const DAY = "(?:mon|tue|wed|thu|fri|sat|sun)";
const TRAILING_TIME = new RegExp(
  "\\s+(" +
    `(?:tomorrow|today|tonight|next\\b.*|this\\b.*|${DAY}\\w*\\b.*)` +
    "|" +
    `(?:at|in|on|by)\\s+(?:\\d|noon|midnight|${DAY}).*` +
    ")$",
  "i",
);

/**
 * Split `/remind` args into a time phrase + message. Primary form is
 * "<time> to <message>"; falls back to detecting a trailing time phrase when
 * there's no "to". The time phrase is resolved to an absolute time in Rust.
 */
export function splitRemind(rest: string): { phrase: string; message: string } {
  const s = rest.trim().replace(/^me\s+/i, "");
  const toIdx = s.toLowerCase().indexOf(" to ");
  if (toIdx !== -1) {
    return {
      phrase: s.slice(0, toIdx).trim(),
      message: cleanMessage(s.slice(toIdx + 4)),
    };
  }
  const m = s.match(TRAILING_TIME);
  if (m && m.index !== undefined) {
    return {
      phrase: s.slice(m.index).trim(),
      message: cleanMessage(s.slice(0, m.index)),
    };
  }
  // No detectable time → all message; Rust will ask for a time.
  return { phrase: "", message: cleanMessage(s) };
}

/** `/timer <spec> [label]` → duration spec + optional label. */
export function parseTimer(rest: string): { spec: string; label?: string } {
  const trimmed = rest.trim();
  const sp = trimmed.indexOf(" ");
  if (sp === -1) return { spec: trimmed };
  return { spec: trimmed.slice(0, sp), label: trimmed.slice(sp + 1).trim() || undefined };
}

/** `/sup [provider] [n]` in any order → provider id + limit. */
export function parseSup(
  rest: string,
  fallbackProvider: ProviderId,
): { providerId: string; limit: number } {
  let providerId: string = fallbackProvider;
  let limit = 3;
  for (const t of rest.trim().split(/\s+/).filter(Boolean)) {
    const n = parseInt(t, 10);
    if (!Number.isNaN(n)) limit = Math.min(Math.max(n, 1), 20);
    else providerId = t.toLowerCase();
  }
  return { providerId, limit };
}
