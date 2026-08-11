"use client";

import { useEffect, useState, type PointerEvent } from "react";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import {
  shapeDrawIsVisible,
  shapeDrawResult,
  type CanvasShapeTool,
  type ShapeDrawResult
} from "@/features/pitch/application/shapeDrawing";
import type { CanvasPoint } from "@/features/pitch/application/previewCanvas";

type DrawGesture = {
  fromCenter: boolean;
  pointerId: number;
  preserveAspectRatio: boolean;
  result: ShapeDrawResult;
  start: CanvasPoint;
};

export function ShapeDrawOverlay({
  getCanvasPoint,
  onCancel,
  onComplete,
  tool
}: {
  getCanvasPoint: (event: { clientX: number; clientY: number }) => CanvasPoint;
  onCancel: () => void;
  onComplete: (props: MotionDocProps) => void;
  tool: CanvasShapeTool;
}) {
  const [gesture, setGesture] = useState<DrawGesture | null>(null);
  const shape = String(tool.props.shape ?? "rectangle");

  useEffect(() => {
    function cancelOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [onCancel]);

  function start(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startPoint = getCanvasPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setGesture({
      fromCenter: event.altKey,
      pointerId: event.pointerId,
      preserveAspectRatio: event.shiftKey,
      result: shapeDrawResult(startPoint, startPoint, {
        fromCenter: event.altKey,
        preserveAspectRatio: event.shiftKey,
        shape
      }),
      start: startPoint
    });
  }

  function update(event: PointerEvent<HTMLDivElement>) {
    setGesture((current) => current && current.pointerId === event.pointerId ? {
      ...current,
      fromCenter: event.altKey,
      preserveAspectRatio: event.shiftKey,
      result: shapeDrawResult(current.start, getCanvasPoint(event), {
        fromCenter: event.altKey,
        preserveAspectRatio: event.shiftKey,
        shape
      })
    } : current);
  }

  function finish(event: PointerEvent<HTMLDivElement>) {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const result = shapeDrawResult(gesture.start, getCanvasPoint(event), {
      fromCenter: event.altKey,
      preserveAspectRatio: event.shiftKey,
      shape
    });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setGesture(null);
    if (!shapeDrawIsVisible(result)) return;
    onComplete({ ...tool.props, ...result.frame, ...(result.rotation === undefined ? {} : { rotation: result.rotation }) });
  }

  function cancelGesture(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setGesture(null);
  }

  const preview = gesture && shapeDrawIsVisible(gesture.result) ? gesture.result : null;

  return (
    <div
      aria-label="Draw shape"
      className="absolute inset-0 z-[80] cursor-crosshair touch-none"
      data-shape-draw-overlay
      onPointerCancel={cancelGesture}
      onPointerDown={start}
      onPointerMove={update}
      onPointerUp={finish}
      role="presentation"
    >
      {preview ? <ShapeDraft props={tool.props} result={preview} shape={shape} /> : null}
    </div>
  );
}

function ShapeDraft({ props, result, shape }: { props: MotionDocProps; result: ShapeDrawResult; shape: string }) {
  const fill = String(props.fill ?? "#a8b8ff");
  const stroke = String(props.stroke ?? "#8ea5ff");
  const strokeWidth = Math.max(Number(props.strokeWidth) || 1, 1);
  const frame = result.frame;
  const style = {
    height: `${frame.h}%`,
    left: `${frame.x}%`,
    top: `${frame.y}%`,
    transform: result.rotation === undefined ? undefined : `rotate(${result.rotation}deg)`,
    width: `${frame.w}%`
  };

  return (
    <div className="pointer-events-none absolute origin-center" style={style}>
      <svg className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
        {shape === "line" ? (
          <line stroke={stroke} strokeLinecap="round" strokeWidth={Math.max(strokeWidth, 2)} vectorEffect="non-scaling-stroke" x1="0" x2="100" y1="50" y2="50" />
        ) : shape === "circle" ? (
          <ellipse cx="50" cy="50" fill={fill} rx="49" ry="49" stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
        ) : shape === "triangle" || (shape === "polygon" && Number(props.sides) === 3) ? (
          <path d="M50 1L99 99H1Z" fill={fill} stroke={stroke} strokeLinejoin="round" strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
        ) : (
          <rect fill={fill} height="98" rx={Number(props.radius) || 0} stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" width="98" x="1" y="1" />
        )}
      </svg>
      <span className="absolute inset-0 border border-[#8ea5ff]" />
    </div>
  );
}
