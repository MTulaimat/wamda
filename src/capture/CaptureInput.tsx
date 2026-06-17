import { forwardRef, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronDown, Zap } from "lucide-react";
import { T } from "../tokens";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Slot between the glyph and the input - used for the selected-template chip. */
  leading?: React.ReactNode;
  /** Slot to the right of the input - reserved seam for a future dictate button. */
  trailing?: React.ReactNode;

  /** Expandable details (task capture only; hidden for /commands). */
  showExpandToggle?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  description?: string;
  descriptionRef?: React.Ref<HTMLTextAreaElement>;
  onDescriptionChange?: (v: string) => void;
  onDescriptionKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  due?: string | null;
  /** Hands Capture an opener for the native date picker (for Ctrl+D). */
  onDatePickerReady?: (open: () => void) => void;
  onDueChange?: (v: string | null) => void;
};

/**
 * Self-contained capture input row (glyph + text field), with an optional
 * expandable block for a description + due date. Kept isolated so a dictate
 * affordance can later slot into `trailing` without touching Capture. Voice/mic
 * UI is intentionally out of scope for now.
 */
export const CaptureInput = forwardRef<HTMLInputElement, Props>(
  (
    {
      value,
      onChange,
      onKeyDown,
      placeholder,
      disabled,
      leading,
      trailing,
      showExpandToggle,
      expanded,
      onToggleExpand,
      description = "",
      descriptionRef,
      onDescriptionChange,
      onDescriptionKeyDown,
      due = null,
      onDatePickerReady,
      onDueChange,
    },
    ref,
  ) => {
    const dateRef = useRef<HTMLInputElement>(null);

    const openDatePicker = () => {
      const el = dateRef.current;
      if (!el) return;
      try {
        el.showPicker();
      } catch {
        el.focus();
      }
    };

    // Hand the opener up to Capture so Ctrl+D can trigger it.
    useEffect(() => {
      onDatePickerReady?.(openDatePicker);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const dueLabel = due
      ? new Date(`${due}T00:00:00`).toLocaleDateString([], {
          month: "short",
          day: "numeric",
        })
      : null;

    return (
      <div>
        {/* Title row. The focus ring (field-wrap) is dropped when expanded so the
            title + details read as one continuous surface. */}
        <div
          className={expanded ? undefined : "field-wrap"}
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
              width: 28,
              height: 28,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Zap size={18} color={T.faint} />
          </div>

          {leading}

          <input
            ref={ref}
            className="bare"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? "What needs doing?"}
            style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em" }}
          />

          {showExpandToggle && (
            <button
              className="icon-btn"
              onClick={onToggleExpand}
              title={expanded ? "Hide details" : "Add details (Ctrl+↓)"}
              style={{
                display: "grid",
                placeItems: "center",
                width: 28,
                height: 28,
                padding: 0,
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: "rgba(255,255,255,0.04)",
                color: T.sub,
                flexShrink: 0,
                cursor: "pointer",
              }}
            >
              <ChevronDown
                size={16}
                style={{
                  transform: expanded ? "rotate(180deg)" : "none",
                  transition: "transform .22s cubic-bezier(.16,1,.3,1)",
                }}
              />
            </button>
          )}

          {trailing}
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: "hidden" }}
            >
              <div style={{ position: "relative", padding: "0 18px 16px 56px" }}>
                {/* Due date - icon only, aligned under the expand button. */}
                <div style={{ position: "absolute", top: 2, right: 18 }}>
                  <button
                    className="icon-btn"
                    onClick={openDatePicker}
                    disabled={disabled}
                    title={due ? `Due ${dueLabel}` : "Set a due date"}
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: 28,
                      height: 28,
                      padding: 0,
                      borderRadius: 8,
                      border: `1px solid ${due ? "var(--accent)" : T.border}`,
                      background: due
                        ? "rgba(110,123,255,0.14)"
                        : "rgba(255,255,255,0.04)",
                      color: due ? "var(--accent)" : T.faint,
                      cursor: "pointer",
                    }}
                  >
                    <CalendarDays size={16} />
                  </button>
                  {/* Hidden native input that backs the picker. */}
                  <input
                    ref={dateRef}
                    type="date"
                    value={due ?? ""}
                    disabled={disabled}
                    tabIndex={-1}
                    onChange={(e) => onDueChange?.(e.target.value || null)}
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 30,
                      width: 0,
                      height: 0,
                      opacity: 0,
                      padding: 0,
                      border: "none",
                      pointerEvents: "none",
                    }}
                  />
                </div>

                <textarea
                  ref={descriptionRef}
                  className="bare"
                  value={description}
                  disabled={disabled}
                  onChange={(e) => onDescriptionChange?.(e.target.value)}
                  onKeyDown={onDescriptionKeyDown}
                  placeholder="Add a description…  (Ctrl+Enter to add)"
                  rows={3}
                  style={{
                    resize: "none",
                    lineHeight: 1.5,
                    fontSize: 13.5,
                    paddingTop: 4,
                    paddingRight: 38,
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

CaptureInput.displayName = "CaptureInput";
