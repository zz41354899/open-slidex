import { useLayoutEffect, useRef, type RefObject } from "react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/features/pitch/application/previewCanvas";
import { SharedHtmlSceneLayer } from "@/features/pitch/ui/preview/SharedHtmlSceneLayer";

export function SharedHtmlCanvasOverlay({
  activeSlideIndex,
  actualScale,
  canvasRef,
  hostRef,
  interactive,
  onRequestSlide,
  scenes,
  suspended
}: {
  activeSlideIndex: number;
  actualScale: number;
  canvasRef: RefObject<HTMLDivElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
  interactive: boolean;
  onRequestSlide: (slideIndex: number) => void;
  scenes: MotionDocScene[];
  suspended: boolean;
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (suspended) return;
    let animationFrame: number | null = null;
    let framesRemaining = 0;
    let missingTargetFrames = 0;
    let disposed = false;
    let observedCanvas: HTMLDivElement | null = null;
    let observedHost: HTMLDivElement | null = null;
    let observer: ResizeObserver | null = null;
    let scrollContainer: HTMLElement | null = null;

    const scheduleSync = (frames = 2) => {
      framesRemaining = Math.max(framesRemaining, frames);
      if (animationFrame === null) animationFrame = window.requestAnimationFrame(runScheduledSync);
    };

    const observeCurrentTargets = () => {
      const canvas = canvasRef.current;
      const host = hostRef.current;
      const overlay = overlayRef.current;
      if (!canvas || !host || !overlay) return null;
      if (canvas === observedCanvas && host === observedHost) return { canvas, overlay };

      observer?.disconnect();
      scrollContainer?.removeEventListener("scroll", handleScroll);
      observedCanvas = canvas;
      observedHost = host;
      observer = new ResizeObserver(() => scheduleSync(18));
      observer.observe(canvas);
      observer.observe(host);
      if (host.parentElement) observer.observe(host.parentElement);
      scrollContainer = host.parentElement;
      scrollContainer?.addEventListener("scroll", handleScroll, { passive: true });
      return { canvas, overlay };
    };

    const syncPosition = () => {
      const targets = observeCurrentTargets();
      if (!targets) return false;
      const canvasRect = targets.canvas.getBoundingClientRect();
      const overlayRect = targets.overlay.getBoundingClientRect();
      const left = finiteCssPixels(targets.overlay.style.left);
      const top = finiteCssPixels(targets.overlay.style.top);
      const horizontalError = canvasRect.left - overlayRect.left;
      const verticalError = canvasRect.top - overlayRect.top;

      if (Math.abs(horizontalError) >= 0.25) targets.overlay.style.left = `${left + horizontalError}px`;
      if (Math.abs(verticalError) >= 0.25) targets.overlay.style.top = `${top + verticalError}px`;
      targets.overlay.style.visibility = "visible";
      targets.overlay.dataset.htmlCanvasAligned = Math.abs(horizontalError) < 0.75 && Math.abs(verticalError) < 0.75
        ? "true"
        : "settling";
      return true;
    };

    function runScheduledSync() {
      animationFrame = null;
      if (disposed) return;
      const positioned = syncPosition();
      framesRemaining -= 1;
      if (positioned) {
        missingTargetFrames = 0;
      } else {
        missingTargetFrames += 1;
        if (missingTargetFrames < 60) framesRemaining = Math.max(framesRemaining, 1);
      }
      if (framesRemaining > 0) animationFrame = window.requestAnimationFrame(runScheduledSync);
    }
    function handleScroll() {
      scheduleSync(2);
    }
    const trackPanelTransition = (event: TransitionEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-html-source-workspace]")) return;
      scheduleSync(event.type === "transitionend" ? 4 : 18);
    };

    scheduleSync(30);
    window.addEventListener("resize", handleScroll);
    document.addEventListener("transitionrun", trackPanelTransition, true);
    document.addEventListener("transitionend", trackPanelTransition, true);
    document.addEventListener("transitioncancel", trackPanelTransition, true);
    return () => {
      disposed = true;
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      scrollContainer?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      document.removeEventListener("transitionrun", trackPanelTransition, true);
      document.removeEventListener("transitionend", trackPanelTransition, true);
      document.removeEventListener("transitioncancel", trackPanelTransition, true);
    };
  }, [activeSlideIndex, actualScale, canvasRef, hostRef, suspended]);

  if (suspended) return null;

  return (
    <div
      className="pointer-events-none invisible absolute left-0 top-0 z-40 overflow-hidden bg-black"
      data-html-canvas-interactive={interactive ? "true" : "false"}
      data-shared-html-canvas-runtime
      ref={overlayRef}
      style={{
        height: CANVAS_HEIGHT * actualScale,
        width: CANVAS_WIDTH * actualScale
      }}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          height: CANVAS_HEIGHT,
          transform: `scale(${actualScale})`,
          transformOrigin: "left top",
          width: CANVAS_WIDTH
        }}
      >
        <SharedHtmlSceneLayer
          activeSlideIndex={activeSlideIndex}
          interactive={interactive}
          onRequestSlide={onRequestSlide}
          replayNonce={0}
          scenes={scenes}
        />
      </div>
    </div>
  );
}

function finiteCssPixels(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
