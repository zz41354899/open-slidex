
import { useEffect, useState } from "react";
import { PitchHeader } from "@/features/pitch/ui/PitchHeader";
import { PreviewCanvas } from "@/features/pitch/ui/PreviewCanvas";
import { useMobileEdgePanels } from "@/features/pitch/ui/hooks/useMobileEdgePanels";
import { DesktopSlideNoteFab } from "@/features/pitch/ui/notes/DesktopSlideNoteFab";
import { WorkspaceCodeEditorOverlay } from "@/features/pitch/ui/workspace/WorkspaceCodeEditorOverlay";
import { WorkspaceInspectorPanel } from "@/features/pitch/ui/workspace/WorkspaceInspectorPanel";
import { WorkspaceLayerSidebar } from "@/features/pitch/ui/workspace/WorkspaceLayerSidebar";
import { WorkspaceScrollbarStyle } from "@/features/pitch/ui/workspace/WorkspaceScrollbarStyle";
import type { PitchWorkspaceProps } from "@/features/pitch/ui/workspace/PitchWorkspaceTypes";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { useVisibleRemoteMcpOperations } from "@/features/pitch/ui/hooks/useVisibleRemoteMcpOperations";
import { PreviewMediaPolicyProvider } from "@/features/pitch/ui/preview/PreviewMediaPolicy";

