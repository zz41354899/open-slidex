export const motionDocEnterAnimations = [
  "blurIn",
  "fadeIn",
  "fadeUp",
  "none",
  "pop",
  "reveal",
  "rise",
  "slideLeft",
  "zoomIn"
] as const;

export type MotionDocEnterAnimation = (typeof motionDocEnterAnimations)[number];

export const motionDocSlideTransitions = [
  "curtain",
  "fade",
  "morph",
  "none",
  "pushLeft",
  "rise",
  "scale",
  "wipe"
] as const;

export type MotionDocSlideTransition = (typeof motionDocSlideTransitions)[number];

const enterAnimationSet = new Set<string>(motionDocEnterAnimations);
const slideTransitionSet = new Set<string>(motionDocSlideTransitions);

export function isMotionDocEnterAnimation(
  value: unknown
): value is MotionDocEnterAnimation {
  return typeof value === "string" && enterAnimationSet.has(value);
}

export function isMotionDocSlideTransition(
  value: unknown
): value is MotionDocSlideTransition {
  return typeof value === "string" && slideTransitionSet.has(value);
}

export function normalizeMotionDocEnterAnimation(
  value: string | number | undefined,
  fallback: MotionDocEnterAnimation = "none"
): MotionDocEnterAnimation {
  if (isMotionDocEnterAnimation(value)) return value;
  if (value === undefined) return fallback;
  if (value === "") return "none";
  throw new Error(
    `Unknown MotionDoc enter animation "${String(value)}". Expected one of: ${motionDocEnterAnimations.join(", ")}.`
  );
}

export function normalizeMotionDocSlideTransition(
  value: string | number | undefined
): MotionDocSlideTransition {
  if (isMotionDocSlideTransition(value)) return value;
  if (value === undefined) return "none";
  if (value === "") return "none";
  throw new Error(
    `Unknown MotionDoc slide transition "${String(value)}". Expected one of: ${motionDocSlideTransitions.join(", ")}.`
  );
}
