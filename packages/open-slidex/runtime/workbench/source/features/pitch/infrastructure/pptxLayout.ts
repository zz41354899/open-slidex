import type PptxGenJS from "pptxgenjs";
import { MOTION_DOC_CANVAS_ASPECT_RATIO } from "@/core/motion-doc/domain/viewport";

export const SLIDEX_PPTX_LAYOUT = "LAYOUT_WIDE";
export const SLIDEX_PPTX_HEIGHT_INCHES = 7.5;
export const SLIDEX_PPTX_WIDTH_INCHES = SLIDEX_PPTX_HEIGHT_INCHES * MOTION_DOC_CANVAS_ASPECT_RATIO;

export function motionDocFontPointsToPptPoints(fontSize: number) {
  return fontSize;
}

export function configureSlideXPptxLayout(pptx: PptxGenJS) {
  pptx.layout = SLIDEX_PPTX_LAYOUT;
}
