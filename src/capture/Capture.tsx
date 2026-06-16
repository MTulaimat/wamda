import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Check,
  ChevronDown,
  CornerDownLeft,
  Layout,
  LayoutTemplate,
  Link2,
  Settings as SettingsIcon,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { T } from "../tokens";
import {
  getSettings,
  hideCapture,
  listProviders,
  openSettings,
  providerCreateTask,
  providerDeleteTask,
  providerListDue,
  providerListTemplates,
  noteCreate,
  noteList,
  noteRemove,
  reminderList,
  reminderRemove,
  reminderSchedule,
  timerStart,
} from "../ipc";
import { useSettings } from "../useSettings";
import { applyAccent } from "../accent";
import { playChime } from "../sound";
import { CaptureInput } from "./CaptureInput";
import { DestinationPicker } from "./DestinationPicker";
import {
  buildRegistry,
  type CommandSpec,
  matchCommands,
  parseCommand,
  parseSup,
  parseTimer,
  splitRemind,
} from "./commands";
import {
  PROVIDER_LABELS,
  type Note,
  type ProviderId,
  type ProviderStatus,
  type Reminder,
  type TaskSummary,
  type Template,
} from "../types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type OpenedPayload = { prefill?: string | null };
type SupResults = { providerId: string; items: TaskSummary[] };
// /notes and /reminders share one deletable-list panel.
type LocalList =
  | { kind: "notes"; items: Note[] }
  | { kind: "reminders"; items: Reminder[] };

// Shown until list_providers() resolves, so /trello · /linear appear immediately.
const DEFAULT_PROVIDERS: ProviderStatus[] = [
  { id: "trello", label: "Trello", configured: false },
  { id: "linear", label: "Linear", configured: false },
];

// Entrance is driven by animation controls (not a remount) so replaying it on
// each open never unmounts the bar — which is what caused the open flicker.
const ENTRANCE_FROM = { opacity: 0, y: 12, scale: 0.965, filter: "blur(6px)" };
const ENTRANCE_TO = {
  opacity: 1,
  y: 0,
  scale: 1,
  filter: "blur(0px)",
  transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] as const },
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function formatDue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const labelFor = (id: string): string => PROVIDER_LABELS[id as ProviderId] ?? id;

