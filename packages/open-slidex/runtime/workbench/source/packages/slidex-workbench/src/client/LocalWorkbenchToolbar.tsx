import { ArrowRight, BarChart3, Circle, Diamond, Image as ImageIcon, Minus, Shapes, Square, Table2, Triangle, Type, Video } from "lucide-react";
import {
  ShadcnDialog,
  ShadcnDialogClose,
  ShadcnDialogContent,
  ShadcnDialogDescription,
  ShadcnDialogTitle,
  ShadcnPopover,
  ShadcnPopoverContent,
  ShadcnPopoverTrigger,
  ShadcnSeparator,
  ShadcnTooltip,
  ShadcnTooltipContent,
  ShadcnTooltipTrigger
} from "@open-slidex/editor-ui";
import { forwardRef, useEffect, type Dispatch, type ReactNode, type SetStateAction } from "react";

import { shapePreset } from "@/core/motion-doc/domain/shapeCatalog";
import type { AddBlockOptions } from "@/features/pitch/application/motionDocCommands";
import type { CanvasShapeTool } from "@/features/pitch/application/shapeDrawing";
import type { CanvasTool } from "@/features/pitch/application/canvasTools";
import type { AddBlockType } from "@/features/pitch/ui/pitchOptions";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { TableToolbox } from "@/features/pitch/ui/preview/TableToolbox";

import { localWorkbenchShortcut, localWorkbenchShortcutBindings, type LocalWorkbenchShortcutAction } from "./localWorkbenchShortcuts";

export type LocalToolMenuId = "media" | "shape" | "table";

type LocalWorkbenchToolbarProps = {
  activeCanvasTool: CanvasTool;
  disabled: boolean;
  onAddBlock: (type: AddBlockType, options?: AddBlockOptions) => void;
  onSelectShapeTool: (tool: CanvasShapeTool) => void;
  onCanvasToolChange: (tool: CanvasTool) => void;
  openTool: LocalToolMenuId | null;
  setOpenTool: Dispatch<SetStateAction<LocalToolMenuId | null>>;
  shortcutHelpOpen: boolean;
  setShortcutHelpOpen: Dispatch<SetStateAction<boolean>>;
};

const commonShapes = [
  { icon: Square, label: "Rectangle", preset: "rectangle" },
  { icon: Circle, label: "Circle", preset: "circle" },
  { icon: Triangle, label: "Triangle", preset: "triangle" },
  { icon: Diamond, label: "Diamond", preset: "diamond" },
  { icon: Minus, label: "Line", preset: "line" },
  { icon: ArrowRight, label: "Arrow", preset: "arrow-end" }
] as const;

