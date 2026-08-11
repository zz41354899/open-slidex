"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type {
  MotionDocBlockWithProps,
  MotionDocPropValue
} from "@/core/motion-doc/domain/motionDocTypes";
import type { BlockUpdateOptions } from "@/features/pitch/application/pitchCommandTypes";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

export type ControlOption<T extends string = string> = { label: string; value: T };
export type IconControlOption<T extends string = string> = ControlOption<T> & { icon: ReactNode };

export type BlockFieldProps<TBlock extends MotionDocBlockWithProps = MotionDocBlockWithProps> = {
  block: TBlock;
  selectedBlockIndex: number;
  updateBlock: (blockIndex: number, newProps: TBlock["props"], newText?: string, options?: BlockUpdateOptions) => void;
};

export function Field({ children, label }: { children: ReactNode; label: string }) {
  const { tx } = usePitchI18n();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {label ? <span className="text-[11px] font-medium tracking-[0.01em] text-neutral-500">{tx(label)}</span> : null}
      {children}
    </div>
  );
}

export function OptionButtons<T extends string>({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: T) => void;
  options: ReadonlyArray<ControlOption<T>>;
  value: T;
}) {
  const { tx } = usePitchI18n();
  return (
    <Field label={label}>
      <div className="flex min-h-9 w-full gap-1 overflow-x-auto rounded-xl border border-white/[0.055] bg-[#18181b] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] custom-scrollbar">
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              className={`flex min-w-0 flex-1 items-center justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium outline-none transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:ring-1 focus-visible:ring-violet-300/60 active:scale-[0.98] ${
                isSelected
                  ? "bg-white text-[#17171a] shadow-[0_1px_5px_rgba(0,0,0,0.22)]"
                  : "text-neutral-500 hover:bg-white/[0.055] hover:text-neutral-200"
              }`}
              key={option.value}
              onClick={() => onChange(option.value)}
              type="button"
            >
              <span className="truncate whitespace-nowrap">{tx(option.label)}</span>
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function IconSegmentedControl<T extends string>({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: T) => void;
  options: ReadonlyArray<IconControlOption<T>>;
  value: T;
}) {
  const { tx } = usePitchI18n();
  return (
    <Field label={label}>
      <div className="flex min-h-9 w-full gap-1 rounded-xl border border-white/[0.055] bg-[#18181b] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              aria-label={tx(option.label)}
              className={`group relative flex h-7 flex-1 items-center justify-center rounded-lg outline-none transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:ring-1 focus-visible:ring-violet-300/60 active:scale-[0.96] ${
                isSelected
                  ? "bg-white text-[#17171a] shadow-[0_1px_5px_rgba(0,0,0,0.22)]"
                  : "text-neutral-600 hover:bg-white/[0.055] hover:text-neutral-200"
              }`}
              key={option.value}
              onClick={() => onChange(option.value)}
              title={tx(option.label)}
              type="button"
            >
              <span className="scale-95 transition-transform duration-150 group-hover:scale-100">{option.icon}</span>
              <span className="sr-only">{tx(option.label)}</span>
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function NativeSelect<T extends string>({
  onChange,
  options,
  value
}: {
  onChange: (value: T) => void;
  options: ReadonlyArray<ControlOption<T>>;
  value: T;
}) {
  const { tx } = usePitchI18n();
  return (
    <div className="relative min-h-9 rounded-xl border border-white/[0.055] bg-[#18181b] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-[border-color,background-color,box-shadow] hover:border-white/[0.09] hover:bg-[#1b1b1e] focus-within:border-violet-300/35 focus-within:bg-[#1d1d20] focus-within:ring-2 focus-within:ring-violet-400/10">
      <select
        className="h-9 w-full cursor-pointer appearance-none bg-transparent pl-3 pr-8 text-[12px] font-medium text-neutral-200 outline-none"
        onChange={(event) => {
          const selectedOption = options.find((option) => option.value === event.target.value);

          if (selectedOption) {
            onChange(selectedOption.value);
          }
        }}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-neutral-900 text-neutral-200">
            {tx(option.label)}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-600"
        size={14}
      />
    </div>
  );
}

export function TextInput({
  label,
  onChange,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: MotionDocPropValue;
}) {
  const { tx } = usePitchI18n();
  return (
    <Field label={label}>
      <input
        className="h-9 w-full rounded-xl border border-white/[0.055] bg-[#18181b] px-3 text-[12px] text-neutral-200 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-[border-color,background-color,box-shadow] placeholder:text-neutral-600 hover:border-white/[0.09] hover:bg-[#1b1b1e] focus:border-violet-300/35 focus:bg-[#1d1d20] focus:ring-2 focus:ring-violet-400/10"
        onChange={(event) => onChange(event.target.value)}
        placeholder={tx(placeholder)}
        type="text"
        value={value}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  onChange,
  placeholder,
  rows,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows: number;
  value: MotionDocPropValue;
}) {
  const { tx } = usePitchI18n();
  return (
    <Field label={label}>
      <textarea
        className="w-full resize-none rounded-xl border border-white/[0.055] bg-[#18181b] px-3 py-2.5 text-[12px] leading-relaxed text-neutral-200 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-[border-color,background-color,box-shadow] placeholder:text-neutral-600 hover:border-white/[0.09] hover:bg-[#1b1b1e] focus:border-violet-300/35 focus:bg-[#1d1d20] focus:ring-2 focus:ring-violet-400/10"
        onChange={(event) => onChange(event.target.value)}
        placeholder={tx(placeholder)}
        rows={rows}
        value={value}
      />
    </Field>
  );
}

export function NumberInput({
  max,
  min,
  onChange,
  placeholder,
  prefix,
  step,
  suffix,
  value
}: {
  max?: string;
  min: string;
  onChange: (value: number | "") => void;
  placeholder?: string;
  prefix?: React.ReactNode;
  step: string;
  suffix?: string;
  value: MotionDocPropValue;
}) {
  const [draftValue, setDraftValue] = useState(String(value ?? ""));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraftValue(String(value ?? ""));
    }
  }, [isFocused, value]);

  return (
    <div className="flex min-h-9 items-center overflow-hidden rounded-xl border border-white/[0.055] bg-[#18181b] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-[border-color,background-color,box-shadow] hover:border-white/[0.09] hover:bg-[#1b1b1e] focus-within:border-violet-300/35 focus-within:bg-[#1d1d20] focus-within:ring-2 focus-within:ring-violet-400/10">
      {prefix ? <span className="flex items-center pl-2.5 text-neutral-600">{prefix}</span> : null}
      <input
        className="h-9 w-full min-w-0 bg-transparent px-2.5 font-mono text-[12px] tabular-nums text-neutral-200 outline-none"
        inputMode="decimal"
        max={max}
        min={min}
        onBlur={() => {
          setIsFocused(false);
          setDraftValue(String(value ?? ""));
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          setDraftValue(nextValue);
          onChange(nextValue === "" ? "" : parseFloat(nextValue));
        }}
        onFocus={() => setIsFocused(true)}
        placeholder={placeholder}
        step={step}
        type="text"
        value={isFocused ? draftValue : value}
      />
      {suffix ? <span className="pr-2.5 font-mono text-[11px] text-neutral-600">{suffix}</span> : null}
    </div>
  );
}
