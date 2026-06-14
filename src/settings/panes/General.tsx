import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import { T } from "../../tokens";
import { Key, comboParts } from "../../ui";
import { Field, inputStyle, ToggleRow } from "../widgets";
import { accelFromEvent } from "../accelerator";
import { registerShortcut, setAutostart } from "../../ipc";
import type { Settings } from "../../types";

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
    </>
  );
}
