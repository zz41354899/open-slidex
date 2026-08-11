export const localWorkbenchShortcutBindings = [
  { action: "select", key: "V", label: "Select" },
  { action: "hand", key: "H", label: "Hand" },
  { action: "zoom", key: "Z", label: "Zoom" },
  { action: "temporary-hand", key: "Space", label: "Temporary Hand" },
  { action: "text", key: "T", label: "Text" },
  { action: "media", key: "M", label: "Media" },
  { action: "shape", key: "S", label: "Shape" },
  { action: "table", key: "B", label: "Table" },
  { action: "icon", key: "I", label: "Icon" },
  { action: "chart", key: "C", label: "Chart" },
  { action: "undo", key: "⌘/Ctrl Z", label: "Undo" },
  { action: "redo", key: "⇧⌘Z / Ctrl Y", label: "Redo" },
  { action: "command-menu", key: "⌘K", label: "Command Menu" },
  { action: "assistant", key: "/", label: "SlideX AI" },
  { action: "shortcut-help", key: "⇧?", label: "Keyboard shortcuts" }
] as const;

export type LocalWorkbenchShortcutAction = (typeof localWorkbenchShortcutBindings)[number]["action"];

export function localWorkbenchShortcut(action: LocalWorkbenchShortcutAction) {
  return localWorkbenchShortcutBindings.find((binding) => binding.action === action)?.key ?? "";
}

export function isWorkbenchTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target.isContentEditable || Boolean(target.closest("[data-code-editor]"));
}

export function isLocalWorkbenchWindowsRedoShortcut(event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey">) {
  return event.ctrlKey
    && !event.metaKey
    && !event.altKey
    && !event.shiftKey
    && event.key.toLowerCase() === "y";
}
