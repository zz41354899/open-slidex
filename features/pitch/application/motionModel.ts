import type { MotionDocBlock, MotionDocPropInput, MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import {
  normalizeEnterAnimation,
  normalizeSlideTransition,
  type EnterAnimation,
  type SlideTransition
} from "@/features/pitch/application/motionPresets";

export type ElementMotionConfig = {
  delay?: number;
  duration?: number;
  enter: EnterAnimation;
};

export type SlideMotionConfig = {
  duration?: number;
  slideTransition: SlideTransition;
};

export function normalizeElementMotion(props: MotionDocPropInput): ElementMotionConfig {
  const enter = normalizeEnterAnimation(props.enter);

  if (enter === "none") {
    return { enter };
  }

  return {
    delay: numberProp(props.delay, 0),
    duration: numberProp(props.duration, 0.6),
    enter
  };
}

export function normalizeElementMotionProps(props: MotionDocProps): MotionDocProps {
  const motion = normalizeElementMotion(props);
  const nextProps: MotionDocProps = {
    ...props,
    enter: motion.enter
  };

  if (motion.enter === "none") {
    delete nextProps.delay;
    delete nextProps.duration;
    return nextProps;
  }

  nextProps.delay = motion.delay ?? 0;
  nextProps.duration = motion.duration ?? 0.6;

  return nextProps;
}

export function hasElementMotion(props: MotionDocPropInput) {
  return normalizeElementMotion(props).enter !== "none";
}

export function applyElementAnimationProps(
  props: MotionDocProps,
  enter: EnterAnimation
): MotionDocProps {
  return normalizeElementMotionProps({
    ...props,
    enter
  });
}

export function normalizeBlockMotion(block: MotionDocBlock): MotionDocBlock {
  if (!("props" in block)) {
    return block;
  }

  return {
    ...block,
    props: normalizeElementMotionProps(block.props)
  } as MotionDocBlock;
}

export function normalizeSlideMotion(props: MotionDocPropInput): SlideMotionConfig {
  const slideTransition = normalizeSlideTransition(props.slideTransition);

  if (slideTransition === "none") {
    return { slideTransition };
  }

  return {
    duration: numberProp(props.transitionDuration, 0.72),
    slideTransition
  };
}

export function applySlideTransitionProps(
  props: MotionDocProps,
  slideTransition: SlideTransition
): MotionDocProps {
  const nextProps: MotionDocProps = {
    ...props,
    slideTransition
  };

  if (slideTransition === "none") {
    nextProps.transitionDuration = "";
    return nextProps;
  }

  nextProps.transitionDuration = props.transitionDuration || 0.72;

  return nextProps;
}

function numberProp(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}
