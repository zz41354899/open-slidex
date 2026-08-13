
import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Hand, MousePointer2, Plus, ZoomIn, ZoomOut } from "lucide-react";
import { canvasToolOptions, type CanvasTool } from "@/features/pitch/application/canvasTools";
import type { CanvasShapeTool } from "@/features/pitch/application/shapeDrawing";
import type { AddBlockOptions, InsertSlidePlacement } from "@/features/pitch/application/motionDocCommands";
import type { SlideRow } from "@/features/pitch/application/slideRows";
import { TableToolbox } from "@/features/pitch/ui/preview/TableToolbox";
import { ShapeLibraryModal } from "@/features/pitch/ui/preview/ShapeLibraryModal";
import { MobileCanvasDock } from "@/features/pitch/ui/preview/MobileCanvasChrome";
import { toolGroups, type AddBlockType, type PitchBlockTool, type PitchToolGroup } from "@/features/pitch/ui/pitchOptions";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import type { CanvasViewMode } from "@/features/pitch/application/canvasViewMode";
import { CanvasViewSwitch } from "@/features/pitch/ui/preview/CanvasViewSwitch";

export type CanvasZoomDirection = "in" | "out";

type CanvasSlideNavProps = {
  activeSlideIndex: number;
  canvasViewMode: CanvasViewMode;
  onCanvasViewModeChange: (mode: CanvasViewMode) => void;
  onNextSlide: () => void;
  onPreviousSlide: () => void;
  sceneCount: number;
};

