
import type { PointerEvent } from "react";
import type { MotionDocFrame } from "@/core/motion-doc/domain/frame";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  marqueeRect,
  resizeHandles,
  type AlignmentGuide,
  type MarqueeSelection,
  type ResizeHandle,
  type SelectionSpacingGuide
} from "@/features/pitch/application/previewCanvas";
import type { CanvasInteractionMode } from "@/features/pitch/ui/preview/interaction/useCanvasInteractionEngine";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

export function FrameInteractionHalo({ isTextBlock }: { isTextBlock: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute z-0 rounded-[10px] ${isTextBlock ? "-inset-2" : "-inset-3"} ${
        isTextBlock
          ? "cursor-move border border-transparent bg-transparent"
          : "cursor-move border border-transparent bg-white/[0.01] group-hover/frame:border-violet-400/20"
      }`}
    />
  );
}

export function AlignmentGuideLine({ guide, index }: { guide: AlignmentGuide; index: number }) {
  const isVertical = guide.orientation === "vertical";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-50 bg-[#ff4fd8] shadow-[0_0_0_1px_rgba(255,255,255,0.7),0_0_12px_rgba(255,79,216,0.9)]"
      key={`${guide.orientation}-${guide.position}-${index}`}
      style={isVertical
        ? { bottom: 0, left: `${guide.position}%`, top: 0, width: 1.5 }
        : { height: 1.5, left: 0, right: 0, top: `${guide.position}%` }}
    />
  );
}

export function MarqueeOverlay({ marqueeSelection }: { marqueeSelection: MarqueeSelection }) {
  const { tx } = usePitchI18n();
  const rect = marqueeRect(marqueeSelection);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute rounded-[3px] border border-dashed border-[#b9c4ff] bg-[#8ea5ff]/15 shadow-[0_0_0_1px_rgba(55,48,163,0.35),0_8px_30px_rgba(20,17,75,0.12)]"
      style={{ height: `${rect.h}%`, left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%` }}
    >
      <span className="absolute left-1 top-1 rounded bg-[#181a25]/90 px-1.5 py-0.5 text-[8px] font-semibold text-[#dce2ff] shadow-sm">
        {tx("Select")}
      </span>
    </div>
  );
}

export function SelectedFrameControls({
  frame,
  interactionMode,
  isLocked,
  isLineShape,
  isTextBlock,
  label,
  onStartResize,
  onStartRotate,
  showHandles
}: {
  frame: MotionDocFrame;
  interactionMode: CanvasInteractionMode;
  isLocked: boolean;
  isLineShape: boolean;
  isTextBlock: boolean;
  label?: string;
  onStartResize: (event: PointerEvent<HTMLSpanElement>, handle: ResizeHandle) => void;
  onStartRotate: (event: PointerEvent<HTMLSpanElement>) => void;
  showHandles: boolean;
}) {
  const { tx } = usePitchI18n();
  const labelAtBottom = frame.y < 5;
  const dimensionInside = frame.y < 11 || frame.y + frame.h > 95;

  return (
    <>
      {isLocked || label ? (
        <span className={`pointer-events-none absolute left-1 rounded-md bg-white px-1.5 py-0.5 font-mono text-[9px] font-semibold text-black shadow-sm ${labelAtBottom ? "top-1" : "-top-6"}`}>
          {label ?? tx("locked")}
        </span>
      ) : null}
      {!isLocked && showHandles && !isLineShape && !isTextBlock ? (
        <span className={`pointer-events-none absolute rounded-md border border-violet-300/20 bg-[#17131f]/92 px-1.5 py-0.5 font-mono text-[9px] font-medium tabular-nums text-violet-100 shadow-[0_5px_16px_rgba(20,10,35,0.28)] backdrop-blur-md ${dimensionInside ? "right-1 top-1" : "-bottom-6 right-0"}`}>
          {interactionMode === "dragging" ? `${tx("Move")} · ` : interactionMode === "resizing" ? `${tx("Resize")} · ` : ""}
          {Math.round(frame.w / 100 * CANVAS_WIDTH)} × {Math.round(frame.h / 100 * CANVAS_HEIGHT)}
        </span>
      ) : null}
      {isLocked || !showHandles ? null : isLineShape ? (
        <>
          <RotationHandle onPointerDown={onStartRotate} />
          <LineEndpointHandle endpoint="start" onPointerDown={(event) => onStartResize(event, "w")} />
          <LineEndpointHandle endpoint="end" onPointerDown={(event) => onStartResize(event, "e")} />
        </>
      ) : (
        <>
          <RotationHandle onPointerDown={onStartRotate} side="right" />
          {resizeHandles.map((handle) => (
            <ResizeHandleControl handle={handle} key={handle} onPointerDown={(event) => onStartResize(event, handle)} />
          ))}
        </>
      )}
    </>
  );
}

