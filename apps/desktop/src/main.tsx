import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ProductMotion } from "./Motion";
import "./presentation.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <ProductMotion />
  </React.StrictMode>,
);
