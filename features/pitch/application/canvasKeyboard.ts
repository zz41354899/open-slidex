export const CANVAS_KEYBOARD_INTENT_EVENT = "open-slidex:canvas-keyboard-intent";

export type CanvasKeyboardZoomCommand = "fit" | "in" | "out";

export type CanvasKeyboardWheelZoomIntent = {
  deltaMode: number;
  deltaY: number;
  kind: "wheel-zoom";
  xRatio: number;
  yRatio: number;
};

export type CanvasKeyboardIntent =
  | { active: boolean; kind: "temporary-hand" }
  | { kind: "tool"; tool: "hand" | "select" | "zoom" }
  | { command: CanvasKeyboardZoomCommand; kind: "zoom" }
  | CanvasKeyboardWheelZoomIntent;

type CanvasKeyboardEventDescriptor = {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
};

export function canvasKeyboardZoomCommand(
  event: CanvasKeyboardEventDescriptor
): CanvasKeyboardZoomCommand | null {
  if ((!event.metaKey && !event.ctrlKey) || event.altKey) return null;

  if (event.key === "+" || event.key === "=" || event.key === "Add") return "in";
  if (event.key === "-" || event.key === "_" || event.key === "Subtract") return "out";
  if (event.key === "0") return "fit";
  return null;
}

export function isCanvasSpaceKey(event: Pick<KeyboardEvent, "code" | "key">) {
  return event.code === "Space" || event.key === " " || event.key === "Spacebar";
}

export function emitCanvasKeyboardIntent(intent: CanvasKeyboardIntent) {
  window.dispatchEvent(new CustomEvent<CanvasKeyboardIntent>(CANVAS_KEYBOARD_INTENT_EVENT, {
    detail: intent
  }));
}

export function canvasKeyboardIntentFromUnknown(value: unknown): CanvasKeyboardIntent | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  if (record.kind === "temporary-hand") {
    return typeof record.active === "boolean"
      ? { active: record.active, kind: record.kind }
      : null;
  }

  if (record.kind === "wheel-zoom") {
    const deltaY = Number(record.deltaY);
    const deltaMode = Number(record.deltaMode);
    const xRatio = Number(record.xRatio);
    const yRatio = Number(record.yRatio);
    if (![deltaY, deltaMode, xRatio, yRatio].every(Number.isFinite)) return null;
    return {
      deltaMode: deltaMode === 1 || deltaMode === 2 ? deltaMode : 0,
      deltaY,
      kind: "wheel-zoom",
      xRatio: Math.max(0, Math.min(1, xRatio)),
      yRatio: Math.max(0, Math.min(1, yRatio))
    };
  }

  if (
    record.kind === "tool"
    && (record.tool === "select" || record.tool === "hand" || record.tool === "zoom")
  ) {
    return { kind: record.kind, tool: record.tool };
  }

  if (
    record.kind === "zoom"
    && (record.command === "fit" || record.command === "in" || record.command === "out")
  ) {
    return { command: record.command, kind: "zoom" };
  }

  return null;
}
