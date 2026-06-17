import { T } from "./tokens";

/* Keycap - ported verbatim from the prototype. */
export function Key({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 22,
        height: 22,
        padding: "0 6px",
        fontSize: 11.5,
        fontWeight: 600,
        color: accent ? "#fff" : T.sub,
        background: accent ? "var(--accent)" : "rgba(255,255,255,0.06)",
        border: `1px solid ${accent ? "transparent" : T.border}`,
        borderRadius: 6,
        boxShadow: accent ? "none" : "inset 0 -1px 0 rgba(0,0,0,0.25)",
      }}
    >
      {children}
    </span>
  );
}

/** Format an accelerator string ("Ctrl+Alt+Space") into keycap parts. */
export function comboParts(accelerator: string): string[] {
  return accelerator.split("+").map((p) => p.trim());
}