/** A row in the /notes · /reminders panel: text, timestamp, and a delete button. */
function LocalRow({
  primary,
  when,
  first,
  onDelete,
}: {
  primary: string;
  when: string;
  first: boolean;
  onDelete: () => void;
}) {
  return (
    <div
      className="row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 16px",
        borderTop: first ? "none" : `1px solid ${T.hairline}`,
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13.5,
          color: T.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={primary}
      >
        {primary}
      </span>
      <span style={{ flexShrink: 0, fontSize: 12, color: T.faint }}>
        {formatWhen(when)}
      </span>
      <button
        className="icon-btn"
        onClick={onDelete}
        title="Delete"
        style={{
          display: "grid",
          placeItems: "center",
          width: 26,
          height: 26,
          flexShrink: 0,
          padding: 0,
          borderRadius: 7,
          border: `1px solid ${T.border}`,
          background: "rgba(255,255,255,0.04)",
          color: T.sub,
          cursor: "pointer",
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function Capture() {
  const { settings, setSettings, update, updateProvider } = useSettings();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState("");
  const [due, setDue] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [supResults, setSupResults] = useState<SupResults | null>(null);
  const [localList, setLocalList] = useState<LocalList | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dropdownIdx, setDropdownIdx] = useState(0);
  // The template the next capture is based on (from a provider default or a
  // `/template` pick), plus the lazily-fetched list for the picker.
  const [template, setTemplate] = useState<Template | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesErr, setTemplatesErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const openDatePickerRef = useRef<(() => void) | null>(null);
  // The last task we created, for `/undo`. A ref (not state) so it survives the
  // capture window hiding/reopening — which runs resetAll() and clears form state.
  const lastSubmitRef = useRef<{
    providerId: ProviderId;
    taskId: string;
    title: string;
    description: string;
    due: string | null;
  } | null>(null);
  // Which provider's templates are currently cached (null = not loaded).
  const templatesProvider = useRef<string | null>(null);
  const controls = useAnimationControls();

  const registry = useMemo(
    () => buildRegistry(providers.length ? providers : DEFAULT_PROVIDERS),
    [providers],
  );

  // Replay the entrance without remounting (set to the start frame, then animate in).
  const playEntrance = useCallback(() => {
    controls.set(ENTRANCE_FROM);
    void controls.start(ENTRANCE_TO);
    inputRef.current?.focus();
  }, [controls]);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 340);
  }, []);

  // Derived destination state for the active provider.
  const trello = settings.providers.trello;
  const linear = settings.providers.linear;
  const trelloConfigured = !!(trello.key && trello.token && trello.listId);
  const linearConfigured = !!(linear.apiKey && linear.teamId);
  const dp = settings.defaultProvider;
  const configured = dp === "trello" ? trelloConfigured : linearConfigured;
  const destination =
    dp === "trello" ? trello.listName || "Not set" : linear.teamName || "Not set";
  const destinationLabel =
    dp === "trello" ? trello.listName || "Trello" : linear.teamName || "Linear";

  const parsed = parseCommand(text);
  const isCommand = parsed.isCommand;
  const afterSlash = text.startsWith("/") ? text.slice(1) : "";
  const typingToken = isCommand && !afterSlash.includes(" ");
  const matches = typingToken ? matchCommands(registry, parsed.token) : [];
  const showDropdown = !sending && !toast && typingToken && matches.length > 0;
  const submitLabel = isCommand ? "Run" : dp === "linear" ? "Add issue" : "Add card";
  const activeSpec = isCommand
    ? registry.find((c) => c.token === parsed.token)
    : undefined;

  // `/template …` argument zone → show the template picker instead of commands.
  const inTemplateArgs =
    isCommand && parsed.token === "template" && afterSlash.includes(" ");
  const templateQuery = parsed.rest.trim().toLowerCase();
  const templateMatches = templates.filter((t) =>
    t.name.toLowerCase().includes(templateQuery),
  );
  const showTemplateDropdown = !sending && !toast && inTemplateArgs;
  // The active provider's configured default template (empty id = none).
  const defTplId = settings.providers[dp].templateId;
  const defTplName = settings.providers[dp].templateName;

  // The button loader reads "Adding…" only for task sends (not local commands).
  const showSendLoader = !isCommand || !!activeSpec?.providerId;

  // Start hidden; the entrance plays on the first (and every) show event.
  useEffect(() => {
    controls.set(ENTRANCE_FROM);
  }, [controls]);

  // Load the provider registry once up front.
  useEffect(() => {
    void listProviders().then(setProviders).catch(() => {});
  }, []);

  // Reset the dropdown highlight whenever the query changes.
  useEffect(() => {
    setDropdownIdx(0);
  }, [text]);

  // Switching providers invalidates the cached template list.
  useEffect(() => {
    templatesProvider.current = null;
    setTemplates([]);
  }, [dp]);

  // The effective template starts from the provider's configured default. A
  // `/template` pick overrides this (it doesn't touch the default), and ✕ clears
  // it for the current capture. Re-runs on open (fresh settings) and dp change.
  useEffect(() => {
    setTemplate(defTplId ? { id: defTplId, name: defTplName || "Template" } : null);
  }, [dp, defTplId, defTplName]);

  // Lazily fetch templates the first time the user enters `/template `.
  useEffect(() => {
    if (!inTemplateArgs || !configured) return;
    if (templatesProvider.current === dp) return;
    templatesProvider.current = dp;
    setTemplatesErr(null);
    setTemplatesLoading(true);
    providerListTemplates(dp)
      .then(setTemplates)
      .catch((e) => {
        setTemplates([]);
        setTemplatesErr(String(e));
        templatesProvider.current = null; // allow a retry
      })
      .finally(() => setTemplatesLoading(false));
  }, [inTemplateArgs, configured, dp]);

  // React to Rust show/hide lifecycle events.
  useEffect(() => {
    const resetAll = () => {
      setText("");
      setSending(false);
      setToast(null);
      setError(null);
      setSupResults(null);
      setLocalList(null);
      setPickerOpen(false);
      setExpanded(false);
      setDescription("");
      setDue(null);
      setTemplate(null);
      setTemplatesErr(null);
      setTemplates([]);
      templatesProvider.current = null;
    };
    const unlistenOpened = listen<OpenedPayload>("capture:opened", (e) => {
      resetAll();
      if (e.payload?.prefill) setText(e.payload.prefill);
      // Pull fresh settings + provider statuses so the chip/commands are current.
      void getSettings()
        .then((s) => {
          setSettings(s);
          applyAccent(s.accent);
          // Seed the effective template from the active provider's default. Must
          // happen here (not only via the defTpl effect): on a reopen the saved
          // id is unchanged, so that effect won't re-fire after resetAll cleared
          // the chip — which would silently drop the default on every capture.
          const cfg = s.providers[s.defaultProvider];
          setTemplate(
            cfg.templateId
              ? { id: cfg.templateId, name: cfg.templateName || "Template" }
              : null,
          );
        })
        .catch(() => {});
      void listProviders().then(setProviders).catch(() => {});
      playEntrance(); // replay entrance + refocus (no remount → no flicker)
    });
    const unlistenReset = listen("capture:reset", () => {
      resetAll();
      // Hide the bar so the next show starts from the entrance start frame.
      controls.set(ENTRANCE_FROM);
    });
    return () => {
      void unlistenOpened.then((f) => f());
      void unlistenReset.then((f) => f());
    };
  }, [playEntrance, controls, setSettings]);

  // Esc is staged: picker → results → collapse details → hide.
  // Ctrl/Cmd+, opens Settings (standard).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === ",") {
        e.preventDefault();
        void openSettings();
        return;
      }
      if (mod && e.key === "1") {
        e.preventDefault();
        update({ defaultProvider: "trello" });
        return;
      }
      if (mod && e.key === "2") {
        e.preventDefault();
        update({ defaultProvider: "linear" });
        return;
      }
      if (mod && e.key.toLowerCase() === "p" && !isCommand) {
        e.preventDefault();
        setPickerOpen((v) => !v);
        return;
      }
      if (mod && e.key.toLowerCase() === "d" && !isCommand) {
        e.preventDefault();
        setExpanded(true);
        window.setTimeout(() => openDatePickerRef.current?.(), 70);
        return;
      }
      if (e.key !== "Escape") return;
      if (pickerOpen) {
        setPickerOpen(false);
        return;
      }
      if (localList) {
        setLocalList(null);
        setText("");
        return;
      }
      if (supResults) {
        setSupResults(null);
        setText("");
        return;
      }
      if (expanded) {
        setExpanded(false);
        return;
      }
      void hideCapture();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen, localList, supResults, expanded, isCommand, update]);

  const finishWithToast = async (message: string) => {
    setSending(false);
    setText("");
    setExpanded(false);
    setDescription("");
    setDue(null);
    setSupResults(null);
    setLocalList(null);
    setToast(message);
    if (settings.soundOnCapture) playChime();
    // The bar stays open after a capture/command so you can keep going; refocus
    // for the next entry (after the re-render re-enables the disabled input).
    setTimeout(() => inputRef.current?.focus(), 0);
    await delay(1300);
    setToast(null);
  };

  const run = async () => {
    const p = parseCommand(text);

    // Default task capture (no leading slash).
    if (!p.isCommand) {
      const value = text.trim();
      if (!value) {
        triggerShake();
        return;
      }
      if (!configured) {
        setError("notconfigured");
        triggerShake();
        return;
      }
      setError(null);
      setSending(true);
      try {
        const created = await providerCreateTask(dp, {
          title: value,
          description: description.trim() || null,
          due,
          templateId: template?.id ?? null,
        });
        lastSubmitRef.current = {
          providerId: dp,
          taskId: created.id,
          title: value,
          description: description.trim(),
          due,
        };
        await finishWithToast(
          template
            ? `Added to ${destinationLabel} · from ${template.name}`
            : `Added to ${destinationLabel}`,
        );
      } catch (e) {
        setSending(false); // restores the input with text intact
        setError(String(e));
        triggerShake();
      }
      return;
    }

    // Commands.
    setError(null);
    try {
      switch (p.token) {
        case "remind": {
          const { phrase, message } = splitRemind(p.rest);
          setSending(true);
          const r = await reminderSchedule(phrase, message);
          await finishWithToast(`Reminder set for ${formatWhen(r.fireAt)}`);
          break;
        }
        case "timer": {
          const { spec, label } = parseTimer(p.rest);
          setSending(true);
          const confirm = await timerStart(spec, label);
          await finishWithToast(confirm);
          break;
        }
        case "sup": {
          const { providerId, limit } = parseSup(p.rest, dp);
          setSending(true);
          const items = await providerListDue(providerId, limit);
          setSending(false);
          setText("");
          setSupResults({ providerId, items });
          break;
        }
        case "note": {
          const body = p.rest.trim();
          if (!body) {
            setError("What should the note say?");
            triggerShake();
            return;
          }
          setSending(true);
          await noteCreate(body);
          await finishWithToast("Note saved");
          break;
        }
        case "notes": {
          setSending(true);
          const items = await noteList();
          setSending(false);
          setText("");
          setLocalList({ kind: "notes", items });
          break;
        }
        case "reminders": {
          setSending(true);
          const items = await reminderList();
          setSending(false);
          setText("");
          // Soonest-first; the stored order is just insertion order.
          items.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
          setLocalList({ kind: "reminders", items });
          break;
        }
        case "template": {
          // Reached only via the submit button while still picking; select the
          // highlighted template (Enter in the picker is handled in keydown).
          const hi =
            templateMatches[Math.min(dropdownIdx, templateMatches.length - 1)];
          if (hi) pickTemplate(hi);
          else triggerShake();
          return;
        }
        case "undo": {
          const last = lastSubmitRef.current;
          if (!last) {
            setError("Nothing to undo yet");
            triggerShake();
            return;
          }
          setSending(true);
          try {
            await providerDeleteTask(last.providerId, last.taskId);
          } catch (e) {
            setSending(false);
            setError(String(e));
            triggerShake();
            return;
          }
          lastSubmitRef.current = null; // consumed — can't undo the same task twice
          setSending(false);
          // Bring the deleted task back into the bar so it can be edited & re-added.
          if (last.providerId !== dp) update({ defaultProvider: last.providerId });
          setDescription(last.description);
          setDue(last.due);
          setExpanded(!!(last.description || last.due));
          setText(last.title);
          setToast(`Removed from ${PROVIDER_LABELS[last.providerId]} — edit & re-add`);
          setTimeout(() => setToast(null), 1700);
          setTimeout(() => inputRef.current?.focus(), 0);
          return;
        }
        default: {
          // /trello or /linear (a provider route command).
          const spec = registry.find(
            (c) => c.id === "provider" && c.token === p.token,
          );
          if (!spec?.providerId) {
            setError(`Unknown command “/${p.token}”`);
            triggerShake();
            return;
          }
          const pid = spec.providerId as ProviderId;
          const pConfigured = pid === "trello" ? trelloConfigured : linearConfigured;
          if (p.rest.trim() === "") {
            // No message → just switch the destination and keep the bar open.
            // (An empty command never creates a task or closes the window.)
            update({ defaultProvider: pid });
            setText("");
            setError(null);
            inputRef.current?.focus();
            return;
          }
          if (!pConfigured) {
            setError(`Connect ${PROVIDER_LABELS[pid]} in Settings`);
            triggerShake();
            return;
          }
          setSending(true);
          const created = await providerCreateTask(pid, {
            title: p.rest.trim(),
            description: description.trim() || null,
            due,
          });
          lastSubmitRef.current = {
            providerId: pid,
            taskId: created.id,
            title: p.rest.trim(),
            description: description.trim(),
            due,
          };
          await finishWithToast(`Added to ${PROVIDER_LABELS[pid]}`);
        }
      }
    } catch (e) {
      setSending(false);
      setError(String(e));
      triggerShake();
    }
  };

  const completeWith = (c?: CommandSpec) => {
    if (!c) return;
    setText(`/${c.token} `);
    setDropdownIdx(0);
    inputRef.current?.focus();
  };

  // Lock in a template and return to normal capture (text becomes the title).
  const pickTemplate = (t: Template) => {
    setTemplate({ id: t.id, name: t.name });
    setText("");
    setDropdownIdx(0);
    inputRef.current?.focus();
  };

  const removeTemplate = () => {
    setTemplate(null);
    inputRef.current?.focus();
  };

  // Delete a note/reminder from its list panel: remove server-side, then drop it
  // from the visible list (keeps the panel open so you can clear several).
  const removeLocalItem = async (id: string) => {
    if (!localList) return;
    try {
      if (localList.kind === "notes") await noteRemove(id);
      else await reminderRemove(id);
    } catch (e) {
      setError(String(e));
      triggerShake();
      return;
    }
    setLocalList((cur) => {
      if (!cur) return null;
      return cur.kind === "notes"
        ? { kind: "notes", items: cur.items.filter((n) => n.id !== id) }
        : { kind: "reminders", items: cur.items.filter((r) => r.id !== id) };
    });
  };

  const onChangeText = (v: string) => {
    setText(v);
    if (error) setError(null);
    if (supResults) setSupResults(null);
    if (localList) setLocalList(null);
  };

  const focusDescription = () => {
    setExpanded(true);
    window.setTimeout(() => descRef.current?.focus(), 50);
  };

  const onTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace on an empty title clears the selected template chip.
    if (e.key === "Backspace" && template && text === "") {
      e.preventDefault();
      removeTemplate();
      return;
    }
    // Template picker (`/template `) — arrow to move, Enter/Tab to select.
    if (showTemplateDropdown) {
      const list = templateMatches;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (list.length) setDropdownIdx((i) => (i + 1) % list.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (list.length) setDropdownIdx((i) => (i - 1 + list.length) % list.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const hi = list[Math.min(dropdownIdx, list.length - 1)];
        if (hi) pickTemplate(hi);
        return;
      }
    }
    if (showDropdown) {
      const hi = matches[Math.min(dropdownIdx, matches.length - 1)];
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setDropdownIdx((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setDropdownIdx((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        completeWith(hi);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        // A fully-typed command runs; a partial match completes first.
        // `/template` and `/note` always complete into their arg zone (the text
        // they need follows the token), never "run" on the bare command.
        const completesOnly = hi?.token === "template" || hi?.token === "note";
        if (hi && hi.token === parsed.token && !completesOnly) void run();
        else completeWith(hi);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void run();
      return;
    }
    // Tab moves into the description (expanding details first).
    if (e.key === "Tab" && !e.shiftKey && !isCommand) {
      e.preventDefault();
      focusDescription();
      return;
    }
    if (!isCommand && (e.ctrlKey || e.metaKey) && e.key === "ArrowDown") {
      e.preventDefault();
      focusDescription();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "ArrowUp") {
      e.preventDefault();
      setExpanded(false);
    }
  };

  const onDescKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void run();
      return;
    }
    // Shift+Tab returns to the title.
    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

  const templateChip = template ? (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        flexShrink: 0,
        maxWidth: 220,
        padding: "4px 5px 4px 9px",
        borderRadius: 8,
        background: "rgba(110,123,255,0.14)",
        border: "1px solid var(--accent)",
        color: "var(--accent)",
        fontSize: 12.5,
        fontWeight: 600,
      }}
      title={`Based on “${template.name}”`}
    >
      <LayoutTemplate size={12} style={{ flexShrink: 0 }} />
      <span
        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {template.name}
      </span>
      <button
        className="icon-btn"
        onMouseDown={(e) => {
          e.preventDefault();
          removeTemplate();
        }}
        title="Remove template"
        style={{
          display: "grid",
          placeItems: "center",
          width: 16,
          height: 16,
          padding: 0,
          borderRadius: 5,
          border: "none",
          background: "transparent",
          color: "var(--accent)",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <X size={12} />
      </button>
    </span>
  ) : undefined;

  return (
    <div
      className="qc-root"
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 96,
        overflow: "hidden",
      }}
      onMouseDown={(e) => {
        // Clicking the transparent area (outside the bar) dismisses.
        if (e.target === e.currentTarget) void hideCapture();
      }}
    >
      <div
        style={{
          position: "relative",
          width: 580,
          maxWidth: "92vw",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <motion.div
          className={shake ? "shake" : ""}
          initial={ENTRANCE_FROM}
          animate={controls}
          style={{
            position: "relative",
            zIndex: 0,
            width: "100%",
            background: "#121420",
            border: `1px solid ${T.border}`,
            borderRadius: 18,
            boxShadow:
              "0 24px 70px -12px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <CaptureInput
            ref={inputRef}
            value={text}
            disabled={sending}
            onChange={onChangeText}
            onKeyDown={onTitleKeyDown}
            placeholder={
              isCommand
                ? "Type a command…"
                : template
                  ? `Name this ${dp === "linear" ? "issue" : "card"}…`
                  : "What needs doing?"
            }
            leading={!isCommand ? templateChip : undefined}
            showExpandToggle={!isCommand}
            expanded={expanded && !isCommand}
            onToggleExpand={() => setExpanded((v) => !v)}
            description={description}
            descriptionRef={descRef}
            onDescriptionChange={setDescription}
            onDescriptionKeyDown={onDescKeyDown}
            due={due}
            onDatePickerReady={(fn) => {
              openDatePickerRef.current = fn;
            }}
            onDueChange={setDue}
          />

          {/* footer bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "11px 16px",
              borderTop: `1px solid ${T.hairline}`,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  flexShrink: 0,
                  userSelect: "none",
                }}
              >
                <Zap size={13} color="var(--accent)" />
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: T.sub,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Wamda
                </span>
              </span>
              <span
                style={{ width: 1, height: 13, background: T.border, flexShrink: 0 }}
              />
              {error === "notconfigured" ? (
              <button
                className="btn"
                onClick={() => void openSettings()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "5px 10px",
                  borderRadius: 8,
                  background: "rgba(255,138,91,0.12)",
                  border: `1px solid rgba(255,138,91,0.4)`,
                  color: "#FF8A5B",
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
              >
                <Link2 size={13} /> Connect {PROVIDER_LABELS[dp]} in Settings
              </button>
            ) : error ? (
              <span
                style={{
                  fontSize: 12.5,
                  color: "#FF6B6B",
                  fontWeight: 500,
                  maxWidth: 380,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={error}
              >
                {error}
              </span>
            ) : isCommand ? (
              <span style={{ fontSize: 12.5, color: T.faint, fontWeight: 500 }}>
                {activeSpec ? (
                  <>
                    <span className="mono" style={{ color: "var(--accent)" }}>
                      /{activeSpec.token}
                    </span>{" "}
                    {activeSpec.hint}
                  </>
                ) : (
                  "Type a command — / for the list"
                )}
              </span>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  className="btn"
                  onClick={() => setPickerOpen((v) => !v)}
                  title="Choose destination"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "5px 10px",
                    borderRadius: 8,
                    background: pickerOpen
                      ? "rgba(110,123,255,0.12)"
                      : "rgba(255,255,255,0.05)",
                    border: `1px solid ${pickerOpen ? "var(--accent)" : T.border}`,
                    color: T.text,
                    fontSize: 12.5,
                    fontWeight: 500,
                  }}
                >
                  <Layout size={13} color="var(--accent)" />
                  {PROVIDER_LABELS[dp]} <span style={{ color: T.faint }}>·</span>{" "}
                  {destination}
                  <ChevronDown
                    size={13}
                    color={T.faint}
                    style={{
                      transform: pickerOpen ? "rotate(180deg)" : "none",
                      transition: "transform .2s cubic-bezier(.16,1,.3,1)",
                    }}
                  />
                </button>
              </div>
            )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                className="icon-btn"
                onClick={() => void openSettings()}
                title="Open settings"
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 30,
                  height: 30,
                  padding: 0,
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: "rgba(255,255,255,0.04)",
                  color: T.sub,
                  cursor: "pointer",
                }}
              >
                <SettingsIcon size={16} />
              </button>
              <button
                className="btn"
                onClick={() => void run()}
                disabled={sending}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minWidth: 96,
                  padding: "6px 12px",
                  borderRadius: 9,
                  background: "var(--accent)",
                  border: "none",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  boxShadow: "0 4px 14px -4px rgba(110,123,255,0.7)",
                }}
              >
                {sending ? (
                  <>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        border: "2px solid rgba(255,255,255,0.4)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin .7s linear infinite",
                      }}
                    />
                    {showSendLoader ? "Adding…" : "Working…"}
                  </>
                ) : (
                  <>
                    {submitLabel} <CornerDownLeft size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* destination picker (provider → board/team → list) */}
        <AnimatePresence>
          {pickerOpen && !isCommand && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "relative",
                zIndex: 1,
                background: "#121420",
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: 14,
                boxShadow: "0 24px 70px -12px rgba(0,0,0,0.6)",
              }}
            >
              <DestinationPicker
                settings={settings}
                update={update}
                updateProvider={updateProvider}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* command autocomplete */}
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "relative",
                zIndex: 1,
                background: "#121420",
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                overflowX: "hidden",
                overflowY: "auto",
                maxHeight: 240,
                boxShadow: "0 24px 70px -12px rgba(0,0,0,0.6)",
              }}
            >
              {matches.map((c, i) => {
                const active = i === Math.min(dropdownIdx, matches.length - 1);
                return (
                  <div
                    key={c.token}
                    className="row"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      completeWith(c);
                    }}
                    onMouseEnter={() => setDropdownIdx(i)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      cursor: "pointer",
                      background: active ? "rgba(255,255,255,0.06)" : "transparent",
                      borderTop: i ? `1px solid ${T.hairline}` : "none",
                    }}
                  >
                    <span
                      className="mono"
                      style={{ fontSize: 12, color: "var(--accent)", minWidth: 66 }}
                    >
                      /{c.token}
                    </span>
                    <span style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>
                      {c.title}
                    </span>
                    <span
                      style={{ marginLeft: "auto", fontSize: 12, color: T.faint }}
                    >
                      {c.hint}
                    </span>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* template picker (shown after `/template `) */}
        <AnimatePresence>
          {showTemplateDropdown && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "relative",
                zIndex: 1,
                background: "#121420",
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                overflowX: "hidden",
                overflowY: "auto",
                maxHeight: 260,
                boxShadow: "0 24px 70px -12px rgba(0,0,0,0.6)",
              }}
            >
              <div
                style={{
                  padding: "10px 16px",
                  borderBottom: `1px solid ${T.hairline}`,
                  fontSize: 11,
                  color: T.faint,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {PROVIDER_LABELS[dp]} · Templates
              </div>
              {!configured ? (
                <button
                  className="row"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void openSettings();
                  }}
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    background: "transparent",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <Link2 size={14} color={T.faint} />
                  <span style={{ fontSize: 13, color: T.sub }}>
                    Connect {PROVIDER_LABELS[dp]} in Settings
                  </span>
                </button>
              ) : templatesLoading ? (
                <div
                  style={{
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: `2px solid ${T.faint}`,
                      borderTopColor: T.text,
                      borderRadius: "50%",
                      animation: "spin .7s linear infinite",
                    }}
                  />
                  <span style={{ fontSize: 13, color: T.sub }}>Loading templates…</span>
                </div>
              ) : templateMatches.length === 0 ? (
                <div
                  style={{ padding: "14px 16px", fontSize: 13, color: T.sub, lineHeight: 1.5 }}
                >
                  {templatesErr
                    ? templatesErr
                    : templates.length === 0
                      ? `No templates on this ${dp === "linear" ? "team" : "board"} — create one in ${PROVIDER_LABELS[dp]}.`
                      : `No template matches “${parsed.rest.trim()}”.`}
                </div>
              ) : (
                templateMatches.map((t, i) => {
                  const active =
                    i === Math.min(dropdownIdx, templateMatches.length - 1);
                  return (
                    <div
                      key={t.id}
                      className="row"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickTemplate(t);
                      }}
                      onMouseEnter={() => setDropdownIdx(i)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 11,
                        padding: "10px 16px",
                        cursor: "pointer",
                        background: active ? "rgba(255,255,255,0.06)" : "transparent",
                        borderTop: i ? `1px solid ${T.hairline}` : "none",
                      }}
                    >
                      <LayoutTemplate
                        size={14}
                        color="var(--accent)"
                        style={{ flexShrink: 0 }}
                      />
                      <span
                        style={{
                          fontSize: 13.5,
                          color: T.text,
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.name}
                      </span>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* /sup read-only results */}
        <AnimatePresence>
          {supResults && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "relative",
                zIndex: 1,
                background: "#121420",
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                overflowX: "hidden",
                overflowY: "auto",
                maxHeight: 244,
                boxShadow: "0 24px 70px -12px rgba(0,0,0,0.65)",
              }}
            >
              <div
                style={{
                  padding: "10px 16px",
                  borderBottom: `1px solid ${T.hairline}`,
                  fontSize: 11,
                  color: T.faint,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {labelFor(supResults.providerId)} · Upcoming
              </div>
              {supResults.items.length === 0 ? (
                <div style={{ padding: "16px", fontSize: 13, color: T.sub }}>
                  Nothing due — you’re all clear.
                </div>
              ) : (
                supResults.items.map((it, i) => (
                  <button
                    key={i}
                    className="row"
                    onClick={() => {
                      void openUrl(it.url);
                      void hideCapture();
                    }}
                    style={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "11px 16px",
                      background: "transparent",
                      border: "none",
                      borderTop: i ? `1px solid ${T.hairline}` : "none",
                      color: T.text,
                      fontSize: 13.5,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {it.title}
                    </span>
                    {it.due && (
                      <span style={{ flexShrink: 0, fontSize: 12, color: T.faint }}>
                        {formatDue(it.due)}
                      </span>
                    )}
                  </button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* /notes · /reminders — deletable local lists */}
        <AnimatePresence>
          {localList && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "relative",
                zIndex: 1,
                background: "#121420",
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                overflowX: "hidden",
                overflowY: "auto",
                maxHeight: 244,
                boxShadow: "0 24px 70px -12px rgba(0,0,0,0.65)",
              }}
            >
              <div
                style={{
                  padding: "10px 16px",
                  borderBottom: `1px solid ${T.hairline}`,
                  fontSize: 11,
                  color: T.faint,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {localList.kind === "notes" ? "Notes" : "Reminders"}
              </div>
              {localList.items.length === 0 ? (
                <div style={{ padding: "16px", fontSize: 13, color: T.sub }}>
                  {localList.kind === "notes"
                    ? "No notes yet — save one with /note."
                    : "No reminders set — add one with /remind."}
                </div>
              ) : localList.kind === "notes" ? (
                localList.items.map((n, i) => (
                  <LocalRow
                    key={n.id}
                    primary={n.text}
                    when={n.createdAt}
                    first={i === 0}
                    onDelete={() => void removeLocalItem(n.id)}
                  />
                ))
              ) : (
                localList.items.map((r, i) => (
                  <LocalRow
                    key={r.id}
                    primary={r.message}
                    when={r.fireAt}
                    first={i === 0}
                    onDelete={() => void removeLocalItem(r.id)}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* success / confirmation capsule (rises from where the text was typed) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 72, x: -276 }}
            animate={{ opacity: 1, y: 0, x: -276 }}
            exit={{ opacity: 0, y: -8, x: -276 }}
            transition={{ duration: 0.46, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              top: 48,
              left: "50%",
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "9px 15px",
              borderRadius: 11,
              background: T.glassSolid,
              border: `1px solid ${T.border}`,
              boxShadow: "0 12px 30px -8px rgba(0,0,0,0.6)",
              maxWidth: "80vw",
            }}
          >
            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: T.success,
                flexShrink: 0,
              }}
            >
              <Check size={12} color="#06281f" strokeWidth={3} />
            </span>
            <span
              style={{
                fontSize: 13,
                color: T.text,
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {toast}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
