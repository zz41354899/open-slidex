import type { CSSProperties } from "react";
import { motionDocBlockFrame } from "@/core/motion-doc/domain/frame";
import type { MotionDocBlockOf, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { SvgStageBlock } from "@/features/pitch/ui/preview/motion/EmbeddedBlocks";

export function SharedSvgSceneLayer({ activeSlideIndex, replayNonce, scenes }: {
  activeSlideIndex: number;
  replayNonce: number;
  scenes: MotionDocScene[];
}) {
  const sharedScenes = collectSharedScenes(scenes);
  return (
    <div className="pointer-events-none absolute inset-0 z-[80] overflow-hidden" data-shared-svg-layer>
      {[...sharedScenes.entries()].map(([sharedScene, declarations]) => {
        const active = declarations.get(activeSlideIndex);
        const fallback = declarations.values().next().value as MotionDocBlockOf<"SvgBlock"> | undefined;
        if (!fallback) return null;
        const block = active ?? fallback;
        const frame = motionDocBlockFrame(block);
        const style: CSSProperties = {
          height: `${frame.h}%`,
          left: `${frame.x}%`,
          opacity: active ? 1 : 0,
          position: "absolute",
          top: `${frame.y}%`,
          transition: `left ${duration(block)}s ${easing(block)}, top ${duration(block)}s ${easing(block)}, width ${duration(block)}s ${easing(block)}, height ${duration(block)}s ${easing(block)}, opacity 120ms ease-out`,
          visibility: active ? "visible" : "hidden",
          width: `${frame.w}%`
        };
        return (
          <div data-shared-scene={sharedScene} key={sharedScene} style={style}>
            <SvgStageBlock
              easing={easing(block)}
              playback
              replayNonce={active ? replayNonce : 0}
              src={String(fallback.props.src ?? "")}
              stage={Number(block.props.stage ?? 0)}
              stageDuration={duration(block)}
            />
          </div>
        );
      })}
    </div>
  );
}

function collectSharedScenes(scenes: MotionDocScene[]) {
  const records = new Map<string, Map<number, MotionDocBlockOf<"SvgBlock">>>();
  scenes.forEach((scene, slideIndex) => scene.blocks.forEach((block) => {
    if (block.type !== "SvgBlock") return;
    const key = typeof block.props.sharedScene === "string" ? block.props.sharedScene.trim() : "";
    if (!key) return;
    const declarations = records.get(key) ?? new Map<number, MotionDocBlockOf<"SvgBlock">>();
    declarations.set(slideIndex, block);
    records.set(key, declarations);
  }));
  return records;
}

function duration(block: MotionDocBlockOf<"SvgBlock">) {
  const value = Number(block.props.stageDuration ?? 0.6);
  return Math.min(Math.max(Number.isFinite(value) ? value : 0.6, 0), 30);
}

function easing(block: MotionDocBlockOf<"SvgBlock">) {
  const value = typeof block.props.easing === "string" ? block.props.easing : "ease-in-out";
  return /^(?:linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\([\d.,\s-]+\))$/.test(value) ? value : "ease-in-out";
}
