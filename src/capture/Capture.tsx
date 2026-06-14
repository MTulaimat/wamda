import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { listen } from "@tauri-apps/api/event";
import {
  Check,
  ChevronDown,
  CornerDownLeft,
  Layout,
  Link2,
} from "lucide-react";
import { T } from "../tokens";
import { getSettings, hideCapture, openSettings, trelloCreateCard } from "../ipc";
import { useSettings } from "../useSettings";
import { applyAccent } from "../accent";
import { playChime } from "../sound";
import { CaptureInput } from "./CaptureInput";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type OpenedPayload = { prefill?: string | null };

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

export function Capture() {
  const { settings, setSettings } = useSettings();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(false);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const controls = useAnimationControls();

  // Replay the entrance without remounting (set to the start frame, then animate in).
  const playEntrance = useCallback(() => {
    controls.set(ENTRANCE_FROM);
    void controls.start(ENTRANCE_TO);
    inputRef.current?.focus();
  }, [controls]);

  const configured = !!(
    settings.trelloKey &&
    settings.trelloToken &&
    settings.listId
  );

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 340);
  }, []);

  // Start hidden; the entrance plays on the first (and every) show event,
  // so we never flash the at-rest bar before animating.
  useEffect(() => {
    controls.set(ENTRANCE_FROM);
  }, [controls]);

  // React to Rust show/hide lifecycle events.
  useEffect(() => {
    const unlistenOpened = listen<OpenedPayload>("capture:opened", (e) => {
      setSending(false);
      setToast(false);
      setError(null);
      if (e.payload?.prefill) setText(e.payload.prefill);
      // Pull fresh settings so the destination chip + accent reflect any
      // changes made in the (long-lived) settings window since last open.
      void getSettings()
        .then((s) => {
          setSettings(s);
          applyAccent(s.accent);
        })
        .catch(() => {});
      playEntrance(); // replay entrance + refocus (no remount → no flicker)
    });
    const unlistenReset = listen("capture:reset", () => {
      setText("");
      setSending(false);
      setToast(false);
      setError(null);
      // Hide the bar so the next show starts from the entrance start frame
      // (prevents a stale at-rest frame flashing before the animation).
      controls.set(ENTRANCE_FROM);
    });
    return () => {
      void unlistenOpened.then((f) => f());
      void unlistenReset.then((f) => f());
    };
  }, [playEntrance, controls, setSettings]);

  // Esc dismisses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void hideCapture();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = useCallback(async () => {
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
      await trelloCreateCard(
        settings.trelloKey,
        settings.trelloToken,
        settings.listId,
        value,
      );
      // Clear the field and let the confirmation rise up from where it was typed.
      setSending(false);
      setText("");
      setToast(true);
      if (settings.soundOnCapture) playChime();
      await delay(1300);
      setToast(false);
      void hideCapture();
    } catch (e) {
      setSending(false); // restores the input with text intact
      setError(String(e));
      triggerShake();
    }
  }, [text, configured, settings, triggerShake]);

  const board = settings.boardName || "Not set";
  const list = settings.listName || "Not set";

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
      <motion.div
        className={shake ? "shake" : ""}
        initial={ENTRANCE_FROM}
        animate={controls}
        style={{
          position: "relative",
          width: 580,
          maxWidth: "92vw",
          // Opaque solid surface (no blur/transparency).
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
          onChange={(v) => {
            setText(v);
            if (error) setError(null);
          }}
          onEnter={() => void send()}
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
              <Link2 size={13} /> Connect Trello in Settings
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
                onClick={() => void openSettings()}
                title="Change destination in Settings"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "5px 10px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${T.border}`,
                  color: T.text,
                  fontSize: 12.5,
                  fontWeight: 500,
                }}
              >
                <Layout size={13} color="var(--accent)" />
                {board} <span style={{ color: T.faint }}>/</span> {list}
                <ChevronDown size={13} color={T.faint} />
              </button>
            </div>
          )}

          <button
            className="btn"
            onClick={() => void send()}
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
            Add card <CornerDownLeft size={14} />
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {toast && (
          <motion.div
            // Rises straight up from where the text was typed, on the left.
            // x offset is relative to the bar's center so it tracks the bar
            // regardless of window width; -276 lines its text up with the input.
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
              }}
            >
              <Check size={12} color="#06281f" strokeWidth={3} />
            </span>
            <span style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>
              Added to <span style={{ color: T.success }}>{list}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
