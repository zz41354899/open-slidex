import type { MotionProps } from "framer-motion";
import type { EnterAnimation, SlideTransition } from "@/features/pitch/application/motionPresets";
import { normalizeElementMotion, normalizeSlideMotion } from "@/features/pitch/application/motionModel";

const springEase = [0.22, 1, 0.36, 1] as const;
const swiftEase = [0.16, 1, 0.3, 1] as const;

export function elementMotionProps({
  delay = 0,
  duration = 0.6,
  enter = "none"
}: {
  delay?: number;
  duration?: number;
  enter?: EnterAnimation;
}): MotionProps {
  const motion = normalizeElementMotion({ delay, duration, enter });

  enter = motion.enter;
  delay = motion.delay ?? 0;
  duration = motion.duration ?? 0.6;

  if (enter === "none") {
    return {};
  }

  const shared = {
    animate: { filter: "blur(0px)", opacity: 1, rotate: 0, scale: 1, x: 0, y: 0 },
    transition: { delay, duration, ease: springEase }
  } satisfies MotionProps;

  if (enter === "fadeIn") {
    return { ...shared, initial: { opacity: 0 } };
  }

  if (enter === "zoomIn") {
    return { ...shared, initial: { opacity: 0, scale: 0.88 } };
  }

  if (enter === "slideLeft") {
    return { ...shared, initial: { opacity: 0, x: 54 } };
  }

  if (enter === "rise") {
    return { ...shared, initial: { opacity: 0, rotate: -1.2, y: 42 } };
  }

  if (enter === "pop") {
    return {
      ...shared,
      initial: { opacity: 0, scale: 0.72 },
      transition: { delay, duration: Math.max(duration * 0.85, 0.36), ease: [0.34, 1.56, 0.64, 1] }
    };
  }

  if (enter === "reveal") {
    return { ...shared, initial: { opacity: 0, scale: 0.98, y: 10 } };
  }

  if (enter === "blurIn") {
    return { ...shared, initial: { filter: "blur(14px)", opacity: 0, scale: 1.04 } };
  }

  return { ...shared, initial: { opacity: 0, y: 28 } };
}

export function slideMotionProps({
  duration = 0.72,
  slideTransition = "none"
}: {
  duration?: number;
  slideTransition?: SlideTransition;
}): MotionProps {
  const motion = normalizeSlideMotion({ slideTransition, transitionDuration: duration });

  slideTransition = motion.slideTransition;
  duration = motion.duration ?? 0.72;

  if (slideTransition === "none") {
    return { initial: false };
  }

  const shared = {
    animate: {
      clipPath: "inset(0% 0% 0% 0%)",
      filter: "blur(0px)",
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0
    },
    transition: { duration, ease: swiftEase }
  } satisfies MotionProps;

  if (slideTransition === "fade") {
    return { ...shared, initial: { opacity: 0 } };
  }

  if (slideTransition === "rise") {
    return { ...shared, initial: { opacity: 0, scale: 0.985, y: 36 } };
  }

  if (slideTransition === "pushLeft") {
    return { ...shared, initial: { opacity: 0, x: 96 } };
  }

  if (slideTransition === "scale") {
    return { ...shared, initial: { filter: "blur(8px)", opacity: 0, scale: 1.08 } };
  }

  if (slideTransition === "wipe") {
    return { ...shared, initial: { clipPath: "inset(0% 100% 0% 0%)", opacity: 1 } };
  }

  return { ...shared, initial: { clipPath: "inset(0% 0% 100% 0%)", opacity: 1, y: 18 } };
}
