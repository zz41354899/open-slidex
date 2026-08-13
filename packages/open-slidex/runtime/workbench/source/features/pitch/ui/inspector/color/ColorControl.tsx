
import { useState } from "react";
import type { MotionDocPropValue } from "@/core/motion-doc/domain/motionDocTypes";
import { Field } from "@/features/pitch/ui/inspector/controls/BaseControls";
import { ColorActionBar } from "@/features/pitch/ui/inspector/color/ColorActionBar";
import { colorSwatchStyle } from "@/features/pitch/ui/inspector/color/colorSwatchStyle";
import { ColorPickerSurface } from "@/features/pitch/ui/inspector/color/ColorPickerSurface";
import { defaultColorPresets } from "@/features/pitch/ui/inspector/color/palettes";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/common/ui/shadcnPrimitives";

type ColorControlProps = {
  displayValue?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  presets?: readonly string[];
  value: MotionDocPropValue | undefined;
};

export function ColorControl({
  displayValue,
  label,
  onChange,
  placeholder = "#ffffff",
  presets = defaultColorPresets,
  value
}: ColorControlProps) {
  const { tx } = usePitchI18n();
  const [isOpen, setIsOpen] = useState(false);
  const colorValue = String(value ?? "");
  const resolvedValue = colorValue || displayValue || placeholder;
  const swatchStyle = colorSwatchStyle(resolvedValue);

  return (
    <Field label={label}>
      <Popover onOpenChange={setIsOpen} open={isOpen}>
        <PopoverTrigger asChild>
          <button
            aria-expanded={isOpen}
            className="flex w-full items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.06] focus-visible:ring-1 focus-visible:ring-white/[0.12]"
            type="button"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="h-4 w-4 shrink-0 rounded-[4px] border border-white/20 shadow-inner" style={swatchStyle} />
              <span className="truncate font-mono text-[13px] text-neutral-200">{colorValue || displayValue || tx("Default")}</span>
            </span>
            <span className="text-[12px] text-neutral-500">{tx(isOpen ? "Close" : "Edit")}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          aria-label={`${tx(label)} ${tx("color controls")}`}
          className="z-[1000] max-h-[calc(100vh-1.5rem)] w-72 overflow-y-auto rounded-xl border-neutral-700 bg-[#111111] p-3.5 text-neutral-200 shadow-2xl shadow-black/60"
          sideOffset={8}
        >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-300">{tx(label)}</span>
            </div>
            <ColorPickerSurface
              label={label}
              onChange={onChange}
              presets={presets}
              value={resolvedValue}
            />
            <ColorActionBar
              label={label}
              onClear={() => onChange("")}
              onPick={onChange}
              onTransparent={() => onChange("transparent")}
            />
        </PopoverContent>
      </Popover>
    </Field>
  );
}
