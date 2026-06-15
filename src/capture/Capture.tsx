import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Check,
  ChevronDown,
  CornerDownLeft,
  Layout,
  Link2,
  Settings as SettingsIcon,
  Zap,
} from "lucide-react";
import { T } from "../tokens";
import {
  getSettings,
  hideCapture,
  listProviders,
  openSettings,
  providerCreateTask,
  providerListDue,
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
  type ProviderId,
  type ProviderStatus,
  type TaskSummary,
} from "../types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type OpenedPayload = { prefill?: string | null };
type SupResults = { providerId: string; items: TaskSummary[] };

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dropdownIdx, setDropdownIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const openDatePickerRef = useRef<(() => void) | null>(null);
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

  // React to Rust show/hide lifecycle events.
  useEffect(() => {
    const resetAll = () => {
      setText("");
      setSending(false);
      setToast(null);
      setError(null);
      setSupResults(null);
      setPickerOpen(false);
      setExpanded(false);
      setDescription("");
      setDue(null);
    };
    const unlistenOpened = listen<OpenedPayload>("capture:opened", (e) => {
      resetAll();
      if (e.payload?.prefill) setText(e.payload.prefill);
      // Pull fresh settings + provider statuses so the chip/commands are current.
      void getSettings()
        .then((s) => {
          setSettings(s);
          applyAccent(s.accent);
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
  }, [pickerOpen, supResults, expanded, isCommand, update]);

  const finishWithToast = async (message: string, keepOpen = false) => {
    setSending(false);
    setText("");
    setExpanded(false);
    setDescription("");
    setDue(null);
    setSupResults(null);
    setToast(message);
    if (settings.soundOnCapture) playChime();
    if (keepOpen) {
      // Focus after the re-render re-enables the input (disabled={sending}).
      setTimeout(() => inputRef.current?.focus(), 0);
    }
    await delay(1300);
    setToast(null);
    if (!keepOpen) void hideCapture();
  };

  // keepOpen (Shift+Enter) leaves the bar open after adding, to capture more.
  const run = async (keepOpen = false) => {
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
        await providerCreateTask(dp, {
          title: value,
          description: description.trim() || null,
          due,
        });
        await finishWithToast(`Added to ${destinationLabel}`, keepOpen);
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
          await finishWithToast(`Reminder set for ${formatWhen(r.fireAt)}`, keepOpen);
          break;
        }
        case "timer": {
          const { spec, label } = parseTimer(p.rest);
          setSending(true);
          const confirm = await timerStart(spec, label);
          await finishWithToast(confirm, keepOpen);
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
          await providerCreateTask(pid, {
            title: p.rest.trim(),
            description: description.trim() || null,
            due,
          });
          await finishWithToast(`Added to ${PROVIDER_LABELS[pid]}`, keepOpen);
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

  const onChangeText = (v: string) => {
    setText(v);
    if (error) setError(null);
    if (supResults) setSupResults(null);
  };

  const focusDescription = () => {
    setExpanded(true);
    window.setTimeout(() => descRef.current?.focus(), 50);
  };

  const onTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
        if (hi && hi.token === parsed.token) void run();
        else completeWith(hi);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void run(e.shiftKey); // Shift+Enter: add and keep the bar open
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
      void run(e.shiftKey); // Ctrl+Shift+Enter: add and keep open
      return;
    }
    // Shift+Tab returns to the title.
    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

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
            placeholder={isCommand ? "Type a command…" : "What needs doing?"}
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
                <span
                  style={{
                    fontSize: 11,
                    color: T.faint,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Sends to
                </span>
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
                onClick={(e) => void run(e.shiftKey)}
                disabled={sending}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
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
                {submitLabel} <CornerDownLeft size={14} />
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
