import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

export function normalizeBlockRotation(value: string | number | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const normalized = ((parsed % 360) + 360) % 360;
  return Math.round((normalized > 180 ? normalized - 360 : normalized) * 10) / 10;
}

export function blockRotation(props: MotionDocProps) {
  return normalizeBlockRotation(props.rotation);
}

export function blockAspectRatioLocked(props: MotionDocProps) {
  return props.lockAspectRatio === 1
    || props.lockAspectRatio === "1"
    || props.lockAspectRatio === "true";
}

export function setBlockAspectRatioLocked(props: MotionDocProps, locked: boolean): MotionDocProps {
  const next = { ...props };
  if (locked) next.lockAspectRatio = "true";
  else delete next.lockAspectRatio;
  return next;
}
