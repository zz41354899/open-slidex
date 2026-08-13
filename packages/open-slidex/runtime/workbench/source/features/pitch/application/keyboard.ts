import type { PositionDelta } from "@/features/pitch/application/pitchGeometry";

export function isArrowKey(key: string) {
  return key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown";
}

export function arrowDelta(key: string, isLargeStep: boolean, isFineStep: boolean): PositionDelta {
  const step = isFineStep ? 0.2 : isLargeStep ? 5 : 1;

  if (key === "ArrowLeft") return { x: -step, y: 0 };
  if (key === "ArrowRight") return { x: step, y: 0 };
  if (key === "ArrowUp") return { x: 0, y: -step };

  return { x: 0, y: step };
}

export type ShortcutTargetDescriptor = {
  contentEditable?: string | null;
  isContentEditable?: boolean;
  role?: string | null;
  tagName?: string | null;
};

export function isEditableShortcutTargetDescriptor(target: ShortcutTargetDescriptor) {
  const tagName = target.tagName?.toUpperCase();
  const contentEditable = target.contentEditable?.toLowerCase();
  const role = target.role?.toLowerCase();

  return target.isContentEditable === true
    || contentEditable === "true"
    || contentEditable === "plaintext-only"
    || role === "textbox"
    || tagName === "INPUT"
    || tagName === "SELECT"
    || tagName === "TEXTAREA";
}
