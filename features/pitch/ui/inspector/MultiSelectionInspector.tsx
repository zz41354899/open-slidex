"use client";

import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  type LucideIcon
} from "lucide-react";
import type { SelectionAlignment } from "@/features/pitch/application/multiSelectionLayout";
import type { SelectedBlockColorItem } from "@/features/pitch/application/multiSelectionColors";
import { ColorControl } from "@/features/pitch/ui/inspector/InspectorControls";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type MultiSelectionInspectorProps = {
  canArrange: boolean;
  colorItems: readonly SelectedBlockColorItem[];
  onAlign: (alignment: SelectionAlignment) => void;
  onColorChange: (blockIndex: number, color: string) => void;
};

const alignmentActions = [
  { icon: AlignHorizontalJustifyStart, label: "Align left", value: "left" },
  { icon: AlignHorizontalJustifyCenter, label: "Align center", value: "center" },
  { icon: AlignHorizontalJustifyEnd, label: "Align right", value: "right" },
  { icon: AlignVerticalJustifyStart, label: "Align top", value: "top" },
  { icon: AlignVerticalJustifyCenter, label: "Align middle", value: "middle" },
  { icon: AlignVerticalJustifyEnd, label: "Align bottom", value: "bottom" }
] as const satisfies ReadonlyArray<{ icon: LucideIcon; label: string; value: SelectionAlignment }>;

export function MultiSelectionInspector({ canArrange, colorItems, onAlign, onColorChange }: MultiSelectionInspectorProps) {
  const { locale, tx } = usePitchI18n();

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="mb-2.5 text-[11px] font-semibold text-neutral-400">
          {locale === "zh-TW" ? "選取顏色" : "Selection colors"}
        </h3>
        <div className="flex flex-col gap-2">
          {colorItems.map((item) => (
            <ColorControl
              key={item.blockIndex}
              label={item.label}
              onChange={(color) => onColorChange(item.blockIndex, color)}
              value={item.color}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2.5 text-[11px] font-semibold text-neutral-400">
          {locale === "zh-TW" ? "對齊" : "Alignment"}
        </h3>
        <div className="grid grid-cols-6 gap-1.5">
          {alignmentActions.map(({ icon: Icon, label, value }) => (
            <button
              aria-label={tx(label)}
              className="flex h-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.025] text-neutral-400 transition hover:border-[#8ea5ff]/30 hover:bg-[#8ea5ff]/10 hover:text-[#bac6ff] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-25"
              disabled={!canArrange}
              key={value}
              onClick={() => onAlign(value)}
              title={tx(label)}
              type="button"
            >
              <Icon size={15} strokeWidth={1.8} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
