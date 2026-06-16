import { T } from "../../tokens";
import { ToggleRow } from "../widgets";
import { setAutostart } from "../../ipc";
import type { Settings } from "../../types";

export function General({
  settings,
  update,
}: {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}) {
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
        How and when the capture bar appears. Keys live under Shortcuts.
      </p>

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
