"use client";

import * as Popover from "@radix-ui/react-popover";
import * as Toolbar from "@radix-ui/react-toolbar";
import { Check, ChevronDown, Type } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { numberValue } from "@/core/motion-doc/domain/frame";
import type { MotionDocTextBlock } from "@/core/motion-doc/domain/motionDocTypes";
import {
  MOTION_DOC_FONT_SIZES,
  motionDocDefaultFontSize
} from "@/core/motion-doc/domain/typography";
import { CompactColorPanel } from "@/features/pitch/ui/inspector/color/CompactColorPanel";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

export type TextPreset = {
  fontSize: number;
  fontWeight: number;
  label: string;
  lineHeight: number;
  role: "title" | "content";
  sample: string;
};

const textPresets: TextPreset[] = [
  { fontSize: MOTION_DOC_FONT_SIZES.display, fontWeight: 700, label: "Display", lineHeight: 1, role: "title", sample: "Large statement" },
  { fontSize: MOTION_DOC_FONT_SIZES.heading, fontWeight: 650, label: "Heading", lineHeight: 1.08, role: "title", sample: "Section heading" },
  { fontSize: MOTION_DOC_FONT_SIZES.lead, fontWeight: 560, label: "Lead", lineHeight: 1.28, role: "content", sample: "Introductory copy" },
  { fontSize: MOTION_DOC_FONT_SIZES.body, fontWeight: 400, label: "Body", lineHeight: 1.45, role: "content", sample: "Comfortable reading" },
  { fontSize: MOTION_DOC_FONT_SIZES.caption, fontWeight: 500, label: "Caption", lineHeight: 1.35, role: "content", sample: "Details and notes" }
];

export function TextOptionRow({ children, label }: { children: ReactNode; label: string }) {
  const { tx } = usePitchI18n();
  return (
    <div className="flex h-9 items-center justify-between px-1.5">
      <span className="text-[11px] text-neutral-400">{tx(label)}</span>
      <div className="flex items-center gap-0.5">{children}</div>
    </div>
  );
}

export function TextColorPopover({
  color,
  onChange
}: {
  color: string;
  onChange: (value: string) => void;
}) {
  const { tx } = usePitchI18n();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        aria-expanded={isOpen}
        aria-label={tx("Text color")}
        className="group flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-white/[0.08]"
        onClick={() => setIsOpen((current) => !current)}
        onPointerDown={(event) => event.preventDefault()}
        title={tx("Text color")}
        type="button"
      >
        <span className="h-4 w-4 rounded-[4px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]" style={{ backgroundColor: color }} />
      </button>
      {isOpen ? (
        <div
          className="absolute bottom-[calc(100%+8px)] right-0 z-[130] max-h-[min(360px,calc(100vh-32px))] w-[250px] overflow-y-auto rounded-xl border border-white/10 bg-[#17171a] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.58)]"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <CompactColorPanel label={tx("Text color")} onChange={onChange} value={color} />
        </div>
      ) : null}
    </div>
  );
}

export function TextWeightInput({
  onCommit,
  value
}: {
  onCommit: (value: number) => void;
  value: number | undefined;
}) {
  const { tx } = usePitchI18n();
  const [draft, setDraft] = useState(() => String(value ?? ""));

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  function commit() {
    const parsedWeight = Number(draft);
    if (!Number.isFinite(parsedWeight) || draft.trim() === "") {
      setDraft(String(value ?? ""));
      return;
    }

    const nextWeight = Math.min(Math.max(Math.round(parsedWeight / 50) * 50, 100), 900);
    setDraft(String(nextWeight));
    if (nextWeight !== value) onCommit(nextWeight);
  }

  return (
    <input
      aria-label={tx("Text weight")}
      className="h-7 w-16 rounded-md bg-black/25 px-2 text-center font-mono text-[11px] text-neutral-200 outline-none focus:ring-1 focus:ring-white/25"
      max={900}
      min={100}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setDraft(String(value ?? ""));
          event.currentTarget.blur();
        }
      }}
      step={50}
      type="number"
      value={draft}
    />
  );
}

export function TextPresetPicker({
  block,
  onSelect,
  side = "bottom"
}: {
  block: MotionDocTextBlock;
  onSelect: (preset: TextPreset) => void;
  side?: "top" | "bottom";
}) {
  const { tx } = usePitchI18n();
  const fontSize = numberValue(block.props.fontSize) ?? motionDocDefaultFontSize(block.type);
  const activePreset = textPresets.find((preset) => preset.fontSize === fontSize);

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Toolbar.Button
          aria-label={tx("Text styles")}
          className="flex h-7 w-[132px] shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-neutral-300 outline-none transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:ring-1 focus-visible:ring-white/40"
          title={tx("Text styles")}
        >
          <Type className="shrink-0 text-neutral-500" size={13} />
          <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left">
            {tx(activePreset?.label ?? "Style")}
          </span>
          <ChevronDown className="shrink-0 text-neutral-500" size={12} />
        </Toolbar.Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          avoidCollisions
          collisionPadding={12}
          className="z-[110] w-[208px] overflow-hidden rounded-xl border border-white/[0.09] bg-[#17171a]/[0.98] p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          onCloseAutoFocus={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => event.preventDefault()}
          side={side}
          sideOffset={8}
        >
          <div className="flex h-7 items-center gap-1.5 px-2 text-[10px] font-medium text-neutral-500">
            <Type aria-hidden size={11} />
            {tx("Text styles")}
          </div>
          <div className="space-y-0.5 border-t border-white/[0.06] pt-1">
            {textPresets.map((preset) => {
              const active = activePreset?.label === preset.label;
              return (
                <Popover.Close asChild key={preset.label}>
                  <button
                    aria-pressed={active}
                    className={`group flex min-h-8 w-full items-center gap-2 rounded-lg px-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/30 ${
                      active
                        ? "bg-white/[0.10] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                        : "text-neutral-300 hover:bg-white/[0.055] hover:text-white"
                    }`}
                    onClick={() => onSelect(preset)}
                    type="button"
                  >
                    <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[11px] font-medium">
                      {tx(preset.label)}
                    </span>
                    <span
                      className={`shrink-0 font-mono text-[9px] tabular-nums ${
                        active ? "text-neutral-300" : "text-neutral-600 group-hover:text-neutral-500"
                      }`}
                    >
                      {preset.fontSize} pt
                    </span>
                    <span
                      aria-hidden
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                        active ? "bg-white text-black" : "text-transparent"
                      }`}
                    >
                      <Check size={10} strokeWidth={3} />
                    </span>
                  </button>
                </Popover.Close>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
