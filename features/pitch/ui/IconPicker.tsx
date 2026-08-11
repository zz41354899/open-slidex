"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Clock3, Search as SearchIcon, X } from "lucide-react";
import { iconCategoryLabels, iconMatchesQuery, iconsForCategory, type IconCategoryId } from "@/core/motion-doc/domain/iconCatalog";
import { isSlideXIconName, lucideIconLabels, lucideIconPaths, type SlideXIconName } from "@/core/motion-doc/domain/lucideIconRegistry";
import { loadRecentIcons, rememberRecentIcon } from "@/features/pitch/infrastructure/recentIconStorage";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type IconPickerProps = {
  value?: string;
  onChange: (icon: SlideXIconName | "") => void;
  mode?: "inspector" | "toolbox";
  onIconDragStart?: (event: DragEvent<HTMLButtonElement>, icon: SlideXIconName) => void;
};

export function IconPicker({ value = "", onChange, mode = "inspector", onIconDragStart }: IconPickerProps) {
  const { tx } = usePitchI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<IconCategoryId>(mode === "toolbox" ? "popular" : "all");
  const [recentIcons, setRecentIcons] = useState<SlideXIconName[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setRecentIcons(loadRecentIcons()), []);

  const filteredIcons = useMemo(() => {
    const source = query.trim() ? iconsForCategory("all", recentIcons) : iconsForCategory(category, recentIcons);
    return source.filter((name) => iconMatchesQuery(name, lucideIconLabels[name], query));
  }, [category, query, recentIcons]);

  const selectIcon = (name: SlideXIconName) => {
    rememberRecentIcon(name);
    setRecentIcons((current) => [name, ...current.filter((item) => item !== name)].slice(0, 12));
    onChange(name);
  };

  const selectedIcon = isSlideXIconName(value) ? value : null;
  const gridHeight = mode === "toolbox" ? "max-h-[244px]" : "max-h-52";
  const visibleCategoryIds = mode === "toolbox" ? (["all", "recent", "popular"] as const) : [];

  return (
    <div className={`flex min-w-0 flex-col ${mode === "toolbox" ? "gap-2" : "gap-2.5"}`}>
      <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950/70 px-2.5 py-2 transition focus-within:border-sky-500/50 focus-within:ring-1 focus-within:ring-sky-500/20">
        <SearchIcon size={13} className="shrink-0 text-neutral-500" />
        <input
          ref={searchRef}
          className="w-full bg-transparent text-[11px] text-neutral-100 outline-none placeholder:text-neutral-600"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setQuery("");
              searchRef.current?.blur();
            }
            if (event.key === "Enter" && filteredIcons[0]) selectIcon(filteredIcons[0]);
          }}
          placeholder={tx(mode === "toolbox" ? "Search icons" : "Search by name or idea…")}
          type="search"
          value={query}
        />
        {query ? <button aria-label={tx("Clear search")} className="text-neutral-500 hover:text-white" onClick={() => setQuery("")} type="button"><X size={12} /></button> : null}
      </div>

      {mode === "toolbox" ? <div className="flex gap-1 overflow-x-auto pb-0.5 custom-scrollbar">
        {visibleCategoryIds.map((categoryId) => {
          if (categoryId === "recent" && recentIcons.length === 0) return null;
          const active = !query && category === categoryId;
          return (
            <button
              className={`shrink-0 rounded-md px-2 py-1 text-[9px] font-medium transition ${active ? "bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/20" : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"}`}
              key={categoryId}
              onClick={() => { setCategory(categoryId); setQuery(""); }}
              type="button"
            >
              {categoryId === "recent" ? <Clock3 className="mr-1 inline" size={9} /> : null}{tx(iconCategoryLabels[categoryId])}
            </button>
          );
        })}
      </div> : null}

      <div className={`grid ${gridHeight} ${mode === "toolbox" ? "grid-cols-6" : "grid-cols-5"} gap-1.5 overflow-y-auto rounded-lg border border-neutral-800/80 bg-neutral-950/50 p-1.5 custom-scrollbar`}>
        {filteredIcons.map((name) => {
          const isSelected = value === name;
          return (
            <button
              aria-label={`${tx(mode === "toolbox" ? "Add" : "Use")} ${lucideIconLabels[name]} ${tx("icon")}`}
              className={`group flex aspect-square min-h-10 items-center justify-center rounded-md border transition-all ${isSelected ? "border-sky-400/50 bg-sky-500/15 text-sky-100" : "border-transparent text-neutral-400 hover:border-neutral-700 hover:bg-neutral-900 hover:text-white"}`}
              draggable={Boolean(onIconDragStart)}
              key={name}
              onClick={() => selectIcon(name)}
              onDragStart={(event) => onIconDragStart?.(event, name)}
              title={lucideIconLabels[name]}
              type="button"
            >
              <LucideIconPreview name={name} className="h-[18px] w-[18px] transition-transform group-hover:scale-110" />
            </button>
          );
        })}
        {filteredIcons.length === 0 ? (
          <div className={`${mode === "toolbox" ? "col-span-6" : "col-span-5"} flex flex-col items-center px-2 py-7 text-center text-[10px] text-neutral-500`}>
            <SearchIcon className="mb-2 opacity-50" size={18} />
            {tx("No matching icons")}
            <button className="mt-1 text-sky-400 hover:text-sky-300" onClick={() => { setQuery(""); setCategory("all"); }} type="button">{tx("Browse all icons")}</button>
          </div>
        ) : null}
      </div>
      {value && !selectedIcon ? <span className="text-[10px] leading-relaxed text-amber-400/80">{tx("This icon is not in the local export registry yet.")}</span> : null}
    </div>
  );
}

function LucideIconPreview({ name, className }: { name: SlideXIconName; className: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      {lucideIconPaths[name].map((path, index) => renderIconPath(path, `${name}-${index}`))}
    </svg>
  );
}

function renderIconPath(path: string, key: string) {
  const [shape, ...parts] = path.split(" ");
  if (shape === "circle") return <circle cx={parts[0]} cy={parts[1]} key={key} r={parts[2]} />;
  if (shape === "ellipse") return <ellipse cx={parts[0]} cy={parts[1]} key={key} rx={parts[2]} ry={parts[3]} />;
  if (shape === "rect") return <rect height={parts[3]} key={key} rx={parts[4]} ry={parts[5]} width={parts[2]} x={parts[0]} y={parts[1]} />;
  return <path d={shape === "path" ? parts.join(" ") : path} key={key} />;
}