type MultiSelectionFrameProps = {
  blockIndex: number;
  canResize: boolean;
  count: number;
  frame: MotionDocFrame;
  interactionMode: CanvasInteractionMode;
  isFocusMode: boolean;
  isGroup: boolean;
  isTransforming: boolean;
  lockedCount: number;
  onStartMove: (event: PointerEvent<HTMLDivElement>) => void;
  onStartResize: (event: PointerEvent<HTMLSpanElement>, handle: ResizeHandle) => void;
  spacingGuides: readonly SelectionSpacingGuide[];
};

export function MultiSelectionFrame({
  blockIndex,
  canResize,
  count,
  frame,
  interactionMode,
  isFocusMode,
  isGroup,
  isTransforming,
  lockedCount,
  onStartMove,
  onStartResize,
  spacingGuides
}: MultiSelectionFrameProps) {
  const { locale, tx } = usePitchI18n();
  const badgeAtBottom = frame.y < 5;
  const dimensionInside = frame.y + frame.h > 95;

  return (
    <div
      aria-label={locale === "zh-TW"
        ? (isGroup ? `${count} 個元素的群組` : `已選取 ${count} 個元素`)
        : (isGroup ? `Group of ${count} elements` : `${count} selected elements`)}
      className={`group/selection absolute z-30 border bg-transparent transition-colors duration-150 ${
        isGroup ? "pointer-events-none" : "cursor-move"
      } ${
        isTransforming
          ? "border-violet-400"
          : isGroup
            ? isFocusMode
              ? "border-pink-300/45 bg-pink-300/[0.025] shadow-[0_0_0_1px_rgba(244,114,182,0.07),0_10px_30px_rgba(244,114,182,0.045)]"
              : "border-violet-400/35 hover:border-violet-400/55"
            : "border-violet-500 hover:border-violet-400"
      }`}
      data-block-index={blockIndex}
      data-frame-control
      data-multi-selection-frame
      onPointerDown={isGroup ? undefined : onStartMove}
      role="group"
      style={{ height: `${frame.h}%`, left: `${frame.x}%`, top: `${frame.y}%`, width: `${frame.w}%` }}
    >
      {isGroup ? <GroupDragEdges onPointerDown={onStartMove} /> : null}
      {!isGroup ? (
        <>
          <span className={`pointer-events-none absolute left-0 flex items-center gap-1.5 rounded-md border border-white/10 bg-[#17131f]/95 px-2 py-1 text-[10px] font-semibold text-violet-100 shadow-lg backdrop-blur-md ${badgeAtBottom ? "top-1" : "-top-7"}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
            <span>{tx("Selection")}</span>
            <span className="font-normal text-violet-200/55">· {interactionMode === "dragging" ? tx("Moving") : interactionMode === "resizing" ? tx("Resizing") : (locale === "zh-TW" ? `${count} 個圖層` : `${count} layers`)}</span>
            {lockedCount > 0 ? <span className="font-normal text-violet-200/55">· {locale === "zh-TW" ? `${lockedCount} 個已鎖定` : `${lockedCount} locked`}</span> : null}
          </span>
          {interactionMode === "selected" ? <SelectionSpacingOverlay frame={frame} guides={spacingGuides} /> : null}
          <span className={`pointer-events-none absolute rounded-md border border-violet-300/20 bg-[#17131f]/92 px-1.5 py-0.5 font-mono text-[9px] font-medium tabular-nums text-violet-100 shadow-md backdrop-blur-md ${dimensionInside ? "bottom-1 right-1" : "-bottom-6 right-0"}`}>
            {Math.round(frame.w / 100 * CANVAS_WIDTH)} × {Math.round(frame.h / 100 * CANVAS_HEIGHT)}
          </span>
        </>
      ) : null}
      {canResize ? resizeHandles.map((handle) => (
        <ResizeHandleControl handle={handle} key={`group-${handle}`} onPointerDown={(event) => onStartResize(event, handle)} />
      )) : null}
    </div>
  );
}

function GroupDragEdges({
  onPointerDown
}: {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-auto absolute -top-2 left-4 right-4 z-20 h-4 cursor-move" data-group-drag-handle="top" onPointerDown={onPointerDown} />
      <div aria-hidden="true" className="pointer-events-auto absolute -bottom-2 left-4 right-4 z-20 h-4 cursor-move" data-group-drag-handle="bottom" onPointerDown={onPointerDown} />
      <div aria-hidden="true" className="pointer-events-auto absolute -left-2 bottom-4 top-4 z-20 w-4 cursor-move" data-group-drag-handle="left" onPointerDown={onPointerDown} />
      <div aria-hidden="true" className="pointer-events-auto absolute -right-2 bottom-4 top-4 z-20 w-4 cursor-move" data-group-drag-handle="right" onPointerDown={onPointerDown} />
    </>
  );
}

function LineEndpointHandle({ endpoint, onPointerDown }: { endpoint: "end" | "start"; onPointerDown: (event: PointerEvent<HTMLSpanElement>) => void }) {
  const { tx } = usePitchI18n();
  return (
    <span aria-label={`${tx("Adjust line")} ${tx(endpoint)}`} className={`absolute top-1/2 z-50 flex h-7 w-7 -translate-y-1/2 items-center justify-center cursor-move ${endpoint === "start" ? "-left-3.5" : "-right-3.5"}`} data-line-endpoint={endpoint} onPointerDown={onPointerDown} role="button">
      <span className="pointer-events-none h-3 w-3 rounded-full border-2 border-violet-500 bg-white shadow-[0_1px_3px_rgba(28,16,52,0.3)]" />
    </span>
  );
}

function RotationHandle({ onPointerDown, side = "top" }: { onPointerDown: (event: PointerEvent<HTMLSpanElement>) => void; side?: "right" | "top" }) {
  const { tx } = usePitchI18n();
  return (
    <span
      aria-label={tx("Rotate")}
      className={`pointer-events-auto absolute z-50 flex h-8 w-8 cursor-grab items-center justify-center active:cursor-grabbing ${side === "right" ? "-right-11 top-1/2 -translate-y-1/2" : "-top-11 left-1/2 -translate-x-1/2"}`}
      data-rotation-handle
      onPointerDown={onPointerDown}
      role="button"
    >
      <span className={`pointer-events-none absolute bg-violet-400/80 ${side === "right" ? "left-0 h-px w-4" : "bottom-0 h-4 w-px"}`} />
      <span className={`pointer-events-none h-3.5 w-3.5 rounded-full border-2 border-violet-500 bg-white shadow-[0_1px_4px_rgba(28,16,52,0.35)] ${side === "right" ? "ml-4" : "mb-4"}`} />
    </span>
  );
}

function ResizeHandleControl({ handle, onPointerDown }: { handle: ResizeHandle; onPointerDown: (event: PointerEvent<HTMLSpanElement>) => void }) {
  const { tx } = usePitchI18n();
  return (
    <span aria-label={`${tx("Resize")} ${tx(resizeHandleLabel(handle))}`} className={`pointer-events-auto absolute z-40 flex items-center justify-center ${resizeHandleHitAreaClass(handle)}`} data-resize-handle={handle} onPointerDown={onPointerDown} role="button">
      <span className="pointer-events-none h-3 w-3 rounded-full border-2 border-violet-500 bg-white shadow-[0_1px_3px_rgba(28,16,52,0.3)]" />
    </span>
  );
}

function resizeHandleHitAreaClass(handle: ResizeHandle) {
  if (handle === "n") return "-top-3 left-1/2 h-6 w-12 -translate-x-1/2 cursor-ns-resize";
  if (handle === "e") return "-right-3 top-1/2 h-12 w-6 -translate-y-1/2 cursor-ew-resize";
  if (handle === "s") return "-bottom-3 left-1/2 h-6 w-12 -translate-x-1/2 cursor-ns-resize";
  if (handle === "w") return "-left-3 top-1/2 h-12 w-6 -translate-y-1/2 cursor-ew-resize";
  if (handle === "nw") return "-left-3.5 -top-3.5 h-7 w-7 cursor-nwse-resize";
  if (handle === "ne") return "-right-3.5 -top-3.5 h-7 w-7 cursor-nesw-resize";
  if (handle === "sw") return "-bottom-3.5 -left-3.5 h-7 w-7 cursor-nesw-resize";
  return "-bottom-3.5 -right-3.5 h-7 w-7 cursor-nwse-resize";
}

function resizeHandleLabel(handle: ResizeHandle) {
  const labels: Record<ResizeHandle, string> = {
    e: "right edge", n: "top edge", ne: "top right corner", nw: "top left corner",
    s: "bottom edge", se: "bottom right corner", sw: "bottom left corner", w: "left edge"
  };
  return labels[handle];
}

function SelectionSpacingOverlay({ frame, guides }: { frame: MotionDocFrame; guides: readonly SelectionSpacingGuide[] }) {
  if (guides.length === 0) return null;

  return (
    <>{guides.map((guide, index) => <SpacingGuide frame={frame} guide={guide} key={`${guide.axis}-${guide.start}-${guide.end}-${index}`} />)}</>
  );
}

function SpacingGuide({ frame, guide }: { frame: MotionDocFrame; guide: SelectionSpacingGuide }) {
  const warning = guide.status === "overlap" || guide.status === "tight" || guide.status === "uneven";
  const start = Math.min(guide.start, guide.end);
  const end = Math.max(guide.start, guide.end);
  const colorClass = warning
    ? "bg-amber-300 text-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.85)]"
    : "bg-emerald-300 text-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.85)]";

  if (guide.axis === "horizontal") {
    const left = (start - frame.x) / frame.w * 100;
    const width = Math.max((end - start) / frame.w * 100, 0);
    const top = (guide.crossPosition - frame.y) / frame.h * 100;
    return (
      <span className={`pointer-events-none absolute z-10 h-px ${colorClass}`} style={{ left: `${left}%`, minWidth: 1, top: `${top}%`, width: `${width}%` }}>
        <i className="absolute -left-px -top-1 h-2 w-px bg-current" /><i className="absolute -right-px -top-1 h-2 w-px bg-current" />
      </span>
    );
  }

  const left = (guide.crossPosition - frame.x) / frame.w * 100;
  const top = (start - frame.y) / frame.h * 100;
  const height = Math.max((end - start) / frame.h * 100, 0);
  return (
    <span className={`pointer-events-none absolute z-10 w-px ${colorClass}`} style={{ height: `${height}%`, left: `${left}%`, minHeight: 1, top: `${top}%` }}>
      <i className="absolute -left-1 -top-px h-px w-2 bg-current" /><i className="absolute -bottom-px -left-1 h-px w-2 bg-current" />
    </span>
  );
}
