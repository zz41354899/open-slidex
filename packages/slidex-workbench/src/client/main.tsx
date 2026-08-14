import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { I18nProvider } from "@/common/lib/I18nProvider";
import { TooltipProvider as ShadcnTooltipProvider } from "@/packages/editor-ui/src/components/ui/tooltip";
import { Workbench } from "./Workbench";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-700.css";
import "@open-slidex/editor-ui/styles.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("SlideX Workbench root was not found.");

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <ShadcnTooltipProvider>
        <Workbench />
      </ShadcnTooltipProvider>
    </I18nProvider>
  </StrictMode>
);