export function PitchWorkspace({ assistant, commands, document, remoteMcp, selection, toolRail, view }: PitchWorkspaceProps) {
  const { tx } = usePitchI18n();
  const sceneCount = document.scenes.length;
  const setActiveCanvasTool = view.setActiveCanvasTool;
  const [zoomLevel, setZoomLevel] = useState<number | "fit">("fit");
  const [fitScale, setFitScale] = useState(1);
  const visibleRemoteMcpOperations = useVisibleRemoteMcpOperations(remoteMcp?.activities ?? []);
  const canvasViewMode = view.canvasViewMode;

  useMobileEdgePanels({
    isLeftPanelOpen: view.isMobileSidebarOpen,
    isRightPanelOpen: view.isMobileInspectorOpen,
    setIsLeftPanelOpen: view.setIsMobileSidebarOpen,
    setIsRightPanelOpen: view.setIsMobileInspectorOpen
  });

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 639px)");

    function syncMobileCanvasTool() {
      if (mobileQuery.matches) setActiveCanvasTool("select");
    }

    syncMobileCanvasTool();
    mobileQuery.addEventListener("change", syncMobileCanvasTool);
    return () => mobileQuery.removeEventListener("change", syncMobileCanvasTool);
  }, [setActiveCanvasTool]);

  function selectSlide(index: number) {
    commands.setActiveSlideIndex(index);
    selection.selectSingleBlock(null);
  }

  return (
    <PreviewMediaPolicyProvider assetUrl={view.assetUrl} animateCharts={view.localChartAnimationsActive} localAssetsOnly={view.localAssetsOnly === true}>
      <main className="flex h-[100dvh] flex-col overflow-hidden bg-[#212121] font-sans text-neutral-300">
      <PitchHeader
        accessMode={view.accessMode}
        actualScale={zoomLevel === "fit" ? fitScale : zoomLevel}
        badge={view.headerBadge}
        brand={view.headerBrand}
        centerContent={view.headerTools}
        exportOptions={commands.openExportWithFormat ? [
          { description: tx("Interactive presentation"), id: "html", label: "HTML" },
          { description: tx("Editable PowerPoint"), id: "pptx", label: "PowerPoint" },
          { description: tx("Canonical source"), id: "mdx", label: "MDX" }
        ] : undefined}
        exportInteraction={view.exportInteraction}
        exportMenuRef={view.exportMenuRef}
        homeHref={view.homeHref}
        isMobileInspectorOpen={view.isMobileInspectorOpen}
        isMobileSidebarOpen={view.isMobileSidebarOpen}
        notice={view.notice}
        onExport={commands.openExport}
        onExportOption={commands.openExportWithFormat ? (format) => commands.openExportWithFormat?.(format as "html" | "mdx" | "pptx") : undefined}
        onPlay={commands.openPresentationPreview}
        onProjectNameChange={view.onProjectNameChange}
        onReplay={view.onReplayAnimations}
        onRedo={view.interactionDisabled ? undefined : commands.redoLastChange}
        onToggleInspector={() => {
          view.setIsMobileInspectorOpen((value) => !value);
          view.setIsMobileSidebarOpen(false);
        }}
        onToggleSidebar={() => {
          view.setIsMobileSidebarOpen((value) => !value);
          view.setIsMobileInspectorOpen(false);
        }}
        onUndo={view.interactionDisabled ? () => undefined : commands.undoLastChange}
        projectName={`${document.projectName === "Untitled presentation" ? tx("Untitled presentation") : document.projectName}${document.isProjectDirty ? ` - ${tx("Edited")}` : ""}`}
        projectNameEditValue={document.projectName}
        setZoomLevel={setZoomLevel}
        variant={view.headerVariant}
        zoomLevel={zoomLevel}
      />

      <div className="relative flex flex-1 animate-[bubble-appear_0.3s_ease-out] overflow-hidden bg-[#212121]" id="workspace-v4">
        {toolRail}
        <WorkspaceLayerSidebar
          commands={commands}
          document={document}
          onSelectSlide={selectSlide}
          remoteMcpOperations={visibleRemoteMcpOperations}
          selection={selection}
          view={view}
        />

        <div className="relative flex min-w-0 flex-1">
          <PreviewCanvas
            assistantActivities={assistant?.activities ?? []}
            assistantTrace={assistant?.trace}
            assistantTone={assistant?.tone}
            activeCanvasTool={view.activeCanvasTool}
            canvasViewMode={canvasViewMode}
            canvasShapeTool={view.canvasShapeTool}
            activeSlide={document.activeSlide}
            activeSlideIndex={document.activeSlideIndex}
            canPasteBlock={selection.hasCopiedBlock}
            isGridVisible={view.isCanvasGridVisible}
            interactionDisabled={view.interactionDisabled === true}
            isSnapEnabled={view.isCanvasSnapEnabled}
            onAddBlock={commands.addBlockToActiveSlide}
            onBeginBlockTransform={commands.beginBlockTransform}
            onCanvasToolChange={view.setActiveCanvasTool}
            onCanvasViewModeChange={view.setCanvasViewMode}
            onCanvasShapeToolChange={view.setCanvasShapeTool}
            onClearSelection={selection.clearBlockSelection}
            onCopySelectedBlock={commands.copySelectedBlock}
            onDeleteSelectedBlocks={commands.deleteSelectedBlocks}
            onDuplicateSelectedBlock={commands.duplicateSelectedBlock}
            onFitScaleChange={setFitScale}
            onGroupSelectedBlocks={commands.groupSelectedBlocks}
            onInsertSlideNearActive={commands.insertSlideNearActive}
            onMoveSelectedBlocksToEdge={commands.moveSelectedBlocksToEdge}
            onNextSlide={commands.goToNextSlide}
            onOpenMobileInspector={() => {
              view.setIsMobileInspectorOpen(true);
              view.setIsMobileSidebarOpen(false);
            }}
            onOpenMobileLayers={() => {
              view.setIsMobileSidebarOpen(true);
              view.setIsMobileInspectorOpen(false);
            }}
            onPasteCopiedBlock={commands.pasteCopiedBlock}
            onPreviousSlide={commands.goToPreviousSlide}
            onShaderFrameCapture={commands.persistActiveSlideShaderFrame}
            onSelectBlock={selection.selectBlock}
            onSelectBlocks={selection.selectBlocks}
            onSelectSlide={selectSlide}
            onReorderSlide={commands.reorderSlide}
            onSetZoomLevel={setZoomLevel}
            onToggleSelectedBlocksPositionLock={commands.toggleSelectedBlocksPositionLock}
            onUndo={commands.undoLastChange}
            onUngroupSelectedBlocks={commands.ungroupSelectedBlocks}
            onUpdateBlock={commands.updateBlock}
            onUpdateBlockFrames={commands.updatePositionedBlockFrames}
            onUseSelectedImageAsBackground={commands.useSelectedImageAsBackground}
            replayNonce={view.replayNonce}
            remoteMcpActivityWarning={remoteMcp?.connectionWarning}
            remoteMcpOperations={visibleRemoteMcpOperations}
            sceneCount={sceneCount}
            scenes={document.scenes}
            selectedBlockIndex={selection.selectedBlockIndex}
            selectedBlockIndices={selection.selectedBlockIndices}
            selectedBlocksLocked={selection.selectedBlocksLocked}
            showDesktopBlockDock={view.localAssetsOnly !== true}
            slideRows={document.slideRows}
            source={document.canvasSource}
            zoomLevel={zoomLevel}
          />
          {view.commentsEnabled ? <DesktopSlideNoteFab
            comments={document.activeSlideComments}
            onAddComment={commands.onAddActiveSlideComment}
            onPassComment={commands.onPassActiveSlideComment}
            slideNumber={document.activeSlideIndex + 1}
          /> : null}
        </div>

        <WorkspaceInspectorPanel commands={commands} document={document} selection={selection} view={view} />
      </div>

      <WorkspaceCodeEditorOverlay commands={commands} document={document} sceneCount={sceneCount} selection={selection} view={view} />
      <WorkspaceScrollbarStyle />
      </main>
    </PreviewMediaPolicyProvider>
  );
}
