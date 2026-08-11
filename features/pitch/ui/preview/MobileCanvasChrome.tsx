"use client";

import { useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Maximize2,
  PanelRight,
  Plus,
  Presentation,
  Shapes,
  Sparkles,
  Table2,
  Type,
  Undo2,
  Video,
  X,
} from "lucide-react";
import type { AddBlockOptions } from "@/features/pitch/application/motionDocCommands";
import type { AddBlockType, PitchToolGroupId } from "@/features/pitch/ui/pitchOptions";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type MobileCanvasDockProps = {
  onAddBlock: (type: AddBlockType, options?: AddBlockOptions) => void;
  onFit: () => void;
  onInsertSlideAfter: () => void;
  onOpenInspector: () => void;
  onOpenLayers: () => void;
  onOpenToolGroup: (groupId: PitchToolGroupId) => void;
  onUndo: () => void;
};

export function MobileCanvasDock({
  onAddBlock,
  onFit,
  onInsertSlideAfter,
  onOpenInspector,
  onOpenLayers,
  onOpenToolGroup,
  onUndo
}: MobileCanvasDockProps) {
  const { tx } = usePitchI18n();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  function addBlock(type: AddBlockType) {
    onAddBlock(type);
    setIsMoreOpen(false);
  }

  function openGroup(groupId: PitchToolGroupId) {
    setIsMoreOpen(false);
    onOpenToolGroup(groupId);
  }

  function insertSlide() {
    onInsertSlideAfter();
    setIsMoreOpen(false);
  }

  return (
    <>
      {isMoreOpen ? (
        <button
          aria-label={tx("Close insert menu")}
          className="fixed inset-0 z-[55] bg-black/45 backdrop-blur-sm sm:hidden"
          onClick={() => setIsMoreOpen(false)}
          type="button"
        />
      ) : null}

      {isMoreOpen ? (
        <div className="absolute bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-3 right-3 z-[60] rounded-2xl border border-white/[0.1] bg-[#111113]/95 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.82)] backdrop-blur-2xl sm:hidden">
          <div className="mb-2 flex items-center justify-between px-1">
            <div>
              <p className="text-sm font-semibold text-white">{tx("Add to slide")}</p>
              <p className="mt-0.5 text-[11px] text-neutral-500">{tx("Choose only what you need.")}</p>
            </div>
            <button
              aria-label={tx("Close insert menu")}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 active:bg-white/[0.08] active:text-white"
              onClick={() => setIsMoreOpen(false)}
              type="button"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MobileInsertButton icon={<Type size={18} />} label={tx("Text")} onClick={() => addBlock("Text")} />
            <MobileInsertButton icon={<ImageIcon size={18} />} label={tx("Image")} onClick={() => addBlock("Image")} />
            <MobileInsertButton icon={<Presentation size={18} />} label={tx("New slide")} onClick={insertSlide} />
            <MobileInsertButton icon={<Video size={18} />} label={tx("Video")} onClick={() => addBlock("Video")} />
            <MobileInsertButton icon={<Shapes size={18} />} label={tx("Shape")} onClick={() => openGroup("shape")} />
            <MobileInsertButton icon={<Table2 size={18} />} label={tx("Table")} onClick={() => addBlock("Table")} />
            <MobileInsertButton icon={<Sparkles size={18} />} label={tx("Icon")} onClick={() => openGroup("icon")} />
            <MobileInsertButton icon={<LayoutGrid size={18} />} label={tx("Media")} onClick={() => openGroup("media")} />
          </div>
        </div>
      ) : null}

      <div className="absolute bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 items-end gap-0.5 rounded-[1.35rem] border border-white/[0.12] bg-neutral-900/94 px-2 py-1.5 shadow-[0_14px_44px_rgba(0,0,0,0.84)] backdrop-blur-xl sm:hidden">
        <MobileDockButton icon={<Layers size={18} />} label={tx("Slides")} onClick={onOpenLayers} />
        <MobileDockButton icon={<Undo2 size={18} />} label={tx("Undo")} onClick={onUndo} />
        <button
          aria-label={tx("Add content")}
          className={`mx-1 flex h-14 w-14 -translate-y-2 items-center justify-center rounded-full border text-black shadow-[0_10px_30px_rgba(0,0,0,0.6)] transition active:scale-95 ${
            isMoreOpen ? "border-white bg-neutral-200" : "border-white/80 bg-white"
          }`}
          onClick={() => setIsMoreOpen((current) => !current)}
          type="button"
        >
          <Plus className={`transition-transform ${isMoreOpen ? "rotate-45" : ""}`} size={24} strokeWidth={2.4} />
        </button>
        <MobileDockButton icon={<Maximize2 size={18} />} label={tx("Fit")} onClick={onFit} />
        <MobileDockButton icon={<PanelRight size={18} />} label={tx("Options")} onClick={onOpenInspector} />
      </div>
    </>
  );
}

function MobileDockButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="flex h-12 min-w-12 flex-col items-center justify-center rounded-xl px-1.5 text-[10px] font-medium text-neutral-300 transition active:scale-95 active:bg-white/[0.08]"
      onClick={onClick}
      type="button"
    >
      <span className="flex h-5 items-center">{icon}</span>
      <span className="mt-0.5 leading-none">{label}</span>
    </button>
  );
}

function MobileInsertButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.035] text-xs font-medium text-neutral-200 transition active:scale-[0.97] active:bg-white/[0.09]"
      onClick={onClick}
      type="button"
    >
      <span className="text-neutral-300">{icon}</span>
      {label}
    </button>
  );
}

export function MobileEdgePanelHandles({
  onOpenInspector,
  onOpenLayers
}: {
  onOpenInspector: () => void;
  onOpenLayers: () => void;
}) {
  const { tx } = usePitchI18n();
  return (
    <>
      <button
        aria-label={tx("Open slides and layers")}
        className="absolute left-0 top-1/2 z-20 flex h-16 w-5 -translate-y-1/2 items-center justify-center rounded-r-xl border-y border-r border-white/[0.1] bg-neutral-900/80 text-neutral-500 shadow-lg backdrop-blur sm:hidden"
        onClick={onOpenLayers}
        type="button"
      >
        <ChevronRight size={14} />
      </button>
      <button
        aria-label={tx("Open options")}
        className="absolute right-0 top-1/2 z-20 flex h-16 w-5 -translate-y-1/2 items-center justify-center rounded-l-xl border-y border-l border-white/[0.1] bg-neutral-900/80 text-neutral-500 shadow-lg backdrop-blur sm:hidden"
        onClick={onOpenInspector}
        type="button"
      >
        <ChevronLeft size={14} />
      </button>
    </>
  );
}
