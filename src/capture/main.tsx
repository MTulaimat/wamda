import ReactDOM from "react-dom/client";
import { Capture } from "./Capture";
import { CSS } from "../tokens";

// No StrictMode: its dev double-mount double-fires the window-show listeners,
// which replays the entrance animation twice.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <>
    <style>{CSS}</style>
    <Capture />
  </>,
);
