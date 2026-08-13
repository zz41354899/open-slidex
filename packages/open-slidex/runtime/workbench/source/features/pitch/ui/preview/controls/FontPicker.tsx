
import { Check, ChevronDown, Clock3, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { googleFonts } from "@/features/pitch/application/googleFonts";
import {
  loadRecentFonts,
  recentFontLimit,
  rememberRecentFont
} from "@/features/pitch/infrastructure/recentFontStorage";
import { useDynamicFont } from "@/features/pitch/ui/hooks/useDynamicFont";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/common/ui/shadcnPrimitives";

type FontPickerProps = {
  displayValue?: string;
  onChange: (font: string) => void;
  preserveTextSelection?: boolean;
  value: string;
};

function FontPreviewItem({ font, isSelected, onClick }: { font: string; isSelected: boolean; onClick: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useDynamicFont(isVisible ? font : null);

  return (
    <button
      ref={ref}
      className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
        isSelected ? "bg-white text-black" : "text-neutral-300 hover:bg-white/[0.08] hover:text-white"
      }`}
      onClick={onClick}
      type="button"
      style={isVisible ? { fontFamily: `"${font}", sans-serif` } : {}}
    >
      <span className={`grid h-7 w-8 shrink-0 place-items-center rounded-md text-[13px] ${isSelected ? "bg-black/10" : "bg-white/[0.05] text-neutral-400 group-hover:text-white"}`}>Aa</span>
      <span className="min-w-0 flex-1 truncate">{font}</span>
      {isSelected && <Check className="shrink-0" size={14} />}
    </button>
  );
}

export function FontPicker({ displayValue, onChange, preserveTextSelection = false, value }: FontPickerProps) {
  const { tx } = usePitchI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [recentFonts, setRecentFonts] = useState<string[]>([]);

  useEffect(() => setRecentFonts(loadRecentFonts()), []);

  const filteredFonts = useMemo(() => {
    const s = search.toLowerCase();
    return googleFonts.filter((f) => f.toLowerCase().includes(s));
  }, [search]);
  const listedFonts = search.trim()
    ? filteredFonts
    : filteredFonts.filter((font) => !recentFonts.includes(font));

  const handleSelect = (font: string) => {
    if (font) {
      rememberRecentFont(font);
      setRecentFonts((current) => [font, ...current.filter((item) => item !== font)].slice(0, recentFontLimit));
    }
    onChange(font);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          className="flex w-[112px] shrink-0 items-center justify-between gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-neutral-200 outline-none transition-colors hover:bg-white/[0.08] focus-visible:ring-1 focus-visible:ring-white/40"
          onPointerDown={(event) => event.preventDefault()}
          title={tx("Font Family")}
          type="button"
        >
          <span className="truncate">{displayValue ?? (value || tx("Default Font"))}</span>
          <ChevronDown className="shrink-0 ml-1 text-neutral-500" size={14} />
        </button>
      </PopoverTrigger>
        <PopoverContent
          align="start"
          className="z-[100] flex w-[280px] flex-col overflow-hidden rounded-xl border border-white/[0.1] bg-[#17171a] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.58)] animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95"
          data-text-edit-control={preserveTextSelection ? "" : undefined}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          sideOffset={8}
        >
          <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">{tx("Font family")}</div>
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 py-2 focus-within:ring-1 focus-within:ring-white/20">
            <Search className="text-neutral-500" size={14} />
            <input
              className="w-full bg-transparent text-[12px] text-neutral-200 outline-none placeholder:text-neutral-500"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={tx("Search fonts...")}
              value={search}
            />
          </div>
          <div className="custom-scrollbar mt-1.5 max-h-[300px] overflow-y-auto">
            <button
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[12px] transition-colors ${
                value === "" ? "bg-white text-black" : "text-neutral-300 hover:bg-white/[0.08] hover:text-white"
              }`}
              onClick={() => handleSelect("")}
              type="button"
            >
              <span className={`grid h-7 w-8 place-items-center rounded-md text-[13px] ${value === "" ? "bg-black/10" : "bg-white/[0.05] text-neutral-400"}`}>Aa</span>
              <span className="flex-1">{tx("Default Font")}</span>
              {value === "" && <Check size={14} />}
            </button>
            {!search.trim() && recentFonts.length > 0 ? (
              <>
                <div className="flex items-center gap-1.5 px-2.5 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                  <Clock3 size={10} />
                  {tx("Recently used")}
                </div>
                {recentFonts.map((font) => (
                  <FontPreviewItem
                    key={`recent-${font}`}
                    font={font}
                    isSelected={value === font}
                    onClick={() => handleSelect(font)}
                  />
                ))}
                <div className="mx-2 my-1 h-px bg-white/[0.07]" />
              </>
            ) : null}
            {listedFonts.map((font) => (
              <FontPreviewItem
                key={font}
                font={font}
                isSelected={value === font}
                onClick={() => handleSelect(font)}
              />
            ))}
            {listedFonts.length === 0 && recentFonts.length === 0 && (
              <div className="px-2 py-3 text-center text-[12px] text-neutral-500">
                {tx("No fonts found.")}
              </div>
            )}
          </div>
        </PopoverContent>
    </Popover>
  );
}
