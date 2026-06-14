import { forwardRef } from "react";
import { Zap } from "lucide-react";
import { T } from "../tokens";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Slot to the right of the input — reserved seam for a future dictate button. */
  trailing?: React.ReactNode;
};

/**
 * Self-contained capture input row (glyph + text field). Kept isolated so a
 * dictate affordance can later slot into `trailing` without touching Capture.
 * Voice/mic UI is intentionally out of scope for now.
 */
export const CaptureInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, onEnter, placeholder, disabled, trailing }, ref) => {
    return (
      <div
        className="field-wrap"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "18px 18px 16px",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 26,
            height: 26,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <Zap size={18} color={T.faint} />
        </div>

        <input
          ref={ref}
          className="bare"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEnter();
          }}
          placeholder={placeholder ?? "What needs doing?"}
          style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em" }}
        />

        {trailing}
      </div>
    );
  },
);

CaptureInput.displayName = "CaptureInput";
