import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import WidgetApp from "./WidgetApp.jsx";
import "./index.css";

const embed = new URLSearchParams(window.location.search).get("embed") === "1";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {embed ? <WidgetApp /> : <App />}
  </StrictMode>
);
