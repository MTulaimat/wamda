import { T } from "../../tokens";
import { Field } from "../widgets";
import type { Settings } from "../../types";

const ACCENTS = ["#6E7BFF", "#34D6A0", "#FF8A5B", "#F25C9B", "#52B6FF", "#C792EA"];

export function Appearance({
  settings,
  update,
}: {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}) {
  return (
    <>
      <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: T.text }}>
        Appearance
      </h2>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: T.faint }}>
        Make it yours.
      </p>

      <Field label="Accent color">
        <div style={{ display: "flex", gap: 12 }}>
          {ACCENTS.map((c) => (
            <button
              key={c}
              className="swatch"
              onClick={() => update({ accent: c })}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: c,
                border: "none",
                boxShadow:
                  settings.accent.toLowerCase() === c.toLowerCase()
                    ? `0 0 0 2px #15171f, 0 0 0 4px ${c}`
                    : "none",
              }}
            />
          ))}
        </div>
      </Field>
    </>
  );
}
