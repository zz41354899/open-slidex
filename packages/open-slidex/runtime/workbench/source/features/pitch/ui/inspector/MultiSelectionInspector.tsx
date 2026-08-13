
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Columns3,
  Rows3,
  type LucideIcon
} from "lucide-react";
import type { SelectionAlignment, SelectionDistribution } from "@/features/pitch/application/multiSelectionLayout";
import type { SelectedBlockColorItem } from "@/features/pitch/application/multiSelectionColors";
import { ColorControl } from "@/features/pitch/ui/inspector/InspectorControls";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/common/ui/shadcnPrimitives";

type MultiSelectionInspectorProps = {
  canArrange: boolean;
  colorItems: readonly SelectedBlockColorItem[];
  onAlign: (alignment: SelectionAlignment) => void;
  onDistribute: (distribution: SelectionDistribution) => void;
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

export function MultiSelectionInspector({ canArrange, colorItems, onAlign, onColorChange, onDistribute }: MultiSelectionInspectorProps) {
  const { tx } = usePitchI18n();

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="mb-2.5 text-[11px] font-semibold text-neutral-400">
          {tx("Selection colors")}
        </h3>
        <div className="flex flex-col gap-2">
          {colorItems.map((item) => (
            <ColorControl
              key={item.blockIndex}
              label={item.generatedType && item.generatedIndex
                ? tx("Indexed layer", { index: item.generatedIndex, type: tx(item.generatedType) })
                : item.label}
              onChange={(color) => onColorChange(item.blockIndex, color)}
              value={item.color}
            />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Button className="h-9 gap-2 rounded-lg border-white/[0.06] bg-white/[0.025] text-[10px] font-semibold text-neutral-400 hover:border-[#8ea5ff]/30 hover:bg-[#8ea5ff]/10 hover:text-[#bac6ff]" disabled={!canArrange || colorItems.length < 3} onClick={() => onDistribute("horizontal")} type="button" variant="outline"><Columns3 size={14} />{tx("Distribute H")}</Button>
          <Button className="h-9 gap-2 rounded-lg border-white/[0.06] bg-white/[0.025] text-[10px] font-semibold text-neutral-400 hover:border-[#8ea5ff]/30 hover:bg-[#8ea5ff]/10 hover:text-[#bac6ff]" disabled={!canArrange || colorItems.length < 3} onClick={() => onDistribute("vertical")} type="button" variant="outline"><Rows3 size={14} />{tx("Distribute V")}</Button>
        </div>
      </section>

      <section>
        <h3 className="mb-2.5 text-[11px] font-semibold text-neutral-400">
          {tx("Alignment")}
        </h3>
        <div className="grid grid-cols-6 gap-1.5">
          {alignmentActions.map(({ icon: Icon, label, value }) => (
            <Tooltip key={value}>
              <TooltipTrigger asChild>
                <Button
                  aria-label={tx(label)}
                  className="h-9 rounded-lg border-white/[0.06] bg-white/[0.025] text-neutral-400 hover:border-[#8ea5ff]/30 hover:bg-[#8ea5ff]/10 hover:text-[#bac6ff] active:scale-[0.96]"
                  disabled={!canArrange}
                  onClick={() => onAlign(value)}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <Icon size={15} strokeWidth={1.8} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{tx(label)}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </section>
    </div>
  );
}
