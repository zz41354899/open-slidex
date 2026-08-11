"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { MotionDocPropValue } from "@/core/motion-doc/domain/motionDocTypes";
import { Field } from "@/features/pitch/ui/inspector/controls/BaseControls";
import { ColorActionBar } from "@/features/pitch/ui/inspector/color/ColorActionBar";
import { colorSwatchStyle } from "@/features/pitch/ui/inspector/color/colorSwatchStyle";
import { ColorPickerSurface } from "@/features/pitch/ui/inspector/color/ColorPickerSurface";
import { defaultColorPresets } from "@/features/pitch/ui/inspector/color/palettes";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

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
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const colorValue = String(value ?? "");
  const resolvedValue = colorValue || displayValue || placeholder;
  const swatchStyle = colorSwatchStyle(resolvedValue);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function updatePopoverPosition() {
      const rect = buttonRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const margin = 12;
      const width = Math.min(288, window.innerWidth - margin * 2);
      const left = Math.min(Math.max(rect.right - width, margin), Math.max(window.innerWidth - width - margin, margin));
      const top = window.innerHeight - rect.bottom < 330
        ? Math.max(margin, rect.top - 334)
        : rect.bottom + 8;

      setPopoverStyle({
        left,
        maxHeight: window.innerHeight - margin * 2,
        overflowY: "auto",
        position: "fixed",
        top,
        width,
        zIndex: 1000
      });
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <Field label={label}>
      <div>
        <button
          aria-expanded={isOpen}
          className="flex w-full items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.06] focus-visible:ring-1 focus-visible:ring-white/[0.12]"
          onClick={() => setIsOpen((current) => !current)}
          ref={buttonRef}
          type="button"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="h-4 w-4 shrink-0 rounded-[4px] border border-white/20 shadow-inner" style={swatchStyle} />
            <span className="truncate font-mono text-[13px] text-neutral-200">{colorValue || displayValue || tx("Default")}</span>
          </span>
          <span className="text-[12px] text-neutral-500">{tx(isOpen ? "Close" : "Edit")}</span>
        </button>

        {isOpen && typeof document !== "undefined" ? createPortal(
          <div
            className="rounded-xl border border-neutral-700 bg-[#111111] p-3.5 shadow-2xl shadow-black/60"
            ref={panelRef}
            style={popoverStyle}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-300">{tx(label)}</span>
            </div>
            <ColorPickerSurface
              label={tx(label)}
              onChange={onChange}
              presets={presets}
              value={resolvedValue}
            />
            <ColorActionBar
              label={tx(label)}
              onClear={() => onChange("")}
              onPick={onChange}
              onTransparent={() => onChange("transparent")}
            />
          </div>,
          document.body
        ) : null}
      </div>
    </Field>
  );
}
