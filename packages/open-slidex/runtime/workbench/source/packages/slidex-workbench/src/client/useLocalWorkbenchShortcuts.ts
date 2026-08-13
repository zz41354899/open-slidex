import { useEffect, type Dispatch, type SetStateAction } from "react";

import { isLocalWorkbenchWindowsRedoShortcut, isWorkbenchTypingTarget } from "./localWorkbenchShortcuts";
import type { LocalToolMenuId } from "./LocalWorkbenchToolbar";

type UseLocalWorkbenchShortcutsOptions = {
  blocked: boolean;
  onAddChart: () => void;
  onAddText: () => void;
  onRedo: () => void;
  onToggleCommandMenu: () => void;
  onToggleShortcutHelp: () => void;
  setOpenTool: Dispatch<SetStateAction<LocalToolMenuId | null>>;
};

export function useLocalWorkbenchShortcuts(options: UseLocalWorkbenchShortcutsOptions) {
  useEffect(() => {
    function toggleTool(tool: LocalToolMenuId) {
      options.setOpenTool((current) => current === tool ? null : tool);
    }

    function onKeyDown(event: KeyboardEvent) {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "k") {
        if (options.blocked) return;
        event.preventDefault();
        options.onToggleCommandMenu();
        return;
      }

      if (isWorkbenchTypingTarget(event.target)) return;
      if (!options.blocked && isLocalWorkbenchWindowsRedoShortcut(event)) {
        event.preventDefault();
        options.onRedo();
        return;
      }
      if (options.blocked || modifier || event.altKey) return;
      const key = event.key.toLowerCase();

      if (event.key === "?" && event.shiftKey) {
        event.preventDefault();
        options.onToggleShortcutHelp();
        return;
      }
      if (key === "t") {
        event.preventDefault();
        options.setOpenTool(null);
        options.onAddText();
        return;
      }
      if (key === "c") {
        event.preventDefault();
        options.setOpenTool(null);
        options.onAddChart();
        return;
      }
      if (key === "m") {
        event.preventDefault();
        toggleTool("media");
        return;
      }
      if (key === "s") {
        event.preventDefault();
        toggleTool("shape");
        return;
      }
      if (key === "b") {
        event.preventDefault();
        toggleTool("table");
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [options]);
}
