"use client";

import { isSlideXIconName, lucideIconPaths } from "@/core/motion-doc/domain/lucideIconRegistry";
import {
  legacyCssFontPixelsToCanvasPixels,
  MOTION_DOC_FONT_SIZES,
  motionDocFontPointsToCanvasPixels
} from "@/core/motion-doc/domain/typography";
import { MotionBlock, type AnimationProps, type ColorProps, type RadiusProps } from "@/features/pitch/ui/preview/motion/MotionBlock";
import { cardWidthClass, metricWidthClass, surfaceVars } from "@/features/pitch/ui/preview/motion/blockStyles";

export function Card({
  background,
  backgroundColor,
  color,
  icon,
  layout = "vertical",
  mutedColor,
  text,
  textColor,
  title,
  width = "md",
  ...animation
}: AnimationProps & {
  icon?: string;
  layout?: string;
  text: string;
  title: string;
  width?: string;
} & RadiusProps & ColorProps) {
  const isHorizontal = layout === "horizontal";
  const colors = surfaceVars({ background, backgroundColor, color, mutedColor, textColor });

  return (
    <MotionBlock
      className={`${cardWidthClass(width)} overflow-hidden rounded-2xl border border-[var(--slide-border)] bg-[var(--slide-card)] p-5 shadow-xl shadow-black/20 backdrop-blur ${
        isHorizontal ? "flex items-start gap-4" : ""
      }`}
      style={colors}
      {...animation}
    >
      {icon ? (
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--slide-border)] bg-white/[0.08] text-[var(--slide-fg)] ${
            isHorizontal ? "" : "mb-4"
          }`}
          style={{ color: "var(--block-fg, var(--slide-fg))" }}
        >
          <LucideSvg name={icon} />
        </div>
      ) : null}
      <div className="min-w-0">
        <h3 className="font-semibold text-[var(--slide-fg)]" style={{ color: "var(--block-fg, var(--slide-fg))", fontSize: legacyCssFontPixelsToCanvasPixels(20) }}>
          {title}
        </h3>
        <p className="mt-2 text-[var(--slide-muted)]" style={{ color: "var(--block-muted, var(--slide-muted))", fontSize: legacyCssFontPixelsToCanvasPixels(16), lineHeight: 1.75 }}>
          {text}
        </p>
      </div>
    </MotionBlock>
  );
}

export function Metric({
  background,
  backgroundColor,
  caption,
  color,
  label,
  mutedColor,
  textColor,
  value,
  width = "sm",
  ...animation
}: AnimationProps & {
  caption?: string;
  label: string;
  value: string;
  width?: string;
} & RadiusProps & ColorProps) {
  return (
    <MotionBlock
      className={`${metricWidthClass(width)} rounded-2xl border border-[var(--slide-border)] bg-[var(--slide-card)] p-5 shadow-xl shadow-black/20 backdrop-blur`}
      style={surfaceVars({ background, backgroundColor, color, mutedColor, textColor })}
      {...animation}
    >
      <p className="font-semibold tracking-[0.18em] text-[var(--slide-muted)]" style={{ color: "var(--block-muted, var(--slide-muted))", fontSize: legacyCssFontPixelsToCanvasPixels(12) }}>
        {label}
      </p>
      <p className="mt-3 font-semibold leading-none text-[var(--slide-fg)]" style={{ color: "var(--block-fg, var(--slide-fg))", fontSize: motionDocFontPointsToCanvasPixels(MOTION_DOC_FONT_SIZES.heading) }}>
        {value}
      </p>
      {caption ? (
        <p className="mt-3 text-[var(--slide-muted)]" style={{ color: "var(--block-muted, var(--slide-muted))", fontSize: legacyCssFontPixelsToCanvasPixels(14), lineHeight: 1.5 }}>
          {caption}
        </p>
      ) : null}
    </MotionBlock>
  );
}

function LucideSvg({ name }: { name: string }) {
  if (!isSlideXIconName(name)) {
    return null;
  }

  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {lucideIconPaths[name].map((path, index) => {
        const [shape, ...parts] = path.split(" ");

        if (shape === "circle") {
          return <circle cx={parts[0]} cy={parts[1]} key={path + index} r={parts[2]} />;
        }

        if (shape === "ellipse") {
          return <ellipse cx={parts[0]} cy={parts[1]} key={path + index} rx={parts[2]} ry={parts[3]} />;
        }

        if (shape === "rect") {
          return <rect height={parts[3]} key={path + index} rx={parts[4]} ry={parts[5]} width={parts[2]} x={parts[0]} y={parts[1]} />;
        }

        return <path d={shape === "path" ? parts.join(" ") : path} key={path + index} />;
      })}
    </svg>
  );
}
