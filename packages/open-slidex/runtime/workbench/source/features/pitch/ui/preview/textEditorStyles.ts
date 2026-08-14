import type { CSSProperties } from "react";
import { numberValue } from "@/core/motion-doc/domain/frame";
import type { MotionDocTextBlock } from "@/core/motion-doc/domain/motionDocTypes";
import {
  motionDocDefaultFontSize,
  motionDocFontPointsToCanvasPixels,
  motionDocLineHeightCanvasPixels
} from "@/core/motion-doc/domain/typography";
import { stringValue } from "@/features/pitch/application/previewCanvas";

export function editableFrameStyle(block: MotionDocTextBlock): CSSProperties {
  const verticalAlign = stringValue(block.props.textVerticalAlign, "top");
  const background = stringValue(block.props.background ?? block.props.backgroundColor ?? block.props.bg, "");
  const radius = numberValue(block.props.radius ?? block.props.borderRadius);

  return {
    alignItems: "stretch",
    ...(background ? { background } : {}),
    ...(radius === undefined ? {} : { borderRadius: `${Math.max(radius, 0)}px` }),
    display: "flex",
    flexDirection: "column",
    justifyContent: verticalAlign === "bottom"
      ? "flex-end"
      : verticalAlign === "middle" || verticalAlign === "center" ? "center" : "flex-start"
  };
}

export function editableTextStyle(block: MotionDocTextBlock, canvasScale: number): CSSProperties {
  const fontSize = Number(block.props.fontSize) || motionDocDefaultFontSize(block.type);
  const textAlign = stringValue(block.props.textAlign, "left") as CSSProperties["textAlign"];
  const color = stringValue(block.props.color ?? block.props.textColor, "inherit");
  const hasSurface = Boolean(stringValue(block.props.background ?? block.props.backgroundColor ?? block.props.bg, ""));
  const fontWeight = numberValue(block.props.fontWeight) ?? (block.props.role === "title" ? 600 : 400);
  const lineHeight = motionDocLineHeightCanvasPixels(
    fontSize,
    block.props.lineHeight,
    block.props.lineHeightPt,
    block.props.role === "title" ? 1.02 : 1.45
  );
  const letterSpacing = numberValue(block.props.letterSpacing) ?? 0;
  const fontFamily = stringValue(block.props.fontFamily, "");

  return {
    border: 0,
    boxSizing: "border-box",
    caretColor: "#7c6df6",
    color,
    display: "block",
    fontFamily: fontFamily ? `"${fontFamily}", var(--font-geist-sans, sans-serif)` : "inherit",
    fontSize: `${motionDocFontPointsToCanvasPixels(fontSize) * canvasScale}px`,
    fontStyle: block.props.fontStyle === "italic" ? "italic" : "normal",
    fontWeight,
    letterSpacing: `${motionDocFontPointsToCanvasPixels(letterSpacing) * canvasScale}px`,
    lineHeight: `${lineHeight * canvasScale}px`,
    margin: 0,
    minHeight: "1em",
    padding: hasSurface ? "0.12em 0.18em" : 0,
    textAlign,
    userSelect: "text",
    whiteSpace: "pre-wrap",
    width: "100%"
  };
}
