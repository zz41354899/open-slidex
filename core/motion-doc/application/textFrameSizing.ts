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
  const measuredLines = measuredTextLines(text, props, fontSize);
  const currentX = frameValue(props.x, defaultFrameX());
  const currentY = frameValue(props.y, defaultFrameY(block.type));
  const currentWidth = frameValue(props.w, defaultFrameWidth(block.type));
  const currentHeight = frameValue(props.h, defaultFrameHeight(block.type));
  const maxWidth = Math.max(MIN_TEXT_FRAME_WIDTH, 100 - currentX);
  const maxHeight = Math.max(MIN_TEXT_FRAME_HEIGHT, 100 - currentY);
  const maxFontSize = Math.max(fontSize, ...measuredLines.map((line) => line.maxFontSize));
  const { horizontalPaddingPx, verticalPaddingPx } = selectionPaddingForFont(maxFontSize, props);
  const longestLineWidth = Math.max(...measuredLines.map((line) => line.width), maxFontSize * 2);
  const contentWidth = ((longestLineWidth + horizontalPaddingPx) / MOTION_DOC_CANVAS_WIDTH) * 100;
  // "Fit text box" means fit the text to the chosen measure (frame width),
  // not silently widen a title until it reaches the edge of the slide.
  const nextWidth = mode === "height" || mode === "fit"
    ? currentWidth
    : clampFrameSize(
        mode === "grow" ? Math.max(currentWidth, contentWidth) : contentWidth,
        MIN_TEXT_FRAME_WIDTH,
        maxWidth
      );
  const widthPx = Math.max((nextWidth / 100) * MOTION_DOC_CANVAS_WIDTH, maxFontSize * 2);
  const wrappedLines = wrappedTextLines(text, props, fontSize, widthPx);
  const contentHeightPx = wrappedLines.reduce(
    (height, line) => height + (
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

type MeasuredTextLine = { maxFontSize: number; width: number };
type MeasuredTextToken = MeasuredTextLine & { kind: "break" | "cjk" | "space" | "word"; value?: string };

/**
 * Estimate visual lines with the same high-level constraints users expect:
 * CJK may wrap between ideographs; a western word stays together; spaces do
 * not become a line's first visible character. The browser remains the visual
 * authority, but this avoids the old character-count height jumps.
 */
function wrappedTextLines(text: string, props: MotionDocProps, baseFontSize: number, widthPx: number) {
  const tokens = measuredTextTokens(text, props, baseFontSize);
  const lines: MeasuredTextLine[] = [{ maxFontSize: baseFontSize, width: 0 }];
  let pendingSpace: MeasuredTextToken | null = null;

  for (const token of tokens) {
    if (token.kind === "break") {
      lines.push({ maxFontSize: token.maxFontSize, width: 0 });
      pendingSpace = null;
      continue;
    }

    const line = lines[lines.length - 1];
    if (token.kind === "space") {
      if (line.width > 0) pendingSpace = token;
      continue;
    }

    const spaceWidth = pendingSpace?.width ?? 0;
    const nextWidth = line.width + spaceWidth + token.width;
    if (line.width > 0 && nextWidth > widthPx && !isClosingCjkToken(token)) {
      lines.push({ maxFontSize: token.maxFontSize, width: token.width });
      pendingSpace = null;
      continue;
    }

    line.width = nextWidth;
    line.maxFontSize = Math.max(line.maxFontSize, token.maxFontSize, pendingSpace?.maxFontSize ?? 0);
    pendingSpace = null;
  }

  return lines;
}

function measuredTextTokens(text: string, props: MotionDocProps, baseFontSize: number) {
  const baseLetterSpacing = motionDocFontPointsToCanvasPixels(numberValue(props.letterSpacing) ?? 0);
  const tokens: MeasuredTextToken[] = [];
  let word: MeasuredTextToken | null = null;

  function flushWord() {
    if (word) tokens.push(word);
    word = null;
  }

  for (const segment of textStyleSegments(text || " ", props)) {
    const fontSize = segment.fontSize === undefined
      ? baseFontSize
      : motionDocFontPointsToCanvasPixels(segment.fontSize);
    const letterSpacing = segment.letterSpacing === undefined
      ? baseLetterSpacing
      : motionDocFontPointsToCanvasPixels(segment.letterSpacing);

    for (const character of Array.from(segment.text || " ")) {
      const width = estimatedLineWidth(character, fontSize) + letterSpacing;
      if (character === "\n") {
        flushWord();
        tokens.push({ kind: "break", maxFontSize: fontSize, width: 0 });
      } else if (/\s/.test(character)) {
        flushWord();
        tokens.push({ kind: "space", maxFontSize: fontSize, width });
      } else if (isCjkCharacter(character)) {
        flushWord();
        tokens.push({ kind: "cjk", maxFontSize: fontSize, value: character, width });
      } else if (word) {
        word.width += width;
        word.maxFontSize = Math.max(word.maxFontSize, fontSize);
      } else {
        word = { kind: "word", maxFontSize: fontSize, width };
      }
    }
  }

  flushWord();
  return tokens;
}

function isCjkCharacter(value: string) {
  return /[\u2e80-\u9fff\uff00-\uffef]/.test(value);
}

function isClosingCjkToken(token: MeasuredTextToken) {
  return token.kind === "cjk" && /^[、。，．：；！？）］｝〉》」』】〕〙〗]$/.test(token.value ?? "");
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
