export const canvasToolOptions = [
  { id: "select", label: "Select", shortcut: "V" },
  { id: "hand", label: "Hand", shortcut: "H" },
  { id: "zoom", label: "Zoom", shortcut: "Z" }
] as const;

export type CanvasTool = (typeof canvasToolOptions)[number]["id"];

export const defaultCanvasTool: CanvasTool = "select";

export function canvasToolFromShortcut(key: string): CanvasTool | null {
  const normalizedKey = key.toLowerCase();

  if (normalizedKey === "v") {
    return "select";
  }

  if (normalizedKey === "h") {
    return "hand";
  }

  if (normalizedKey === "z") {
    return "zoom";
  }

  return null;
}
