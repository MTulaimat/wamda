import { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, ChevronDown, ExternalLink, Link2 } from "lucide-react";
import { T } from "../../tokens";
import { Field, inputStyle } from "../widgets";
import { linearGetTeams, trelloGetBoards, trelloGetLists } from "../../ipc";
import {
  type Board,
  type List,
  PROVIDER_LABELS,
  type Providers,
  type ProviderId,
  type Settings,
  type Team,
} from "../../types";

const POWERUP_URL = "https://trello.com/power-ups/admin";
const LINEAR_KEYS_URL = "https://linear.app/settings/account/security";
const tokenUrl = (key: string) =>
  `https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=${encodeURIComponent(
    key,
  )}&name=Wamda`;

type Props = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  updateProvider: <K extends ProviderId>(
    id: K,
    patch: Partial<Providers[K]>,
  ) => void;
};

const optBg = { background: "#15171f" };
const selectStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: T.text,
  fontSize: 13,
  outline: "none",
  width: "100%",
  appearance: "none",
  cursor: "pointer",
};
const selectWrap = (enabled: boolean): React.CSSProperties => ({
  ...inputStyle,
  justifyContent: "space-between",
  opacity: enabled ? 1 : 0.5,
  pointerEvents: enabled ? "auto" : "none",
});

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: connected ? T.success : T.faint,
      }}
    />
  );
}

function TestButton({
  testing,
  connected,
  disabled,
  onClick,
}: {
  testing: boolean;
  connected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        borderRadius: 10,
        border: `1px solid ${connected ? T.success : T.border}`,
        background: connected ? "rgba(52,214,160,0.1)" : "rgba(255,255,255,0.05)",
        color: connected ? T.success : T.text,
        fontSize: 13,
        fontWeight: 600,
        marginBottom: 4,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {testing ? (
        <>
          <span
            style={{
              width: 14,
              height: 14,
              border: `2px solid ${T.faint}`,
              borderTopColor: T.text,
              borderRadius: "50%",
              animation: "spin .7s linear infinite",
            }}
          />{" "}
          Testing…
        </>
      ) : connected ? (
        <>
          <Check size={15} /> Connected
        </>
      ) : (
        <>
          <Link2 size={15} /> Test connection
        </>
      )}
    </button>
  );
}

