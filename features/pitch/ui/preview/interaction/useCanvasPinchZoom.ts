"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import { canvasZoomScaleFromPinch } from "@/features/pitch/application/canvasZoom";

type TouchPoint = {
  x: number;
  y: number;
};

type PinchState = {
  anchorContentX: number;
  anchorContentY: number;
  startDistance: number;
  startScale: number;
};

type PendingPinchFrame = {
  pinchState: PinchState;
  pointerX: number;
  pointerY: number;
  scrollArea: HTMLDivElement;
  scale: number;
  zoomRatio: number;
};

type UseCanvasPinchZoomArgs = {
  actualScale: number;
  getScrollArea: () => HTMLDivElement | null;
  onPinchStart: () => void;
  onSetZoomLevel: (scale: number) => void;
};

export function useCanvasPinchZoom({
  actualScale,
  getScrollArea,
  onPinchStart,
  onSetZoomLevel
}: UseCanvasPinchZoomArgs) {
  const actualScaleRef = useRef(actualScale);
  const pinchStateRef = useRef<PinchState | null>(null);
  const pointsRef = useRef(new Map<number, TouchPoint>());
  const rafRef = useRef<number | null>(null);
  const pendingFrameRef = useRef<PendingPinchFrame | null>(null);

  useEffect(() => {
    actualScaleRef.current = actualScale;
  }, [actualScale]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") {
      return false;
    }

    pointsRef.current.set(event.pointerId, pointFromEvent(event));

    if (pointsRef.current.size !== 2) {
      return false;
    }

    const scrollArea = getScrollArea();
    const points = firstTwoPoints(pointsRef.current);

    if (!scrollArea || !points) {
      return false;
    }

    const midpoint = midpointOf(points[0], points[1]);
    const viewportRect = scrollArea.getBoundingClientRect();
    const pointerX = midpoint.x - viewportRect.left;
    const pointerY = midpoint.y - viewportRect.top;

    pinchStateRef.current = {
      anchorContentX: scrollArea.scrollLeft + pointerX,
      anchorContentY: scrollArea.scrollTop + pointerY,
      startDistance: distanceBetween(points[0], points[1]),
      startScale: actualScaleRef.current
    };
    onPinchStart();
    return true;
  }, [getScrollArea, onPinchStart]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" || !pointsRef.current.has(event.pointerId)) {
      return false;
    }

    pointsRef.current.set(event.pointerId, pointFromEvent(event));
    const pinchState = pinchStateRef.current;
    const points = firstTwoPoints(pointsRef.current);
    const scrollArea = getScrollArea();

    if (!pinchState || !points || !scrollArea) {
      return false;
    }

    const midpoint = midpointOf(points[0], points[1]);
    const viewportRect = scrollArea.getBoundingClientRect();
    const pointerX = midpoint.x - viewportRect.left;
    const pointerY = midpoint.y - viewportRect.top;
    const nextScale = canvasZoomScaleFromPinch(
      pinchState.startScale,
      pinchState.startDistance,
      distanceBetween(points[0], points[1])
    );
    const zoomRatio = nextScale / Math.max(pinchState.startScale, 0.01);

    pendingFrameRef.current = {
      pinchState,
      pointerX,
      pointerY,
      scale: nextScale,
      scrollArea,
      zoomRatio
    };
    if (rafRef.current === null) {
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const frame = pendingFrameRef.current;
        pendingFrameRef.current = null;
        if (!frame) return;
        onSetZoomLevel(frame.scale);
        frame.scrollArea.scrollLeft = frame.pinchState.anchorContentX * frame.zoomRatio - frame.pointerX;
        frame.scrollArea.scrollTop = frame.pinchState.anchorContentY * frame.zoomRatio - frame.pointerY;
      });
    }
    return true;
  }, [getScrollArea, onSetZoomLevel]);

  const handlePointerEnd = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") {
      return false;
    }

    const wasPinching = pinchStateRef.current !== null;
    pointsRef.current.delete(event.pointerId);

    if (pointsRef.current.size < 2) {
      pinchStateRef.current = null;
      if (pendingFrameRef.current) {
        const frame = pendingFrameRef.current;
        pendingFrameRef.current = null;
        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        onSetZoomLevel(frame.scale);
        frame.scrollArea.scrollLeft = frame.pinchState.anchorContentX * frame.zoomRatio - frame.pointerX;
        frame.scrollArea.scrollTop = frame.pinchState.anchorContentY * frame.zoomRatio - frame.pointerY;
      }
    }

    return wasPinching;
  }, [onSetZoomLevel]);

  useEffect(() => () => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
    }
    pendingFrameRef.current = null;
  }, []);

  return {
    handlePointerDown,
    handlePointerEnd,
    handlePointerMove
  };
}

function firstTwoPoints(points: ReadonlyMap<number, TouchPoint>) {
  const values = Array.from(points.values());
  return values.length < 2 ? null : [values[0], values[1]] as const;
}

function pointFromEvent(event: PointerEvent<HTMLDivElement>): TouchPoint {
  return { x: event.clientX, y: event.clientY };
}

function distanceBetween(first: TouchPoint, second: TouchPoint) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function midpointOf(first: TouchPoint, second: TouchPoint): TouchPoint {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  };
}
