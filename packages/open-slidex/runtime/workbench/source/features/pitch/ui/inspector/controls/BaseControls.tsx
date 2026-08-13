import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Field as ShadcnField,
  Input,
  Label,
  NativeSelect as ShadcnNativeSelect,
  NativeSelectOption,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/common/ui/shadcnPrimitives";
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
    <ShadcnField className="flex min-w-0 flex-col gap-2">
      {label ? <Label className="text-[14px] font-medium tracking-[0.01em] text-neutral-500">{tx(label)}</Label> : null}
      {children}
    </ShadcnField>
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
      <ToggleGroup
        aria-label={tx(label)}
        className="flex min-h-9 w-full gap-1 overflow-x-auto rounded-xl border border-white/[0.055] bg-[#18181b] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] custom-scrollbar"
        onValueChange={(nextValue) => {
          if (nextValue) onChange(nextValue as T);
        }}
        spacing={1}
        type="single"
        value={value}
      >
        {options.map((option) => (
          <ToggleGroupItem
            className="h-auto min-h-7 w-auto min-w-0 flex-1 shrink rounded-lg px-2 py-1.5 text-[14px] font-medium text-neutral-500 outline-none transition-[background-color,color,box-shadow,transform] duration-150 hover:bg-white/[0.055] hover:text-neutral-200 focus-visible:border-transparent focus-visible:ring-1 focus-visible:ring-violet-300/60 active:scale-[0.98] data-[state=on]:bg-white data-[state=on]:text-[#17171a] data-[state=on]:shadow-[0_1px_5px_rgba(0,0,0,0.22)]"
            key={option.value}
            value={option.value}
          >
            <span className="truncate whitespace-nowrap">{tx(option.label)}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
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
      <ToggleGroup
        aria-label={tx(label)}
        className="flex min-h-9 w-full gap-1 rounded-xl border border-white/[0.055] bg-[#18181b] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]"
        onValueChange={(nextValue) => {
          if (nextValue) onChange(nextValue as T);
        }}
        spacing={1}
        type="single"
        value={value}
      >
        {options.map((option) => (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                aria-label={tx(option.label)}
                className="group relative h-7 w-auto min-w-0 flex-1 shrink rounded-lg px-1 text-neutral-600 outline-none transition-[background-color,color,box-shadow,transform] duration-150 hover:bg-white/[0.055] hover:text-neutral-200 focus-visible:border-transparent focus-visible:ring-1 focus-visible:ring-violet-300/60 active:scale-[0.96] data-[state=on]:bg-white data-[state=on]:text-[#17171a] data-[state=on]:shadow-[0_1px_5px_rgba(0,0,0,0.22)]"
                value={option.value}
              >
                <span className="scale-95 transition-transform duration-150 group-hover:scale-100">{option.icon}</span>
                <span className="sr-only">{tx(option.label)}</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="top">{tx(option.label)}</TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
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
    <div className="w-full [&>[data-slot=native-select-wrapper]]:w-full">
      <ShadcnNativeSelect
        className="h-9 w-full cursor-pointer rounded-xl border-white/[0.055] bg-[#18181b] pl-3 pr-8 text-[14px] font-medium text-neutral-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-[border-color,background-color,box-shadow] hover:border-white/[0.09] hover:bg-[#1b1b1e] focus-visible:border-violet-300/35 focus-visible:bg-[#1d1d20] focus-visible:ring-2 focus-visible:ring-violet-400/10 dark:bg-[#18181b] dark:hover:bg-[#1b1b1e] dark:focus-visible:bg-[#1d1d20]"
        onChange={(event) => {
          const selectedOption = options.find((option) => option.value === event.target.value);

          if (selectedOption) {
            onChange(selectedOption.value);
          }
        }}
        value={value}
      >
        {options.map((option) => (
          <NativeSelectOption className="bg-neutral-900 text-neutral-200" key={option.value} value={option.value}>
            {tx(option.label)}
          </NativeSelectOption>
        ))}
      </ShadcnNativeSelect>
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
      <Input
        className="h-9 rounded-xl border-white/[0.055] bg-[#18181b] px-3 text-[14px] text-neutral-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-[border-color,background-color,box-shadow] placeholder:text-neutral-600 hover:border-white/[0.09] hover:bg-[#1b1b1e] focus-visible:border-violet-300/35 focus-visible:bg-[#1d1d20] focus-visible:ring-2 focus-visible:ring-violet-400/10 dark:bg-[#18181b] dark:hover:bg-[#1b1b1e] dark:focus-visible:bg-[#1d1d20]"
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
        className="w-full resize-none rounded-xl border border-white/[0.055] bg-[#18181b] px-3 py-2.5 text-[14px] leading-relaxed text-neutral-200 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-[border-color,background-color,box-shadow] placeholder:text-neutral-600 hover:border-white/[0.09] hover:bg-[#1b1b1e] focus:border-violet-300/35 focus:bg-[#1d1d20] focus:ring-2 focus:ring-violet-400/10"
        onChange={(event) => onChange(event.target.value)}
        placeholder={tx(placeholder)}
        rows={rows}
        value={value}
      />
    </Field>
  );
}

export function NumberInput({
  "aria-label": ariaLabel,
  commitOnBlur = false,
  max,
  min,
  onChange,
  placeholder,
  prefix,
  showSteppers = false,
  step,
  suffix,
  value
}: {
  "aria-label"?: string;
  commitOnBlur?: boolean;
  max?: string;
  min: string;
  onChange: (value: number | "") => void;
  placeholder?: string;
  prefix?: React.ReactNode;
  showSteppers?: boolean;
  step: string;
  suffix?: string;
  value: MotionDocPropValue;
}) {
  const { tx } = usePitchI18n();
  const [draftValue, setDraftValue] = useState(String(value ?? ""));
  const [isFocused, setIsFocused] = useState(false);

  function adjustedValue(direction: -1 | 1) {
    const stepValue = Number(step) || 1;
    const currentValue = Number(isFocused ? draftValue : value);
    const fallback = Number(min) || 0;
    const lowerBound = Number(min);
    const upperBound = max === undefined ? Number.POSITIVE_INFINITY : Number(max);
    const precision = Math.max(0, (step.split(".")[1] ?? "").length);
    const nextValue = Math.min(
      Number.isFinite(upperBound) ? upperBound : Number.POSITIVE_INFINITY,
      Math.max(Number.isFinite(lowerBound) ? lowerBound : Number.NEGATIVE_INFINITY, (Number.isFinite(currentValue) ? currentValue : fallback) + direction * stepValue)
    );
    const roundedValue = Number(nextValue.toFixed(precision));
    setDraftValue(String(roundedValue));
    onChange(roundedValue);
  }

  useEffect(() => {
    if (!isFocused) {
      setDraftValue(String(value ?? ""));
    }
  }, [isFocused, value]);

  return (
    <div className="flex min-h-9 items-center overflow-hidden rounded-xl border border-white/[0.055] bg-[#18181b] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-[border-color,background-color,box-shadow] hover:border-white/[0.09] hover:bg-[#1b1b1e] focus-within:border-violet-300/35 focus-within:bg-[#1d1d20] focus-within:ring-2 focus-within:ring-violet-400/10">
      {prefix ? <span className="flex items-center pl-2.5 text-neutral-600">{prefix}</span> : null}
      {showSteppers ? (
        <button aria-label={tx("Decrease")} className="flex h-9 w-7 shrink-0 items-center justify-center text-neutral-500 hover:bg-white/[0.06] hover:text-white" onClick={() => adjustedValue(-1)} type="button"><Minus size={11} /></button>
      ) : null}
      <Input
        aria-label={ariaLabel}
        className="h-9 min-w-0 rounded-none border-0 bg-transparent px-2.5 font-mono text-[14px] tabular-nums text-neutral-200 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
        inputMode="decimal"
        max={max}
        min={min}
        onBlur={() => {
          if (commitOnBlur) {
            const nextValue = draftValue.trim();
            const parsedValue = Number(nextValue);
            if (nextValue === "") onChange("");
            else if (Number.isFinite(parsedValue)) onChange(parsedValue);
          }
          setIsFocused(false);
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          setDraftValue(nextValue);
          if (!commitOnBlur) onChange(nextValue === "" ? "" : parseFloat(nextValue));
        }}
        onFocus={() => setIsFocused(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            adjustedValue(event.key === "ArrowUp" ? 1 : -1);
            return;
          }
          if (commitOnBlur && event.key === "Enter") event.currentTarget.blur();
        }}
        placeholder={placeholder}
        step={step}
        type="text"
        value={isFocused ? draftValue : value}
      />
      {suffix ? <span className="pr-2.5 font-mono text-[14px] text-neutral-600">{suffix}</span> : null}
      {showSteppers ? (
        <button aria-label={tx("Increase")} className="flex h-9 w-7 shrink-0 items-center justify-center text-neutral-500 hover:bg-white/[0.06] hover:text-white" onClick={() => adjustedValue(1)} type="button"><Plus size={11} /></button>
      ) : null}
    </div>
  );
}
