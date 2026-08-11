"use client";

import { useEffect, useRef } from "react";

const dotSpacing = 20;
const baseDotRadius = 1.05;
const interactionRadius = 92;
const maximumDotOffset = 5;

type DotFieldPointerState = {
  influence: number;
  targetInfluence: number;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
};

type InteractiveDotFieldProps = {
  className?: string;
  interactive?: boolean;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function InteractiveDotField({ className = "opacity-85", interactive = true }: InteractiveDotFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const interactiveRef = useRef(interactive);
  const requestDrawRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    interactiveRef.current = interactive;
    if (interactive) requestDrawRef.current();
  }, [interactive]);

  useEffect(() => {
    if (canvasRef.current === null) return;
    const canvas: HTMLCanvasElement = canvasRef.current;

    const canvasContext = canvas.getContext("2d");
    if (canvasContext === null) return;
    const context: CanvasRenderingContext2D = canvasContext;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer: DotFieldPointerState = {
      influence: 0,
      targetInfluence: 0,
      targetX: 0,
      targetY: 0,
      x: 0,
      y: 0
    };
    let animationFrame: number | null = null;
    let canvasBounds: DOMRect | null = null;
    let isTemporarilyPaused = false;
    let height = 0;
    let width = 0;

    function draw() {
      context.clearRect(0, 0, width, height);

      let row = 0;
      for (let y = dotSpacing / 2; y < height; y += dotSpacing) {
        let column = 0;
        for (let x = dotSpacing / 2; x < width; x += dotSpacing) {
          const distanceX = x - pointer.x;
          const distanceY = y - pointer.y;
          const distance = Math.hypot(distanceX, distanceY);
          const proximity = pointer.influence * Math.pow(
            clamp(1 - distance / interactionRadius, 0, 1),
            2
          );
          const directionX = distance > 0 ? distanceX / distance : 0;
          const directionY = distance > 0 ? distanceY / distance : 0;
          const offset = proximity * maximumDotOffset;
          const radiusVariation = ((column * 7 + row * 11) % 5) * 0.025;
          const radius = baseDotRadius + radiusVariation + proximity * 0.8;
          const opacity = 0.24 + proximity * 0.34;

          context.beginPath();
          context.arc(
            x + directionX * offset,
            y + directionY * offset,
            radius,
            0,
            Math.PI * 2
          );
          context.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          context.fill();
          column += 1;
        }
        row += 1;
      }
    }

    function animate() {
      if (!interactiveRef.current || isTemporarilyPaused) {
        animationFrame = null;
        return;
      }

      pointer.x += (pointer.targetX - pointer.x) * 0.16;
      pointer.y += (pointer.targetY - pointer.y) * 0.16;
      pointer.influence += (pointer.targetInfluence - pointer.influence) * 0.14;
      draw();

      const isSettled = (
        Math.abs(pointer.targetX - pointer.x) < 0.1 &&
        Math.abs(pointer.targetY - pointer.y) < 0.1 &&
        Math.abs(pointer.targetInfluence - pointer.influence) < 0.005
      );
      if (isSettled) {
        pointer.x = pointer.targetX;
        pointer.y = pointer.targetY;
        pointer.influence = pointer.targetInfluence;
        draw();
        animationFrame = null;
        return;
      }

      animationFrame = window.requestAnimationFrame(animate);
    }

    function requestDraw() {
      if (!interactiveRef.current || isTemporarilyPaused) return;
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(animate);
      }
    }
    requestDrawRef.current = requestDraw;

    function resizeCanvas() {
      const bounds = canvas.getBoundingClientRect();
      canvasBounds = bounds;
      width = bounds.width;
      height = bounds.height;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      pointer.x = pointer.targetX = width * 0.68;
      pointer.y = pointer.targetY = height * 0.58;
      draw();
    }

    function handlePointerMove(event: PointerEvent) {
      if (!interactiveRef.current) return;
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;

      const bounds = canvasBounds;
      if (!bounds) return;
      const isInside = (
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom
      );
      pointer.targetInfluence = isInside && !reducedMotionQuery.matches ? 1 : 0;
      if (isInside) {
        pointer.targetX = event.clientX - bounds.left;
        pointer.targetY = event.clientY - bounds.top;
      }
      requestDraw();
    }

    function handleReducedMotionChange() {
      pointer.targetInfluence = 0;
      requestDraw();
    }

    function handleGestureStart(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("[data-dot-field-pause]")) return;
      isTemporarilyPaused = true;
    }

    function handleGestureEnd() {
      if (!isTemporarilyPaused) return;
      isTemporarilyPaused = false;
      requestDraw();
    }

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handleGestureStart, { capture: true, passive: true });
    window.addEventListener("pointerup", handleGestureEnd, { capture: true, passive: true });
    window.addEventListener("pointercancel", handleGestureEnd, { capture: true, passive: true });
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
    resizeCanvas();

    return () => {
      requestDrawRef.current = () => undefined;
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handleGestureStart, true);
      window.removeEventListener("pointerup", handleGestureEnd, true);
      window.removeEventListener("pointercancel", handleGestureEnd, true);
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      ref={canvasRef}
    />
  );
}
