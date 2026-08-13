import type { CSSProperties } from "react";
import {
  motionDocFontPointsToCanvasPixels,
  motionDocLineHeightCanvasValue
} from "@/core/motion-doc/domain/typography";
import type { ColorProps } from "@/features/pitch/ui/preview/motion/MotionBlock";

type TextStyleProps = {
  fontFamily?: string;
  fontSize?: number | string;
  fontStyle?: string;
  fontWeight?: number | string;
  letterSpacing?: number | string;
  lineHeight?: number | string;
  lineHeightPt?: number | string;
};

export function textStyle(
  { fontFamily, fontSize, fontStyle, fontWeight, letterSpacing, lineHeight, lineHeightPt }: TextStyleProps,
  defaultLineHeight: number,
  textAlign: ColorProps["textAlign"]
): CSSProperties {
  return {
    ...(fontFamily === undefined || fontFamily === "" ? {} : { fontFamily: `"${fontFamily}", var(--font-geist-sans, sans-serif)` }),
    ...(fontSize === undefined || fontSize === "" ? {} : {
      fontSize: typeof fontSize === "number"
        ? `${motionDocFontPointsToCanvasPixels(fontSize)}px`
        : fontSize
    }),
    ...(fontWeight === undefined || fontWeight === "" ? {} : { fontWeight }),
    ...(fontStyle === "italic" ? { fontStyle: "italic" } : {}),
    ...(letterSpacing === undefined || letterSpacing === "" ? {} : {
      letterSpacing: typeof letterSpacing === "number"
        ? `${motionDocFontPointsToCanvasPixels(letterSpacing)}px`
        : letterSpacing
    }),
    lineHeight: motionDocLineHeightCanvasValue(lineHeight, lineHeightPt, defaultLineHeight),
    ...(textAlign ? { textAlign } : {}),
    whiteSpace: "pre-wrap"
  };
}

export function cssColor(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function surfaceStyle(
  props: Pick<ColorProps, "background" | "backgroundColor" | "color" | "textColor">,
  padWhenFilled = false
): CSSProperties {
  const background = cssColor(props.background ?? props.backgroundColor);
  const color = cssColor(props.color ?? props.textColor);

  return {
    ...(background ? { background, padding: padWhenFilled ? "0.12em 0.18em" : undefined } : {}),
    ...(color ? { color } : {})
  };
}

export function surfaceVars(props: ColorProps): CSSProperties {
  const background = cssColor(props.background ?? props.backgroundColor);
  const color = cssColor(props.color ?? props.textColor);
  const mutedColor = cssColor(props.mutedColor);

  return {
    ...(background ? { "--block-bg": background, background } : {}),
    ...(color ? { "--block-fg": color } : {}),
    ...(mutedColor || color ? { "--block-muted": mutedColor ?? color } : {})
  } as CSSProperties;
}

export function cardWidthClass(value: string) {
  if (value === "sm") return "w-full max-w-sm";
  if (value === "lg") return "w-full max-w-3xl";
  if (value === "full") return "w-full max-w-none";

  return "w-full max-w-2xl";
}

export function metricWidthClass(value: string) {
  if (value === "md") return "w-full max-w-md";
  if (value === "lg") return "w-full max-w-2xl";
  if (value === "full") return "w-full max-w-none";

  return "w-full max-w-sm";
}

export function alignXToFlex(value: "left" | "center" | "right" | "stretch") {
  if (value === "center") return "center";
  if (value === "right") return "flex-end";
  if (value === "stretch") return "stretch";

  return "flex-start";
}

export function alignYToFlex(value: "top" | "center" | "bottom") {
  if (value === "top") return "flex-start";
  if (value === "bottom") return "flex-end";

  return "center";
}
