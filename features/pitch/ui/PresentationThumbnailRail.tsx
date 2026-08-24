
import { useEffect, useRef } from "react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { SlideThumbnailPreview } from "@/features/pitch/ui/preview/SlideThumbnailPreview";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type PresentationThumbnailRailProps = {
  activeSlideIndex: number;
  id?: string;
  mode?: "filmstrip" | "rail";
  onSelectSlide: (slideIndex: number) => void;
  scenes: MotionDocScene[];
};

export function PresentationThumbnailRail({
  activeSlideIndex,
  id,
  mode = "rail",
  onSelectSlide,
  scenes
}: PresentationThumbnailRailProps) {
  const { locale, tx } = usePitchI18n();
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const activeThumbnail = railRef.current?.querySelector<HTMLElement>(`[data-preview-thumbnail="${activeSlideIndex}"]`);
    activeThumbnail?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: mode === "filmstrip" ? "center" : "nearest" });
  }, [activeSlideIndex, mode]);

  if (mode === "filmstrip") {
    return (
      <aside aria-label={tx("Presentation slides")} className="animate-in fade-in slide-in-from-bottom-4 h-[116px] shrink-0 border-t border-white/[0.08] bg-[#0a0a0c]/95 px-3 py-2.5 shadow-[0_-14px_32px_rgba(0,0,0,0.3)] duration-300 sm:h-[124px] sm:px-5" id={id}>
        <div className="relative h-full w-full rounded-[22px] border border-white/[0.1] bg-[#1c1c1e]/82 px-3 pb-2 pt-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:px-5">
          <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-1 w-8 -translate-x-1/2 rounded-full bg-white/[0.18]" />
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold tracking-[0.01em] text-neutral-400">{tx("Slides")}</span>
            <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-medium tabular-nums text-neutral-300">{String(activeSlideIndex + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin]" ref={railRef}>
            {scenes.map((scene, sceneIndex) => {
              const isActive = sceneIndex === activeSlideIndex;

              return (
                <button
                  aria-current={isActive ? "true" : undefined}
                  aria-label={locale === "zh-TW" ? `前往第 ${sceneIndex + 1} 張投影片` : `Go to slide ${sceneIndex + 1}`}
                  className="group relative w-[92px] shrink-0 text-left transition-transform duration-200 ease-out hover:scale-[1.025] sm:w-[108px]"
                  data-preview-thumbnail={sceneIndex}
                  key={sceneIndex}
                  onClick={() => onSelectSlide(sceneIndex)}
                  type="button"
                >
                  <span className={`absolute left-1.5 top-1.5 z-10 rounded-md border border-white/[0.08] bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums shadow-sm backdrop-blur-md transition-colors ${isActive ? "text-white" : "text-neutral-300 group-hover:text-white"}`}>
                    {String(sceneIndex + 1).padStart(2, "0")}
                  </span>
                  <span className={`relative block aspect-video overflow-hidden rounded-[7px] bg-black transition-all duration-200 ${
                    isActive
                      ? "scale-[1.02] ring-2 ring-white shadow-[0_0_0_3px_rgba(255,255,255,0.12),0_8px_18px_rgba(0,0,0,0.42)]"
                      : "opacity-55 ring-1 ring-white/[0.1] group-hover:opacity-90 group-hover:ring-white/35"
                  }`}>
                    <SlideThumbnailPreview
                      activeSlideIndex={sceneIndex}
                      eager={isActive}
                      replayNonce={0}
                      scene={scene}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden w-[154px] shrink-0 flex-col border-r border-white/[0.08] bg-black/40 sm:flex lg:w-[184px]" aria-label={tx("Presentation slides")}>
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.06] px-3 lg:px-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{tx("Slides")}</span>
        <span className="font-mono text-[10px] text-neutral-600">{scenes.length}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-2.5 py-3 [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin] lg:px-3" ref={railRef}>
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
                />
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
