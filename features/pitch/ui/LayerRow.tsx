"use client";

import { ChevronUp, ChevronDown, Gauge, GripVertical, Image as ImageIcon, Link2, Lock, MousePointer2, PlaySquare, Rows3, Shapes, Sparkles, Table2, Trash2 } from "lucide-react";
import { useState, type MouseEvent, type PointerEvent } from "react";
import type { MotionDocBlock } from "@/core/motion-doc/domain/motionDocTypes";
import { isPositionLocked } from "@/features/pitch/application/motionDocCommands";
import { LayerContextMenu } from "@/features/pitch/ui/LayerContextMenu";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

export function LayerTextIcon({ className = "", label }: { className?: string; label: "H" | "T" }) {
  return (
    <span className={`inline-flex h-3 w-3 items-center justify-center font-serif text-[11px] font-bold leading-none ${className}`}>
      {label}
    </span>
  );
}

export function BlockLayerIcon({ block, className = "" }: { block: MotionDocBlock; className?: string }) {
  if (block.type === "Title") return <LayerTextIcon className={className} label="H" />;
  if (block.type === "Text") return <LayerTextIcon className={className} label="T" />;
  if (block.type === "ImageBlock") return <ImageIcon className={className} size={12} />;
  if (block.type === "VideoBlock") return <PlaySquare className={className} size={12} />;
  if (block.type === "Metric") return <Gauge className={className} size={12} />;
  if (block.type === "Icon") return <Sparkles className={className} size={12} />;
  if (block.type === "Shape") return <Shapes className={className} size={12} />;
  if (block.type === "Stack") return <Rows3 className={className} size={12} />;
  if (block.type === "Table") return <Table2 className={className} size={12} />;

  return <MousePointer2 className={className} size={12} />;
}

function blockLayerLabel(block: MotionDocBlock) {
  if (typeof block.props.layerName === "string" && block.props.layerName.trim()) return block.props.layerName;
  if ("text" in block && block.text.trim()) {
    return block.text;
  }

  if (block.type === "Table") {
    return "Table";
  }

  return String(block.props.title || block.props.text || block.type);
}