export function CanvasSlideNav({
  activeSlideIndex,
  canvasViewMode,
  onCanvasViewModeChange,
  onNextSlide,
  onPreviousSlide,
  sceneCount
}: CanvasSlideNavProps) {
  const { tx } = usePitchI18n();
  return (
    <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/[0.04] bg-neutral-950/60 p-1 shadow-lg shadow-black/40 backdrop-blur-xl sm:top-5 transition-all duration-300">
      <CanvasViewSwitch mode={canvasViewMode} onChange={onCanvasViewModeChange} />
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-white/[0.08]" />
      <button
        aria-label={tx("Previous slide")}
        className="rounded-lg p-1.5 text-neutral-400 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white/[0.04] hover:text-white hover:scale-[1.04] active:scale-[0.93] cursor-pointer"
        onClick={onPreviousSlide}
        type="button"
      >
        <ChevronLeft size={12} strokeWidth={2.5} />
      </button>
      <div className="flex min-w-[36px] items-center justify-center px-2 py-0.5 sm:min-w-[48px]">
        <span className="font-mono text-sm font-semibold text-neutral-300 sm:text-base">
          {activeSlideIndex + 1} <span className="font-normal text-neutral-600">/</span> {sceneCount}
        </span>
      </div>
      <button
        aria-label={tx("Next slide")}
        className="rounded-lg p-1.5 text-neutral-400 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white/[0.04] hover:text-white hover:scale-[1.04] active:scale-[0.93] cursor-pointer"
        onClick={onNextSlide}
        data-canvas-next-slide
        type="button"
      >
        <ChevronRight size={12} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function CanvasBlockDock({
  activeCanvasTool,
  onAddBlock,
  onCanvasToolChange,
  onCanvasShapeToolChange,
  onFitMobile,
  onInsertSlideAfter,
  onOpenMobileInspector,
  onOpenMobileLayers,
  onUndoMobile,
  showDesktopBlockDock = true,
  zoomDirection
}: {
  activeCanvasTool: CanvasTool;
  onAddBlock: (type: AddBlockType, options?: AddBlockOptions) => void;
  onCanvasToolChange: (tool: CanvasTool) => void;
  onCanvasShapeToolChange: (tool: CanvasShapeTool | null) => void;
  onFitMobile: () => void;
  onInsertSlideAfter: () => void;
  onOpenMobileInspector: () => void;
  onOpenMobileLayers: () => void;
  onUndoMobile: () => void;
  showDesktopBlockDock?: boolean;
  zoomDirection: CanvasZoomDirection;
}) {
  const { tx } = usePitchI18n();
  const [openGroupId, setOpenGroupId] = useState<PitchToolGroup["id"] | null>(null);
  const [isCanvasToolMenuOpen, setIsCanvasToolMenuOpen] = useState(false);
  const activeGroup = toolGroups.find((group) => group.id === openGroupId) ?? null;

  function addTool(type: AddBlockType, options?: AddBlockOptions) {
    onAddBlock(type, options);
    setOpenGroupId(null);
  }

  function selectCanvasDrawTool(type: AddBlockType, options?: AddBlockOptions) {
    if (type !== "ShapeRectangle" && type !== "Image" && type !== "Video") return;
    onCanvasToolChange("select");
    onCanvasShapeToolChange({ type, props: options?.props ?? {} });
    setOpenGroupId(null);
  }

  return (
    <>
      {activeGroup || isCanvasToolMenuOpen ? (
        <button
          aria-label={tx("Close tool menu")}
          className="fixed inset-0 z-[55] cursor-default bg-transparent"
          onClick={() => {
            setOpenGroupId(null);
            setIsCanvasToolMenuOpen(false);
          }}
          type="button"
        />
      ) : null}
      {activeGroup && !activeGroup.modal && (activeGroup.tools.length > 1 || activeGroup.id === "table") ? (
        <ToolFlyout
          group={activeGroup}
          onAddTool={addTool}
          onSelectCanvasDrawTool={selectCanvasDrawTool}
        />
      ) : null}
      {activeGroup?.id === "shape" ? (
        <ShapeLibraryModal onAddTool={selectCanvasDrawTool} onClose={() => setOpenGroupId(null)} />
      ) : null}
      {isCanvasToolMenuOpen ? (
        <CanvasToolMenu
          activeCanvasTool={activeCanvasTool}
          onSelectTool={(tool) => {
            onCanvasToolChange(tool);
            setIsCanvasToolMenuOpen(false);
          }}
          zoomDirection={zoomDirection}
        />
      ) : null}
      <MobileCanvasDock
        onAddBlock={addTool}
        onSelectCanvasDrawTool={selectCanvasDrawTool}
        onFit={onFitMobile}
        onInsertSlideAfter={onInsertSlideAfter}
        onOpenInspector={onOpenMobileInspector}
        onOpenLayers={onOpenMobileLayers}
        onOpenToolGroup={(groupId) => {
          setIsCanvasToolMenuOpen(false);
          setOpenGroupId(groupId);
        }}
        onUndo={onUndoMobile}
      />
      {showDesktopBlockDock ? <div className="absolute bottom-5 left-1/2 z-50 hidden -translate-x-1/2 items-center gap-1.5 rounded-xl border border-white/[0.12] bg-neutral-900/90 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all duration-300 hover:shadow-black/85 sm:flex md:bottom-7">
        <button
          aria-label={tx("Open canvas tools")}
          className={`group relative flex h-11 w-12 shrink-0 cursor-pointer items-center justify-center overflow-visible rounded-lg transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.06] active:scale-[0.93] sm:h-9.5 sm:w-11 md:h-10.5 md:w-12 ${
            isCanvasToolMenuOpen ? "bg-white/[0.12] text-white border border-white/[0.1]" : "text-neutral-300 hover:bg-white/[0.06] hover:text-white"
          }`}
          onClick={() => {
            setOpenGroupId(null);
            setIsCanvasToolMenuOpen((current) => !current);
          }}
          title={`${tx(canvasToolLabel(activeCanvasTool, zoomDirection))} (${canvasToolShortcut(activeCanvasTool)})`}
          type="button"
        >
          <span className="scale-80 sm:scale-95 md:scale-105">{canvasToolIcon(activeCanvasTool, 17, zoomDirection)}</span>
          <ChevronDown className="ml-0.5 text-neutral-500" size={12} />
          <span className="pointer-events-none absolute -top-9 origin-bottom scale-90 whitespace-nowrap rounded-lg border border-white/[0.08] bg-[#111113] px-2.5 py-1 text-xs font-bold text-white opacity-0 shadow-xl transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 sm:-top-10">
            {tx(canvasToolLabel(activeCanvasTool, zoomDirection))}
          </span>
        </button>
        {toolGroups.map((group) => {
          const isOpen = openGroupId === group.id;
          const isSingleTool = !group.modal && group.tools.length === 1 && group.id !== "table";
          return (
            <button
              aria-label={isSingleTool ? `${tx("Add")} ${tx(group.label)}` : `${tx("Open")} ${tx(group.label)} ${tx("tools")}`}
              className={`group relative flex h-11 w-11 shrink-0 cursor-pointer flex-col items-center justify-center overflow-visible rounded-lg transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.06] active:scale-[0.93] sm:h-9.5 sm:w-9.5 md:h-10.5 md:w-10.5 ${
                isOpen ? "bg-white/[0.12] text-white border border-white/[0.1]" : "text-neutral-300 hover:bg-white/[0.06] hover:text-white"
              }`}
              key={group.id}
              onClick={() => {
                setIsCanvasToolMenuOpen(false);
                if (isSingleTool) {
                  addTool(group.tools[0].type);
                } else {
                  setOpenGroupId((current) => (current === group.id ? null : group.id));
                }
              }}
              type="button"
            >
              <span className="scale-80 sm:scale-95 md:scale-105">{group.icon}</span>
              <span className="pointer-events-none absolute -top-9 origin-bottom scale-90 whitespace-nowrap rounded-lg border border-white/[0.08] bg-[#111113] px-2.5 py-1 text-xs font-bold text-white opacity-0 shadow-xl transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 sm:-top-10">
                {tx(group.label)}
              </span>
            </button>
          );
        })}
      </div> : null}
    </>
  );
}

function ToolFlyout({
  group,
  onAddTool,
  onSelectCanvasDrawTool
}: {
  group: PitchToolGroup;
  onAddTool: (type: AddBlockType, options?: AddBlockOptions) => void;
  onSelectCanvasDrawTool: (type: AddBlockType, options?: AddBlockOptions) => void;
}) {
  if (group.id === "table") {
    return <TableToolbox onAddTool={onAddTool} />;
  }

  return <CommandToolMenu group={group} onAddTool={onAddTool} onSelectCanvasDrawTool={onSelectCanvasDrawTool} />;
}

function CanvasToolMenu({
  activeCanvasTool,
  onSelectTool,
  zoomDirection
}: {
  activeCanvasTool: CanvasTool;
  onSelectTool: (tool: CanvasTool) => void;
  zoomDirection: CanvasZoomDirection;
}) {
  const { tx } = usePitchI18n();
  return (
    <div className="absolute bottom-[4.25rem] left-1/2 z-[60] w-[220px] -translate-x-1/2 overflow-hidden rounded-xl border border-white/[0.04] bg-neutral-950/90 p-[6px] shadow-[0_20px_50px_rgba(0,0,0,0.75)] backdrop-blur-2xl sm:bottom-[5rem]">
      <div className="px-2.5 pb-1.5 pt-1 text-sm font-bold text-neutral-400">
        {tx("Canvas tool")}
      </div>
      {canvasToolOptions.map((tool) => {
        const isActive = tool.id === activeCanvasTool;

        return (
          <button
            className={`grid h-9.5 w-full grid-cols-[22px_1fr_auto] items-center gap-2 rounded-lg px-2.5 text-left text-sm font-semibold transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.96] ${
              isActive ? "bg-white/[0.07] text-white" : "text-neutral-200 hover:bg-white/[0.04] hover:text-white"
            }`}
            key={tool.id}
            onClick={() => onSelectTool(tool.id)}
            type="button"
          >
            <span className="flex items-center justify-center text-neutral-300">{canvasToolIcon(tool.id, 16, zoomDirection)}</span>
            <span className="truncate">{tx(tool.id === "zoom" ? canvasToolLabel(tool.id, zoomDirection) : tool.label)}</span>
            <span className="font-mono text-xs text-neutral-500">{tool.shortcut}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CanvasSlideAddControls({
  onInsertSlideNearActive,
  orientation = "horizontal"
}: {
  onInsertSlideNearActive: (placement: InsertSlidePlacement) => void;
  orientation?: "horizontal" | "vertical";
}) {
  const beforeClass = orientation === "vertical"
    ? "left-1/2 -top-5 -translate-x-1/2"
    : "-left-5 top-1/2 -translate-y-1/2";
  const afterClass = orientation === "vertical"
    ? "bottom-[-1.25rem] left-1/2 -translate-x-1/2"
    : "-right-5 top-1/2 -translate-y-1/2";
  return (
    <>
      <CanvasSlideAddButton
        className={beforeClass}
        label={orientation === "vertical" ? "Add slide before" : "Add slide left"}
        onClick={() => onInsertSlideNearActive("before")}
      />
      <CanvasSlideAddButton
        className={afterClass}
        label={orientation === "vertical" ? "Add slide after" : "Add slide right"}
        onClick={() => onInsertSlideNearActive("after")}
      />
    </>
  );
}

function CanvasSlideAddButton({
  className,
  label,
  onClick
}: {
  className: string;
  label: string;
  onClick: () => void;
}) {
  const { tx } = usePitchI18n();
  return (
    <button
      aria-label={tx(label)}
      className={`absolute z-50 hidden h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-neutral-950/80 text-neutral-300 shadow-[0_10px_30px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-all duration-200 hover:scale-110 hover:border-white/25 hover:bg-white hover:text-black active:scale-95 sm:flex ${className}`}
      onClick={onClick}
      title={tx(label)}
      type="button"
    >
      <Plus size={16} strokeWidth={2.4} />
    </button>
  );
}

function canvasToolIcon(tool: CanvasTool, size: number, zoomDirection: CanvasZoomDirection) {
  if (tool === "hand") {
    return <Hand size={size} />;
  }

  if (tool === "zoom") {
    return zoomDirection === "out" ? <ZoomOut size={size} /> : <ZoomIn size={size} />;
  }

  return <MousePointer2 size={size} />;
}

function canvasToolLabel(tool: CanvasTool, zoomDirection: CanvasZoomDirection) {
  if (tool === "zoom" && zoomDirection === "out") {
    return "Zoom out";
  }

  return canvasToolOptions.find((option) => option.id === tool)?.label ?? "Select";
}

function canvasToolShortcut(tool: CanvasTool) {
  return canvasToolOptions.find((option) => option.id === tool)?.shortcut ?? "V";
}

function CommandToolMenu({
  group,
  onAddTool,
  onSelectCanvasDrawTool
}: {
  group: PitchToolGroup;
  onAddTool: (type: AddBlockType, options?: AddBlockOptions) => void;
  onSelectCanvasDrawTool: (type: AddBlockType, options?: AddBlockOptions) => void;
}) {
  const { tx } = usePitchI18n();
  return (
    <div className="absolute bottom-[4.25rem] left-1/2 z-[60] w-[230px] -translate-x-1/2 overflow-hidden rounded-xl border border-white/[0.04] bg-neutral-950/90 p-[6px] shadow-[0_20px_50px_rgba(0,0,0,0.75)] backdrop-blur-2xl sm:bottom-[5rem]">
      <div className="px-2.5 pb-1.5 pt-1 text-sm font-bold text-neutral-400">
        {tx(group.label)}
      </div>
      {group.tools.map((tool) => (
        <CommandToolButton key={tool.type} tool={tool} onAddTool={group.id === "media" ? onSelectCanvasDrawTool : onAddTool} />
      ))}
    </div>
  );
}


function CommandToolButton({
  onAddTool,
  tool
}: {
  onAddTool: (type: AddBlockType, options?: AddBlockOptions) => void;
  tool: PitchBlockTool;
}) {
  const { tx } = usePitchI18n();
  return (
    <button
      className="grid h-9.5 w-full grid-cols-[22px_1fr_auto] items-center gap-2 rounded-lg px-2.5 text-left text-sm font-semibold text-neutral-200 transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white/[0.04] hover:text-white active:scale-[0.96]"
      onClick={() => onAddTool(tool.type)}
      type="button"
    >
      <span className="flex items-center justify-center text-neutral-300">{tool.icon}</span>
      <span className="truncate">{tx(tool.label)}</span>
      {tool.shortcut ? <span className="font-mono text-xs text-neutral-500">{tool.shortcut}</span> : null}
    </button>
  );
}

export function CanvasTimeline({
  activeSlideIndex,
  onSelectSlide,
  slideRows,
  totalDuration
}: {
  activeSlideIndex: number;
  onSelectSlide: (index: number) => void;
  slideRows: SlideRow[];
  totalDuration: number;
}) {
  return (
    <div className="relative z-10 flex h-4 w-full shrink-0 overflow-hidden border-t border-white/[0.03] bg-neutral-950 select-none sm:h-5">
      {slideRows.map((slide) => {
        const isActive = slide.index === activeSlideIndex;
        const widthPercent = Math.max((slide.duration / Math.max(totalDuration, 1)) * 100, 2);

        return (
          <button
            aria-label={`Go to slide ${slide.index + 1}`}
            className={`group/time h-full border-r border-white/[0.03] transition-all relative flex flex-col justify-between p-0.5 cursor-pointer ${
              isActive
                ? "bg-[#0ea5e9]/8 shadow-[inset_0_1px_0_rgba(14,165,233,0.1)]"
                : "bg-transparent hover:bg-white/[0.01]"
            }`}
            key={slide.index}
            onClick={() => onSelectSlide(slide.index)}
            style={{ width: `${widthPercent}%` }}
            type="button"
          >
            {/* Active glowing indicator block */}
            <span className={`absolute top-0 left-0 right-0 h-[2px] transition-all ${isActive ? "bg-[#0ea5e9]" : "bg-transparent"}`} />

            {/* Tick marks inside timeline */}
            <div className="flex w-full justify-between px-1 opacity-20 group-hover/time:opacity-40 transition-opacity">
              <span className="h-1.5 w-[1px] bg-white" />
              <span className="h-1 w-[1px] bg-white" />
              <span className="h-1 w-[1px] bg-white" />
              <span className="h-1 w-[1px] bg-white" />
            </div>

            <div className="flex w-full items-center justify-between px-1.5 pb-0.5 font-mono text-[11px] font-semibold">
              <span className={isActive ? "text-[#0ea5e9]" : "text-neutral-500 group-hover/time:text-neutral-400"}>
                S{slide.index + 1}
              </span>
              <span className="text-neutral-600 group-hover/time:text-neutral-500 font-normal">
                {slide.duration}s
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
