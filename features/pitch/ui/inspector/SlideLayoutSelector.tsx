"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ChevronDown } from "lucide-react";
import { slideLayouts } from "@/core/motion-doc/presets/templates/slideLayouts";
import { stripNonLocalMotionDocMedia } from "@/core/motion-doc/application/localMediaPolicy";
import { createPortal } from "react-dom";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type SlideLayoutSelectorProps = {
  localAssetsOnly?: boolean;
  onAddLayout: (layoutSource: string, layoutId: string) => void;
};

export function SlideLayoutSelector({ localAssetsOnly = false, onAddLayout }: SlideLayoutSelectorProps) {
  const { tx } = usePitchI18n();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="flex w-full items-center justify-between rounded-xl border border-white/[0.05] bg-[#020202] px-3.5 py-2.5 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.03)] transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-white/[0.1] focus-within:border-white/[0.2] focus-within:ring-1 focus-within:ring-white/[0.1]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-12 overflow-hidden rounded-[4px] border border-white/10 bg-white shadow-sm flex items-center justify-center">
            <LayoutThumbnail layoutId="blank" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[10px] font-bold text-neutral-500 mb-0.5">{tx("Add new slide")}</span>
            <span className="text-sm font-semibold text-neutral-200">{tx("Choose Layout")}</span>
          </div>
        </div>
        <ChevronDown size={14} className="text-neutral-400" />
      </button>

      {isOpen && <SlideLayoutsPopover localAssetsOnly={localAssetsOnly} onAddLayout={onAddLayout} onClose={() => setIsOpen(false)} buttonRef={buttonRef} />}
    </div>
  );
}

