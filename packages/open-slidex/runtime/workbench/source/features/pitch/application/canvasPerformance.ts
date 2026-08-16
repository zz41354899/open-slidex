import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";

export const MAIN_CANVAS_PRELOAD_MARGIN = "640px 0px";
export const MAIN_CANVAS_INACTIVE_SHADER_MAX_PIXEL_COUNT = 640 * 360;
export const THUMBNAIL_SHADER_MAX_PIXEL_COUNT = 480 * 270;
export const THUMBNAIL_SHADER_MIN_PIXEL_RATIO = 0.25;
export const CANVAS_SAFE_AREA_INSET_PERCENT = 5;

const mainCanvasShaderPixelBudgets = [
  { maxDisplayWidth: 720, pixelCount: 640 * 360 },
  { maxDisplayWidth: 1080, pixelCount: 960 * 540 },
  { maxDisplayWidth: Number.POSITIVE_INFINITY, pixelCount: 1280 * 720 }
] as const;

/**
 * Quantized preview quality avoids a WebGL resize on every zoom tick. The DPR
 * cap keeps a Retina display from rendering more shader pixels than the editor
 * can visibly use. Export paths keep their own full-resolution renderer.
 */
export function mainCanvasShaderMaxPixelCount(
  canvasScale: number,
  devicePixelRatio = 1
) {
  const safeScale = Number.isFinite(canvasScale) ? Math.max(0, canvasScale) : 1;
  const effectivePixelRatio = Math.min(Math.max(devicePixelRatio, 1), 1.5);
  const displayPixelWidth = 1920 * safeScale * effectivePixelRatio;

  return mainCanvasShaderPixelBudgets.find(
    ({ maxDisplayWidth }) => displayPixelWidth <= maxDisplayWidth
  )?.pixelCount ?? 1280 * 720;
}

export function effectiveCanvasShaderSpeed(speed: number, playbackActive: boolean) {
  return playbackActive ? speed : 0;
}

export function canvasSafeAreaPixels() {
  return {
    horizontal: MOTION_DOC_CANVAS_WIDTH * CANVAS_SAFE_AREA_INSET_PERCENT / 100,
    vertical: MOTION_DOC_CANVAS_HEIGHT * CANVAS_SAFE_AREA_INSET_PERCENT / 100
  };
}
