
import { useEffect, useState, type KeyboardEvent } from "react";
import { Slider } from "@/common/ui/shadcnPrimitives";

type ShaderRangeControlProps = {
  ariaLabel: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  unit?: string;
  value: number;
};

export function ShaderRangeControl({
  ariaLabel,
  label,
  max,
  min,
  onChange,
  step,
  unit,
  value
}: ShaderRangeControlProps) {
  const [draft, setDraft] = useState(() => formatRangeValue(value, step));

  useEffect(() => {
    setDraft(formatRangeValue(value, step));
  }, [step, value]);

  function commitDraft() {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(formatRangeValue(value, step));
      return;
    }

    const nextValue = snapRangeValue(parsed, min, max, step);
    setDraft(formatRangeValue(nextValue, step));
    if (nextValue !== value) onChange(nextValue);
  }

  return (
    <div className="group flex flex-col gap-1.5 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-neutral-400 transition-colors group-hover:text-neutral-200">
          {label}
        </span>
        <label className="flex h-7 min-w-[58px] items-center justify-end rounded-md border border-transparent bg-white/[0.025] px-1.5 transition-colors hover:bg-white/[0.05] focus-within:border-[#8ea5ff]/45 focus-within:bg-white/[0.055]">
          <input
            aria-label={`${ariaLabel} value`}
            className="w-11 appearance-none bg-transparent text-right font-mono text-[14px] tabular-nums text-neutral-400 outline-none transition-colors group-hover:text-neutral-300 focus:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            inputMode="decimal"
            max={max}
            min={min}
            onBlur={commitDraft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => handleValueKeyDown(event, commitDraft, () => {
              setDraft(formatRangeValue(value, step));
              event.currentTarget.blur();
            })}
            step={step}
            type="number"
            value={draft}
          />
          {unit ? <span className="ml-1 font-mono text-[14px] text-neutral-600">{unit}</span> : null}
        </label>
      </div>
      <Slider
        aria-label={ariaLabel}
        className="h-7 cursor-ew-resize [&_[data-slot=slider-range]]:bg-[#8ea5ff]/75 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-[#111111] [&_[data-slot=slider-thumb]]:shadow-[0_1px_6px_rgba(0,0,0,0.75)] [&_[data-slot=slider-track]]:bg-white/[0.08] [&_[data-slot=slider-track]]:shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]"
        max={max}
        min={min}
        onKeyDown={stopRangeShortcutPropagation}
        onValueChange={([nextValue]) => onChange(nextValue)}
        step={step}
        value={[value]}
      />
    </div>
  );
}

function formatRangeValue(value: number, step: number) {
  return value.toFixed(decimalPlaces(step));
}

function snapRangeValue(value: number, min: number, max: number, step: number) {
  const clamped = Math.min(Math.max(value, min), max);
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Number(snapped.toFixed(decimalPlaces(step)));
}

function decimalPlaces(value: number) {
  const decimal = String(value).split(".")[1];
  return decimal?.length ?? 0;
}

function handleValueKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  commit: () => void,
  reset: () => void
) {
  event.stopPropagation();

  if (event.key === "Enter") {
    event.preventDefault();
    commit();
    event.currentTarget.blur();
  } else if (event.key === "Escape") {
    event.preventDefault();
    reset();
  }
}

function stopRangeShortcutPropagation(event: KeyboardEvent) {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) {
    event.stopPropagation();
  }
}
