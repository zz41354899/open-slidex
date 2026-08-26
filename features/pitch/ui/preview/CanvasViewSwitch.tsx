
import { Grid2X2, RectangleHorizontal, Rows3 } from "lucide-react";
import type { CanvasViewMode } from "@/features/pitch/application/canvasViewMode";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

export function CanvasViewSwitch({
  mode,
  onChange,
  singleSlidePreview = false
}: {
  mode: CanvasViewMode;
  onChange: (mode: CanvasViewMode) => void;
  singleSlidePreview?: boolean;
}) {
  const { tx } = usePitchI18n();
  const slideLabel = tx(singleSlidePreview ? "Single slide view" : "Vertical slide view");
  const gridLabel = tx("Slide grid view");
  const SlideIcon = singleSlidePreview ? RectangleHorizontal : Rows3;

  return (
    <div aria-label={tx("Canvas view")} className="flex items-center rounded-lg border border-white/[0.08] bg-black/20 p-0.5" role="group">
      <button
        aria-label={slideLabel}
        aria-pressed={mode === "slide"}
        className={`flex h-7 w-7 items-center justify-center rounded-md transition ${mode === "slide" ? "bg-white/[0.14] text-white shadow-sm" : "text-neutral-500 hover:bg-white/[0.07] hover:text-neutral-200"}`}
        data-canvas-view="slide"
        onClick={() => onChange("slide")}
        title={slideLabel}
        type="button"
      >
        <SlideIcon size={14} />
      </button>
      <button
        aria-label={gridLabel}
        aria-pressed={mode === "grid"}
        className={`flex h-7 w-7 items-center justify-center rounded-md transition ${mode === "grid" ? "bg-white/[0.14] text-white shadow-sm" : "text-neutral-500 hover:bg-white/[0.07] hover:text-neutral-200"}`}
        data-canvas-view="grid"
        onClick={() => onChange("grid")}
        title={gridLabel}
        type="button"
      >
        <Grid2X2 size={14} />
      </button>
    </div>
  );
}
