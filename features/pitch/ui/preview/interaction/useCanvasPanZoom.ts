"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type PointerEvent, type RefObject, type SetStateAction } from "react";
import type { CanvasTool } from "@/features/pitch/application/canvasTools";
import {
  canvasZoomAnchorFromPoint,
  canvasZoomScaleFromWheel,
  canvasZoomScrollCorrection,
  dampedCanvasZoomScale,
  nextCanvasZoomScale,
  type CanvasZoomAnchor
} from "@/features/pitch/application/canvasZoom";
import { useCanvasPinchZoom } from "@/features/pitch/ui/preview/interaction/useCanvasPinchZoom";

export type CanvasViewportOffset = { x: number; y: number };
export type CanvasZoomDirection = "in" | "out";

type CanvasPanState = CanvasViewportOffset & {
  pointerId: number;
  startX: number;
  startY: number;
};

type UseCanvasPanZoomArgs = {
  activeCanvasTool: CanvasTool;
  actualScale: number;
  canvasRef: RefObject<HTMLDivElement | null>;
  canvasViewportOffset: CanvasViewportOffset;
  clearCanvasInteraction: () => void;
  closeContextMenu: () => void;
  onSetZoomLevel: (zoomLevel: number | "fit") => void;
  resetFramePreview: () => void;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  setCanvasViewportOffset: Dispatch<SetStateAction<CanvasViewportOffset>>;
};

