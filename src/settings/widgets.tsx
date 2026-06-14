import { T } from "../tokens";

export function Toggle({
  on,
  set,
}: {
  on: boolean;
  set: (v: boolean) => void;
}) {
  return (
    <button
      className="tog btn"
      onClick={() => set(!on)}
      style={{
        width: 42,
        height: 25,
        borderRadius: 13,
        border: "none",
        padding: 3,
        background: on ? "var(--accent)" : "rgba(255,255,255,0.12)",
        cursor: "pointer",
        display: "flex",
      }}
    >
      <span
        className="tog-knob"
        style={{
          width: 19,
          height: 19,
          borderRadius: "50%",
          background: "#fff",
          transform: on ? "translateX(17px)" : "translateX(0)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
  onHint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  onHint?: () => void;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 7,
        }}
      >
        <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>
          {label}
        </span>
        {hint && (
          <span
            className="linkish"
            onClick={onHint}
            style={{ fontSize: 11.5, color: T.faint, cursor: "pointer" }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "11px 13px",
  borderRadius: 10,
  background: T.field,
  border: `1px solid ${T.border}`,
};

/** A row with a title/description and a control on the right. */
export function ToggleRow({
  title,
  desc,
  on,
  set,
}: {
  title: string;
  desc: string;
  on: boolean;
  set: (v: boolean) => void;
}) {
  return (
    <div
      className="row"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "13px 12px",
        margin: "0 -12px",
        borderRadius: 10,
      }}
    >
      <div>
        <div style={{ fontSize: 13.5, color: T.text, fontWeight: 500 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>{desc}</div>
      </div>
      <Toggle on={on} set={set} />
    </div>
  );
}
