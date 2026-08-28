
import { startTransition, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Maximize2, Minimize2, RotateCcw, X } from "lucide-react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { interactionFromProps, parseInteraction } from "@/core/motion-doc/domain/interaction";
import { motionDocBlockFrame } from "@/core/motion-doc/domain/frame";
import { blockRotation } from "@/core/motion-doc/domain/blockTransform";
import {
  normalizeSharedMorphEasing,
  sharedMorphCurveFromProps,
  sharedMorphEffectProps,
  type SharedMorphCurve,
  type SharedMorphEasing
} from "@/core/motion-doc/domain/sharedMorph";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/features/pitch/application/previewCanvas";
import { PresentationThumbnailRail } from "@/features/pitch/ui/PresentationThumbnailRail";
import { PreviewPane } from "@/features/pitch/ui/preview/PreviewPane";
import { SharedHtmlSceneLayer } from "@/features/pitch/ui/preview/SharedHtmlSceneLayer";
import { SharedSvgSceneLayer } from "@/features/pitch/ui/preview/SharedSvgSceneLayer";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import {
  captureSharedMorph,
  createMotionPlaybackController,
  playSharedMorph,
  sharedMorphMotionIds,
  type MotionPlaybackController,
  type SharedMorphSnapshot
} from "@/features/pitch/application/motionPlayback";

type PresentationPreviewModalProps = {
  activeSlideIndex: number;
  documentTitle: string;
  isOpen: boolean;
  onClose: () => void;
  scenes: MotionDocScene[];
  startInFullscreen: boolean;
};

