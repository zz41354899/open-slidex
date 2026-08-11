"use client";

import { Grid3X3, Magnet } from "lucide-react";
import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";
import { Field } from "@/features/pitch/ui/inspector/InspectorControls";
import { AccordionSection } from "@/features/pitch/ui/inspector/controls/AccordionSection";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type SlideLayoutSectionProps = {
  isGridVisible: boolean;
  isSnapEnabled: boolean;
  setIsGridVisible: (value: boolean) => void;
  setIsSnapEnabled: (value: boolean) => void;
};

export function SlideLayoutSection({
  isGridVisible,
  isSnapEnabled,
  setIsGridVisible,
  setIsSnapEnabled
}: SlideLayoutSectionProps) {
  const { tx } = usePitchI18n();

  return (
    <AccordionSection title={tx("Canvas Grid & Layout")} defaultOpen>
      <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2">
        <span className="text-[11px] text-neutral-500">{tx("Canvas size")}</span>
        <span className="font-mono text-[11px] text-neutral-300">16:9 · {MOTION_DOC_CANVAS_WIDTH}×{MOTION_DOC_CANVAS_HEIGHT}</span>
      </div>

      <Field label={tx("Canvas grid")}>
        <button
          aria-pressed={isGridVisible}
          className={`flex items-center justify-between rounded-md border px-3 py-2 text-[11px] transition-colors cursor-pointer ${
            isGridVisible
              ? "border-neutral-600 bg-neutral-900 text-white"
              : "border-neutral-800 bg-transparent text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
          }`}
          onClick={() => setIsGridVisible(!isGridVisible)}
          type="button"
        >
          <span className="flex items-center gap-2">
            <Grid3X3 size={13} />
            {tx("Grid Overlay")}
          </span>
          <span className={`flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${isGridVisible ? "bg-[#8ea5ff]" : "bg-neutral-800"}`}>
            <span className={`h-3 w-3 rounded-full transition-transform ${isGridVisible ? "translate-x-3 bg-black" : "translate-x-0 bg-neutral-500"}`} />
          </span>
        </button>
      </Field>

      <AlignmentSnapControl isSnapEnabled={isSnapEnabled} setIsSnapEnabled={setIsSnapEnabled} />

    </AccordionSection>
  );
}

export function AlignmentSnapControl({
  isSnapEnabled,
  setIsSnapEnabled
}: {
  isSnapEnabled: boolean;
  setIsSnapEnabled: (value: boolean) => void;
}) {
  const { tx } = usePitchI18n();

  return (
    <Field label={tx("Alignment snapping")}>
      <button
        aria-pressed={isSnapEnabled}
        className={`flex items-center justify-between rounded-md border px-3 py-2 text-[11px] transition-colors cursor-pointer ${
          isSnapEnabled
            ? "border-[#8ea5ff]/55 bg-[#8ea5ff]/10 text-white"
            : "border-neutral-800 bg-transparent text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
        }`}
        onClick={() => setIsSnapEnabled(!isSnapEnabled)}
        type="button"
      >
        <span className="flex items-center gap-2">
          <Magnet size={13} />
          {tx("Snap to guides")}
        </span>
        <span className={`flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${isSnapEnabled ? "bg-[#8ea5ff]" : "bg-neutral-800"}`}>
          <span className={`h-3 w-3 rounded-full transition-transform ${isSnapEnabled ? "translate-x-3 bg-black" : "translate-x-0 bg-neutral-500"}`} />
        </span>
      </button>
      <span className="text-[10px] leading-4 text-neutral-600">
        {tx("Objects lock onto slide edges, centers, and nearby objects.")}
      </span>
    </Field>
  );
}
