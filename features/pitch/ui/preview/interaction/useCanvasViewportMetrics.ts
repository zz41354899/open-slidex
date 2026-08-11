"use client";

import { useEffect, useState, type CSSProperties, type RefObject } from "react";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/features/pitch/application/previewCanvas";

const mobileCanvasBreakpoint = 640;
type UseCanvasViewportMetricsOptions = {
  onFitScaleChange?: (scale: number) => void;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  zoomLevel: number | "fit";
};

export function useCanvasViewportMetrics({
  onFitScaleChange,
  scrollAreaRef,
  zoomLevel
}: UseCanvasViewportMetricsOptions) {
  const [canvasViewportWidth, setCanvasViewportWidth] = useState(0);
  const [fitCanvasWidth, setFitCanvasWidth] = useState(799);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const updateFitWidth = () => {
      const rect = scrollArea.getBoundingClientRect();
      const isMobileViewport = rect.width < mobileCanvasBreakpoint;
      const horizontalInset = isMobileViewport ? 24 : 96;
      const minimumWidth = isMobileViewport ? 240 : 280;
      const maximumWidth = isMobileViewport ? CANVAS_WIDTH : 799;
      setCanvasViewportWidth(rect.width);
      setFitCanvasWidth(Math.max(minimumWidth, Math.min(maximumWidth, rect.width - horizontalInset)));
    };

    updateFitWidth();
    const observer = new ResizeObserver(updateFitWidth);
    observer.observe(scrollArea);
    return () => observer.disconnect();
  }, [scrollAreaRef]);

  const actualScale = zoomLevel === "fit" ? fitCanvasWidth / CANVAS_WIDTH : zoomLevel;
  const canvasFrameWidth = zoomLevel === "fit" ? fitCanvasWidth : CANVAS_WIDTH * zoomLevel;
  const canvasStripMinimumPadding = canvasViewportWidth < mobileCanvasBreakpoint ? 12 : 48;

  useEffect(() => {
    onFitScaleChange?.(actualScale);
  }, [actualScale, onFitScaleChange]);

  return {
    actualScale,
    canvasFrameStyle: frameStyle(zoomLevel, fitCanvasWidth),
    canvasStripSidePadding: Math.max(canvasStripMinimumPadding, Math.round((canvasViewportWidth - canvasFrameWidth) / 2))
  };
}

function frameStyle(zoomLevel: number | "fit", fitCanvasWidth: number): CSSProperties {
  if (zoomLevel === "fit") {
    return { aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`, width: fitCanvasWidth };
  }

  return { height: CANVAS_HEIGHT * zoomLevel, width: CANVAS_WIDTH * zoomLevel };
}
