import { ArrowRight, BarChart3, Circle, Diamond, Image as ImageIcon, Minus, Shapes, Sparkles, Square, Table2, Triangle, Type, Video } from "lucide-react";
import { useEffect, useRef, type Dispatch, type ReactNode, type SetStateAction } from "react";

import { shapePreset } from "@/core/motion-doc/domain/shapeCatalog";
import type { AddBlockOptions } from "@/features/pitch/application/motionDocCommands";
import type { CanvasShapeTool } from "@/features/pitch/application/shapeDrawing";
import { IconPicker } from "@/features/pitch/ui/IconPicker";
import type { AddBlockType } from "@/features/pitch/ui/pitchOptions";
import { TableToolbox } from "@/features/pitch/ui/preview/TableToolbox";

import { localWorkbenchShortcut, localWorkbenchShortcutBindings, type LocalWorkbenchShortcutAction } from "./localWorkbenchShortcuts";

export type LocalToolMenuId = "icon" | "media" | "shape" | "table";

type LocalWorkbenchToolbarProps = {
  disabled: boolean;
  onAddBlock: (type: AddBlockType, options?: AddBlockOptions) => void;
  onSelectShapeTool: (tool: CanvasShapeTool) => void;
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
  const toolbarRef = useRef<HTMLDivElement>(null);
  const { openTool, setOpenTool, setShortcutHelpOpen, shortcutHelpOpen } = props;

  useEffect(() => {
    if (props.disabled) setOpenTool(null);
  }, [props.disabled, setOpenTool]);

  useEffect(() => {
    if (!openTool) return;
    function close(event: MouseEvent) {
      if (!toolbarRef.current?.contains(event.target as Node)) setOpenTool(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenTool(null);
    }
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [openTool, setOpenTool]);

  useEffect(() => {
    if (!shortcutHelpOpen) return;
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setShortcutHelpOpen(false);
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [setShortcutHelpOpen, shortcutHelpOpen]);

  function add(type: AddBlockType, options?: AddBlockOptions) {
    if (props.disabled) return;
    props.onAddBlock(type, options);
    props.setOpenTool(null);
  }

  function selectShape(tool: CanvasShapeTool) {
    if (props.disabled) return;
    props.onSelectShapeTool(tool);
    props.setOpenTool(null);
  }

  function toggle(tool: LocalToolMenuId) {
    if (props.disabled) return;
    props.setOpenTool((current) => current === tool ? null : tool);
  }

  return (
    <>
      <div className="local-top-toolbar" ref={toolbarRef} role="toolbar" aria-label="Insert tools">
        <ToolbarButton action="text" disabled={props.disabled} icon={<Type size={18} />} label="Text" onClick={() => add("Text")} />
        <ToolbarButton action="media" active={props.openTool === "media"} disabled={props.disabled} icon={<ImageIcon size={18} />} label="Media" onClick={() => toggle("media")} />
        <ToolbarButton action="chart" disabled={props.disabled} icon={<BarChart3 size={18} />} label="Chart" onClick={() => add("Chart")} />
        <ToolbarButton action="table" active={props.openTool === "table"} disabled={props.disabled} icon={<Table2 size={18} />} label="Table" onClick={() => toggle("table")} />
        <ToolbarButton action="shape" active={props.openTool === "shape"} disabled={props.disabled} icon={<Shapes size={18} />} label="Shape" onClick={() => toggle("shape")} />
        <ToolbarButton action="icon" active={props.openTool === "icon"} disabled={props.disabled} icon={<Sparkles size={18} />} label="Icon" onClick={() => toggle("icon")} />

        {props.openTool === "media" ? (
          <ToolbarPopover className="local-media-popover" label="Media">
            <PopoverAction icon={<ImageIcon size={16} />} label="Image" onClick={() => add("Image")} />
            <PopoverAction icon={<Video size={16} />} label="Video" onClick={() => add("Video")} />
          </ToolbarPopover>
        ) : null}
        {props.openTool === "shape" ? (
          <ToolbarPopover className="local-shape-popover" label="Shape">
            <div className="local-shape-grid">
              {commonShapes.map((item) => {
                const Icon = item.icon;
                const preset = shapePreset(item.preset);
                return (
                  <button key={item.preset} onClick={() => selectShape({ type: "ShapeRectangle", props: { ...preset.props, preset: preset.id } })} type="button">
                    <Icon size={17} /><span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </ToolbarPopover>
        ) : null}
        {props.openTool === "table" ? (
          <ToolbarPopover className="local-table-popover" label="Table">
            <TableToolbox onAddTool={add} />
          </ToolbarPopover>
        ) : null}
        {props.openTool === "icon" ? (
          <ToolbarPopover className="local-icon-popover" label="Icon">
            <IconPicker mode="toolbox" onChange={(icon) => { if (icon) add("Icon", { props: { icon } }); }} />
          </ToolbarPopover>
        ) : null}
      </div>

      {props.shortcutHelpOpen ? (
        <div className="shortcut-help-backdrop" onMouseDown={() => props.setShortcutHelpOpen(false)} role="presentation">
          <section aria-label="Keyboard shortcuts" aria-modal="true" className="shortcut-help" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <header><div><strong>Keyboard shortcuts</strong><span>Local SlideX Workbench</span></div><button onClick={() => props.setShortcutHelpOpen(false)} type="button">Close</button></header>
            <div>{localWorkbenchShortcutBindings.map((binding) => <p key={binding.action}><span>{binding.label}</span><kbd>{binding.key}</kbd></p>)}</div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ToolbarButton({ action, active = false, disabled, icon, label, onClick }: { action: LocalWorkbenchShortcutAction; active?: boolean; disabled: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  const shortcut = localWorkbenchShortcut(action);
  return <button aria-label={`${label} (${shortcut})`} aria-pressed={active} className={active ? "is-active" : ""} disabled={disabled} onClick={onClick} title={`${label} (${shortcut})`} type="button">{icon}<span>{label}</span></button>;
}

function ToolbarPopover({ children, className, label }: { children: ReactNode; className: string; label: string }) {
  return <section aria-label={`${label} tools`} className={`local-toolbar-popover ${className}`}>{children}</section>;
}

function PopoverAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return <button className="local-popover-action" onClick={onClick} type="button">{icon}<span>{label}</span></button>;
}
