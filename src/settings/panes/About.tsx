import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowUpCircle, ExternalLink, Zap } from "lucide-react";
import { T } from "../../tokens";
import { checkForUpdate } from "../../ipc";
import type { UpdateInfo } from "../../types";

export function About() {
  // Read the real version from the Tauri config at runtime so this never drifts
  // out of sync with tauri.conf.json / Cargo.toml on a release bump.
  const [version, setVersion] = useState("");
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    void getVersion().then(setVersion).catch(() => {});
    // Passive check on open - only surface a pill when something newer exists;
    // silently ignore offline / rate-limit failures so we never nag.
    void checkForUpdate()
      .then((info) => {
        if (info.available) setUpdate(info);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 18 }}>
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 44,
            height: 44,
            borderRadius: 12,
            background: `linear-gradient(135deg,var(--accent),${T.accent2})`,
            boxShadow: `0 6px 18px -4px var(--accent)`,
          }}
        >
          <Zap size={24} color="#fff" />
        </span>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>
            Wamda
          </div>
          <div className="mono" style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>
            {version ? `v${version}` : ""}
          </div>
        </div>
      </div>

      {update && (
        <button
          type="button"
          onClick={() => void openUrl(update.url)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          title={`You're on v${update.currentVersion} - open the v${update.latestVersion} release`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            textAlign: "left",
            padding: "11px 14px",
            marginBottom: 18,
            borderRadius: 10,
            border: `1px solid var(--accent)`,
            background: hovered ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.035)",
            color: T.text,
            font: "inherit",
            cursor: "pointer",
            transition: "background 120ms ease",
          }}
        >
          <ArrowUpCircle size={17} color="var(--accent)" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            Update available - v{update.latestVersion}
          </span>
          <span
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              color: T.sub,
            }}
          >
            View release
            <ExternalLink size={12} />
          </span>
        </button>
      )}

      <p style={{ margin: "0 0 22px", fontSize: 13.5, color: T.sub, lineHeight: 1.6 }}>
        Wamda is a background quick-capture command bar - tap a hotkey, type a task, and it lands on
        Trello or Linear. Slash commands add reminders, timers, and a glance at what’s due - without
        breaking your flow.
      </p>

      {/* The name */}
      <div
        style={{
          padding: "16px 18px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.025)",
          border: `1px solid ${T.hairline}`,
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Wamda</span>
          <span style={{ fontSize: 17, color: T.sub }} lang="ar" dir="rtl">
            وَمْضة
          </span>
          <span style={{ fontSize: 12, color: T.faint }}>· “wam-da”</span>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: T.sub, lineHeight: 1.6 }}>
          Arabic for <b style={{ color: T.text }}>a flash or flicker of light</b> - the brief spark
          of a thought, captured in an instant. It’s why the icon is a ⚡.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: T.faint,
        }}
      >
        <span>Built with Tauri + React.</span>
      </div>
    </>
  );
}
