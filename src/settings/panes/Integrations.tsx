import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, ChevronDown, ClipboardCheck, ExternalLink, Link2 } from "lucide-react";
import { T } from "../../tokens";
import { Field, inputStyle } from "../widgets";
import {
  linearGetTeams,
  linearGetUsers,
  readClipboard,
  trelloGetBoards,
  trelloGetLists,
  trelloGetMembers,
  trelloGetTemplates,
} from "../../ipc";
import {
  type Board,
  type List,
  type Person,
  PROVIDER_LABELS,
  type Providers,
  type ProviderId,
  type Settings,
  type Team,
  type Template,
} from "../../types";

const POWERUP_URL = "https://trello.com/power-ups/admin";
const LINEAR_KEYS_URL = "https://linear.app/settings/account/security";
const tokenUrl = (key: string) =>
  `https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=${encodeURIComponent(
    key,
  )}&name=Wamda`;
// Trello tokens are 64+ alphanumerics; the 32-hex API key never matches, so this
// reliably tells a copied token apart from other clipboard junk before we auto-fill.
const looksLikeToken = (s: string) => /^[A-Za-z0-9]{64,}$/.test(s);

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
  summary,
  children,
}: {
  id: ProviderId;
  connected: boolean;
  isDefault: boolean;
  onSetDefault: () => void;
  summary?: string;
  children: React.ReactNode;
}) {
  // Connected providers collapse to a tidy summary row; an unconfigured one starts
  // open so a new user lands straight on the fields. The user toggles from there.
  const [expanded, setExpanded] = useState(!connected);

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
        role="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginBottom: expanded ? 16 : 0,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <StatusDot connected={connected} />
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
            {PROVIDER_LABELS[id]}
          </span>
          {!expanded && summary && (
            <span
              style={{
                fontSize: 12,
                color: T.faint,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {summary}
            </span>
          )}
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
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
              onClick={(e) => {
                e.stopPropagation();
                onSetDefault();
              }}
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
          <ChevronDown
            size={17}
            color={T.faint}
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.22s ease",
            }}
          />
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TrelloCard({ settings, update, updateProvider }: Props) {
  const cfg = settings.providers.trello;
  const [key, setKey] = useState(cfg.key);
  const [token, setToken] = useState(cfg.token);
  const [boards, setBoards] = useState<Board[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [members, setMembers] = useState<Person[]>([]);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteNote, setPasteNote] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const didPreload = useRef(false);
  // True while the user is over in the browser approving the token, so a focus
  // event means "they're back" and we should peek the clipboard for the token.
  const awaitingRef = useRef(false);
  // Mirror `key` into a ref so the once-mounted focus listener reads the latest.
  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  useEffect(() => {
    if (didPreload.current) return;
    didPreload.current = true;
    if (cfg.key && cfg.token) {
      trelloGetBoards(cfg.key, cfg.token)
        .then((b) => {
          setBoards(b);
          if (cfg.boardId) {
            void trelloGetTemplates(cfg.key, cfg.token, cfg.boardId)
              .then(setTemplates)
              .catch(() => {});
            void trelloGetMembers(cfg.key, cfg.token, cfg.boardId)
              .then(setMembers)
              .catch(() => {});
            return trelloGetLists(cfg.key, cfg.token, cfg.boardId).then(setLists);
          }
        })
        .catch(() => {
          /* stale creds - user can re-test */
        });
    }
  }, [cfg.key, cfg.token, cfg.boardId]);

  const test = async (k: string = key, t: string = token) => {
    setTesting(true);
    setError(null);
    try {
      const b = await trelloGetBoards(k, t);
      setBoards(b);
      updateProvider("trello", { key: k, token: t, connected: true });
    } catch (e) {
      updateProvider("trello", { connected: false });
      setError(String(e));
    } finally {
      setTesting(false);
    }
  };

  // Pull a Trello token straight off the clipboard - called automatically when the
  // user returns from the authorize page, and manually via the field's hint link.
  const pullToken = async (auto: boolean) => {
    const clip = (await readClipboard().catch(() => null))?.trim() ?? "";
    if (!clip || !looksLikeToken(clip) || clip === keyRef.current) {
      if (!auto) {
        setPasteNote({
          ok: false,
          text: "No token on the clipboard yet - approve in Trello and copy it first.",
        });
      }
      return;
    }
    setToken(clip);
    setPasteNote({ ok: true, text: "Grabbed your token from the clipboard." });
    setError(null);
    if (keyRef.current) void test(keyRef.current, clip); // auto-validate
  };

  // Keep the focus listener (mounted once) pointed at the latest pullToken so it
  // never fires against a stale closure.
  const pullTokenRef = useRef(pullToken);
  useEffect(() => {
    pullTokenRef.current = pullToken;
  });
  useEffect(() => {
    const onFocus = () => {
      if (!awaitingRef.current) return;
      awaitingRef.current = false; // one-shot per authorize round-trip
      void pullTokenRef.current(true);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const onBoard = async (id: string) => {
    const name = boards.find((b) => b.id === id)?.name ?? "";
    updateProvider("trello", {
      boardId: id,
      boardName: name,
      listId: "",
      listName: "",
      templateId: "",
      templateName: "",
      assigneeId: "",
      assigneeName: "",
    });
    setLists([]);
    setTemplates([]);
    setMembers([]);
    try {
      const [ls, ts, ms] = await Promise.all([
        trelloGetLists(key || cfg.key, token || cfg.token, id),
        trelloGetTemplates(key || cfg.key, token || cfg.token, id),
        trelloGetMembers(key || cfg.key, token || cfg.token, id),
      ]);
      setLists(ls);
      setTemplates(ts);
      setMembers(ms);
    } catch (e) {
      setError(String(e));
    }
  };

  const onList = (id: string) => {
    const name = lists.find((l) => l.id === id)?.name ?? "";
    updateProvider("trello", { listId: id, listName: name });
  };

  const onTemplate = (id: string) => {
    const name = templates.find((t) => t.id === id)?.name ?? "";
    updateProvider("trello", { templateId: id, templateName: name });
  };

  const onAssignee = (id: string) => {
    const name = members.find((m) => m.id === id)?.name ?? "";
    updateProvider("trello", { assigneeId: id, assigneeName: name });
  };

  const dest = [cfg.boardName, cfg.listName].filter(Boolean).join(" → ");
  const summary = cfg.connected ? dest || "Connected" : "Not connected";

  return (
    <ProviderCard
      id="trello"
      connected={cfg.connected}
      isDefault={settings.defaultProvider === "trello"}
      onSetDefault={() => update({ defaultProvider: "trello" })}
      summary={summary}
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
      <button
        className="btn"
        disabled={!key.trim()}
        onClick={() => {
          awaitingRef.current = true;
          setPasteNote(null);
          void openUrl(tokenUrl(key.trim()));
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          padding: "10px 16px",
          borderRadius: 10,
          marginBottom: 8,
          border: `1px solid ${key.trim() ? "var(--accent)" : T.border}`,
          background: key.trim() ? "rgba(110,123,255,0.12)" : "rgba(255,255,255,0.04)",
          color: key.trim() ? "var(--accent)" : T.faint,
          fontSize: 13,
          fontWeight: 600,
          cursor: key.trim() ? "pointer" : "not-allowed",
          opacity: key.trim() ? 1 : 0.6,
        }}
      >
        <ExternalLink size={15} /> Get token from Trello
      </button>
      <p style={{ margin: "0 0 16px", fontSize: 11.5, color: T.faint, lineHeight: 1.5 }}>
        {key.trim()
          ? "Opens Trello in your browser - click Allow, copy the token it shows, then switch back here. We'll grab it from your clipboard automatically."
          : "Paste your API key above to unlock this."}
      </p>

      <Field
        label="Token"
        hint="Paste from clipboard"
        onHint={() => void pullToken(false)}
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
      {pasteNote && (
        <div
          style={{
            margin: "-10px 0 14px",
            fontSize: 12,
            color: pasteNote.ok ? T.success : T.faint,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {pasteNote.ok && <ClipboardCheck size={13} />}
          {pasteNote.text}
        </div>
      )}

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
      <Field label="Default template">
        <div className="field-wrap" style={selectWrap(cfg.connected && !!cfg.boardId)}>
          <select
            value={cfg.templateId}
            onChange={(e) => onTemplate(e.target.value)}
            style={selectStyle}
          >
            <option value="" style={optBg}>
              None
            </option>
            {templates.map((t) => (
              <option key={t.id} value={t.id} style={optBg}>
                {t.name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} color={T.faint} />
        </div>
      </Field>
      <p style={{ margin: "-6px 0 0", fontSize: 11.5, color: T.faint, lineHeight: 1.5 }}>
        New Trello captures start from this template. Override any time with{" "}
        <span className="mono" style={{ color: "var(--accent)" }}>
          /template
        </span>
        .
      </p>
      <div style={{ height: 1, background: T.hairline, margin: "16px 0" }} />
      <Field label="Default assignee">
        <div className="field-wrap" style={selectWrap(cfg.connected && !!cfg.boardId)}>
          <select
            value={cfg.assigneeId}
            onChange={(e) => onAssignee(e.target.value)}
            style={selectStyle}
          >
            <option value="" style={optBg}>
              Unassigned
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id} style={optBg}>
                {m.name}
                {m.detail ? ` · ${m.detail}` : ""}
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
  const [users, setUsers] = useState<Person[]>([]);
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
          /* stale key - user can re-test */
        });
      void linearGetUsers(cfg.apiKey).then(setUsers).catch(() => {});
    }
  }, [cfg.apiKey]);

  const test = async () => {
    setTesting(true);
    setError(null);
    try {
      const t = await linearGetTeams(apiKey);
      setTeams(t);
      updateProvider("linear", { apiKey, connected: true });
      void linearGetUsers(apiKey).then(setUsers).catch(() => {});
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

  const onAssignee = (id: string) => {
    const name = users.find((u) => u.id === id)?.name ?? "";
    updateProvider("linear", { assigneeId: id, assigneeName: name });
  };

  const summary = cfg.connected ? cfg.teamName || "Connected" : "Not connected";

  return (
    <ProviderCard
      id="linear"
      connected={cfg.connected}
      isDefault={settings.defaultProvider === "linear"}
      onSetDefault={() => update({ defaultProvider: "linear" })}
      summary={summary}
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
      <Field label="Default assignee">
        <div className="field-wrap" style={selectWrap(cfg.connected)}>
          <select
            value={cfg.assigneeId}
            onChange={(e) => onAssignee(e.target.value)}
            style={selectStyle}
          >
            <option value="" style={optBg}>
              Unassigned
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id} style={optBg}>
                {u.name}
                {u.detail ? ` · ${u.detail}` : ""}
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
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1.5px solid ${active ? "var(--accent)" : T.border}`,
                  background: active ? "rgba(110,123,255,0.1)" : "rgba(255,255,255,0.02)",
                  color: active ? T.text : T.sub,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {/* Radio dot - the unambiguous "pick one" affordance. */}
                <span
                  style={{
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: `2px solid ${active ? "var(--accent)" : T.faint}`,
                  }}
                >
                  {active && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--accent)",
                      }}
                    />
                  )}
                </span>
                <span style={{ flex: 1 }}>{PROVIDER_LABELS[id]}</span>
                <StatusDot connected={settings.providers[id].connected} />
              </button>
            );
          })}
        </div>
        <p style={{ margin: "9px 0 0", fontSize: 11.5, color: T.faint, lineHeight: 1.5 }}>
          New captures land here unless you pick a service inline with{" "}
          <span className="mono">/trello</span> or{" "}
          <span className="mono">/linear</span>.
        </p>
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
