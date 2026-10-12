import { loadCaptionFonts } from "./lib/caption-fonts";
import { presets } from "../../../packages/core/src/captions";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/app.css";
void loadCaptionFonts(presets[0].style).catch(() => {});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
