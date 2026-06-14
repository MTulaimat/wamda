import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { T } from "../../tokens";
import type { Settings } from "../../types";

const POWERUP_URL = "https://trello.com/power-ups/admin";

// Authorize URL prefilled for Wamda: write scope (needed to create cards) and a
// non-expiring token. Filled with the user's key once they've entered it.
const tokenUrl = (key: string) =>
  `https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=${encodeURIComponent(
    key,
  )}&name=Wamda`;

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
      <span
        style={{
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          border: `1px solid ${T.border}`,
          color: "var(--accent)",
          fontSize: 13,
          fontWeight: 700,
        }}
        className="mono"
      >
        {n}
      </span>
      <div style={{ flex: 1, paddingTop: 1 }}>
        <div style={{ fontSize: 13.5, color: T.text, fontWeight: 600, marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.55 }}>{children}</div>
      </div>
    </div>
  );
}

function LinkButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        marginTop: 8,
        padding: "7px 12px",
        borderRadius: 9,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${T.border}`,
        color: disabled ? T.faint : T.text,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {icon} {label}
    </button>
  );
}

export function Setup({ settings }: { settings: Settings }) {
  const hasKey = !!settings.trelloKey.trim();

  return (
    <>
      <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: T.text }}>
        Setup guide
      </h2>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: T.faint }}>
        Connect Wamda to Trello in three steps. You only do this once.
      </p>

      <Step n={1} title="Get your API key">
        Trello issues a key to a “Power-Up.” Open the admin page, click{" "}
        <b style={{ color: T.text }}>New</b> to create a Power-Up (any name), then open it
        and copy the generated <b style={{ color: T.text }}>API key</b>.
        <br />
        <LinkButton
          label="Open Power-Up admin"
          icon={<ExternalLink size={13} />}
          onClick={() => void openUrl(POWERUP_URL)}
        />
      </Step>

      <Step n={2} title="Generate a token">
        The token authorizes Wamda to create cards on your account. Paste your key in the{" "}
        <b style={{ color: T.text }}>Trello</b> tab first, then use the button below — it opens
        Trello’s approval page with the right permissions already set
        (<span className="mono" style={{ color: T.sub }}>read,write</span> · never expires).
        Click <b style={{ color: T.text }}>Allow</b> and copy the token it shows.
        <br />
        <LinkButton
          label={hasKey ? "Generate token for your key" : "Enter your API key first"}
          icon={<KeyRound size={13} />}
          onClick={() => void openUrl(tokenUrl(settings.trelloKey))}
          disabled={!hasKey}
        />
      </Step>

      <Step n={3} title="Pick where cards land">
        Back in the <b style={{ color: T.text }}>Trello</b> tab, paste the key + token and hit{" "}
        <b style={{ color: T.text }}>Test connection</b>. Then choose a board and a list — every
        capture drops a card onto that list.
      </Step>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          marginTop: 26,
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(52,214,160,0.07)",
          border: `1px solid rgba(52,214,160,0.25)`,
        }}
      >
        <ShieldCheck size={16} color={T.success} style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 12, color: T.sub, lineHeight: 1.55 }}>
          Your token is stored locally and used only to talk to Trello from Wamda’s backend — it’s
          never logged or sent anywhere else.
        </span>
      </div>
    </>
  );
}