export function LocalWorkbenchToolbar(props: LocalWorkbenchToolbarProps) {
  const { tx } = usePitchI18n();
  const { openTool, setOpenTool, setShortcutHelpOpen, shortcutHelpOpen } = props;

  useEffect(() => {
    if (props.disabled) setOpenTool(null);
  }, [props.disabled, setOpenTool]);

  function add(type: AddBlockType, options?: AddBlockOptions) {
    if (props.disabled) return;
    props.onAddBlock(type, options);
    props.setOpenTool(null);
  }

  function selectCanvasDrawTool(tool: CanvasShapeTool) {
    if (props.disabled) return;
    props.onSelectShapeTool(tool);
    props.setOpenTool(null);
  }

  function setPopoverOpen(tool: LocalToolMenuId, nextOpen: boolean) {
    if (props.disabled) return;
    setOpenTool((current) => nextOpen ? tool : current === tool ? null : current);
  }

  return (
    <>
      <div className="local-top-toolbar" role="toolbar" aria-label={tx("Insert tools")}>
        <ShadcnTooltip>
          <ShadcnTooltipTrigger asChild>
            <ToolbarButton action="text" disabled={props.disabled} icon={<Type size={18} />} label="Text" onClick={() => add("Text")} />
          </ShadcnTooltipTrigger>
          <ShadcnTooltipContent side="bottom">{tx("Add a text frame")}</ShadcnTooltipContent>
        </ShadcnTooltip>
        <ShadcnPopover onOpenChange={(nextOpen) => setPopoverOpen("media", nextOpen)} open={openTool === "media"}>
          <ShadcnPopoverTrigger asChild>
            <ToolbarButton action="media" active={openTool === "media"} disabled={props.disabled} icon={<ImageIcon size={18} />} label="Media" />
          </ShadcnPopoverTrigger>
          <ToolbarPopover className="local-media-popover" label="Media">
            <PopoverAction icon={<ImageIcon size={16} />} label="Image" onClick={() => selectCanvasDrawTool({ type: "Image", props: {} })} />
            <PopoverAction icon={<Video size={16} />} label="Video" onClick={() => selectCanvasDrawTool({ type: "Video", props: {} })} />
          </ToolbarPopover>
        </ShadcnPopover>
        <ShadcnTooltip>
          <ShadcnTooltipTrigger asChild>
            <ToolbarButton action="chart" disabled={props.disabled} icon={<BarChart3 size={18} />} label="Chart" onClick={() => add("Chart")} />
          </ShadcnTooltipTrigger>
          <ShadcnTooltipContent side="bottom">{tx("Add an editable chart")}</ShadcnTooltipContent>
        </ShadcnTooltip>
        <ShadcnPopover onOpenChange={(nextOpen) => setPopoverOpen("table", nextOpen)} open={openTool === "table"}>
          <ShadcnPopoverTrigger asChild>
            <ToolbarButton action="table" active={openTool === "table"} disabled={props.disabled} icon={<Table2 size={18} />} label="Table" />
          </ShadcnPopoverTrigger>
          <ToolbarPopover className="local-table-popover" label="Table">
            <TableToolbox onAddTool={add} />
          </ToolbarPopover>
        </ShadcnPopover>
        <ShadcnPopover onOpenChange={(nextOpen) => setPopoverOpen("shape", nextOpen)} open={openTool === "shape"}>
          <ShadcnPopoverTrigger asChild>
            <ToolbarButton action="shape" active={openTool === "shape"} disabled={props.disabled} icon={<Shapes size={18} />} label="Shape" />
          </ShadcnPopoverTrigger>
          <ToolbarPopover className="local-shape-popover" label="Shape">
            <div className="local-shape-grid">
              {commonShapes.map((item) => {
                const Icon = item.icon;
                const preset = shapePreset(item.preset);
                return (
                  <button key={item.preset} onClick={() => selectCanvasDrawTool({ type: "ShapeRectangle", props: { ...preset.props, preset: preset.id } })} type="button">
                    <Icon size={17} /><span>{tx(item.label)}</span>
                  </button>
                );
              })}
            </div>
          </ToolbarPopover>
        </ShadcnPopover>
      </div>

      <ShadcnDialog onOpenChange={setShortcutHelpOpen} open={shortcutHelpOpen}>
        <ShadcnDialogContent aria-describedby="shortcut-help-description" className="shortcut-help gap-0 p-0" showCloseButton={false}>
          <header>
            <div>
              <ShadcnDialogTitle asChild><strong>{tx("Keyboard shortcuts")}</strong></ShadcnDialogTitle>
              <ShadcnDialogDescription asChild><span id="shortcut-help-description">{tx("Local SlideX Workbench")}</span></ShadcnDialogDescription>
            </div>
            <ShadcnDialogClose asChild><button type="button">{tx("Close")}</button></ShadcnDialogClose>
          </header>
          <ShadcnSeparator className="bg-white/7" />
          <div>{localWorkbenchShortcutBindings.map((binding) => <p key={binding.action}><span>{tx(binding.label)}</span><kbd>{binding.key}</kbd></p>)}</div>
        </ShadcnDialogContent>
      </ShadcnDialog>
    </>
  );
}

const ToolbarButton = forwardRef<HTMLButtonElement, { action: LocalWorkbenchShortcutAction; active?: boolean; disabled: boolean; icon: ReactNode; label: string; onClick?: () => void }>(function ToolbarButton({ action, active = false, disabled, icon, label, onClick }, ref) {
  const { tx } = usePitchI18n();
  const shortcut = localWorkbenchShortcut(action);
  return <button aria-label={`${tx(label)} (${shortcut})`} aria-pressed={active} className={active ? "is-active" : ""} disabled={disabled} onClick={onClick} ref={ref} title={`${tx(label)} (${shortcut})`} type="button">{icon}<span>{tx(label)}</span></button>;
});

function ToolbarPopover({ children, className, label }: { children: ReactNode; className: string; label: string }) {
  const { tx } = usePitchI18n();
  return <ShadcnPopoverContent aria-label={tx(`${label} tools`)} className={`local-toolbar-popover ${className}`} side="bottom" sideOffset={8}>{children}</ShadcnPopoverContent>;
}

function PopoverAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  const { tx } = usePitchI18n();
  return <button className="local-popover-action" onClick={onClick} type="button">{icon}<span>{tx(label)}</span></button>;
}
