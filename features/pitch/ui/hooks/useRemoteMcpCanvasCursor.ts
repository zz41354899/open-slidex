"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject
} from "react";

import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import {
  latestRemoteMcpCanvasOperation,
  mcpCanvasCursorFallbackPosition,
  mcpCanvasCursorGeneration,
  mcpCanvasCursorPositionFromRects,
  type McpCanvasCursorPosition
} from "@/features/pitch/application/mcpCanvasCursor";
import type { RemoteMcpOperation } from "@/features/pitch/domain/remoteMcpOperation";

export type McpCanvasCursorPhase =
  | "approaching"
  | "pressing"
  | "running"
  | "settled-success"
  | "settled-failure";

export type McpCanvasCursorState = {
  activity: RemoteMcpOperation;
  generation: string;
  phase: McpCanvasCursorPhase;
  position?: McpCanvasCursorPosition;
};

type UseRemoteMcpCanvasCursorInput = {
  activeSlideIndex: number;
  activities: readonly RemoteMcpOperation[];
  actualScale: number;
  canvasViewportOffset: { x: number; y: number };
  scene: MotionDocScene | undefined;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
};

const domRetryWindowMs = 750;

export function useRemoteMcpCanvasCursor({
  activeSlideIndex,
  activities,
  actualScale,
  canvasViewportOffset,
  scene,
  scrollAreaRef
}: UseRemoteMcpCanvasCursorInput) {
  const cursorLayerRef = useRef<HTMLDivElement | null>(null);
  const animationGenerationRef = useRef(0);
  const measurementGenerationRef = useRef(0);
  const activeOperationIdRef = useRef<string | undefined>(undefined);
  const [cursor, setCursor] = useState<McpCanvasCursorState | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const activity = useMemo(
    () => latestRemoteMcpCanvasOperation(activities, activeSlideIndex),
    [activities, activeSlideIndex]
  );
  const generation = activity ? mcpCanvasCursorGeneration(activity) : undefined;

  useEffect(() => {
    const animationGeneration = ++animationGenerationRef.current;
    const timers: number[] = [];
    if (!activity || !generation) {
      activeOperationIdRef.current = undefined;
      setCursor(null);
      return;
    }

    const sameOperation = activeOperationIdRef.current === activity.id;
    activeOperationIdRef.current = activity.id;
    const settledPhase = activity.status === "completed"
      ? "settled-success"
      : "settled-failure";
    const initialPhase: McpCanvasCursorPhase = reducedMotion
      ? activity.status === "running" ? "running" : settledPhase
      : activity.status !== "running" && sameOperation ? settledPhase : "approaching";

    setCursor((current) => ({
      activity,
      generation,
      phase: initialPhase,
      position: current?.activity.id === activity.id ? current.position : undefined
    }));

    if (reducedMotion || (activity.status !== "running" && sameOperation)) {
      return;
    }

    const schedulePhase = (delay: number, phase: McpCanvasCursorPhase) => {
      timers.push(window.setTimeout(() => {
        if (animationGenerationRef.current !== animationGeneration) return;
        setCursor((current) => current?.generation === generation
          ? { ...current, phase }
          : current);
      }, delay));
    };

    schedulePhase(220, "pressing");
    schedulePhase(420, activity.status === "running" ? "running" : settledPhase);

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [activity, generation, reducedMotion]);

  useEffect(() => {
    const measurementGeneration = ++measurementGenerationRef.current;
    if (!activity || !generation) return;
    const measuredActivity = activity;
    const measuredGeneration = generation;

    let animationFrame: number | undefined;
    let observedTarget: HTMLElement | undefined;
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(() => scheduleMeasurement());
    const retryDeadline = performance.now() + domRetryWindowMs;

    function updatePosition(position: McpCanvasCursorPosition) {
      if (measurementGenerationRef.current !== measurementGeneration) return;
      setCursor((current) => {
        if (!current || current.generation !== measuredGeneration) return current;
        if (
          current.position?.source === position.source &&
          current.position.xPercent === position.xPercent &&
          current.position.yPercent === position.yPercent
        ) {
          return current;
        }
        return { ...current, position };
      });
    }

    function observeTarget(target: HTMLElement) {
      if (!resizeObserver || observedTarget === target) return;
      if (observedTarget) resizeObserver.unobserve(observedTarget);
      observedTarget = target;
      resizeObserver.observe(target);
    }

    function measure() {
      animationFrame = undefined;
      if (measurementGenerationRef.current !== measurementGeneration) return;
      const cursorLayer = cursorLayerRef.current;
      if (!cursorLayer) {
        scheduleMeasurement();
        return;
      }

      if (measuredActivity.target.kind === "block") {
        const nodeId = measuredActivity.target.nodeId;
        const selector = `[data-motion-doc-node-id="${CSS.escape(nodeId)}"]`;
        const target = cursorLayer.parentElement?.querySelector<HTMLElement>(selector);
        if (target) {
          observeTarget(target);
          updatePosition(mcpCanvasCursorPositionFromRects(
            target.getBoundingClientRect(),
            cursorLayer.getBoundingClientRect()
          ));
          return;
        }
        if (performance.now() < retryDeadline) {
          scheduleMeasurement();
          return;
        }
      }

      updatePosition(mcpCanvasCursorFallbackPosition(
        measuredActivity,
        scene,
        activeSlideIndex
      ));
    }

    function scheduleMeasurement() {
      if (animationFrame !== undefined) return;
      animationFrame = window.requestAnimationFrame(measure);
    }

    const visualViewport = window.visualViewport;
    const scrollArea = scrollAreaRef.current;
    resizeObserver?.observe(cursorLayerRef.current ?? document.documentElement);
    window.addEventListener("resize", scheduleMeasurement);
    window.addEventListener("scroll", scheduleMeasurement, true);
    scrollArea?.addEventListener("scroll", scheduleMeasurement, { passive: true });
    visualViewport?.addEventListener("resize", scheduleMeasurement);
    visualViewport?.addEventListener("scroll", scheduleMeasurement);
    scheduleMeasurement();

    return () => {
      measurementGenerationRef.current += 1;
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasurement);
      window.removeEventListener("scroll", scheduleMeasurement, true);
      scrollArea?.removeEventListener("scroll", scheduleMeasurement);
      visualViewport?.removeEventListener("resize", scheduleMeasurement);
      visualViewport?.removeEventListener("scroll", scheduleMeasurement);
    };
  }, [
    activeSlideIndex,
    activity,
    actualScale,
    canvasViewportOffset.x,
    canvasViewportOffset.y,
    generation,
    scene,
    scrollAreaRef
  ]);

  return { cursor, cursorLayerRef, reducedMotion };
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}
