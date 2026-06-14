/* Translate a keyboard event into a Tauri accelerator string ("Ctrl+Alt+Space").
   Returns null while only modifiers are held (no main key yet). */
export function accelFromEvent(e: KeyboardEvent): string | null {
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return null;

  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Super");

  parts.push(keyName(e.code, e.key));
  return parts.join("+");
}

function keyName(code: string, key: string): string {
  if (code.startsWith("Key")) return code.slice(3); // KeyA -> A
  if (code.startsWith("Digit")) return code.slice(5); // Digit1 -> 1
  if (/^F\d{1,2}$/.test(code)) return code; // F1..F12
  const map: Record<string, string> = {
    Space: "Space",
    Enter: "Enter",
    Tab: "Tab",
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
  };
  if (map[code]) return map[code];
  return key.length === 1 ? key.toUpperCase() : key;
}
