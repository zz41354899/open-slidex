"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Maximize2, Minimize2, RotateCcw, X } from "lucide-react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/features/pitch/application/previewCanvas";
import { PresentationThumbnailRail } from "@/features/pitch/ui/PresentationThumbnailRail";
import { PreviewPane } from "@/features/pitch/ui/preview/PreviewPane";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type PresentationPreviewModalProps = {
  activeSlideIndex: number;
  documentTitle: string;
  exportLabel?: string;
  isOpen: boolean;
  onClose: () => void;
  onExport?: () => void;
  scenes: MotionDocScene[];
  source: string;
};

export function PresentationPreviewModal({
  activeSlideIndex,
  documentTitle,
  exportLabel,
  isOpen,
  onClose,
  onExport,
  scenes,
  source
}: PresentationPreviewModalProps) {
  const { tx } = usePitchI18n();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [replayNonce, setReplayNonce] = useState(0);
  const [frameSize, setFrameSize] = useState({ height: 0, width: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const slideCount = scenes.length;

  const goToSlide = useCallback((nextIndex: number) => {
    setSlideIndex(Math.min(Math.max(nextIndex, 0), Math.max(slideCount - 1, 0)));
  }, [slideCount]);

  const goToPreviousSlide = useCallback(() => goToSlide(slideIndex - 1), [goToSlide, slideIndex]);
  const goToNextSlide = useCallback(() => goToSlide(slideIndex + 1), [goToSlide, slideIndex]);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement === previewRef.current) {
      await document.exitFullscreen();
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const preview = previewRef.current;
    if (!preview) return;

    try {
      if (document.fullscreenElement === preview) {
        await exitFullscreen();
      } else {
        await preview.requestFullscreen();
      }
    } catch {
      // Fullscreen may be disabled by the browser or its embedding context.
    }
  }, [exitFullscreen]);

  const closePreview = useCallback(() => {
    void exitFullscreen();
    onClose();
  }, [exitFullscreen, onClose]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    setSlideIndex(Math.min(Math.max(activeSlideIndex, 0), Math.max(slideCount - 1, 0)));
  }, [activeSlideIndex, isOpen, slideCount]);

  useEffect(() => {
    if (!isOpen) return;

    const preview = previewRef.current;
    const syncFullscreenState = () => setIsFullscreen(document.fullscreenElement === preview);

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      if (document.fullscreenElement === preview) void document.exitFullscreen();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateFrameSize = () => {
      const rect = viewport.getBoundingClientRect();
      const width = Math.max(0, Math.min(rect.width, rect.height * (CANVAS_WIDTH / CANVAS_HEIGHT)));
      setFrameSize({
        height: width / (CANVAS_WIDTH / CANVAS_HEIGHT),
        width
      });
    };

    updateFrameSize();
    const observer = new ResizeObserver(updateFrameSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (isFullscreen) {
          void exitFullscreen();
        } else {
          closePreview();
        }
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goToPreviousSlide();
        return;
      }

      if (event.key === "ArrowRight" || event.key === "PageDown" || event.code === "Space") {
        event.preventDefault();
        goToNextSlide();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePreview, exitFullscreen, goToNextSlide, goToPreviousSlide, isFullscreen, isOpen]);

  if (!isOpen) return null;

  const activeScene = scenes[slideIndex];
  const scale = frameSize.width > 0 ? frameSize.width / CANVAS_WIDTH : 1;
  const title = documentTitle || tx("Untitled presentation");

  return (
    <div
      className="fixed inset-0 z-[100] flex bg-[#050505] text-white"
      ref={previewRef}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePreview();
      }}
    >
      <section aria-labelledby="presentation-preview-title" aria-modal="true" className="flex min-h-0 w-full flex-col" role="dialog">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] bg-black/70 px-3 backdrop-blur-md sm:h-16 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{tx("Presentation preview")}</p>
            <h2 className="truncate text-sm font-semibold tracking-[-0.02em] text-white sm:text-[15px]" id="presentation-preview-title">{title}</h2>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              aria-label={tx(isFullscreen ? "Exit full screen" : "Enter full screen")}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
              onClick={() => void toggleFullscreen()}
              title={tx(isFullscreen ? "Exit full screen" : "Enter full screen")}
              type="button"
            >
              {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
            {onExport ? (
              <button
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-3 text-[13px] font-semibold text-black transition hover:bg-neutral-200 active:scale-[0.98] sm:px-3.5"
                onClick={onExport}
                type="button"
              >
                <Download size={15} />
                <span className="hidden sm:inline">{exportLabel ?? tx("Export")}</span>
              </button>
            ) : null}
            <button
              aria-label={tx("Close presentation preview")}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
              onClick={closePreview}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {!isFullscreen ? (
            <PresentationThumbnailRail
              activeSlideIndex={slideIndex}
              onSelectSlide={goToSlide}
              scenes={scenes}
              source={source}
            />
          ) : null}
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center px-3 py-3 sm:px-6 sm:py-5 lg:px-8 lg:py-6" ref={viewportRef}>
            <div
              className="relative shrink-0 overflow-hidden rounded-sm bg-black shadow-[0_28px_100px_rgba(0,0,0,0.74)] ring-1 ring-white/[0.14]"
              style={{
                height: frameSize.height,
                visibility: frameSize.width > 0 ? "visible" : "hidden",
                width: frameSize.width
              }}
            >
              <div
                className="absolute left-0 top-0"
                style={{
                  height: CANVAS_HEIGHT,
                  transform: `scale(${scale})`,
                  transformOrigin: "left top",
                  width: CANVAS_WIDTH
                }}
              >
                <PreviewPane activeSlideIndex={slideIndex} replayNonce={replayNonce} scene={activeScene} source={source} />
              </div>
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between border-t border-white/[0.08] bg-black/70 px-3 py-2.5 backdrop-blur-md sm:px-5 sm:py-3">
          <p className="hidden text-[11px] text-neutral-500 sm:block">{tx("← → to navigate · Esc exits full screen or closes")}</p>
          <div className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end">
            <button
              aria-label={tx("Restart current slide animation")}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              disabled={!activeScene}
              onClick={() => setReplayNonce((value) => value + 1)}
              type="button"
            >
              <RotateCcw size={15} />
            </button>
            <button
              aria-label={tx("Previous slide")}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              disabled={slideIndex <= 0}
              onClick={goToPreviousSlide}
              type="button"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-20 text-center font-mono text-[12px] font-semibold text-neutral-300">
              {Math.min(slideIndex + 1, Math.max(slideCount, 1))} / {Math.max(slideCount, 1)}
            </span>
            <button
              aria-label={tx("Next slide")}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              disabled={slideIndex >= slideCount - 1}
              onClick={goToNextSlide}
              type="button"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
