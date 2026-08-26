import type { CSSProperties } from "react";
import { motionDocBlockFrame } from "@/core/motion-doc/domain/frame";
import type { MotionDocBlockOf, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { HtmlEmbedBlock } from "@/features/pitch/ui/preview/motion/EmbeddedBlocks";

export function SharedHtmlSceneLayer({
  activeSlideIndex,
  interactive = true,
  onRequestSlide,
  replayNonce,
  scenes
}: {
  activeSlideIndex: number;
  interactive?: boolean;
  onRequestSlide: (slideIndex: number) => void;
  replayNonce: number;
  scenes: MotionDocScene[];
}) {
  const sharedScenes = collectSharedScenes(scenes);
  return (
    <div className="pointer-events-none absolute inset-0 z-[85] overflow-hidden" data-shared-html-layer>
      {[...sharedScenes.entries()].map(([sharedScene, declarations]) => {
        const active = declarations.get(activeSlideIndex);
        const fallback = declarations.values().next().value as MotionDocBlockOf<"HtmlEmbedBlock"> | undefined;
        if (!fallback) return null;
        const block = active ?? fallback;
        const frame = motionDocBlockFrame(block);
        const style: CSSProperties = {
          height: `${frame.h}%`,
          left: `${frame.x}%`,
          opacity: active ? 1 : 0,
          pointerEvents: active && interactive ? "auto" : "none",
          position: "absolute",
          top: `${frame.y}%`,
          visibility: active ? "visible" : "hidden",
          width: `${frame.w}%`
        };
        return (
          <div data-shared-html-scene={sharedScene} key={sharedScene} style={style}>
            <HtmlEmbedBlock
              onNavigate={(page) => {
                const target = [...declarations.entries()].find(([, declaration]) => htmlPage(declaration) === page);
                if (target) onRequestSlide(target[0]);
              }}
              page={htmlPage(block)}
              replayNonce={active ? replayNonce : 0}
              src={String(fallback.props.src ?? "")}
            />
          </div>
        );
      })}
    </div>
  );
}

function collectSharedScenes(scenes: MotionDocScene[]) {
  const records = new Map<string, Map<number, MotionDocBlockOf<"HtmlEmbedBlock">>>();
  scenes.forEach((scene, slideIndex) => scene.blocks.forEach((block) => {
    if (block.type !== "HtmlEmbedBlock") return;
    const key = typeof block.props.sharedScene === "string" ? block.props.sharedScene.trim() : "";
    if (!key) return;
    const declarations = records.get(key) ?? new Map<number, MotionDocBlockOf<"HtmlEmbedBlock">>();
    declarations.set(slideIndex, block);
    records.set(key, declarations);
  }));
  return records;
}

function htmlPage(block: MotionDocBlockOf<"HtmlEmbedBlock">) {
  const value = Number(block.props.page ?? 1);
  return Number.isInteger(value) && value > 0 ? value : 1;
}