function ProviderCard({
  id,
  connected,
  isDefault,
  onSetDefault,
  children,
}: {
  id: ProviderId;
  connected: boolean;
  isDefault: boolean;
  onSetDefault: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: "16px 18px 18px",
        marginBottom: 16,
        background: "rgba(255,255,255,0.015)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginBottom: 16,
        }}
      >
        <StatusDot connected={connected} />
        <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
          {PROVIDER_LABELS[id]}
        </span>
        <div style={{ marginLeft: "auto" }}>
          {isDefault ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--accent)",
                padding: "4px 9px",
                borderRadius: 7,
                background: "rgba(110,123,255,0.12)",
                border: `1px solid rgba(110,123,255,0.3)`,
              }}
            >
              Default
            </span>
          ) : (
            <button
              className="btn"
              onClick={onSetDefault}
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: T.sub,
                padding: "4px 9px",
                borderRadius: 7,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${T.border}`,
                cursor: "pointer",
              }}
            >
              Set as default
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function TrelloCard({ settings, update, updateProvider }: Props) {
  const cfg = settings.providers.trello;
  const [key, setKey] = useState(cfg.key);
  const [token, setToken] = useState(cfg.token);
  const [boards, setBoards] = useState<Board[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didPreload = useRef(false);

  useEffect(() => {
    if (didPreload.current) return;
    didPreload.current = true;
    if (cfg.key && cfg.token) {
      trelloGetBoards(cfg.key, cfg.token)
        .then((b) => {
          setBoards(b);
          if (cfg.boardId) {
            return trelloGetLists(cfg.key, cfg.token, cfg.boardId).then(setLists);
          }
        })
        .catch(() => {
          /* stale creds — user can re-test */
        });
    }
  }, [cfg.key, cfg.token, cfg.boardId]);

  const test = async () => {
    setTesting(true);
    setError(null);
    try {
      const b = await trelloGetBoards(key, token);
      setBoards(b);
      updateProvider("trello", { key, token, connected: true });
    } catch (e) {
      updateProvider("trello", { connected: false });
      setError(String(e));
    } finally {
      setTesting(false);
    }
  };

  const onBoard = async (id: string) => {
    const name = boards.find((b) => b.id === id)?.name ?? "";
    updateProvider("trello", {
      boardId: id,
      boardName: name,
      listId: "",
      listName: "",
    });
    setLists([]);
    try {
      setLists(await trelloGetLists(key || cfg.key, token || cfg.token, id));
    } catch (e) {
      setError(String(e));
    }
  };

  const onList = (id: string) => {
    const name = lists.find((l) => l.id === id)?.name ?? "";
    updateProvider("trello", { listId: id, listName: name });
  };

  return (
    <ProviderCard
      id="trello"
      connected={cfg.connected}
      isDefault={settings.defaultProvider === "trello"}
      onSetDefault={() => update({ defaultProvider: "trello" })}
    >
      <Field
        label="API key"
        hint="Get a key"
        onHint={() => void openUrl(POWERUP_URL)}
      >
        <div className="field-wrap" style={inputStyle}>
          <input
            className="bare"
            placeholder="Paste your API key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            style={{ fontSize: 13 }}
          />
        </div>
      </Field>
      <Field
        label="Token"
        hint={key ? "Generate a token" : "Enter your key first"}
        onHint={() => key && void openUrl(tokenUrl(key))}
      >
        <div className="field-wrap" style={inputStyle}>
          <input
            className="bare"
            type="password"
            placeholder="Paste your token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={{ fontSize: 13 }}
          />
        </div>
      </Field>

      <TestButton
        testing={testing}
        connected={cfg.connected}
        disabled={testing || !key || !token}
        onClick={() => void test()}
      />
      {error && (
        <div style={{ margin: "8px 0 0", fontSize: 12.5, color: "#FF6B6B" }}>
          {error}
        </div>
      )}

      <div style={{ height: 1, background: T.hairline, margin: "16px 0" }} />

      <Field label="Board">
        <div className="field-wrap" style={selectWrap(cfg.connected)}>
          <select
            value={cfg.boardId}
            onChange={(e) => void onBoard(e.target.value)}
            style={selectStyle}
          >
            <option value="" style={optBg}>
              Select a board…
            </option>
            {boards.map((b) => (
              <option key={b.id} value={b.id} style={optBg}>
                {b.name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} color={T.faint} />
        </div>
      </Field>
      <Field label="List">
        <div className="field-wrap" style={selectWrap(cfg.connected && !!cfg.boardId)}>
          <select
            value={cfg.listId}
            onChange={(e) => onList(e.target.value)}
            style={selectStyle}
          >
            <option value="" style={optBg}>
              Select a list…
            </option>
            {lists.map((l) => (
              <option key={l.id} value={l.id} style={optBg}>
                {l.name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} color={T.faint} />
        </div>
      </Field>
    </ProviderCard>
  );
}

function LinearCard({ settings, update, updateProvider }: Props) {
  const cfg = settings.providers.linear;
  const [apiKey, setApiKey] = useState(cfg.apiKey);
  const [teams, setTeams] = useState<Team[]>([]);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didPreload = useRef(false);

  useEffect(() => {
    if (didPreload.current) return;
    didPreload.current = true;
    if (cfg.apiKey) {
      linearGetTeams(cfg.apiKey)
        .then(setTeams)
        .catch(() => {
          /* stale key — user can re-test */
        });
    }
  }, [cfg.apiKey]);

  const test = async () => {
    setTesting(true);
    setError(null);
    try {
      const t = await linearGetTeams(apiKey);
      setTeams(t);
      updateProvider("linear", { apiKey, connected: true });
    } catch (e) {
      updateProvider("linear", { connected: false });
      setError(String(e));
    } finally {
      setTesting(false);
    }
  };

  const onTeam = (id: string) => {
    const name = teams.find((t) => t.id === id)?.name ?? "";
    updateProvider("linear", { teamId: id, teamName: name });
  };

  return (
    <ProviderCard
      id="linear"
      connected={cfg.connected}
      isDefault={settings.defaultProvider === "linear"}
      onSetDefault={() => update({ defaultProvider: "linear" })}
    >
      <Field
        label="Personal API key"
        hint="Get a key"
        onHint={() => void openUrl(LINEAR_KEYS_URL)}
      >
        <div className="field-wrap" style={inputStyle}>
          <input
            className="bare"
            type="password"
            placeholder="lin_api_…"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ fontSize: 13 }}
          />
        </div>
      </Field>
      <p style={{ margin: "-8px 0 14px", fontSize: 11.5, color: T.faint, lineHeight: 1.5 }}>
        Linear → Settings → Account → Security &amp; access → Personal API keys.
        Pasted as-is (no “Bearer”).
      </p>

      <TestButton
        testing={testing}
        connected={cfg.connected}
        disabled={testing || !apiKey}
        onClick={() => void test()}
      />
      {error && (
        <div style={{ margin: "8px 0 0", fontSize: 12.5, color: "#FF6B6B" }}>
          {error}
        </div>
      )}

      <div style={{ height: 1, background: T.hairline, margin: "16px 0" }} />

      <Field label="Team">
        <div className="field-wrap" style={selectWrap(cfg.connected)}>
          <select
            value={cfg.teamId}
            onChange={(e) => onTeam(e.target.value)}
            style={selectStyle}
          >
            <option value="" style={optBg}>
              Select a team…
            </option>
            {teams.map((t) => (
              <option key={t.id} value={t.id} style={optBg}>
                {t.name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} color={T.faint} />
        </div>
      </Field>
    </ProviderCard>
  );
}

export function Integrations(props: Props) {
  const { settings, update } = props;
  const dp = settings.defaultProvider;

  return (
    <>
      <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: T.text }}>
        Integrations
      </h2>
      <p style={{ margin: "0 0 22px", fontSize: 13, color: T.faint }}>
        Connect a service, then pick where captures land by default.
      </p>

      <Field label="Default destination">
        <div style={{ display: "flex", gap: 8 }}>
          {(["trello", "linear"] as ProviderId[]).map((id) => {
            const active = dp === id;
            return (
              <button
                key={id}
                className="btn"
                onClick={() => update({ defaultProvider: id })}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${active ? "var(--accent)" : T.border}`,
                  background: active ? "rgba(110,123,255,0.12)" : "rgba(255,255,255,0.03)",
                  color: active ? T.text : T.sub,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <StatusDot connected={settings.providers[id].connected} />
                {PROVIDER_LABELS[id]}
              </button>
            );
          })}
        </div>
      </Field>

      <div style={{ height: 1, background: T.hairline, margin: "6px -28px 22px" }} />

      <TrelloCard {...props} />
      <LinearCard {...props} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "16px 18px",
          borderRadius: 14,
          border: `1px dashed ${T.border}`,
          background: "transparent",
          opacity: 0.6,
        }}
      >
        <ExternalLink size={15} color={T.faint} />
        <span style={{ fontSize: 12.5, color: T.faint }}>
          More integrations coming soon.
        </span>
      </div>
    </>
  );
}
