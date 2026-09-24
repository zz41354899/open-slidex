import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
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
import {
  captureSharedMorph,
  createMotionPlaybackController,
  playSharedMorph,
  sharedMorphMotionIds,
  type MotionPlaybackController,
  type SharedMorphSnapshot
} from "@/features/pitch/application/motionPlayback";
import { usePitchI18n } from "./pitchI18n";
import { PreviewPane } from "./preview/PreviewPane";
import { SharedHtmlSceneLayer } from "./preview/SharedHtmlSceneLayer";
import { SharedSvgSceneLayer } from "./preview/SharedSvgSceneLayer";

/**
 * Presenter and audience views share the native presentation playback engine.
 * Timer and notes updates stay outside this memoized tree.
 */
export const PresenterSlideStage = memo(function PresenterSlideStage({ scenes, index, onRequestSlide }: {
  scenes: MotionDocScene[]; index: number; onRequestSlide: (index: number) => void;
}) {
  const { tx } = usePitchI18n();
  const viewport = useRef<HTMLDivElement>(null);
  const contentRoot = useRef<HTMLDivElement>(null);
  const playback = useRef<MotionPlaybackController | null>(null);
  const morphCleanup = useRef<(() => void) | null>(null);
  const transitionDelay = useRef(0);
  const hintTimer = useRef<number | null>(null);
  const pendingMorph = useRef<{
    options: { curve: SharedMorphCurve; duration: number; easing: SharedMorphEasing; fadeUnmatched: boolean; shapePrecision: number; shapeSoftness: number };
    snapshot: SharedMorphSnapshot;
  } | null>(null);
  const boundedIndex = clampIndex(index, scenes.length);
  const [renderedIndex, setRenderedIndex] = useState(boundedIndex);
  const [showInteractionHints, setShowInteractionHints] = useState(false);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => setWidth(Math.max(0, Math.min(element.clientWidth, element.clientHeight * CANVAS_WIDTH / CANVAS_HEIGHT)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Capture the currently painted slide before committing its replacement.
  // This also supports remote jumps across a Morph group.
  useLayoutEffect(() => {
    if (boundedIndex === renderedIndex) return;
    const root = contentRoot.current;
    const sourceScene = scenes[renderedIndex];
    const targetScene = scenes[boundedIndex];
    const morphSceneIndex = boundedIndex > renderedIndex ? renderedIndex : boundedIndex;
    const morphScene = boundedIndex > renderedIndex ? sourceScene : targetScene;
    const morphProps = sharedMorphEffectProps(scenes, morphSceneIndex);
    if (root && morphScene?.props.slideTransition === "morph") {
      pendingMorph.current = {
        options: {
          curve: sharedMorphCurveFromProps(morphProps),
          duration: numericProp(morphProps.transitionDuration, 0.72),
          easing: normalizeSharedMorphEasing(morphProps.morphEasing),
          fadeUnmatched: morphProps.morphFadeUnmatched !== "false" && morphProps.morphFadeUnmatched !== 0,
          shapePrecision: numericProp(morphProps.morphShapePrecision, 48),
          shapeSoftness: numericProp(morphProps.morphShapeSoftness, 0.32)
        },
        snapshot: captureSharedMorph(root)
      };
      transitionDelay.current = numericProp(morphProps.transitionDuration, 0.72) * 1000;
    } else {
      pendingMorph.current = null;
      transitionDelay.current = targetScene?.props.slideTransition && targetScene.props.slideTransition !== "none"
        ? numericProp(targetScene.props.transitionDuration, 0.72) * 1000
        : 0;
    }
    playback.current?.cancel();
    setRenderedIndex(boundedIndex);
  }, [boundedIndex, renderedIndex, scenes]);

  useLayoutEffect(() => {
    const root = contentRoot.current;
    if (!root) return;
    playback.current?.cancel();
    morphCleanup.current?.();
    const morph = pendingMorph.current;
    pendingMorph.current = null;
    playback.current = createMotionPlaybackController(root, {
      autoStartDelayMs: transitionDelay.current,
      deferMotionIds: morph ? sharedMorphMotionIds(root, morph.snapshot) : undefined
    });
    transitionDelay.current = 0;
    if (morph) morphCleanup.current = playSharedMorph(root, morph.snapshot, morph.options);
    return () => {
      playback.current?.cancel();
      morphCleanup.current?.();
    };
  }, [renderedIndex]);

  useEffect(() => {
    setShowInteractionHints(false);
    return () => {
      if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
    };
  }, [renderedIndex]);

  const handleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = (event.target as Element).closest<HTMLElement>("[data-slidex-interaction]");
    const interaction = parseInteraction(target?.dataset.slidexInteraction).interaction;
    if (!interaction) {
      if (scenes[renderedIndex]?.blocks.some((block) => interactionFromProps(block.props))) {
        if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
        setShowInteractionHints(true);
        hintTimer.current = window.setTimeout(() => setShowInteractionHints(false), 900);
      } else {
        playback.current?.consume();
      }
      return;
    }
    event.stopPropagation();
    if (interaction.action.type === "nextSlide") onRequestSlide(renderedIndex + 1);
    if (interaction.action.type === "previousSlide") onRequestSlide(renderedIndex - 1);
    if (interaction.action.type === "goToSlide") onRequestSlide(interaction.action.slide - 1);
    if (interaction.action.type === "openUrl") {
      if (interaction.action.url.startsWith("#")) window.location.hash = interaction.action.url;
      else window.open(interaction.action.url, "_blank", "noopener,noreferrer");
    }
  }, [onRequestSlide, renderedIndex, scenes]);

  const scene = scenes[renderedIndex];
  return <div className="flex h-full min-h-0 w-full items-center justify-center" data-presenter-playback-stage ref={viewport}>
    <div className="relative shrink-0 overflow-hidden rounded-lg bg-black" onClick={handleClick} style={{ width, height: width * CANVAS_HEIGHT / CANVAS_WIDTH }}>
      <div className="absolute left-0 top-0" data-presenter-rendered-slide={renderedIndex} ref={contentRoot} style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${width / CANVAS_WIDTH})`, transformOrigin: "left top" }}>
        <PreviewPane activeSlideIndex={renderedIndex} hideHtmlSourceTextBlocks hideSharedHtmlBlocks hideSharedSvgBlocks replayNonce={0} scene={scene} />
        <SharedHtmlSceneLayer activeSlideIndex={renderedIndex} onRequestSlide={onRequestSlide} replayNonce={0} scenes={scenes} />
        <SharedSvgSceneLayer activeSlideIndex={renderedIndex} replayNonce={0} scenes={scenes} />
        {showInteractionHints && scene ? <InteractionAreaHints scene={scene} label={tx("Available click areas")} /> : null}
      </div>
    </div>
  </div>;
});

function InteractionAreaHints({ scene, label }: { scene: MotionDocScene; label: string }) {
  return <div aria-label={label} className="pointer-events-none absolute inset-0 z-[90]">
    {scene.blocks.map((block, index) => {
      if (!interactionFromProps(block.props)) return null;
      const frame = motionDocBlockFrame(block);
      return <div className="absolute rounded-[12px] border-[3px] border-violet-300 bg-violet-500/20 shadow-[0_0_0_7px_rgba(139,92,246,.13),0_0_36px_rgba(139,92,246,.5)] motion-safe:animate-pulse" key={String(block.props.id ?? index)} style={{ height: `${frame.h}%`, left: `${frame.x}%`, top: `${frame.y}%`, transform: `rotate(${blockRotation(block.props)}deg)`, width: `${frame.w}%` }} />;
    })}
  </div>;
}

function clampIndex(index: number, length: number) {
  return Math.max(0, Math.min(index, Math.max(0, length - 1)));
}

function numericProp(value: string | number | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
