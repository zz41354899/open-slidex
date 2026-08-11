export const minCanvasZoomScale = 0.02;
export const maxCanvasZoomScale = 8;

const zoomStepRatio = 1.18;
const wheelZoomSensitivity = 0.0012;
const maximumWheelDelta = 240;
const zoomDampingResponseMs = 70;

type CanvasClientPoint = {
  clientX: number;
  clientY: number;
};

type CanvasClientRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

export type CanvasZoomAnchor = CanvasClientPoint & {
  xRatio: number;
  yRatio: number;
};

export function nextCanvasZoomScale(currentScale: number, direction: "in" | "out", stepCount = 1) {
  const safeStepCount = Math.max(1, Math.min(24, Math.round(stepCount)));
  const ratio = Math.pow(zoomStepRatio, safeStepCount);
  const nextScale = direction === "in" ? currentScale * ratio : currentScale / ratio;

  return roundCanvasZoomScale(clampCanvasZoomScale(nextScale));
}

export function canvasZoomScaleFromPinch(startScale: number, startDistance: number, currentDistance: number) {
  if (startDistance <= 0 || !Number.isFinite(startDistance) || !Number.isFinite(currentDistance)) {
    return clampCanvasZoomScale(startScale);
  }

  return roundCanvasZoomScale(clampCanvasZoomScale(startScale * (currentDistance / startDistance)));
}

export function canvasZoomAnchorFromPoint(point: CanvasClientPoint, rect: CanvasClientRect): CanvasZoomAnchor {
  const clientX = clamp(point.clientX, rect.left, rect.left + rect.width);
  const clientY = clamp(point.clientY, rect.top, rect.top + rect.height);

  return {
    clientX,
    clientY,
    xRatio: rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5,
    yRatio: rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5
  };
}

export function canvasZoomScrollCorrection(anchor: CanvasZoomAnchor, resizedRect: CanvasClientRect) {
  return {
    x: resizedRect.left + resizedRect.width * anchor.xRatio - anchor.clientX,
    y: resizedRect.top + resizedRect.height * anchor.yRatio - anchor.clientY
  };
}

export function canvasZoomScaleFromWheel(
  currentScale: number,
  deltaY: number,
  deltaMode = 0,
  viewportHeight = 800
) {
  const normalizedDelta = normalizedWheelDelta(deltaY, deltaMode, viewportHeight);
  const limitedDelta = clamp(normalizedDelta, -maximumWheelDelta, maximumWheelDelta);
  const nextScale = currentScale * Math.exp(-limitedDelta * wheelZoomSensitivity);

  return roundCanvasZoomScale(clampCanvasZoomScale(nextScale));
}

export function dampedCanvasZoomScale(currentScale: number, targetScale: number, elapsedMs: number) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return clampCanvasZoomScale(currentScale);
  }

  const progress = 1 - Math.exp(-elapsedMs / zoomDampingResponseMs);
  const nextScale = currentScale + (targetScale - currentScale) * progress;

  return clampCanvasZoomScale(nextScale);
}

export function clampCanvasZoomScale(scale: number) {
  return Math.max(minCanvasZoomScale, Math.min(maxCanvasZoomScale, scale));
}

function roundCanvasZoomScale(scale: number) {
  return Math.round(scale * 10000) / 10000;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizedWheelDelta(deltaY: number, deltaMode: number, viewportHeight: number) {
  if (!Number.isFinite(deltaY)) return 0;
  if (deltaMode === 1) return deltaY * 16;
  if (deltaMode === 2) return deltaY * Math.max(viewportHeight, 1);
  return deltaY;
}
