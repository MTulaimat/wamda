import { useState } from "react";
import { Info, Link2, Palette, Settings as SettingsIcon } from "lucide-react";
import { T } from "../tokens";
import { PROVIDER_LABELS, type ProviderId } from "../types";
import { useSettings } from "../useSettings";
import { Titlebar } from "./Titlebar";
import { General } from "./panes/General";
import { Integrations } from "./panes/Integrations";
import { Appearance } from "./panes/Appearance";
import { About } from "./panes/About";

type TabId = "general" | "integrations" | "appearance" | "about";

const TABS: { id: TabId; label: string; icon: typeof SettingsIcon }[] = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "about", label: "About", icon: Info },
];

export function Settings() {
  const { settings, update, updateProvider, loaded } = useSettings();
  const [tab, setTab] = useState<TabId>("general");

  return (
    <div
      className="qc-root"
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#10121d",
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <Titlebar />

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* sidebar */}
        <div
          style={{
            width: 196,
            flexShrink: 0,
            borderRight: `1px solid ${T.hairline}`,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            background: "rgba(255,255,255,0.015)",
          }}
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                className="row btn"
                onClick={() => setTab(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 10px",
                  marginBottom: 2,
                  borderRadius: 9,
                  background: active ? "rgba(255,255,255,0.07)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: active ? T.text : T.sub,
                  fontSize: 13.5,
                  fontWeight: active ? 600 : 500,
                  textAlign: "left",
                }}
              >
                <t.icon size={16} color={active ? "var(--accent)" : T.faint} />{" "}
                {t.label}
              </button>
            );
          })}
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 7,
              padding: "8px 10px",
            }}
          >
            {(["trello", "linear"] as ProviderId[]).map((id) => {
              const c = settings.providers[id].connected;
              return (
                <div
                  key={id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 11.5,
                    color: c ? T.sub : T.faint,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: c ? T.success : T.faint,
                    }}
                  />
                  {PROVIDER_LABELS[id]}
                  <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.faint }}>
                    {c ? "connected" : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* content */}
        <div
          key={tab}
          style={{
            flex: 1,
            padding: "26px 28px",
            overflowY: "auto",
            animation: "tabIn .26s ease both",
          }}
        >
          {loaded && tab === "general" && (
            <General settings={settings} update={update} />
          )}
          {loaded && tab === "integrations" && (
            <Integrations
              settings={settings}
              update={update}
              updateProvider={updateProvider}
            />
          )}
          {loaded && tab === "appearance" && (
            <Appearance settings={settings} update={update} />
          )}
          {loaded && tab === "about" && <About />}
        </div>
      </div>
    </div>
  );
}
