"use client";

import { useEffect, useState, type KeyboardEvent } from "react";

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
  const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);

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
        <span className="text-[12px] font-medium text-neutral-400 transition-colors group-hover:text-neutral-200">
          {label}
        </span>
        <label className="flex h-7 min-w-[58px] items-center justify-end rounded-md border border-transparent bg-white/[0.025] px-1.5 transition-colors hover:bg-white/[0.05] focus-within:border-[#8ea5ff]/45 focus-within:bg-white/[0.055]">
          <input
            aria-label={`${ariaLabel} value`}
            className="w-11 appearance-none bg-transparent text-right font-mono text-[11px] tabular-nums text-neutral-400 outline-none transition-colors group-hover:text-neutral-300 focus:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
          {unit ? <span className="ml-1 font-mono text-[9px] text-neutral-600">{unit}</span> : null}
        </label>
      </div>
      <div className="relative flex h-7 items-center">
        <span className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-white/[0.08] shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]">
          <span
            className="block h-full rounded-full bg-[#8ea5ff]/75 transition-[width] duration-75 group-hover:bg-[#a7b7ff]"
            style={{ width: `${percentage}%` }}
          />
        </span>
        <input
          aria-label={ariaLabel}
          className="absolute inset-0 z-10 h-7 w-full cursor-ew-resize appearance-none bg-transparent outline-none
                     [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent
                     [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#111111] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_1px_6px_rgba(0,0,0,0.75)] [&::-webkit-slider-thumb]:transition-transform
                     hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-125 focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-[#8ea5ff]/25
                     [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent
                     [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#111111] [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_1px_6px_rgba(0,0,0,0.75)]"
          max={max}
          min={min}
          onChange={(event) => onChange(Number(event.target.value))}
          onKeyDown={(event) => stopRangeShortcutPropagation(event)}
          step={step}
          type="range"
          value={value}
        />
      </div>
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

function stopRangeShortcutPropagation(event: KeyboardEvent<HTMLInputElement>) {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) {
    event.stopPropagation();
  }
}
