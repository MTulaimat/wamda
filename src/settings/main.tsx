import ReactDOM from "react-dom/client";
import { Settings } from "./Settings";
import { CSS } from "../tokens";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <>
    <style>{CSS}</style>
    <Settings />
  </>,
);
