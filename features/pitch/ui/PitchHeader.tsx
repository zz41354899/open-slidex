"use client";

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
  onReplay,
  onRedo,
  onToggleInspector,
  onToggleSidebar,
  onUndo,
  projectName,
  setZoomLevel,
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
  onReplay?: () => void;
  onRedo?: () => void;
  onToggleInspector: () => void;
  onToggleSidebar: () => void;
  onUndo: () => void;
  projectName: string;
  setZoomLevel: (value: EditorZoomLevel) => void;
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
        export: tx("Export"),
        fitToScreen: tx("Fit to Screen"),
        play: tx("Play"),
        redo: tx("Redo"),
        toggleInspector: tx("Toggle properties"),
        toggleSidebar: tx("Toggle layers"),
        undo: tx("Undo")
      }}
      notice={tx(notice)}
      onExport={onExport}
      onExportOption={onExportOption}
      onPlay={onPlay}
      onReplay={onReplay}
      onRedo={onRedo}
      onToggleInspector={onToggleInspector}
      onToggleSidebar={onToggleSidebar}
      onUndo={onUndo}
      projectName={projectName}
      setZoomLevel={setZoomLevel}
      variant={variant}
      zoomLevel={zoomLevel}
    />
  );
}
