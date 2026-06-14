import { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, ChevronDown, Link2 } from "lucide-react";
import { T } from "../../tokens";
import { Field, inputStyle } from "../widgets";
import { trelloGetBoards, trelloGetLists } from "../../ipc";
import type { Board, List, Settings } from "../../types";

const POWERUP_URL = "https://trello.com/power-ups/admin";

export function Trello({
  settings,
  update,
  onConnectedChange,
}: {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  onConnectedChange: (connected: boolean) => void;
}) {
  const [key, setKey] = useState(settings.trelloKey);
  const [token, setToken] = useState(settings.trelloToken);
  const [boards, setBoards] = useState<Board[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didPreload = useRef(false);

  // Preload boards/lists once if we already have saved credentials + selection.
  useEffect(() => {
    if (didPreload.current) return;
    didPreload.current = true;
    if (settings.trelloKey && settings.trelloToken) {
      trelloGetBoards(settings.trelloKey, settings.trelloToken)
        .then((b) => {
          setBoards(b);
          setConnected(true);
          onConnectedChange(true);
          if (settings.boardId) {
            return trelloGetLists(
              settings.trelloKey,
              settings.trelloToken,
              settings.boardId,
            ).then(setLists);
          }
        })
        .catch(() => {
          /* stale/invalid creds — user can re-test */
        });
    }
  }, [settings.trelloKey, settings.trelloToken, settings.boardId, onConnectedChange]);

  const test = async () => {
    setTesting(true);
    setError(null);
    try {
      const b = await trelloGetBoards(key, token);
      setBoards(b);
      setConnected(true);
      onConnectedChange(true);
      update({ trelloKey: key, trelloToken: token });
    } catch (e) {
      setConnected(false);
      onConnectedChange(false);
      setError(String(e));
    } finally {
      setTesting(false);
    }
  };

  const onBoard = async (id: string) => {
    const name = boards.find((b) => b.id === id)?.name ?? "";
    update({ boardId: id, boardName: name, listId: "", listName: "" });
    setLists([]);
    try {
      setLists(await trelloGetLists(key || settings.trelloKey, token || settings.trelloToken, id));
    } catch (e) {
      setError(String(e));
    }
  };

  const onList = (id: string) => {
    const name = lists.find((l) => l.id === id)?.name ?? "";
    update({ listId: id, listName: name });
  };

  const selectWrap = (enabled: boolean): React.CSSProperties => ({
    ...inputStyle,
    justifyContent: "space-between",
    opacity: enabled ? 1 : 0.5,
    pointerEvents: enabled ? "auto" : "none",
  });
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

  return (
    <>
      <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: T.text }}>
        Trello
      </h2>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: T.faint }}>
        Connect your account, then pick where cards land.
      </p>

      <Field label="API key" hint="Where do I get this?" onHint={() => void openUrl(POWERUP_URL)}>
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
      <Field label="Token" hint="Where do I get this?" onHint={() => void openUrl(POWERUP_URL)}>
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

      <button
        className="btn"
        onClick={() => void test()}
        disabled={testing || !key || !token}
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
          marginBottom: 14,
          opacity: !key || !token ? 0.5 : 1,
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
      {error && (
        <div style={{ marginBottom: 18, fontSize: 12.5, color: "#FF6B6B" }}>{error}</div>
      )}

      <div style={{ height: 1, background: T.hairline, margin: "8px -28px 22px" }} />

      <Field label="Board">
        <div className="field-wrap" style={selectWrap(connected)}>
          <select
            value={settings.boardId}
            onChange={(e) => void onBoard(e.target.value)}
            style={selectStyle}
          >
            <option value="" style={{ background: "#15171f" }}>
              Select a board…
            </option>
            {boards.map((b) => (
              <option key={b.id} value={b.id} style={{ background: "#15171f" }}>
                {b.name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} color={T.faint} />
        </div>
      </Field>
      <Field label="List">
        <div className="field-wrap" style={selectWrap(connected && !!settings.boardId)}>
          <select
            value={settings.listId}
            onChange={(e) => onList(e.target.value)}
            style={selectStyle}
          >
            <option value="" style={{ background: "#15171f" }}>
              Select a list…
            </option>
            {lists.map((l) => (
              <option key={l.id} value={l.id} style={{ background: "#15171f" }}>
                {l.name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} color={T.faint} />
        </div>
      </Field>
    </>
  );
}