export function useCanvasPanZoom({
  activeCanvasTool,
  actualScale,
  canvasRef,
  canvasViewportOffset,
  clearCanvasInteraction,
  closeContextMenu,
  onSetZoomLevel,
  resetFramePreview,
  scrollAreaRef,
  setCanvasViewportOffset
}: UseCanvasPanZoomArgs) {
  const panStateRef = useRef<CanvasPanState | null>(null);
  const panAnimationFrameRef = useRef<number | null>(null);
  const pendingPanOffsetRef = useRef<CanvasViewportOffset | null>(null);
  const touchPanCandidateRef = useRef<CanvasPanState | null>(null);
  const zoomAnchorRef = useRef<{ anchor: CanvasZoomAnchor; correctionCount: number } | null>(null);
  const zoomAnimationFrameRef = useRef<number | null>(null);
  const zoomAnimationTimeRef = useRef<number | null>(null);
  const zoomCurrentScaleRef = useRef(actualScale);
  const nativeWheelHandlerRef = useRef<(event: globalThis.WheelEvent) => void>(() => undefined);
  const zoomSettleFrameRef = useRef<number | null>(null);
  const zoomTargetAnchorRef = useRef<CanvasZoomAnchor | null>(null);
  const zoomTargetScaleRef = useRef(actualScale);
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [zoomDirection, setZoomDirection] = useState<CanvasZoomDirection>("in");
  const canvasPinchZoom = useCanvasPinchZoom({
    actualScale,
    getScrollArea: () => scrollAreaRef.current,
    onPinchStart: () => {
      stopBufferedZoomAnimation();
      panStateRef.current = null;
      touchPanCandidateRef.current = null;
      setIsPanningCanvas(false);
      closeContextMenu();
      clearCanvasInteraction();
      resetFramePreview();
    },
    onSetZoomLevel
  });

  useEffect(() => {
    if (zoomAnimationFrameRef.current !== null || zoomSettleFrameRef.current !== null) return;
    zoomCurrentScaleRef.current = actualScale;
    zoomTargetScaleRef.current = actualScale;
  }, [actualScale]);

  useEffect(() => {
    if (activeCanvasTool === "zoom") return;
    stopBufferedZoomAnimation();
  }, [activeCanvasTool]);

  nativeWheelHandlerRef.current = handleNativeCanvasToolWheel;

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const handleWheel = (event: globalThis.WheelEvent) => nativeWheelHandlerRef.current(event);
    scrollArea.addEventListener("wheel", handleWheel, { passive: false });

    return () => scrollArea.removeEventListener("wheel", handleWheel);
  }, [scrollAreaRef]);

  useEffect(() => () => {
    stopBufferedZoomAnimation();
    if (panAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(panAnimationFrameRef.current);
    }
  }, []);

  useLayoutEffect(() => {
    const pendingAnchor = zoomAnchorRef.current;
    const canvas = canvasRef.current;
    const scrollArea = scrollAreaRef.current;

    if (!pendingAnchor || !canvas || !scrollArea) return;

    scrollArea.scrollLeft = 0;
    scrollArea.scrollTop = 0;

    const correction = canvasZoomScrollCorrection(pendingAnchor.anchor, canvas.getBoundingClientRect());

    if (
      (Math.abs(correction.x) <= zoomAnchorEpsilon && Math.abs(correction.y) <= zoomAnchorEpsilon)
      || pendingAnchor.correctionCount >= maximumZoomAnchorCorrections
    ) {
      zoomAnchorRef.current = null;
      return;
    }

    pendingAnchor.correctionCount += 1;
    setCanvasViewportOffset((current) => clampCanvasViewportOffset({
      x: current.x - correction.x,
      y: current.y - correction.y
    }));
  }, [actualScale, canvasRef, canvasViewportOffset.x, canvasViewportOffset.y, scrollAreaRef, setCanvasViewportOffset]);

  function handleCanvasToolPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (canvasPinchZoom.handlePointerDown(event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest("button, [data-canvas-context-menu]")) return;

    if (
      event.pointerType === "touch"
      && activeCanvasTool === "select"
      && !isMobileEdgeGestureStart(event.clientX)
      && isDirectPanSurface(target)
    ) {
      touchPanCandidateRef.current = {
        ...canvasViewportOffset,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY
      };
      return;
    }

    if (activeCanvasTool === "hand") {
      startCanvasPan(event);
      return;
    }

    if (activeCanvasTool === "zoom" && (event.button === 0 || event.button === 2)) {
      event.preventDefault();
      event.stopPropagation();
      const direction = event.button === 2 || event.altKey ? "out" : "in";
      setZoomDirection(direction);
      const baseScale = zoomAnimationFrameRef.current === null ? actualScale : zoomTargetScaleRef.current;
      bufferCanvasZoomAtPoint(event, nextCanvasZoomScale(baseScale, direction));
    }
  }

  function handleNativeCanvasToolWheel(event: globalThis.WheelEvent) {
    if (activeCanvasTool !== "zoom" || event.deltaY === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const direction = event.deltaY > 0 ? "out" : "in";
    setZoomDirection(direction);
    const baseScale = zoomAnimationFrameRef.current === null ? actualScale : zoomTargetScaleRef.current;
    const viewportHeight = scrollAreaRef.current?.clientHeight ?? window.innerHeight;
    const targetScale = canvasZoomScaleFromWheel(baseScale, event.deltaY, event.deltaMode, viewportHeight);
    bufferCanvasZoomAtPoint(event, targetScale);
  }

  function startCanvasPan(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    stopBufferedZoomAnimation();
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    panStateRef.current = {
      ...canvasViewportOffset,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY
    };
    closeContextMenu();
    setIsPanningCanvas(true);
    clearCanvasInteraction();
  }

  function updateCanvasPan(event: PointerEvent<HTMLDivElement>) {
    if (canvasPinchZoom.handlePointerMove(event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const panCandidate = touchPanCandidateRef.current;
    if (!panStateRef.current && panCandidate?.pointerId === event.pointerId) {
      const distance = Math.hypot(event.clientX - panCandidate.startX, event.clientY - panCandidate.startY);
      if (distance >= directPanActivationDistance) {
        event.currentTarget.setPointerCapture(event.pointerId);
        panStateRef.current = { ...panCandidate };
        closeContextMenu();
        setIsPanningCanvas(true);
        clearCanvasInteraction();
        resetFramePreview();
      }
    }

    const panState = panStateRef.current;
    if (!panState || panState.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    pendingPanOffsetRef.current = clampCanvasViewportOffset({
      x: panState.x + event.clientX - panState.startX,
      y: panState.y + event.clientY - panState.startY
    });
    if (panAnimationFrameRef.current === null) {
      panAnimationFrameRef.current = window.requestAnimationFrame(() => {
        panAnimationFrameRef.current = null;
        const nextOffset = pendingPanOffsetRef.current;
        pendingPanOffsetRef.current = null;
        if (nextOffset) setCanvasViewportOffset(nextOffset);
      });
    }
  }

  function endCanvasPan(event: PointerEvent<HTMLDivElement>) {
    if (canvasPinchZoom.handlePointerEnd(event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const panState = panStateRef.current;
    touchPanCandidateRef.current = null;
    if (!panState || panState.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const finalOffset = clampCanvasViewportOffset({
      x: panState.x + event.clientX - panState.startX,
      y: panState.y + event.clientY - panState.startY
    });
    if (panAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(panAnimationFrameRef.current);
      panAnimationFrameRef.current = null;
    }
    pendingPanOffsetRef.current = null;
    setCanvasViewportOffset(finalOffset);
    event.currentTarget.releasePointerCapture(event.pointerId);
    panStateRef.current = null;
    setIsPanningCanvas(false);
  }

  function bufferCanvasZoomAtPoint(point: { clientX: number; clientY: number }, targetScale: number) {
    const canvas = canvasRef.current;
    const scrollArea = scrollAreaRef.current;
    if (!canvas || !scrollArea || targetScale === zoomCurrentScaleRef.current) return;

    if (zoomSettleFrameRef.current !== null) {
      window.cancelAnimationFrame(zoomSettleFrameRef.current);
      zoomSettleFrameRef.current = null;
    }

    const anchor = canvasZoomAnchorFromPoint(point, canvas.getBoundingClientRect());
    scrollArea.scrollLeft = 0;
    scrollArea.scrollTop = 0;
    const scrollNormalization = canvasZoomScrollCorrection(anchor, canvas.getBoundingClientRect());

    if (Math.abs(scrollNormalization.x) > zoomAnchorEpsilon || Math.abs(scrollNormalization.y) > zoomAnchorEpsilon) {
      setCanvasViewportOffset((current) => clampCanvasViewportOffset({
        x: current.x - scrollNormalization.x,
        y: current.y - scrollNormalization.y
      }));
    }

    zoomTargetAnchorRef.current = anchor;
    zoomTargetScaleRef.current = targetScale;
    if (zoomAnimationFrameRef.current === null) {
      zoomAnimationTimeRef.current = null;
      zoomAnimationFrameRef.current = window.requestAnimationFrame(animateBufferedZoom);
    }
  }

  function animateBufferedZoom(timestamp: number) {
    const previousTimestamp = zoomAnimationTimeRef.current;
    const elapsedMs = previousTimestamp === null ? defaultAnimationFrameMs : Math.max(timestamp - previousTimestamp, 0);
    const targetScale = zoomTargetScaleRef.current;
    const nextScale = dampedCanvasZoomScale(zoomCurrentScaleRef.current, targetScale, elapsedMs);
    const anchor = zoomTargetAnchorRef.current;
    zoomAnimationTimeRef.current = timestamp;
    zoomCurrentScaleRef.current = nextScale;

    if (anchor) {
      zoomAnchorRef.current = { anchor, correctionCount: 0 };
    }

    onSetZoomLevel(nextScale);

    if (Math.abs(targetScale - nextScale) <= zoomSettleThreshold) {
      zoomCurrentScaleRef.current = targetScale;
      zoomAnimationFrameRef.current = null;
      zoomAnimationTimeRef.current = null;
      if (anchor) {
        zoomAnchorRef.current = { anchor, correctionCount: 0 };
      }
      onSetZoomLevel(targetScale);
      zoomSettleFrameRef.current = window.requestAnimationFrame(() => settleBufferedZoomAnchor(0));
      return;
    }

    zoomAnimationFrameRef.current = window.requestAnimationFrame(animateBufferedZoom);
  }

  function settleBufferedZoomAnchor(frameCount: number) {
    const anchor = zoomTargetAnchorRef.current;
    const canvas = canvasRef.current;
    const scrollArea = scrollAreaRef.current;

    if (!anchor || !canvas || !scrollArea) {
      finishBufferedZoomSettlement();
      return;
    }

    scrollArea.scrollLeft = 0;
    scrollArea.scrollTop = 0;

    const correction = canvasZoomScrollCorrection(anchor, canvas.getBoundingClientRect());
    const needsCorrection = Math.abs(correction.x) > zoomAnchorEpsilon || Math.abs(correction.y) > zoomAnchorEpsilon;

    if (needsCorrection) {
      setCanvasViewportOffset((current) => clampCanvasViewportOffset({
        x: current.x - correction.x,
        y: current.y - correction.y
      }));
    }

    if (frameCount < minimumZoomSettleFrames || (needsCorrection && frameCount < maximumZoomSettleFrames)) {
      zoomSettleFrameRef.current = window.requestAnimationFrame(() => settleBufferedZoomAnchor(frameCount + 1));
      return;
    }

    finishBufferedZoomSettlement();
  }

  function finishBufferedZoomSettlement() {
    zoomSettleFrameRef.current = null;
    zoomTargetAnchorRef.current = null;
    zoomAnchorRef.current = null;
  }

  function stopBufferedZoomAnimation() {
    if (zoomAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(zoomAnimationFrameRef.current);
    }
    if (zoomSettleFrameRef.current !== null) {
      window.cancelAnimationFrame(zoomSettleFrameRef.current);
    }

    zoomAnimationFrameRef.current = null;
    zoomAnimationTimeRef.current = null;
    zoomSettleFrameRef.current = null;
    zoomTargetAnchorRef.current = null;
    zoomTargetScaleRef.current = zoomCurrentScaleRef.current;
    zoomAnchorRef.current = null;
  }

  function fitCanvasToViewport() {
    stopBufferedZoomAnimation();
    setCanvasViewportOffset({ x: 0, y: 0 });
    onSetZoomLevel("fit");
  }

  const isPanActive = useCallback(() => panStateRef.current !== null, []);

  return {
    endCanvasPan,
    fitCanvasToViewport,
    handleCanvasToolPointerDown,
    isPanActive,
    isPanningCanvas,
    setZoomDirection,
    updateCanvasPan,
    zoomDirection
  };
}

const canvasViewportOffsetLimit = 100000;
const defaultAnimationFrameMs = 1000 / 60;
const directPanActivationDistance = 7;
const maximumZoomAnchorCorrections = 3;
const maximumZoomSettleFrames = 5;
const mobileEdgeGestureWidth = 28;
const minimumZoomSettleFrames = 2;
const zoomAnchorEpsilon = 0.1;
const zoomSettleThreshold = 0.0005;

function isDirectPanSurface(target: HTMLElement | null) {
  return !target?.closest("[data-frame-control], button, input, textarea, select, [contenteditable='true']");
}

function isMobileEdgeGestureStart(clientX: number) {
  return clientX <= mobileEdgeGestureWidth || clientX >= window.innerWidth - mobileEdgeGestureWidth;
}

function clampCanvasViewportOffset(offset: CanvasViewportOffset) {
  return {
    x: Math.max(-canvasViewportOffsetLimit, Math.min(canvasViewportOffsetLimit, offset.x)),
    y: Math.max(-canvasViewportOffsetLimit, Math.min(canvasViewportOffsetLimit, offset.y))
  };
}
