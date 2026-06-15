import { useEffect, useState } from "react";
import { ChevronDown, Settings as SettingsIcon } from "lucide-react";
import { T } from "../tokens";
import {
  linearGetTeams,
  openSettings,
  trelloGetBoards,
  trelloGetLists,
} from "../ipc";
import {
  type Board,
  type List,
  PROVIDER_LABELS,
  type ProviderId,
  type Providers,
  type Settings,
  type Team,
} from "../types";

type Props = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  updateProvider: <K extends ProviderId>(
    id: K,
    patch: Partial<Providers[K]>,
  ) => void;
};

const optBg = { background: "#15171f" };

function Select({
  value,
  onChange,
  placeholder,
  options,
  enabled,
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  options: { id: string; name: string }[];
  enabled: boolean;
}) {
  return (
    <div
      className="field-wrap"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "9px 11px",
        borderRadius: 9,
        background: T.field,
        border: `1px solid ${T.border}`,
        marginTop: 8,
        opacity: enabled ? 1 : 0.5,
        pointerEvents: enabled ? "auto" : "none",
      }}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "transparent",
          border: "none",
          color: T.text,
          fontSize: 12.5,
          outline: "none",
          width: "100%",
          appearance: "none",
          cursor: "pointer",
        }}
      >
        <option value="" style={optBg}>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id} style={optBg}>
            {o.name}
          </option>
        ))}
      </select>
      <ChevronDown size={14} color={T.faint} />
    </div>
  );
}

export function DestinationPicker({ settings, update, updateProvider }: Props) {
  const dp = settings.defaultProvider;
  const trello = settings.providers.trello;
  const linear = settings.providers.linear;
  const trelloConnected = !!(trello.key && trello.token);
  const linearConnected = !!linear.apiKey;
  const connected = dp === "trello" ? trelloConnected : linearConnected;

  const [boards, setBoards] = useState<Board[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);

  // Load top-level options (boards / teams) for the active provider.
  useEffect(() => {
    let alive = true;
    if (dp === "trello" && trelloConnected) {
      setLoading(true);
      trelloGetBoards(trello.key, trello.token)
        .then((b) => alive && setBoards(b))
        .catch(() => {})
        .finally(() => alive && setLoading(false));
    } else if (dp === "linear" && linearConnected) {
      setLoading(true);
      linearGetTeams(linear.apiKey)
        .then((t) => alive && setTeams(t))
        .catch(() => {})
        .finally(() => alive && setLoading(false));
    }
    return () => {
      alive = false;
    };
  }, [dp, trello.key, trello.token, linear.apiKey, trelloConnected, linearConnected]);

  // Load lists when a Trello board is selected.
  useEffect(() => {
    let alive = true;
    if (dp === "trello" && trelloConnected && trello.boardId) {
      trelloGetLists(trello.key, trello.token, trello.boardId)
        .then((l) => alive && setLists(l))
        .catch(() => {});
    } else {
      setLists([]);
    }
    return () => {
      alive = false;
    };
  }, [dp, trello.key, trello.token, trello.boardId, trelloConnected]);

  const onBoard = (id: string) => {
    const name = boards.find((b) => b.id === id)?.name ?? "";
    updateProvider("trello", {
      boardId: id,
      boardName: name,
      listId: "",
      listName: "",
    });
  };
  const onList = (id: string) => {
    const name = lists.find((l) => l.id === id)?.name ?? "";
    updateProvider("trello", { listId: id, listName: name });
  };
  const onTeam = (id: string) => {
    const name = teams.find((t) => t.id === id)?.name ?? "";
    updateProvider("linear", { teamId: id, teamName: name });
  };

  return (
    <div>
      {/* provider segmented control */}
      <div style={{ display: "flex", gap: 6 }}>
        {(["trello", "linear"] as ProviderId[]).map((id) => {
          const active = dp === id;
          const conn = id === "trello" ? trelloConnected : linearConnected;
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
                gap: 7,
                padding: "7px 10px",
                borderRadius: 8,
                border: `1px solid ${active ? "var(--accent)" : T.border}`,
                background: active ? "rgba(110,123,255,0.12)" : "rgba(255,255,255,0.03)",
                color: active ? T.text : T.sub,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: conn ? T.success : T.faint,
                }}
              />
              {PROVIDER_LABELS[id]}
            </button>
          );
        })}
      </div>

      {!connected ? (
        <button
          className="btn"
          onClick={() => void openSettings()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            width: "100%",
            justifyContent: "center",
            marginTop: 10,
            padding: "9px 12px",
            borderRadius: 9,
            background: "rgba(255,138,91,0.12)",
            border: `1px solid rgba(255,138,91,0.4)`,
            color: "#FF8A5B",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <SettingsIcon size={13} /> Connect {PROVIDER_LABELS[dp]} in Settings
        </button>
      ) : dp === "trello" ? (
        <>
          <Select
            value={trello.boardId}
            onChange={onBoard}
            placeholder={loading ? "Loading boards…" : "Select a board…"}
            options={boards}
            enabled={!loading}
          />
          <Select
            value={trello.listId}
            onChange={onList}
            placeholder="Select a list…"
            options={lists}
            enabled={!!trello.boardId}
          />
        </>
      ) : (
        <Select
          value={linear.teamId}
          onChange={onTeam}
          placeholder={loading ? "Loading teams…" : "Select a team…"}
          options={teams}
          enabled={!loading}
        />
      )}
    </div>
  );
}
