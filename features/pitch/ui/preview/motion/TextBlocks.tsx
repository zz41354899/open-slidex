"use client";

import type { ReactNode } from "react";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { textStyleLines, textStyleRangesFromProps } from "@/core/motion-doc/domain/textStyleRanges";
import { MOTION_DOC_FONT_SIZES } from "@/core/motion-doc/domain/typography";
import { MotionBlock, type AnimationProps, type ColorProps, type RadiusProps } from "@/features/pitch/ui/preview/motion/MotionBlock";
import { surfaceStyle, textStyle } from "@/features/pitch/ui/preview/motion/blockStyles";
import { useDynamicFonts } from "@/features/pitch/ui/hooks/useDynamicFont";

type TextBlockProps = AnimationProps & {
  children: ReactNode;
  fontFamily?: string;
  fontSize?: number | string;
  fontWeight?: number | string;
  lineHeight?: number | string;
  listStart?: number;
  listType?: string;
  textStyleRanges?: string;
  textVerticalAlign?: string;
} & RadiusProps & ColorProps;

export function Title({
  background,
  backgroundColor,
  children,
  color,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  textAlign,
  textColor,
  textStyleRanges,
  textVerticalAlign,
  listStart,
  listType,
  ...animation
}: TextBlockProps) {
  useTextBlockFonts(children, fontFamily, textStyleRanges);

  return (
    <MotionBlock
      className={`w-full text-5xl font-semibold leading-[1.02] tracking-normal text-[var(--slide-fg)] md:text-7xl`}
      style={{
        ...textStyle({ fontFamily, fontSize: fontSize ?? MOTION_DOC_FONT_SIZES.display, fontWeight, lineHeight }, 1.02, textAlign),
        ...textBoxAlignment(textVerticalAlign),
        ...surfaceStyle({ background, backgroundColor, color, textColor }, true)
      }}
      {...animation}
    >
      {renderContent(children, listType, textStyleRanges, listStart)}
    </MotionBlock>
  );
}

export function Text({
  background,
  backgroundColor,
  children,
  color,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  textAlign,
  textColor,
  textStyleRanges,
  textVerticalAlign,
  listStart,
  listType,
  ...animation
}: TextBlockProps) {
  useTextBlockFonts(children, fontFamily, textStyleRanges);

  return (
    <MotionBlock
      className={`w-full text-lg leading-8 text-[var(--slide-muted)] md:text-2xl md:leading-9`}
      style={{
        ...textStyle({ fontFamily, fontSize: fontSize ?? MOTION_DOC_FONT_SIZES.body, fontWeight, lineHeight }, 1.45, textAlign),
        ...textBoxAlignment(textVerticalAlign),
        ...surfaceStyle({ background, backgroundColor, color, textColor }, true)
      }}
      {...animation}
    >
      {renderContent(children, listType, textStyleRanges, listStart)}
    </MotionBlock>
  );
}

function renderContent(
  children: ReactNode,
  listType?: string,
  textStyleRanges?: string,
  listStart = 1
) {
  if (typeof children === "string") {
    const props: MotionDocProps = textStyleRanges ? { textStyleRanges } : {};
    return textStyleLines(children, props).map((line, lineIndex) => (
      <span
        key={lineIndex}
        className={
          listType === "bullet"
            ? "block pl-[1.2em] -indent-[1.2em]"
            : listType === "ordered"
              ? "block pl-[1.8em] -indent-[1.8em]"
              : "block whitespace-pre-wrap"
        }
      >
        {listType === "bullet" ? "• " : listType === "ordered" ? `${listStart + lineIndex}. ` : null}
        {line.length === 0
          ? "\u200B"
          : line.map((segment) => (
              <InlineTextSegment key={`${segment.start}-${segment.end}`} segment={segment} />
            ))}
      </span>
    ));
  }
  return children;
}

function InlineTextSegment({
  segment
}: {
  segment: ReturnType<typeof textStyleLines>[number][number];
}) {
  const style = {
    color: segment.color,
    fontFamily: segment.fontFamily ? `"${segment.fontFamily}", sans-serif` : undefined,
    fontStyle: segment.italic ? "italic" : undefined,
    fontWeight: segment.fontWeight,
    textDecoration: segment.underline ? "underline" : undefined
  } as const;
  const href = safePreviewHref(segment.href);

  return href ? (
    <a href={href} rel="noopener noreferrer" style={style}>
      {segment.text}
    </a>
  ) : (
    <span style={style}>{segment.text}</span>
  );
}

function safePreviewHref(value: string | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^(?:https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (/^(?:\/|#|\.\.?\/)/.test(trimmed)) return trimmed;
  return "";
}

function useTextBlockFonts(children: ReactNode, fontFamily?: string, textStyleRanges?: string) {
  const inlineFamilies = typeof children === "string"
    ? textStyleRangesFromProps(textStyleRanges ? { textStyleRanges } : {}, children.length)
      .flatMap((range) => range.fontFamily ? [range.fontFamily] : [])
    : [];
  useDynamicFonts(fontFamily ? [fontFamily, ...inlineFamilies] : inlineFamilies);
}

function textBoxAlignment(value: string | undefined) {
  const justifyContent = value === "bottom"
    ? "flex-end"
    : value === "middle" || value === "center"
      ? "center"
      : "flex-start";

  return {
    alignItems: "stretch",
    display: "flex",
    flexDirection: "column",
    justifyContent
  } as const;
}
