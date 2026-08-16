
import { useState, type DragEvent } from "react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import type { SlideRow } from "@/features/pitch/application/slideRows";
import { SlideThumbnailPreview } from "@/features/pitch/ui/preview/SlideThumbnailPreview";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type CanvasGridViewProps = {
  activeSlideIndex: number;
  onOpenSlide: (slideIndex: number) => void;
  onReorderSlide: (fromIndex: number, toIndex: number) => void;
  replayNonce: number;
  scenes: MotionDocScene[];
  slideRows: readonly SlideRow[];
};

/**
 * Grid thumbnails retain their own mounted shell. SlideThumbnailPreview fills
 * it on intersection, which gives large decks lazy rendering without changing
 * source, active-slide identity, or slide ordering.
 */
export function CanvasGridView({
  activeSlideIndex,
  onOpenSlide,
  onReorderSlide,
  replayNonce,
  scenes,
  slideRows
}: CanvasGridViewProps) {
  const { locale } = usePitchI18n();
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const [dropSlideIndex, setDropSlideIndex] = useState<number | null>(null);

  function beginDrag(event: DragEvent<HTMLDivElement>, slideIndex: number) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-slidex-slide", String(slideIndex));
    setDraggedSlideIndex(slideIndex);
  }

  function completeDrop(event: DragEvent<HTMLDivElement>, slideIndex: number) {
    event.preventDefault();
    const fromIndex = draggedSlideIndex ?? Number(event.dataTransfer.getData("application/x-slidex-slide"));
    if (Number.isInteger(fromIndex) && fromIndex >= 0 && fromIndex !== slideIndex) {
      onReorderSlide(fromIndex, slideIndex);
    }
    setDraggedSlideIndex(null);
    setDropSlideIndex(null);
  }

  return (
    <div className="grid w-full max-w-[1500px] grid-cols-1 gap-5 pb-24 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" data-canvas-grid-view>
      {slideRows.map((slide) => {
        const isActive = slide.index === activeSlideIndex;
        const isDropTarget = dropSlideIndex === slide.index && draggedSlideIndex !== slide.index;
        const label = locale === "zh-TW" ? `開啟第 ${slide.index + 1} 張投影片` : `Open slide ${slide.index + 1}`;

        return (
          <div
            aria-label={label}
            className={`group relative cursor-pointer rounded-xl border bg-[#111111]/88 p-2.5 text-left shadow-[0_16px_36px_rgba(0,0,0,0.28)] transition duration-200 focus-within:ring-2 focus-within:ring-[#8ea5ff]/70 ${
              isActive ? "border-[#8ea5ff]/80 ring-1 ring-[#8ea5ff]/30" : "border-white/[0.08] hover:border-white/[0.24] hover:bg-[#161616]"
            } ${isDropTarget ? "-translate-y-1 border-dashed border-[#8ea5ff]" : ""}`}
            data-grid-slide-index={slide.index}
            draggable
            key={slide.index}
            onClick={() => onOpenSlide(slide.index)}
            onDragEnd={() => {
              setDraggedSlideIndex(null);
              setDropSlideIndex(null);
            }}
            onDragLeave={() => setDropSlideIndex(null)}
            onDragOver={(event) => {
              event.preventDefault();
              if (draggedSlideIndex !== null && draggedSlideIndex !== slide.index) setDropSlideIndex(slide.index);
            }}
            onDragStart={(event) => beginDrag(event, slide.index)}
            onDrop={(event) => completeDrop(event, slide.index)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onOpenSlide(slide.index);
            }}
            role="button"
            tabIndex={0}
            title={locale === "zh-TW" ? "點選編輯；拖曳重新排序" : "Click to edit; drag to reorder"}
          >
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black ring-1 ring-white/[0.08]">
              <SlideThumbnailPreview
                activeSlideIndex={slide.index}
                eager={isActive}
                replayNonce={replayNonce}
                scene={scenes[slide.index]}
              />
              <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[14px] font-semibold text-white shadow-sm">
                {slide.index + 1}
              </span>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-3 px-1 pt-2">
              <span className="truncate text-[14px] font-semibold text-neutral-200">{slide.title}</span>
              <span className="shrink-0 font-mono text-[14px] text-neutral-500">{slide.duration}s</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