export function LayerRow({
  block,
  deleteBlock,
  draggedBlockIndex,
  dragOverBlockIndex,
  index,
  moveBlock,
  moveBlockToEdge,
  onSelectBlock,
  reorderBlock,
  renameBlock,
  toggleBlockPositionLock,
  selectedBlockIndex,
  selectedBlockIndices,
  setDraggedBlockIndex,
  setDragOverBlockIndex,
  totalBlocks
}: {
  block: MotionDocBlock;
  deleteBlock: (index: number) => void;
  draggedBlockIndex: number | null;
  dragOverBlockIndex: number | null;
  index: number;
  moveBlock: (index: number, direction: -1 | 1) => void;
  moveBlockToEdge: (index: number, edge: "back" | "front") => void;
  onSelectBlock: (index: number, event: MouseEvent<HTMLDivElement>, target?: "group" | "layer") => void;
  reorderBlock: (fromIndex: number, toIndex: number) => void;
  renameBlock: (index: number, name: string) => void;
  toggleBlockPositionLock: (index: number) => void;
  selectedBlockIndex: number | null;
  selectedBlockIndices: number[];
  setDraggedBlockIndex: (index: number | null) => void;
  setDragOverBlockIndex: (index: number | null) => void;
  totalBlocks: number;
}) {
  const { tx } = usePitchI18n();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const isSelected = selectedBlockIndices.includes(index) || selectedBlockIndex === index;
  const groupId = "props" in block && typeof block.props.groupId === "string" ? block.props.groupId : "";
  const isDragged = draggedBlockIndex === index;
  const isDragOver = dragOverBlockIndex === index && !isDragged;
  let itemClass = "group relative flex min-h-10 items-center justify-between overflow-hidden rounded-[0.85rem] border px-3 py-2.5 cursor-pointer outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-[#8ea5ff]/65 ";

  if (isSelected) {
    itemClass += "bg-[#8ea5ff]/[0.12] text-white border-[#8ea5ff]/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_5px_16px_rgba(6,10,28,0.2)] ";
  } else {
    itemClass += "text-neutral-400 border-transparent hover:bg-white/[0.03] hover:text-neutral-200 ";
  }

  if (isDragged) {
    itemClass += "opacity-30 border-dashed !border-white/[0.06] ";
  } else if (isDragOver) {
    itemClass += "!border-t-white !border-t-2 bg-white/[0.02] shadow-[0_4px_12px_rgba(0,0,0,0.5)] scale-[1.01] z-10 relative ";
  }

  return (
    <div
      aria-selected={isSelected}
      className={itemClass}
      draggable
      onClick={(event) => onSelectBlock(index, event, "layer")}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isSelected) onSelectBlock(index, event, "layer");
        setContextMenu({ x: event.clientX, y: event.clientY });
      }}
      onDragEnd={() => {
        setDraggedBlockIndex(null);
        setDragOverBlockIndex(null);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (dragOverBlockIndex !== index) setDragOverBlockIndex(index);
      }}
      onDragStart={(event) => {
        setDraggedBlockIndex(index);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (draggedBlockIndex !== null && draggedBlockIndex !== index) {
          reorderBlock(draggedBlockIndex, index);
        }
        setDraggedBlockIndex(null);
        setDragOverBlockIndex(null);
      }}
      role="option"
      tabIndex={0}
    >
      {isSelected ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[#8ea5ff] shadow-[0_0_10px_rgba(142,165,255,0.55)]" /> : null}
      <div className="flex items-center gap-2 truncate">
        <div className="cursor-grab transition-colors hover:text-white active:cursor-grabbing" title={tx("Drag to reorder")}>
          <GripVertical size={12} className="opacity-30 group-hover:opacity-100" />
        </div>
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${isSelected ? "border-[#8ea5ff]/35 bg-[#8ea5ff]/15 text-[#cbd3ff]" : "border-white/[0.06] bg-black/20 text-neutral-500 group-hover:text-neutral-300"}`}>
          <BlockLayerIcon block={block} />
        </span>
        <span className={`truncate text-[13px] font-medium transition-colors ${isSelected ? "text-white" : "text-neutral-300 group-hover:text-white"}`}>{blockLayerLabel(block)}</span>
        {groupId ? <Link2 className="shrink-0 text-[#8ea5ff]/70" size={11} /> : null}
        {isPositionLocked(block) ? <Lock className="shrink-0 text-neutral-600" size={10} /> : null}
      </div>
      <div className="flex items-center gap-1">
        <div className={`flex items-center gap-1 transition-all ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}>
        <button className="shrink-0 p-0.5 text-neutral-400 transition-all hover:text-white disabled:opacity-30" disabled={index === totalBlocks - 1} onClick={(event) => { event.stopPropagation(); moveBlock(index, 1); }} title={tx("Move forward")}>
          <ChevronUp size={12} />
        </button>
        <button className="shrink-0 p-0.5 text-neutral-400 transition-all hover:text-white disabled:opacity-30" disabled={index === 0} onClick={(event) => { event.stopPropagation(); moveBlock(index, -1); }} title={tx("Move backward")}>
          <ChevronDown size={12} />
        </button>
        <button
          aria-label={tx("Delete layer")}
          className="ml-1 shrink-0 p-0.5 text-neutral-400 transition-all hover:text-red-400"
          onClick={(event) => {
            event.stopPropagation();

            if (event.detail === 0) {
              deleteBlock(index);
            }
          }}
          onPointerDown={(event) => runLayerPointerAction(event, () => deleteBlock(index))}
          title={tx("Delete layer")}
        >
          <Trash2 size={12} />
        </button>
        </div>
      </div>
      {contextMenu ? (
        <LayerContextMenu
          isLocked={isPositionLocked(block)}
          name={blockLayerLabel(block)}
          onClose={() => setContextMenu(null)}
          onDelete={() => deleteBlock(index)}
          onMoveToBack={() => moveBlockToEdge(index, "back")}
          onMoveToFront={() => moveBlockToEdge(index, "front")}
          onRename={(name) => renameBlock(index, name)}
          onToggleLock={() => toggleBlockPositionLock(index)}
          position={contextMenu}
        />
      ) : null}
    </div>
  );
}

function runLayerPointerAction(event: PointerEvent<HTMLButtonElement>, action: () => void) {
  event.preventDefault();
  event.stopPropagation();
  action();
}
