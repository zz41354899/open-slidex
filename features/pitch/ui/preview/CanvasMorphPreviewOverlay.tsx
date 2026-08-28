import { useLayoutEffect, useRef, useState } from "react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { normalizeSharedMorphEasing, sharedMorphCurveFromProps, sharedMorphEffectProps } from "@/core/motion-doc/domain/sharedMorph";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/features/pitch/application/previewCanvas";
import { captureSharedMorph, playSharedMorph } from "@/features/pitch/application/motionPlayback";
import { PreviewPane } from "@/features/pitch/ui/preview/PreviewPane";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

export function CanvasMorphPreviewOverlay({
  actualScale,
  endSlideIndex,
  onFinish,
  scenes,
  sourceRoot,
  startSlideIndex
}: {
  actualScale: number;
  endSlideIndex: number;
  onFinish: () => void;
  scenes: MotionDocScene[];
  sourceRoot: HTMLElement;
  startSlideIndex: number;
}) {
  const { tx } = usePitchI18n();
  const destinationRef = useRef<HTMLDivElement | null>(null);
  const sourceSnapshotRef = useRef<ReturnType<typeof captureSharedMorph> | null>(null);
  const [targetSlideIndex, setTargetSlideIndex] = useState(startSlideIndex + 1);
  const sourceSlide = scenes[targetSlideIndex - 1];
  const targetSlide = scenes[targetSlideIndex];
  const stepCount = endSlideIndex - startSlideIndex;
  const stepNumber = targetSlideIndex - startSlideIndex;

  useLayoutEffect(() => {
    const destination = destinationRef.current;
    if (!destination || !sourceSlide || !targetSlide) return;
    const effectProps = sharedMorphEffectProps(scenes, targetSlideIndex - 1);
    const duration = numericProp(effectProps.transitionDuration, 0.72);
    const snapshot = sourceSnapshotRef.current ?? captureSharedMorph(sourceRoot);
    sourceSnapshotRef.current = null;
    destination.style.opacity = "1";
    const cleanup = playSharedMorph(destination, snapshot, {
      curve: sharedMorphCurveFromProps(effectProps),
      duration,
      easing: normalizeSharedMorphEasing(effectProps.morphEasing),
      fadeUnmatched: effectProps.morphFadeUnmatched !== "false" && effectProps.morphFadeUnmatched !== 0,
      shapePrecision: numericProp(effectProps.morphShapePrecision, 48),
      shapeSoftness: numericProp(effectProps.morphShapeSoftness, 0.32)
    });
    const finishTimer = window.setTimeout(() => {
      if (targetSlideIndex < endSlideIndex) {
        sourceSnapshotRef.current = captureSharedMorph(destination);
        setTargetSlideIndex((current) => current + 1);
      } else {
        onFinish();
      }
    }, duration * 1000 + 180);
    return () => {
      window.clearTimeout(finishTimer);
      cleanup();
    };
  }, [endSlideIndex, onFinish, sourceRoot, sourceSlide, targetSlide, targetSlideIndex]);

  return (
    <div aria-label={tx("Morph canvas preview")} className="pointer-events-none absolute inset-0 z-[80] overflow-hidden bg-black shadow-[0_0_0_2px_rgba(167,139,250,.45)]">
      <div className="absolute left-0 top-0 opacity-0" key={targetSlideIndex} ref={destinationRef} style={{ height: CANVAS_HEIGHT, transform: `scale(${actualScale})`, transformOrigin: "left top", width: CANVAS_WIDTH }}>
        <PreviewPane activeSlideIndex={targetSlideIndex} hideHtmlSourceTextBlocks hideSharedHtmlBlocks hideSharedSvgBlocks replayNonce={0} scene={targetSlide} />
      </div>
      <span className="absolute left-3 top-3 rounded-[9px] border border-violet-300/25 bg-[#17121f]/88 px-2.5 py-1.5 text-[10px] font-semibold text-violet-100 shadow-lg backdrop-blur">{tx("Effect preview")} · {stepNumber}/{stepCount}</span>
    </div>
  );
}

function numericProp(value: string | number | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