function SlideLayoutsPopover({
  onClose,
  localAssetsOnly,
  onAddLayout,
  buttonRef
}: {
  onClose: () => void;
  localAssetsOnly: boolean;
  onAddLayout: (source: string, id: string) => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  const { locale, tx } = usePitchI18n();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, buttonRef]);

  // Calculate position to right or left depending on space. For this case we can just center it on the screen or position relative to button.
  // The user's image shows a big floating window.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[bubble-appear_0.2s_ease-out]">
      <div
        ref={popoverRef}
        className="relative flex flex-col w-full max-w-[800px] max-h-[80vh] overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#1a1a1a]/95 backdrop-blur-3xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_1px_0_rgba(255,255,255,0.15)]"
      >
        <div className="flex items-center justify-center px-6 py-4 border-b border-white/[0.05]">
          <h2 className="text-[13px] font-semibold text-neutral-200">{tx("Choose Layout")}</h2>
          <button aria-label={locale === "zh-TW" ? "關閉版面選擇器" : "Close layout selector"} onClick={onClose} className="absolute right-4 top-4 text-neutral-400 hover:text-white transition" type="button">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-6 custom-scrollbar">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {slideLayouts.map((layout) => (
              <button
                key={layout.id}
                type="button"
                className="group flex flex-col gap-2 items-center text-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer outline-none"
                onClick={() => {
                  const source = localAssetsOnly ? stripNonLocalMotionDocMedia(layout.source) : layout.source;
                  onAddLayout(source, layout.id);
                  onClose();
                }}
              >
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/[0.1] bg-white shadow-md group-hover:border-[#0ea5e9]/50 group-hover:shadow-[0_0_20px_-5px_rgba(14,165,233,0.5)]">
                  <LayoutThumbnail layoutId={layout.id} />
                </div>
                <span className="text-xs font-semibold text-neutral-300 group-hover:text-white transition-colors">{tx(layout.name)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

type ThumbnailPrimitiveProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

function Block({ className, style }: ThumbnailPrimitiveProps) {
  return <div className={`absolute rounded-sm ${className ?? ""}`} style={style} />;
}

function TextLine({ className, style }: ThumbnailPrimitiveProps) {
  return <div className={`absolute rounded-full bg-black/80 ${className ?? ""}`} style={style} />;
}

function ImgBlock({ className, style, children }: ThumbnailPrimitiveProps) {
  return (
    <div className={`absolute overflow-hidden rounded-[4px] bg-neutral-300 ${className ?? ""}`} style={style}>
      {children ?? <div className="h-full w-full bg-gradient-to-br from-neutral-200 to-neutral-400" />}
    </div>
  );
}

function LayoutThumbnail({ layoutId }: { layoutId: string }) {

  switch (layoutId) {
    case "title":
      return (
        <div className="w-full h-full relative">
          <TextLine className="w-[60%] h-[12%] left-[20%] top-[40%]" />
        </div>
      );
    case "title-photo":
      return (
        <div className="w-full h-full relative">
          <TextLine className="w-[30%] h-[10%] left-[10%] top-[45%]" />
          <ImgBlock className="w-[40%] h-[80%] left-[50%] top-[10%]" />
        </div>
      );
    case "title-alt-photo":
      return (
        <div className="w-full h-full relative">
          <ImgBlock className="w-[40%] h-[80%] left-[10%] top-[10%]" />
          <TextLine className="w-[30%] h-[10%] left-[60%] top-[45%]" />
        </div>
      );
    case "title-bullets":
      return (
        <div className="w-full h-full relative">
          <TextLine className="w-[40%] h-[8%] left-[10%] top-[15%]" />
          <TextLine className="w-[50%] h-[4%] left-[15%] top-[40%]" />
          <Block className="w-[1.5%] h-[4%] left-[10%] top-[40%] rounded-full bg-black/60" />
          <TextLine className="w-[40%] h-[4%] left-[15%] top-[55%]" />
          <Block className="w-[1.5%] h-[4%] left-[10%] top-[55%] rounded-full bg-black/60" />
          <TextLine className="w-[60%] h-[4%] left-[15%] top-[70%]" />
          <Block className="w-[1.5%] h-[4%] left-[10%] top-[70%] rounded-full bg-black/60" />
        </div>
      );
    case "bullets":
      return (
        <div className="w-full h-full relative">
          <TextLine className="w-[50%] h-[5%] left-[15%] top-[30%]" />
          <Block className="w-[2%] h-[5%] left-[10%] top-[30%] rounded-full bg-black/60" />
          <TextLine className="w-[40%] h-[5%] left-[15%] top-[50%]" />
          <Block className="w-[2%] h-[5%] left-[10%] top-[50%] rounded-full bg-black/60" />
          <TextLine className="w-[60%] h-[5%] left-[15%] top-[70%]" />
          <Block className="w-[2%] h-[5%] left-[10%] top-[70%] rounded-full bg-black/60" />
        </div>
      );
    case "title-bullets-photo":
      return (
        <div className="w-full h-full relative">
          <TextLine className="w-[30%] h-[8%] left-[8%] top-[10%]" />
          <TextLine className="w-[20%] h-[4%] left-[12%] top-[35%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[35%] rounded-full bg-black/60" />
          <TextLine className="w-[25%] h-[4%] left-[12%] top-[50%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[50%] rounded-full bg-black/60" />
          <ImgBlock className="w-[40%] h-[60%] left-[52%] top-[30%]" />
        </div>
      );
    case "title-bullets-small-video":
      return (
        <div className="w-full h-full relative">
          <TextLine className="w-[30%] h-[8%] left-[8%] top-[10%]" />
          <TextLine className="w-[20%] h-[4%] left-[12%] top-[35%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[35%] rounded-full bg-black/60" />
          <TextLine className="w-[25%] h-[4%] left-[12%] top-[50%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[50%] rounded-full bg-black/60" />
          <ImgBlock className="w-[35%] h-[45%] left-[52%] top-[30%] !bg-neutral-800 flex items-center justify-center">
            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-white border-b-[4px] border-b-transparent ml-[2px]" />
          </ImgBlock>
        </div>
      );
    case "title-bullets-large-video":
      return (
        <div className="w-full h-full relative">
          <TextLine className="w-[30%] h-[8%] left-[8%] top-[10%]" />
          <TextLine className="w-[20%] h-[4%] left-[12%] top-[35%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[35%] rounded-full bg-black/60" />
          <TextLine className="w-[15%] h-[4%] left-[12%] top-[50%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[50%] rounded-full bg-black/60" />
          <ImgBlock className="w-[50%] h-[65%] left-[42%] top-[25%] !bg-neutral-800 flex items-center justify-center">
            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-[3px]" />
          </ImgBlock>
        </div>
      );
    case "chapter":
      return (
        <div className="w-full h-full relative flex items-center justify-center">
          <TextLine className="w-[40%] h-[12%] !relative" />
        </div>
      );
    case "only-title":
      return (
        <div className="w-full h-full relative flex items-center">
          <TextLine className="w-[50%] h-[10%] left-[8%] top-[45%]" />
        </div>
      );
    case "agenda":
      return (
        <div className="w-full h-full relative">
          <TextLine className="w-[20%] h-[8%] left-[8%] top-[10%]" />
          <TextLine className="w-[30%] h-[4%] left-[15%] top-[35%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[35%] rounded-full bg-black/60" />
          <TextLine className="w-[40%] h-[4%] left-[15%] top-[55%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[55%] rounded-full bg-black/60" />
          <TextLine className="w-[35%] h-[4%] left-[15%] top-[75%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[75%] rounded-full bg-black/60" />
        </div>
      );
    case "statement":
      return (
        <div className="w-full h-full relative flex flex-col items-center justify-center gap-1.5">
          <TextLine className="w-[60%] h-[6%] !relative" />
          <TextLine className="w-[50%] h-[6%] !relative" />
          <TextLine className="w-[40%] h-[6%] !relative" />
        </div>
      );
    case "key-fact":
      return (
        <div className="w-full h-full relative flex flex-col items-center justify-center gap-2">
          <TextLine className="w-[30%] h-[16%] !relative" />
          <TextLine className="w-[15%] h-[4%] !relative" />
        </div>
      );
    case "quote":
      return (
        <div className="w-full h-full relative flex flex-col justify-center pl-[15%] gap-2">
          <TextLine className="w-[50%] h-[6%] !relative" />
          <TextLine className="w-[40%] h-[6%] !relative" />
          <TextLine className="w-[20%] h-[4%] !relative mt-[10%]" />
        </div>
      );
    case "photos-3":
      return (
        <div className="w-full h-full relative">
          <ImgBlock className="w-[40%] h-[80%] left-[8%] top-[10%]" />
          <ImgBlock className="w-[40%] h-[38%] left-[52%] top-[10%]" />
          <ImgBlock className="w-[40%] h-[38%] left-[52%] top-[52%]" />
        </div>
      );
    case "photo":
      return (
        <div className="w-full h-full relative">
          <ImgBlock className="w-full h-full rounded-none" />
        </div>
      );
    case "blank":
    default:
      return <div className="w-full h-full relative" />;
  }
}
