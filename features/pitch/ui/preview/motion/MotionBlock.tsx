"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion } from "framer-motion";
import { hasElementMotion } from "@/features/pitch/application/motionModel";
import type { EnterAnimation } from "@/features/pitch/application/motionPresets";
import { elementMotionProps } from "@/features/pitch/ui/preview/motion/framerMotionProps";

export type { EnterAnimation };

export type AnimationProps = {
  delay?: number;
  duration?: number;
  enter?: EnterAnimation;
  fillFrame?: boolean;
};

export type RadiusProps = {
  borderRadius?: number | string;
  radius?: number | string;
};

export type ColorProps = {
  background?: string;
  backgroundColor?: string;
  color?: string;
  mutedColor?: string;
  textAlign?: "left" | "center" | "right";
  textColor?: string;
};

type MotionBlockProps = AnimationProps & {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
} & RadiusProps;

export function MotionBlock({
  borderRadius,
  children,
  className,
  fillFrame,
  radius,
  style,
  ...animation
}: MotionBlockProps) {
  const blockStyle = {
    ...radiusStyle({ borderRadius, radius }),
    ...(fillFrame ? { height: "100%", maxWidth: "none", width: "100%" } : {}),
    ...style
  };

  if (!hasElementMotion(animation)) {
    return (
      <div className={className} style={blockStyle}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      style={blockStyle}
      {...elementMotionProps(animation)}
    >
      {children}
    </motion.div>
  );
}

function radiusStyle({ borderRadius, radius }: RadiusProps): CSSProperties | undefined {
  const value = borderRadius ?? radius;

  if (value === undefined || value === "") {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (Number.isFinite(parsed)) {
    return { borderRadius: `${Math.max(parsed, 0)}px` };
  }

  return { borderRadius: value };
}
