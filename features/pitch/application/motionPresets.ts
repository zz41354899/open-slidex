import {
  normalizeMotionDocEnterAnimation,
  normalizeMotionDocSlideTransition,
  type MotionDocEnterAnimation,
  type MotionDocSlideTransition
} from "@/core/motion-doc/domain/motionVocabulary";

export type EnterAnimation = MotionDocEnterAnimation;
export type SlideTransition = MotionDocSlideTransition;

export type MotionPreset<TValue extends string> = {
  description: string;
  label: string;
  value: TValue;
};

export const elementAnimationPresets = [
  { description: "Static layer", label: "None", value: "none" },
  { description: "Soft vertical lift", label: "Fade Up", value: "fadeUp" },
  { description: "Clean opacity pass", label: "Fade", value: "fadeIn" },
  { description: "Lens-like scale", label: "Zoom", value: "zoomIn" },
  { description: "Right-to-left drift", label: "Slide", value: "slideLeft" },
  { description: "Crisp studio rise", label: "Rise", value: "rise" },
  { description: "Small elastic snap", label: "Pop", value: "pop" },
  { description: "Masked line reveal", label: "Reveal", value: "reveal" },
  { description: "Defocused arrival", label: "Blur", value: "blurIn" }
] satisfies ReadonlyArray<MotionPreset<EnterAnimation>>;

export const slideTransitionPresets = [
  { description: "No slide motion", label: "None", value: "none" },
  { description: "Match layers across adjacent slides", label: "Morph", value: "morph" },
  { description: "Editorial fade", label: "Fade", value: "fade" },
  { description: "Stage lift", label: "Rise", value: "rise" },
  { description: "Cinematic push", label: "Push", value: "pushLeft" },
  { description: "Camera scale", label: "Scale", value: "scale" },
  { description: "Horizontal wipe", label: "Wipe", value: "wipe" },
  { description: "Soft curtain", label: "Curtain", value: "curtain" }
] satisfies ReadonlyArray<MotionPreset<SlideTransition>>;

export function normalizeEnterAnimation(
  value: string | number | undefined,
  fallback: EnterAnimation = "none"
): EnterAnimation {
  return normalizeMotionDocEnterAnimation(value, fallback);
}

export function normalizeSlideTransition(value: string | number | undefined): SlideTransition {
  return normalizeMotionDocSlideTransition(value);
}
