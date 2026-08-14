import { numberValue } from "@/core/motion-doc/domain/frame";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { textStyleSegments } from "@/core/motion-doc/domain/textStyleRanges";
import {
  motionDocDefaultFontSize,
  motionDocFontPointsToCanvasPixels,
  motionDocLineHeightCanvasPixels
} from "@/core/motion-doc/domain/typography";
import {
  MOTION_DOC_CANVAS_HEIGHT,
  MOTION_DOC_CANVAS_WIDTH
} from "@/core/motion-doc/domain/viewport";

type TextFrameSizingBlock = {
  props: MotionDocProps;
  type: string;
};

type AutoSizeTextFrameOptions = {
  mode?: "fit" | "grow" | "height";
  props?: MotionDocProps;
};

export type TextLineHeightUnit = "multiple" | "points";

const MIN_TEXT_FRAME_WIDTH = 12;
const MIN_TEXT_FRAME_HEIGHT = 6;
const MIN_HORIZONTAL_SELECTION_PADDING_PX = 28;
const MIN_VERTICAL_SELECTION_PADDING_PX = 18;

export function textFramePropsWithLineHeight(
  props: MotionDocProps,
  value: number | "",
  unit: TextLineHeightUnit
): MotionDocProps {
  const nextProps = { ...props };
  delete nextProps.lineHeight;
  delete nextProps.lineHeightPt;

  if (value !== "") {
    nextProps[unit === "points" ? "lineHeightPt" : "lineHeight"] = value;
  }

  return nextProps;
}

export function autoSizeTextFrameProps(
  block: TextFrameSizingBlock,
  text: string,
  options: AutoSizeTextFrameOptions = {}
): MotionDocProps {
  const mode = options.mode ?? "fit";
  const props = options.props ?? block.props;
  const fontSizePoints = numberValue(props.fontSize) ?? defaultFontSize(block.type);
  const fontSize = motionDocFontPointsToCanvasPixels(fontSizePoints);
  const lineHeightPixels = motionDocLineHeightCanvasPixels(
    fontSizePoints,
    props.lineHeight,
    props.lineHeightPt,
    defaultLineHeight(block.type)
  );
  const exactLineHeight = numberValue(props.lineHeightPt);
  const lineHeightMultiple = numberValue(props.lineHeight) ?? defaultLineHeight(block.type);
  const lines = measuredTextLines(text, props, fontSize);
  const currentX = frameValue(props.x, defaultFrameX());
  const currentY = frameValue(props.y, defaultFrameY(block.type));
  const currentWidth = frameValue(props.w, defaultFrameWidth(block.type));
  const currentHeight = frameValue(props.h, defaultFrameHeight(block.type));
  const maxWidth = Math.max(MIN_TEXT_FRAME_WIDTH, 100 - currentX);
  const maxHeight = Math.max(MIN_TEXT_FRAME_HEIGHT, 100 - currentY);
  const maxFontSize = Math.max(fontSize, ...lines.map((line) => line.maxFontSize));
  const { horizontalPaddingPx, verticalPaddingPx } = selectionPaddingForFont(maxFontSize, props);
  const longestLineWidth = Math.max(...lines.map((line) => line.width), maxFontSize * 2);
  const contentWidth = ((longestLineWidth + horizontalPaddingPx) / MOTION_DOC_CANVAS_WIDTH) * 100;
  const nextWidth = mode === "height"
    ? currentWidth
    : clampFrameSize(
        mode === "grow" ? Math.max(currentWidth, contentWidth) : contentWidth,
        MIN_TEXT_FRAME_WIDTH,
        maxWidth
      );
  const widthPx = Math.max((nextWidth / 100) * MOTION_DOC_CANVAS_WIDTH, maxFontSize * 2);
  const contentHeightPx = lines.reduce(
    (height, line) => height + Math.max(1, Math.ceil(line.width / widthPx)) * (
      exactLineHeight !== undefined ? lineHeightPixels : line.maxFontSize * lineHeightMultiple
    ),
    0
  );
  const contentHeight = ((contentHeightPx + verticalPaddingPx) / MOTION_DOC_CANVAS_HEIGHT) * 100;
  const nextHeight = clampFrameSize(
    mode === "grow" ? Math.max(currentHeight, contentHeight) : contentHeight,
    MIN_TEXT_FRAME_HEIGHT,
    maxHeight
  );

  return {
    ...props,
    h: roundFrameSize(nextHeight),
    w: roundFrameSize(nextWidth)
  };
}

function estimatedLineWidth(line: string, fontSize: number) {
  return Array.from(line || " ").reduce((sum, char) => {
    if (/[\u3000-\u9fff\uff00-\uffef]/.test(char)) return sum + fontSize;
    if (char === " ") return sum + fontSize * 0.32;
    return sum + fontSize * 0.56;
  }, 0);
}

function measuredTextLines(text: string, props: MotionDocProps, baseFontSize: number) {
  const baseLetterSpacing = motionDocFontPointsToCanvasPixels(numberValue(props.letterSpacing) ?? 0);
  const lines = [{ maxFontSize: baseFontSize, width: 0 }];

  for (const segment of textStyleSegments(text || " ", props)) {
    const fontSize = segment.fontSize === undefined
      ? baseFontSize
      : motionDocFontPointsToCanvasPixels(segment.fontSize);
    const letterSpacing = segment.letterSpacing === undefined
      ? baseLetterSpacing
      : motionDocFontPointsToCanvasPixels(segment.letterSpacing);

    for (const character of Array.from(segment.text || " ")) {
      if (character === "\n") {
        lines.push({ maxFontSize: fontSize, width: 0 });
        continue;
      }
      const line = lines[lines.length - 1];
      line.maxFontSize = Math.max(line.maxFontSize, fontSize);
      line.width += estimatedLineWidth(character, fontSize) + letterSpacing;
    }
  }

  return lines;
}

function selectionPaddingForFont(fontSize: number, props: MotionDocProps) {
  const surfacePaddingPx = hasTextSurface(props) ? fontSize * 0.4 : 0;
  return {
    horizontalPaddingPx: Math.max(MIN_HORIZONTAL_SELECTION_PADDING_PX, fontSize * 0.75) + surfacePaddingPx,
    verticalPaddingPx: Math.max(MIN_VERTICAL_SELECTION_PADDING_PX, fontSize * 0.45) + surfacePaddingPx
  };
}

function hasTextSurface(props: MotionDocProps) {
  return Boolean(stringProp(props.background ?? props.backgroundColor ?? props.bg));
}

function stringProp(value: string | number | undefined) {
  return typeof value === "string" && value.trim() ? value : "";
}

function frameValue(value: string | number | undefined, fallback: number) {
  const parsed = numberValue(value);
  return parsed === undefined ? fallback : Math.min(Math.max(parsed, 0), 100);
}

function clampFrameSize(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function roundFrameSize(value: number) {
  return Math.round(value * 10) / 10;
}

function defaultFontSize(type: string) {
  return motionDocDefaultFontSize(type);
}

function defaultLineHeight(type: string) {
  return type === "heading" ? 1.12 : 1.45;
}

function defaultFrameWidth(type: string) {
  return type === "heading" ? 52 : 42;
}

function defaultFrameHeight(type: string) {
  return type === "heading" ? 18 : 9;
}

function defaultFrameX() {
  return 8;
}

function defaultFrameY(type: string) {
  return type === "heading" ? 18 : 38;
}
