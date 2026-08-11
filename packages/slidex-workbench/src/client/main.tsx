import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Workbench } from "./Workbench";
import "@open-slidex/editor-ui/styles.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("SlideX Workbench root was not found.");

createRoot(root).render(
  <StrictMode>
    <Workbench />
  </StrictMode>
);
