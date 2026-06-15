import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import { T } from "../../tokens";
import { Key, comboParts } from "../../ui";
import { Field, inputStyle, ToggleRow } from "../widgets";
import { accelFromEvent } from "../accelerator";
import { registerShortcut, setAutostart } from "../../ipc";
import type { Settings } from "../../types";

const CAPTURE_SHORTCUTS: { label: string; combos: string[][] }[] = [
  { label: "Add task · run command", combos: [["Enter"]] },
  { label: "Add task from the description", combos: [["Ctrl", "Enter"]] },
  { label: "Add & keep open (add more)", combos: [["Shift", "Enter"]] },
  { label: "Open details · next field", combos: [["Tab"]] },
  { label: "Previous field", combos: [["Shift", "Tab"]] },
  { label: "Toggle details", combos: [["Ctrl", "↓"], ["Ctrl", "↑"]] },
  { label: "Set due date", combos: [["Ctrl", "D"]] },
  { label: "Destination picker", combos: [["Ctrl", "P"]] },
  { label: "Send to Trello · Linear", combos: [["Ctrl", "1"], ["Ctrl", "2"]] },
  { label: "Command menu", combos: [["/"]] },
  { label: "Open settings", combos: [["Ctrl", ","]] },
  { label: "Dismiss · back out", combos: [["Esc"]] },
];

function Combo({ keys }: { keys: string[] }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {keys.map((k, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {i > 0 && <span style={{ fontSize: 10, color: T.faint }}>+</span>}
          <Key>{k}</Key>
        </span>
      ))}
    </span>
  );
}

export function General({
  settings,
  update,
}: {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Capture the next key combo while recording, then re-register it in Rust.
  useEffect(() => {
    if (!recording) return;
    const fn = async (e: KeyboardEvent) => {
      e.preventDefault();
      const accel = accelFromEvent(e);
      if (!accel) return;
      setRecording(false);
      try {
        await registerShortcut(accel);
        setError(null);
        update({ shortcut: accel });
      } catch (err) {
        setError(String(err));
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [recording, update]);

  const onAutostart = async (v: boolean) => {
    update({ launchAtStartup: v });
    try {
      await setAutostart(v);
    } catch {
      /* surfaced via the toggle reverting on next load if it failed */
    }
  };

  return (
    <>
      <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: T.text }}>
        General
      </h2>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: T.faint }}>
        How and when the capture bar appears.
      </p>

      <Field label="Capture shortcut">
        <button
          className="field-wrap btn"
          onClick={() => {
            setError(null);
            setRecording(true);
          }}
          style={{
            ...inputStyle,
            justifyContent: "space-between",
            width: "100%",
            cursor: "pointer",
          }}
        >
          {recording ? (
            <span style={{ color: "var(--accent)", fontSize: 13, fontWeight: 500 }}>
              Press your keys…
            </span>
          ) : (
            <span style={{ display: "flex", gap: 5 }}>
              {comboParts(settings.shortcut).map((k, i) => (
                <Key key={i}>{k}</Key>
              ))}
            </span>
          )}
          <Keyboard size={16} color={T.faint} />
        </button>
        {error && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#FF6B6B" }}>{error}</div>
        )}
      </Field>

      <ToggleRow
        title="Launch at startup"
        desc="Open Wamda when Windows starts"
        on={settings.launchAtStartup}
        set={(v) => void onAutostart(v)}
      />
      <ToggleRow
        title="Sound on capture"
        desc="Play a soft chime when a card is added"
        on={settings.soundOnCapture}
        set={(v) => update({ soundOnCapture: v })}
      />
      <ToggleRow
        title="Prefill from clipboard"
        desc="Drop clipboard text into the field on open"
        on={settings.prefillFromClipboard}
        set={(v) => update({ prefillFromClipboard: v })}
      />

      <div style={{ height: 1, background: T.hairline, margin: "20px 0 18px" }} />

      <div style={{ fontSize: 13.5, color: T.text, fontWeight: 600, marginBottom: 3 }}>
        Keyboard shortcuts
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: T.faint }}>
        Available while the capture bar is open. On Mac, ⌘ stands in for Ctrl.
      </p>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {CAPTURE_SHORTCUTS.map((s) => (
          <div
            key={s.label}
            className="row"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "7px 10px",
              margin: "0 -10px",
              borderRadius: 8,
            }}
          >
            <span style={{ fontSize: 13, color: T.sub }}>{s.label}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {s.combos.map((c, i) => (
                <span
                  key={i}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  {i > 0 && <span style={{ fontSize: 11, color: T.faint }}>/</span>}
                  <Combo keys={c} />
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 11.5, color: T.faint, lineHeight: 1.5 }}>
        Rebinding individual shortcuts isn’t supported yet — only the capture hotkey
        above is configurable.
      </p>
    </>
  );
}
