import { Image as ImageIcon, Play, RotateCcw, Square, Type } from "lucide-react";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import type { MotionDocBlockWithProps } from "@/core/motion-doc/domain/motionDocTypes";
import {
  formatMotionNumber,
  interpolateMotionNumber,
  interpolateMotionState,
  type MotionAction,
  type MotionTweenAction
} from "@/core/motion-doc/domain/motionSequence";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type MotionPreviewStageProps = {
  action: MotionAction | null;
  block: MotionDocBlockWithProps;
  onPreviewCanvas: () => void;
  stageLabel: string;
};

export function MotionPreviewStage({ action, block, onPreviewCanvas, stageLabel }: MotionPreviewStageProps) {
  const { tx } = usePitchI18n();
  const previewRef = useRef<HTMLDivElement>(null);
  const previewLabelRef = useRef<HTMLSpanElement>(null);
  const numberFrameRef = useRef<number | undefined>(undefined);
  const actionSignature = useMemo(() => JSON.stringify(action), [action]);
  const label = layerLabel(block);
  const isNumberRange = action?.type === "tween" && action.preset === "numberRange" && Boolean(action.numberRange);

  useEffect(() => {
    const element = previewRef.current;
    if (!element) return;
    element.getAnimations().forEach((animation) => animation.cancel());
    if (numberFrameRef.current !== undefined) window.cancelAnimationFrame(numberFrameRef.current);
    if (!action || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (action.type === "tween" && action.preset === "numberRange" && action.numberRange && previewLabelRef.current) {
      return animatePreviewNumber(previewLabelRef.current, action, numberFrameRef);
    }
    const animation = element.animate(previewKeyframes(action), {
      duration: Math.min(2400, Math.max(260, action.duration * 1000)),
      easing: action.type === "tween" && action.path ? "linear" : cssEasing(action.easing),
      fill: "none"
    });
    return () => animation.cancel();
  }, [actionSignature]);

  function replay() {
    const element = previewRef.current;
    if (!element || !action) return;
    element.getAnimations().forEach((animation) => animation.cancel());
    if (numberFrameRef.current !== undefined) window.cancelAnimationFrame(numberFrameRef.current);
    if (action.type === "tween" && action.preset === "numberRange" && action.numberRange && previewLabelRef.current) {
      animatePreviewNumber(previewLabelRef.current, action, numberFrameRef);
      return;
    }
    element.animate(previewKeyframes(action), {
      duration: Math.min(2400, Math.max(260, action.duration * 1000)),
      easing: action.type === "tween" && action.path ? "linear" : cssEasing(action.easing),
      fill: "none"
    });
  }

  return (
    <section aria-label={`${tx(stageLabel)} · ${label}`} className="overflow-hidden rounded-[16px] border border-white/[0.085] bg-[#141416] shadow-[0_18px_38px_rgba(0,0,0,.24),inset_0_1px_0_rgba(255,255,255,.025)]">
      <div className="relative h-[162px] overflow-hidden bg-[radial-gradient(circle_at_50%_44%,rgba(124,58,237,.11),transparent_48%),linear-gradient(145deg,#18181d,#121216)]">
        <div className="absolute inset-3 rounded-[13px] border border-white/[0.045] bg-black/10 shadow-inner" />
        {!isNumberRange && block.type === "Shape" ? (
          <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-20 w-36 -translate-x-1/2 -translate-y-1/2">
            {[0, 1, 2].map((index) => (
              <Square className="absolute size-[58px] fill-violet-500/30 text-violet-400/15" key={index} strokeWidth={1} style={{ left: 12 + index * 13, opacity: .18 + index * .13, top: 8 + index * 2, transform: `rotate(${index * 3 - 8}deg)` }} />
            ))}
          </div>
        ) : null}
        <div
          className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden border border-violet-200/35 bg-[linear-gradient(145deg,rgba(167,139,250,.96),rgba(109,40,217,.94))] text-white shadow-[0_18px_34px_rgba(76,29,149,.36),inset_0_1px_0_rgba(255,255,255,.22)] will-change-transform ${isNumberRange ? "h-16 min-w-36 rounded-[14px] px-5 text-[22px]" : block.type === "Shape" ? "size-[68px] rounded-[10px]" : "h-14 min-w-28 max-w-36 gap-2 rounded-[12px] px-4 text-[10px]"}`}
          ref={previewRef}
        >
          {isNumberRange || block.type === "Shape" ? null : <LayerIcon block={block} />}
          {block.type === "Shape" && !isNumberRange ? null : <span className="truncate font-mono tabular-nums" ref={previewLabelRef}>{action?.type === "tween" && action.preset === "numberRange" && action.numberRange ? formatMotionNumber(action.numberRange.from, action.numberRange) : label}</span>}
        </div>
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-[10px] border border-white/[0.07] bg-black/30 p-1 backdrop-blur-sm">
          <button aria-label={tx("Replay preview")} className="flex size-7 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-25" disabled={!action} onClick={replay} title={tx("Replay preview")} type="button"><RotateCcw size={12} /></button>
          <button aria-label={tx("Preview on canvas")} className="flex size-7 items-center justify-center rounded-lg bg-white text-black transition hover:bg-violet-100 disabled:opacity-25" disabled={!action} onClick={onPreviewCanvas} title={tx("Preview on canvas")} type="button"><Play fill="currentColor" size={10} /></button>
        </div>
      </div>
    </section>
  );
}

function animatePreviewNumber(target: HTMLElement, action: MotionTweenAction, frameRef: MutableRefObject<number | undefined>) {
  const range = action.numberRange;
  if (!range) return undefined;
  const startedAt = performance.now();
  const duration = Math.min(2400, Math.max(260, action.duration * 1000));
  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    target.textContent = formatMotionNumber(interpolateMotionNumber(range, progress, action.easing), range);
    if (progress < 1) frameRef.current = window.requestAnimationFrame(tick);
    else frameRef.current = undefined;
  };
  frameRef.current = window.requestAnimationFrame(tick);
  return () => {
    if (frameRef.current !== undefined) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = undefined;
  };
}

function LayerIcon({ block }: { block: MotionDocBlockWithProps }) {
  if (block.type === "Text") return <Type size={12} />;
  if (block.type === "ImageBlock") return <ImageIcon size={12} />;
  return <Square size={11} />;
}

function previewKeyframes(action: MotionAction): Keyframe[] {
  if (action.type === "enter") return enterFrames(action.preset);
  if (action.type === "exit") return exitFrames(action.preset);
  return tweenFrames(action);
}

function tweenFrames(action: MotionTweenAction): Keyframe[] {
  const frameCount = action.path ? 31 : 2;
  return Array.from({ length: frameCount }, (_, index) => {
    const state = interpolateMotionState(action.from, action.to, index / (frameCount - 1), "linear", action.path);
    const fromCenterX = state.x + state.w / 2;
    const fromCenterY = state.y + state.h / 2;
    const toCenterX = action.to.x + action.to.w / 2;
    const toCenterY = action.to.y + action.to.h / 2;
    return {
      offset: index / (frameCount - 1),
      opacity: state.opacity,
      transform: `translate(calc(-50% + ${(fromCenterX - toCenterX) * 2.1}px), calc(-50% + ${(fromCenterY - toCenterY) * 1.18}px)) scale(${state.w / action.to.w}, ${state.h / action.to.h}) rotate(${state.rotation - action.to.rotation}deg)`
    };
  });
}

function enterFrames(preset: string): Keyframe[] {
  if (preset === "fadeUp" || preset === "rise") return [{ opacity: 0, transform: "translate(-50%, calc(-50% + 22px))" }, { opacity: 1, transform: "translate(-50%, -50%)" }];
  if (preset === "slideLeft") return [{ opacity: 0, transform: "translate(calc(-50% + 54px), -50%)" }, { opacity: 1, transform: "translate(-50%, -50%)" }];
  if (preset === "zoomIn") return [{ opacity: 0, transform: "translate(-50%, -50%) scale(.76)" }, { opacity: 1, transform: "translate(-50%, -50%) scale(1)" }];
  if (preset === "pop") return [{ opacity: 0, transform: "translate(-50%, -50%) scale(.62)" }, { opacity: 1, transform: "translate(-50%, -50%) scale(1)" }];
  return [{ opacity: 0 }, { opacity: 1 }];
}

function exitFrames(preset: string): Keyframe[] {
  if (preset === "fadeDown") return [{ opacity: 1, transform: "translate(-50%, -50%)" }, { opacity: 0, transform: "translate(-50%, calc(-50% + 22px))" }];
  if (preset === "slideRight") return [{ opacity: 1, transform: "translate(-50%, -50%)" }, { opacity: 0, transform: "translate(calc(-50% + 54px), -50%)" }];
  if (preset === "zoomOut") return [{ opacity: 1, transform: "translate(-50%, -50%) scale(1)" }, { opacity: 0, transform: "translate(-50%, -50%) scale(1.22)" }];
  if (preset === "shrink") return [{ opacity: 1, transform: "translate(-50%, -50%) scale(1)" }, { opacity: 0, transform: "translate(-50%, -50%) scale(.62)" }];
  return [{ opacity: 1 }, { opacity: 0 }];
}

function layerLabel(block: MotionDocBlockWithProps) {
  if ("text" in block && block.text.trim()) return block.text.trim().slice(0, 22);
  const name = typeof block.props.groupName === "string" ? block.props.groupName.trim() : "";
  return name || block.type;
}

function cssEasing(value: MotionAction["easing"]) {
  return value === "easeIn" ? "ease-in" : value === "easeOut" ? "ease-out" : value === "easeInOut" ? "ease-in-out" : "linear";
}
