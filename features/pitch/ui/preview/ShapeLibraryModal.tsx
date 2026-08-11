"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { shapeCategories, shapeCategoryLabels, shapePresets, type ShapeCategory, type ShapePreset } from "@/core/motion-doc/domain/shapeCatalog";
import type { AddBlockOptions } from "@/features/pitch/application/motionDocCommands";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import type { AddBlockType } from "@/features/pitch/ui/pitchOptions";

export function ShapeLibraryModal({ onAddTool, onClose }: {
  onAddTool: (type: AddBlockType, options?: AddBlockOptions) => void;
  onClose: () => void;
}) {
  const { tx, txAddLabel } = usePitchI18n();
  const [category, setCategory] = useState<ShapeCategory>("essential");
  const sectionRefs = useRef<Partial<Record<ShapeCategory, HTMLElement | null>>>({});

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function goToCategory(nextCategory: ShapeCategory) {
    setCategory(nextCategory);
    sectionRefs.current[nextCategory]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div aria-label={tx("Shape library")} aria-modal="true" className="flex h-[min(760px,calc(100dvh-3rem))] w-full max-w-[1040px] overflow-hidden rounded-2xl border border-white/10 bg-black text-white shadow-[0_32px_100px_rgba(0,0,0,.8)]" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <nav className="w-48 shrink-0 border-r border-white/[0.08] p-3 pt-5">
          <div className="mb-5 px-3"><h2 className="text-xl font-semibold tracking-[-.025em]">{tx("Shapes")}</h2><p className="mt-1 text-xs text-neutral-500">{tx("Choose a shape to add.")}</p></div>
          {shapeCategories.map((item) => (
            <button className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${category === item ? "bg-white/[0.1] text-white" : "text-neutral-400 hover:bg-white/[0.05] hover:text-white"}`} key={item} onClick={() => goToCategory(item)} type="button">
              {tx(shapeCategoryLabels[item])}
            </button>
          ))}
        </nav>
        <section className="custom-scrollbar min-w-0 flex-1 overflow-y-auto scroll-smooth p-5">
          <header className="sticky top-0 z-10 -mx-1 mb-2 flex items-center justify-end bg-gradient-to-b from-black via-black to-transparent px-1 pb-5">
            <button aria-label={tx("Close shape library")} className="rounded-lg p-2 text-neutral-500 transition hover:bg-white/[0.06] hover:text-white" onClick={onClose} type="button"><X size={16} /></button>
          </header>
          {shapeCategories.map((item) => (
            <section className="scroll-mt-16 pb-9" key={item} ref={(node) => { sectionRefs.current[item] = node; }}>
              <h2 className="mb-4 text-sm font-semibold text-neutral-200">{tx(shapeCategoryLabels[item])}</h2>
              <div className={`grid gap-3 ${item === "lines" ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3 sm:grid-cols-4"}`}>
                {shapePresets.filter((preset) => preset.category === item).map((preset) => {
                  const label = tx(preset.label);
                  return <ShapePresetButton addLabel={txAddLabel(label)} compact={item === "lines"} key={preset.id} label={label} onSelect={() => onAddTool("ShapeRectangle", { props: { ...preset.props, preset: preset.id } })} preset={preset} />;
                })}
              </div>
            </section>
          ))}
        </section>
      </div>
    </div>
  );
}

function ShapePresetButton({ addLabel, compact = false, label, onSelect, preset }: { addLabel: string; compact?: boolean; label: string; onSelect: () => void; preset: ShapePreset }) {
  if (compact) {
    return (
      <button aria-label={addLabel} className="group flex h-14 items-center justify-center rounded-lg px-1 text-neutral-400 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-95" onClick={onSelect} title={label} type="button">
        <ShapePreview preset={preset} />
      </button>
    );
  }

  return (
    <button aria-label={addLabel} className="group min-h-32 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] text-neutral-400 transition duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-[#0e0e0e] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[.985]" onClick={onSelect} title={label} type="button">
      <span className="flex h-24 items-center justify-center px-3"><ShapePreview preset={preset} /></span>
      <span className="flex items-center justify-between border-t border-white/10 px-3 py-2.5 text-left"><span className="truncate text-[11px] font-medium text-neutral-300 transition group-hover:text-white">{label}</span><ArrowUpRight className="shrink-0 text-neutral-600 transition group-hover:text-neutral-300" size={12} /></span>
    </button>
  );
}

function ShapePreview({ preset }: { preset: ShapePreset }) {
  const shape = String(preset.props.shape);
  const fill = String(preset.props.fill);
  const stroke = String(preset.props.stroke);
  const previewStroke = shape === "line" && isDarkPreviewColor(stroke) ? "#d4d4d8" : stroke;
  const dashed = preset.props.lineStyle === "dashed" ? "7 5" : preset.props.lineStyle === "dotted" ? "1 5" : undefined;
  if (shape === "line") { const isPlain = !preset.props.arrowStart && !preset.props.arrowEnd; return <svg className="h-7 w-20 overflow-visible" viewBox="0 0 80 20"><g stroke={previewStroke} strokeLinecap={isPlain && !dashed ? "butt" : "round"} strokeLinejoin="round" strokeWidth="2"><path d={isPlain ? "M0 10H80" : "M3 10H77"} fill="none" strokeDasharray={dashed} />{preset.props.arrowStart === "arrow" ? <path d="M3 10l8-6v12Z" fill={previewStroke} stroke="none" /> : null}{preset.props.arrowEnd === "arrow" ? <path d="M77 10l-8-6v12Z" fill={previewStroke} stroke="none" /> : null}{preset.props.arrowStart === "circle" ? <circle cx="4" cy="10" fill={previewStroke} r="3" stroke="none" /> : null}{preset.props.arrowEnd === "circle" ? <circle cx="76" cy="10" fill={previewStroke} r="3" stroke="none" /> : null}{preset.props.arrowStart === "bar" ? <path d="M3 4v12" /> : null}{preset.props.arrowEnd === "bar" ? <path d="M77 4v12" /> : null}</g></svg>; }
  const paths: Record<string, string> = { arrow: "M5 15h38V5l28 15-28 15V25H5Z", triangle: "M40 1L79 55H1Z", diamond: "M40 3L75 20 40 37 5 20Z", star: "M40 3l9 11 15-2-4 14 9 11-15 1-14 9-9-9-15-1 9-11-4-14 15 2Z", chevron: "M7 5h51l15 15-15 15H7l14-15Z", hexagon: "M15 5h50l10 15-10 15H15L5 20Z", parallelogram: "M18 5h57L62 35H5Z", corner: "M8 5h55l12 12v18H8Z" };
  return <svg className="h-14 w-20" viewBox="0 0 80 56">{shape === "circle" ? <circle cx="40" cy="28" fill={fill} r="21" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" /> : shape === "rectangle" ? <rect fill={fill} height="44" rx={Number(preset.props.radius) > 0 ? 12 : 0} stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" width="62" x="9" y="6" /> : <path d={paths[shape] ?? paths.triangle} fill={fill} stroke={stroke} strokeLinejoin="round" strokeWidth="2" transform={shape === "triangle" ? undefined : "translate(0 8)"} vectorEffect="non-scaling-stroke" />}</svg>;
}

function isDarkPreviewColor(color: string) {
  const normalized = color.trim().toLowerCase();
  if (normalized === "black") return true;
  const match = normalized.match(/^#([0-9a-f]{6})$/);
  if (!match) return false;
  const value = Number.parseInt(match[1], 16);
  const red = value >> 16;
  const green = value >> 8 & 255;
  const blue = value & 255;
  return red * 0.2126 + green * 0.7152 + blue * 0.0722 < 90;
}
