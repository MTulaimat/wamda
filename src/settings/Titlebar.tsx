import { getCurrentWindow } from "@tauri-apps/api/window";
import { X, Zap } from "lucide-react";
import { T } from "../tokens";

/** Frameless custom titlebar. The whole bar is a drag region; close hides the window. */
export function Titlebar() {
  return (
    <div
      data-tauri-drag-region
      style={{
        height: 44,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "0 12px 0 16px",
        borderBottom: `1px solid ${T.hairline}`,
        background: "rgba(255,255,255,0.015)",
      }}
    >
      <span
        data-tauri-drag-region
        style={{
          display: "grid",
          placeItems: "center",
          width: 24,
          height: 24,
          borderRadius: 7,
          background: `linear-gradient(135deg,var(--accent),${T.accent2})`,
          pointerEvents: "none",
        }}
      >
        <Zap size={14} color="#fff" />
      </span>
      <span
        data-tauri-drag-region
        style={{
          fontWeight: 700,
          fontSize: 13,
          color: T.text,
          letterSpacing: "-0.01em",
          flex: 1,
          pointerEvents: "none",
        }}
      >
        Wamda Settings
      </span>
      <button
        className="icon-btn"
        onClick={() => void getCurrentWindow().hide()}
        title="Close"
        style={{
          display: "grid",
          placeItems: "center",
          width: 30,
          height: 30,
          borderRadius: 8,
          background: "transparent",
          border: "none",
          color: T.sub,
          cursor: "pointer",
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
