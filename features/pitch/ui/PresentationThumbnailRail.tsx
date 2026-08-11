"use client";

import { useEffect, useRef } from "react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { SlideThumbnailPreview } from "@/features/pitch/ui/preview/SlideThumbnailPreview";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type PresentationThumbnailRailProps = {
  activeSlideIndex: number;
  onSelectSlide: (slideIndex: number) => void;
  scenes: MotionDocScene[];
  source: string;
};

export function PresentationThumbnailRail({
  activeSlideIndex,
  onSelectSlide,
  scenes,
  source
}: PresentationThumbnailRailProps) {
  const { locale, tx } = usePitchI18n();
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const activeThumbnail = railRef.current?.querySelector<HTMLElement>(`[data-preview-thumbnail="${activeSlideIndex}"]`);
    activeThumbnail?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeSlideIndex]);

  return (
    <aside className="hidden w-[154px] shrink-0 flex-col border-r border-white/[0.08] bg-black/40 sm:flex lg:w-[184px]" aria-label={tx("Presentation slides")}>
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.06] px-3 lg:px-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{tx("Slides")}</span>
        <span className="font-mono text-[10px] text-neutral-600">{scenes.length}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-2.5 py-3 [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin] lg:px-3">
        {scenes.map((scene, sceneIndex) => {
          const isActive = sceneIndex === activeSlideIndex;

          return (
            <button
              aria-current={isActive ? "true" : undefined}
              aria-label={locale === "zh-TW" ? `前往第 ${sceneIndex + 1} 張投影片` : `Go to slide ${sceneIndex + 1}`}
              className="group block w-full text-left"
              data-preview-thumbnail={sceneIndex}
              key={sceneIndex}
              onClick={() => onSelectSlide(sceneIndex)}
              type="button"
            >
              <span className={`mb-1.5 block pl-0.5 font-mono text-[10px] font-semibold transition-colors ${isActive ? "text-white" : "text-neutral-600 group-hover:text-neutral-400"}`}>
                {String(sceneIndex + 1).padStart(2, "0")}
              </span>
              <span className={`relative block aspect-video overflow-hidden rounded-[3px] bg-black transition-all ${
                isActive
                  ? "ring-2 ring-white shadow-[0_0_0_3px_rgba(255,255,255,0.08)]"
                  : "opacity-60 ring-1 ring-white/[0.12] group-hover:opacity-100 group-hover:ring-white/30"
              }`}>
                <SlideThumbnailPreview
                  activeSlideIndex={sceneIndex}
                  eager={isActive}
                  replayNonce={0}
                  scene={scene}
                  source={source}
                />
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
