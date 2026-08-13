
import { useRef, useState } from "react";
import { defaultCanvasTool, type CanvasTool } from "@/features/pitch/application/canvasTools";
import type { CanvasViewMode } from "@/features/pitch/application/canvasViewMode";
import type { CanvasShapeTool } from "@/features/pitch/application/shapeDrawing";

export type PitchFileModalMode = "export" | "import";

export function usePitchWorkspaceViewState(initialResumeIntent?: "export" | "preview") {
  const [activeCanvasTool, setActiveCanvasTool] = useState<CanvasTool>(defaultCanvasTool);
  const [canvasShapeTool, setCanvasShapeTool] = useState<CanvasShapeTool | null>(null);
  const [canvasViewMode, setCanvasViewMode] = useState<CanvasViewMode>("slide");
  const [fileModalMode, setFileModalMode] = useState<PitchFileModalMode>("export");
  const [isCanvasGridVisible, setIsCanvasGridVisible] = useState(false);
  const [isCanvasSnapEnabled, setIsCanvasSnapEnabled] = useState(true);
  const [isCodeEditorOpen, setIsCodeEditorOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(initialResumeIntent === "export");
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isPresentationPreviewOpen, setIsPresentationPreviewOpen] = useState(initialResumeIntent === "preview");
  const [notice, setNotice] = useState("Ready");
  const [replayNonce, setReplayNonce] = useState(0);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  return {
    activeCanvasTool,
    canvasViewMode,
    canvasShapeTool,
    exportMenuRef,
    fileModalMode,
    isCanvasGridVisible,
    isCanvasSnapEnabled,
    isCodeEditorOpen,
    isExporting,
    isExportMenuOpen,
    isMobileInspectorOpen,
    isMobileSidebarOpen,
    isPresentationPreviewOpen,
    notice,
    replayNonce,
    setActiveCanvasTool,
    setCanvasViewMode,
    setCanvasShapeTool,
    setFileModalMode,
    setIsCanvasGridVisible,
    setIsCanvasSnapEnabled,
    setIsCodeEditorOpen,
    setIsExporting,
    setIsExportMenuOpen,
    setIsMobileInspectorOpen,
    setIsMobileSidebarOpen,
    setIsPresentationPreviewOpen,
    setNotice,
    setReplayNonce
  };
}
