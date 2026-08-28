
import type { ReactNode, RefObject } from "react";

import { EditorHeader, type EditorHeaderBadge, type EditorZoomLevel } from "@/common/ui/editor/EditorPrimitives";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

export function PitchHeader({
  accessMode,
  actualScale,
  badge,
  brand,
  centerContent,
  exportOptions,
  exportInteraction,
  exportMenuRef,
  homeHref,
  isMobileInspectorOpen,
  isMobileSidebarOpen,
  notice,
  onExport,
  onExportOption,
  onPlay,
  onProjectNameChange,
  onReplay,
  onRedo,
  onToggleInspector,
  onToggleSidebar,
  onUndo,
  projectName,
  projectNameEditValue,
  setZoomLevel,
  showFitScale,
  variant,
  zoomLevel
}: {
  accessMode: "authenticated" | "guest";
  actualScale: number;
  badge?: EditorHeaderBadge | null;
  brand?: ReactNode;
  centerContent?: ReactNode;
  exportOptions?: readonly { id: string; label: string; description?: string }[];
  exportInteraction?: "format-menu" | "split";
  exportMenuRef: RefObject<HTMLDivElement | null>;
  homeHref: string;
  isMobileInspectorOpen: boolean;
  isMobileSidebarOpen: boolean;
  notice: string;
  onExport: () => void;
  onExportOption?: (id: string) => void;
  onPlay: () => void;
  onProjectNameChange?: (value: string) => void;
  onReplay?: () => void;
  onRedo?: () => void;
  onToggleInspector: () => void;
  onToggleSidebar: () => void;
  onUndo: () => void;
  projectName: string;
  projectNameEditValue?: string;
  setZoomLevel: (value: EditorZoomLevel) => void;
  showFitScale?: boolean;
  variant?: "default" | "local";
  zoomLevel: EditorZoomLevel;
}) {
  const { tx } = usePitchI18n();

  return (
    <EditorHeader
      actualScale={actualScale}
      badge={badge === undefined ? {
        label: accessMode === "guest" ? "Live Demo" : "Pitch Beta",
        tone: accessMode === "guest" ? "guest" : "default"
      } : badge ?? undefined}
      brand={brand ?? (
        <a aria-label={tx("OpenSlideX project home")} href={homeHref || "#"}>
          <img alt="SlideX" className="h-auto w-[68px] rounded object-contain sm:w-[84px]" src="/logo.png" />
        </a>
      )}
      centerContent={centerContent}
      exportOptions={exportOptions}
      exportInteraction={exportInteraction}
      exportButtonRef={exportMenuRef}
      isMobileInspectorOpen={isMobileInspectorOpen}
      isMobileSidebarOpen={isMobileSidebarOpen}
      labels={{
        chooseExportFormat: tx("Choose export format"),
        export: tx("Export"),
        fitToScreen: tx("Fit to Screen"),
        play: tx("Play"),
        redo: tx("Redo"),
        replayAnimations: tx("Replay actions"),
        renamePresentation: tx("Rename presentation"),
        toggleInspector: tx("Toggle properties"),
        toggleSidebar: tx("Toggle layers"),
        undo: tx("Undo")
      }}
      notice={tx(notice)}
      onExport={onExport}
      onExportOption={onExportOption}
      onPlay={onPlay}
      onProjectNameChange={onProjectNameChange}
      onReplay={variant === "local" ? undefined : onReplay}
      onRedo={onRedo}
      onToggleInspector={onToggleInspector}
      onToggleSidebar={onToggleSidebar}
      onUndo={onUndo}
      projectName={projectName}
      projectNameEditValue={projectNameEditValue}
      setZoomLevel={setZoomLevel}
      showFitScale={showFitScale}
      variant={variant}
      zoomLevel={zoomLevel}
    />
  );
}
