"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent
} from "react";
import {
  hexColorValue,
  hexToHsv,
  hexToRgb,
  hsvToHex,
  rgbToHex,
  uniqueColors,
  type HsvColor,
  type RgbColor
} from "@/features/pitch/application/colorPalettes";
import { colorSwatchStyle } from "@/features/pitch/ui/inspector/color/colorSwatchStyle";
import { defaultColorPresets } from "@/features/pitch/ui/inspector/color/palettes";
import { useCustomSwatches } from "@/features/pitch/ui/inspector/color/useCustomSwatches";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type ColorPickerSurfaceProps = {
  compact?: boolean;
  label: string;
  onChange: (value: string) => void;
  presets?: readonly string[];
  value: string;
};

export function ColorPickerSurface({
  compact = false,
  label,
  onChange,
  presets = defaultColorPresets,
  value
}: ColorPickerSurfaceProps) {
  const { tx } = usePitchI18n();
  const { customSwatches } = useCustomSwatches();
  const resolvedHex = hexColorValue(value) ?? "#ffffff";
  const rgb = hexToRgb(resolvedHex);
  const [hsv, setHsv] = useState<HsvColor>(() => hexToHsv(resolvedHex));
  const hsvRef = useRef(hsv);
  const [hexDraft, setHexDraft] = useState<string>(resolvedHex);
  const resolvedPresets = uniqueColors([...customSwatches, ...presets]);

  useEffect(() => {
    setHexDraft(resolvedHex);
  }, [resolvedHex]);

  useEffect(() => {
    if (hsvToHex(hsvRef.current).toLowerCase() === resolvedHex.toLowerCase()) return;

    const nextHsv = hexToHsv(resolvedHex);
    hsvRef.current = nextHsv;
    setHsv(nextHsv);
  }, [resolvedHex]);

  function updateHsv(patch: Partial<HsvColor>) {
    const nextHsv = { ...hsvRef.current, ...patch };
    hsvRef.current = nextHsv;
    setHsv(nextHsv);
    onChange(hsvToHex(nextHsv));
  }

  function updateRgb(channel: keyof RgbColor, nextValue: string) {
    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed)) return;
    onChange(rgbToHex({ ...rgb, [channel]: parsed }));
  }

  function commitHexDraft() {
    const normalized = hexColorValue(hexDraft);
    if (normalized) {
      onChange(normalized);
      setHexDraft(normalized);
    } else {
      setHexDraft(resolvedHex);
    }
  }

  return (
    <div
      aria-label={`${label} ${tx("color controls")}`}
      className="space-y-3"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <ColorPlane hsv={hsv} onChange={updateHsv} />
      <HueSlider hue={hsv.h} onChange={(h) => updateHsv({ h })} />

      {!compact ? (
        <>
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 shrink-0 rounded-lg border border-white/15 shadow-inner" style={colorSwatchStyle(resolvedHex)} />
            <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-lg border border-white/[0.08] bg-black/30 focus-within:border-[#8ea5ff]/55">
              <span className="pl-2 font-mono text-[11px] text-neutral-600">HEX</span>
              <input
                aria-label={`${label} ${tx("hex value")}`}
                className="h-8 min-w-0 flex-1 bg-transparent px-2 font-mono text-[12px] uppercase text-neutral-200 outline-none"
                onBlur={commitHexDraft}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setHexDraft(nextValue);
                  const normalized = hexColorValue(nextValue);
                  if (normalized) onChange(normalized);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    commitHexDraft();
                    event.currentTarget.blur();
                  }
                }}
                value={hexDraft}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {(["r", "g", "b"] as const).map((channel) => (
              <label className="flex h-8 items-center rounded-lg border border-white/[0.08] bg-black/30 px-2 focus-within:border-[#8ea5ff]/55" key={channel}>
                <span className="font-mono text-[10px] uppercase text-neutral-600">{channel}</span>
                <input
                  aria-label={`${label} ${channel.toUpperCase()}`}
                  className="min-w-0 flex-1 bg-transparent text-right font-mono text-[11px] text-neutral-200 outline-none"
                  max={255}
                  min={0}
                  onChange={(event) => updateRgb(channel, event.target.value)}
                  type="number"
                  value={rgb[channel]}
                />
              </label>
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-md border border-white/15" style={{ backgroundColor: resolvedHex }} />
          <span className="font-mono text-[11px] uppercase text-neutral-400">{resolvedHex}</span>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{tx("Palette")}</p>
        <div className="grid grid-cols-8 gap-1.5">
          {resolvedPresets.map((preset) => (
            <button
              aria-label={`${tx("Use color")} ${preset}`}
              className={`aspect-square min-h-5 rounded-md border transition-transform hover:scale-110 ${
                resolvedHex.toLowerCase() === preset.toLowerCase() ? "border-white ring-1 ring-white/25" : "border-white/15"
              }`}
              key={preset}
              onClick={() => onChange(preset)}
              onPointerDown={(event) => event.preventDefault()}
              style={{ background: preset }}
              type="button"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ColorPlane({
  hsv,
  onChange
}: {
  hsv: HsvColor;
  onChange: (patch: Partial<HsvColor>) => void;
}) {
  const { locale, tx } = usePitchI18n();
  const ref = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function update(event: PointerEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    onChange({
      s: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
      v: 1 - Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1)
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.05 : 0.01;
    const patch = event.key === "ArrowLeft"
      ? { s: clampUnit(hsv.s - step) }
      : event.key === "ArrowRight"
        ? { s: clampUnit(hsv.s + step) }
        : event.key === "ArrowDown"
          ? { v: clampUnit(hsv.v - step) }
          : event.key === "ArrowUp"
            ? { v: clampUnit(hsv.v + step) }
            : null;

    if (!patch) return;
    event.preventDefault();
    event.stopPropagation();
    onChange(patch);
  }

  return (
    <div
      aria-label={tx("Saturation and brightness")}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(hsv.v * 100)}
      aria-valuetext={locale === "zh-TW"
        ? `飽和度 ${Math.round(hsv.s * 100)}%，亮度 ${Math.round(hsv.v * 100)}%`
        : `Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
      className={`relative h-32 touch-none overflow-hidden rounded-lg border outline-none transition-[border-color,box-shadow] ${
        isDragging
          ? "cursor-grabbing border-white/55 shadow-[0_0_0_3px_rgba(255,255,255,0.08)]"
          : "cursor-crosshair border-white/15 hover:border-white/30 focus-visible:border-white/50 focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.08)]"
      }`}
      data-dragging={isDragging ? "true" : "false"}
      onKeyDown={handleKeyDown}
      onLostPointerCapture={() => setIsDragging(false)}
      onPointerCancel={() => setIsDragging(false)}
      onPointerDown={(event) => {
        event.preventDefault();
        setIsDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event);
      }}
      onPointerUp={() => setIsDragging(false)}
      ref={ref}
      role="slider"
      style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
      tabIndex={0}
    >
      <span
        className="absolute inset-0"
        style={{ backgroundImage: "linear-gradient(to right, rgb(255 255 255), rgb(255 255 255 / 0))" }}
      />
      <span
        className="absolute inset-0"
        style={{ backgroundImage: "linear-gradient(to top, rgb(0 0 0), rgb(0 0 0 / 0))" }}
      />
      <span
        className={`pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-transparent shadow-[0_1px_8px_rgba(0,0,0,0.9)] transition-transform ${
          isDragging ? "scale-110" : "scale-100"
        }`}
        style={{
          left: `clamp(10px, ${hsv.s * 100}%, calc(100% - 10px))`,
          top: `clamp(10px, ${(1 - hsv.v) * 100}%, calc(100% - 10px))`
        }}
      />
    </div>
  );
}

function HueSlider({ hue, onChange }: { hue: number; onChange: (value: number) => void }) {
  const { locale, tx } = usePitchI18n();
  const ref = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function update(event: PointerEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    onChange(Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1) * 360);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 10 : 1;
    const nextHue = event.key === "ArrowLeft" || event.key === "ArrowDown"
      ? Math.max(hue - step, 0)
      : event.key === "ArrowRight" || event.key === "ArrowUp"
        ? Math.min(hue + step, 360)
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? 360
            : null;

    if (nextHue === null) return;
    event.preventDefault();
    event.stopPropagation();
    onChange(nextHue);
  }

  return (
    <div
      aria-label={tx("Hue")}
      aria-valuemax={360}
      aria-valuemin={0}
      aria-valuenow={Math.round(hue)}
      aria-valuetext={locale === "zh-TW" ? `${Math.round(hue)} 度` : `${Math.round(hue)} degrees`}
      className={`relative h-7 touch-none rounded-lg outline-none transition-[background-color,box-shadow] ${
        isDragging
          ? "cursor-grabbing bg-white/[0.08] shadow-[0_0_0_3px_rgba(255,255,255,0.08)]"
          : "cursor-ew-resize hover:bg-white/[0.05] focus-visible:bg-white/[0.06] focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.08)]"
      }`}
      data-dragging={isDragging ? "true" : "false"}
      onKeyDown={handleKeyDown}
      onLostPointerCapture={() => setIsDragging(false)}
      onPointerCancel={() => setIsDragging(false)}
      onPointerDown={(event) => {
        event.preventDefault();
        setIsDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event);
      }}
      onPointerUp={() => setIsDragging(false)}
      ref={ref}
      role="slider"
      tabIndex={0}
    >
      <span className="pointer-events-none absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full border border-white/15 bg-[linear-gradient(90deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.55)]" />
      <span
        className={`pointer-events-none absolute top-1/2 h-6 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#111111] shadow-[0_1px_8px_rgba(0,0,0,0.9)] transition-transform ${
          isDragging ? "scale-110" : "scale-100"
        }`}
        style={{ left: `clamp(7px, ${hue / 360 * 100}%, calc(100% - 7px))` }}
      />
    </div>
  );
}

function clampUnit(value: number) {
  return Math.min(Math.max(value, 0), 1);
}
