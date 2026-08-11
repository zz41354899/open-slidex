import {
  MOTION_DOC_CANVAS_HEIGHT,
  MOTION_DOC_CANVAS_WIDTH
} from "@/core/motion-doc/domain/viewport";

const LEGACY_MOTION_DOC_CANVAS_WIDTH = 1024;
const CSS_PIXELS_TO_POINTS = 0.75;

export const MOTION_DOC_TYPOGRAPHY_SCALE =
  MOTION_DOC_CANVAS_WIDTH / LEGACY_MOTION_DOC_CANVAS_WIDTH;

export const MOTION_DOC_FONT_SIZE_UNIT = "pt" as const;

export const MOTION_DOC_FONT_SIZES = {
  body: 18,
  caption: 13.5,
  display: 54,
  heading: 36,
  largeDisplay: 72,
  lead: 22.5,
  section: 45,
  slideTitle: 27,
  supportingTitle: 24,
  table: 12
} as const;

export const MOTION_DOC_CANVAS_PROPS = {
  canvasHeight: MOTION_DOC_CANVAS_HEIGHT,
  canvasWidth: MOTION_DOC_CANVAS_WIDTH,
  fontSizeUnit: MOTION_DOC_FONT_SIZE_UNIT
} as const;

export function legacyCssFontPixelsToCanvasPixels(value: number) {
  return Math.round(value * MOTION_DOC_TYPOGRAPHY_SCALE);
}

export function legacyFontPixelsToPoints(value: number) {
  return roundFontSize(value * CSS_PIXELS_TO_POINTS);
}

export function fullHdFontPixelsToPoints(value: number) {
  return roundFontSize(value * CSS_PIXELS_TO_POINTS / MOTION_DOC_TYPOGRAPHY_SCALE);
}

export function motionDocFontPointsToCanvasPixels(value: number) {
  return Math.round(value / CSS_PIXELS_TO_POINTS * MOTION_DOC_TYPOGRAPHY_SCALE);
}

export function motionDocDefaultFontSize(type: string) {
  return type === "Title"
    ? MOTION_DOC_FONT_SIZES.display
    : MOTION_DOC_FONT_SIZES.body;
}

function roundFontSize(value: number) {
  return Math.round(value * 1000) / 1000;
}