export function PresentationPreviewModal({
  activeSlideIndex,
  documentTitle,
  isOpen,
  onClose,
  scenes,
  startInFullscreen
}: PresentationPreviewModalProps) {
  const { tx } = usePitchI18n();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRootRef = useRef<HTMLDivElement | null>(null);
  const playbackRef = useRef<MotionPlaybackController | null>(null);
  const morphCleanupRef = useRef<(() => void) | null>(null);
  const transitionDelayRef = useRef(0);
  const interactionHintTimerRef = useRef<number | null>(null);
  const pendingMorphRef = useRef<{
    options: { curve: SharedMorphCurve; duration: number; easing: SharedMorphEasing; fadeUnmatched: boolean; shapePrecision: number; shapeSoftness: number };
    snapshot: SharedMorphSnapshot;
  } | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [replayNonce, setReplayNonce] = useState(0);
  const [frameSize, setFrameSize] = useState({ height: 0, width: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSlideNavigatorOpen, setIsSlideNavigatorOpen] = useState(true);
  const [showInteractionHints, setShowInteractionHints] = useState(false);
  const slideCount = scenes.length;

  const goToSlide = useCallback((nextIndex: number) => {
    const resolvedIndex = Math.min(Math.max(nextIndex, 0), Math.max(slideCount - 1, 0));
    if (resolvedIndex === slideIndex) return;
    const root = contentRootRef.current;
    const sourceScene = scenes[slideIndex];
    const targetScene = scenes[resolvedIndex];
    const morphSceneIndex = resolvedIndex > slideIndex ? slideIndex : resolvedIndex;
    const morphScene = resolvedIndex > slideIndex ? sourceScene : targetScene;
    const morphProps = sharedMorphEffectProps(scenes, morphSceneIndex);
    // Interactive overview links may jump across a Morph group. Shared IDs, not
    // adjacency, determine which objects participate in the transition.
    if (root && morphScene?.props.slideTransition === "morph") {
      pendingMorphRef.current = {
        options: {
          curve: sharedMorphCurveFromProps(morphProps),
          duration: numericProp(morphProps.transitionDuration, 0.72),
          easing: morphEasingProp(morphProps.morphEasing),
          fadeUnmatched: morphProps.morphFadeUnmatched !== "false" && morphProps.morphFadeUnmatched !== 0,
          shapePrecision: numericProp(morphProps.morphShapePrecision, 48),
          shapeSoftness: numericProp(morphProps.morphShapeSoftness, 0.32)
        },
        snapshot: captureSharedMorph(root)
      };
      transitionDelayRef.current = numericProp(morphProps.transitionDuration, 0.72) * 1000;
    } else {
      pendingMorphRef.current = null;
      const transitionScene = scenes[resolvedIndex];
      transitionDelayRef.current = transitionScene?.props.slideTransition && transitionScene.props.slideTransition !== "none"
        ? numericProp(transitionScene.props.transitionDuration, 0.72) * 1000
        : 0;
    }
    playbackRef.current?.cancel();
    // A target slide can contain images or complex vector layers. Let the
    // pointer interaction finish before React mounts that non-urgent tree.
    startTransition(() => setSlideIndex(resolvedIndex));
  }, [scenes, slideCount, slideIndex]);

  const goToPreviousSlide = useCallback(() => goToSlide(slideIndex - 1), [goToSlide, slideIndex]);
  const goToNextSlide = useCallback(() => {
    if (playbackRef.current?.consume()) return;
    goToSlide(slideIndex + 1);
  }, [goToSlide, slideIndex]);

  const handleViewportClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as Element).closest<HTMLElement>("[data-slidex-interaction]");
    const interaction = parseInteraction(target?.dataset.slidexInteraction).interaction;
    if (!interaction) {
      if (scenes[slideIndex]?.blocks.some((block) => interactionFromProps(block.props))) {
        if (interactionHintTimerRef.current !== null) window.clearTimeout(interactionHintTimerRef.current);
        setShowInteractionHints(true);
        interactionHintTimerRef.current = window.setTimeout(() => setShowInteractionHints(false), 900);
        return;
      }
      playbackRef.current?.consume();
      return;
    }
    event.stopPropagation();
    if (interaction.action.type === "nextSlide") goToSlide(slideIndex + 1);
    if (interaction.action.type === "previousSlide") goToSlide(slideIndex - 1);
    if (interaction.action.type === "goToSlide") goToSlide(interaction.action.slide - 1);
    if (interaction.action.type === "openUrl") {
      if (interaction.action.url.startsWith("#")) window.location.hash = interaction.action.url;
      else window.open(interaction.action.url, "_blank", "noopener,noreferrer");
    }
  }, [goToSlide, scenes, slideIndex]);

  useEffect(() => {
    setShowInteractionHints(false);
    return () => {
      if (interactionHintTimerRef.current !== null) window.clearTimeout(interactionHintTimerRef.current);
    };
  }, [slideIndex]);

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

  useLayoutEffect(() => {
    if (!isOpen) return;
    const root = contentRootRef.current;
    if (!root) return;
    playbackRef.current?.cancel();
    morphCleanupRef.current?.();
    const pendingMorph = pendingMorphRef.current;
    pendingMorphRef.current = null;
    playbackRef.current = createMotionPlaybackController(root, {
      autoStartDelayMs: transitionDelayRef.current,
      deferMotionIds: pendingMorph
        ? sharedMorphMotionIds(root, pendingMorph.snapshot)
        : undefined
    });
    transitionDelayRef.current = 0;
    if (pendingMorph) {
      morphCleanupRef.current = playSharedMorph(root, pendingMorph.snapshot, pendingMorph.options);
    }
    return () => {
      playbackRef.current?.cancel();
      morphCleanupRef.current?.();
    };
  }, [isOpen, replayNonce, slideIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const preview = previewRef.current;
    const syncFullscreenState = () => {
      const nextIsFullscreen = document.fullscreenElement === preview;
      setIsFullscreen(nextIsFullscreen);
      if (nextIsFullscreen) setIsSlideNavigatorOpen(true);
    };

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      if (document.fullscreenElement === preview) void document.exitFullscreen();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !startInFullscreen) return;
    const preview = previewRef.current;
    if (!preview || document.fullscreenElement === preview) return;

    const frame = window.requestAnimationFrame(() => {
      void preview.requestFullscreen().catch(() => undefined);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, startInFullscreen]);

  useLayoutEffect(() => {
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
  }, [isFullscreen, isOpen, isSlideNavigatorOpen]);

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
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        goToSlide(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        goToSlide(slideCount - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePreview, exitFullscreen, goToNextSlide, goToPreviousSlide, goToSlide, isFullscreen, isOpen, slideCount]);

  if (!isOpen) return null;

  const activeScene = scenes[slideIndex];
  const scale = frameSize.width > 0 ? frameSize.width / CANVAS_WIDTH : 1;
  const title = documentTitle || tx("Untitled presentation");

  return (
    <div
      className="fixed inset-0 z-[100] flex bg-black text-white"
      ref={previewRef}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePreview();
      }}
    >
      <section aria-labelledby="presentation-preview-title" aria-modal="true" className="flex min-h-0 w-full flex-col" role="dialog">
        <header className={`flex shrink-0 items-center justify-between gap-3 px-3 sm:px-5 ${isFullscreen ? "h-12 border-b border-white/[0.06] bg-[#111113]/72 backdrop-blur-2xl" : "h-14 border-b border-white/[0.08] bg-black/70 backdrop-blur-md sm:h-16"}`}>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{tx("Presentation preview")}</p>
            <h2 className="truncate text-sm font-semibold tracking-[-0.02em] text-white sm:text-[15px]" id="presentation-preview-title">{title}</h2>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              aria-label={tx(isFullscreen ? "Exit full screen" : "Enter full screen")}
              className={`flex h-9 w-9 items-center justify-center text-neutral-400 transition hover:text-white active:scale-[0.96] ${isFullscreen ? "rounded-full hover:bg-white/[0.12]" : "rounded-lg hover:bg-white/[0.08]"}`}
              onClick={() => void toggleFullscreen()}
              title={tx(isFullscreen ? "Exit full screen" : "Enter full screen")}
              type="button"
            >
              {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
            <button
              aria-label={tx("Close presentation preview")}
              className={`flex h-9 w-9 items-center justify-center text-neutral-400 transition hover:text-white active:scale-[0.96] ${isFullscreen ? "rounded-full hover:bg-white/[0.12]" : "rounded-lg hover:bg-white/[0.08]"}`}
              onClick={closePreview}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className={`flex min-h-0 flex-1 ${isFullscreen ? "flex-col" : "flex-row"}`}>
          {!isFullscreen ? (
            <PresentationThumbnailRail
              activeSlideIndex={slideIndex}
              onSelectSlide={goToSlide}
              scenes={scenes}
            />
          ) : null}
          <div className={`flex min-h-0 min-w-0 flex-1 ${isFullscreen ? "flex-col" : "flex-row"}`}>
            <div className={`flex min-h-0 min-w-0 flex-1 items-center justify-center ${isFullscreen ? "px-3 py-3 sm:px-6 sm:py-4" : "px-3 py-3 sm:px-6 sm:py-5 lg:px-8 lg:py-6"}`} ref={viewportRef}>
              <div
                className={`relative shrink-0 overflow-hidden bg-black ${isFullscreen ? "rounded-[10px] shadow-[0_30px_90px_rgba(0,0,0,0.58)] ring-1 ring-white/[0.08]" : "rounded-sm shadow-[0_28px_100px_rgba(0,0,0,0.74)] ring-1 ring-white/[0.14]"}`}
                onClick={handleViewportClick}
                style={{
                  height: frameSize.height,
                  visibility: frameSize.width > 0 ? "visible" : "hidden",
                  width: frameSize.width
                }}
              >
                <div
                  className="absolute left-0 top-0"
                  ref={contentRootRef}
                  style={{
                    height: CANVAS_HEIGHT,
                    transform: `scale(${scale})`,
                    transformOrigin: "left top",
                    width: CANVAS_WIDTH
                  }}
                >
                  <PreviewPane activeSlideIndex={slideIndex} hideHtmlSourceTextBlocks hideSharedHtmlBlocks hideSharedSvgBlocks replayNonce={replayNonce} scene={activeScene} />
                  <SharedHtmlSceneLayer activeSlideIndex={slideIndex} onRequestSlide={goToSlide} replayNonce={replayNonce} scenes={scenes} />
                  <SharedSvgSceneLayer activeSlideIndex={slideIndex} replayNonce={replayNonce} scenes={scenes} />
                  {showInteractionHints && activeScene ? <InteractionAreaHints scene={activeScene} tx={tx} /> : null}
                </div>
              </div>
            </div>
            {isFullscreen && isSlideNavigatorOpen ? (
              <PresentationThumbnailRail
                activeSlideIndex={slideIndex}
                id="presentation-slide-navigator"
                mode="filmstrip"
                onSelectSlide={goToSlide}
                scenes={scenes}
              />
            ) : null}
          </div>
        </div>

        <footer className={`flex shrink-0 items-center justify-between px-3 sm:px-5 ${isFullscreen ? "relative h-14 border-t border-transparent bg-transparent py-2" : "border-t border-white/[0.08] bg-black/70 py-2.5 backdrop-blur-md sm:py-3"}`}>
          <p className={`hidden text-[11px] sm:block ${isFullscreen ? "absolute left-5 rounded-full border border-white/[0.08] bg-[#1c1c1e]/75 px-3 py-1.5 text-neutral-400 shadow-[0_6px_20px_rgba(0,0,0,0.28)] backdrop-blur-xl" : "text-neutral-500"}`}>{tx("← → to navigate · Esc exits full screen or closes")}</p>
          <div className={`flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end ${isFullscreen ? "animate-in fade-in zoom-in-95 absolute right-3 w-auto rounded-[18px] border border-white/[0.1] bg-[#1c1c1e]/78 p-1 shadow-[0_8px_28px_rgba(0,0,0,0.32)] backdrop-blur-2xl duration-300 sm:right-5" : ""}`}>
            {isFullscreen ? (
              <button
                aria-controls="presentation-slide-navigator"
                aria-expanded={isSlideNavigatorOpen}
                aria-label={tx(isSlideNavigatorOpen ? "Hide slide navigator" : "Show slide navigator")}
                className="flex h-9 w-9 items-center justify-center rounded-[14px] text-neutral-400 transition hover:bg-white/[0.12] hover:text-white active:scale-[0.96]"
                onClick={() => setIsSlideNavigatorOpen((isOpen) => !isOpen)}
                title={tx(isSlideNavigatorOpen ? "Hide slide navigator" : "Show slide navigator")}
                type="button"
              >
                {isSlideNavigatorOpen ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
              </button>
            ) : null}
            <button
              aria-label={tx("Restart current slide actions")}
              className={`flex h-9 w-9 items-center justify-center text-neutral-400 transition hover:bg-white/[0.08] hover:text-white active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-35 ${isFullscreen ? "rounded-[14px] hover:bg-white/[0.12]" : "rounded-lg"}`}
              disabled={!activeScene}
              onClick={() => setReplayNonce((value) => value + 1)}
              title={tx("Restart current slide actions")}
              type="button"
            >
              <RotateCcw size={15} />
            </button>
            <button
              aria-label={tx("Previous slide")}
              className={`flex h-9 w-9 items-center justify-center text-neutral-300 transition hover:bg-white/[0.08] hover:text-white active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-35 ${isFullscreen ? "rounded-[14px] hover:bg-white/[0.12]" : "rounded-lg"}`}
              disabled={slideIndex <= 0}
              onClick={goToPreviousSlide}
              title={tx("Previous slide")}
              type="button"
            >
              <ChevronLeft size={18} />
            </button>
            <span aria-label={localePageStatus(tx, slideIndex, slideCount)} className={`min-w-20 text-center text-[12px] font-semibold tabular-nums text-neutral-300 ${isFullscreen ? "rounded-full border border-white/[0.1] bg-white/[0.08] px-3.5 py-1.5 shadow-inner shadow-white/[0.05]" : "font-mono"}`}>
              {Math.min(slideIndex + 1, Math.max(slideCount, 1))} / {Math.max(slideCount, 1)}
            </span>
            <button
              aria-label={tx("Next slide")}
              className={`flex h-9 w-9 items-center justify-center text-neutral-300 transition hover:bg-white/[0.08] hover:text-white active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-35 ${isFullscreen ? "rounded-[14px] hover:bg-white/[0.12]" : "rounded-lg"}`}
              disabled={slideIndex >= slideCount - 1}
              onClick={goToNextSlide}
              title={tx("Next slide")}
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

function InteractionAreaHints({ scene, tx }: { scene: MotionDocScene; tx: (key: string) => string }) {
  return (
    <div aria-label={tx("Available click areas")} className="pointer-events-none absolute inset-0 z-[90]">
      {scene.blocks.map((block, index) => {
        if (!interactionFromProps(block.props)) return null;
        const frame = motionDocBlockFrame(block);
        return (
          <div
            className="absolute rounded-[12px] border-[3px] border-violet-300 bg-violet-500/20 shadow-[0_0_0_7px_rgba(139,92,246,.13),0_0_36px_rgba(139,92,246,.5)] motion-safe:animate-pulse"
            key={String(block.props.id ?? index)}
            style={{
              height: `${frame.h}%`,
              left: `${frame.x}%`,
              top: `${frame.y}%`,
              transform: `rotate(${blockRotation(block.props)}deg)`,
              width: `${frame.w}%`
            }}
          />
        );
      })}
    </div>
  );
}

function localePageStatus(tx: (key: string) => string, slideIndex: number, slideCount: number) {
  return `${tx("Slides")}: ${Math.min(slideIndex + 1, Math.max(slideCount, 1))} / ${Math.max(slideCount, 1)}`;
}

function numericProp(value: string | number | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function morphEasingProp(value: string | number | undefined) {
  return normalizeSharedMorphEasing(value);
}
