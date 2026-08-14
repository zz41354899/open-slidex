import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { MotionDocEditor } from "@open-slidex/editor-ui";

import { defaultMdx } from "@/core/motion-doc/presets/defaultMdx";
import { getSelectionMdx } from "@/core/motion-doc/application/motionDocSerialize";
import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import { useLayerSelection } from "@/features/pitch/ui/hooks/useLayerSelection";
import { useMotionDocDocument } from "@/features/pitch/ui/hooks/useMotionDocDocument";
import { usePitchCommands } from "@/features/pitch/ui/hooks/usePitchCommands";
import { usePitchShortcuts } from "@/features/pitch/ui/hooks/usePitchShortcuts";
import { usePitchUndo } from "@/features/pitch/ui/hooks/usePitchUndo";
import { usePitchWorkspaceViewState } from "@/features/pitch/ui/hooks/usePitchWorkspaceViewState";
import { PresentationPreviewModal } from "@/features/pitch/ui/PresentationPreviewModal";
import { PreviewMediaPolicyProvider } from "@/features/pitch/ui/preview/PreviewMediaPolicy";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import type { SlideXEditorAssetAdapter } from "@/features/pitch/domain/localEditor";

import { deleteAsset, exportDocument, localWorkbenchAssetUrl, renderMontage, updateContext, uploadAsset } from "./api";
import slidexWordmark from "./assets/slidex-wordmark.png";
import { ChartInspector } from "./ChartInspector";
import { LocalWorkbenchToolbar, type LocalToolMenuId } from "./LocalWorkbenchToolbar";
import { localExportFileName } from "./localExport";
import { normalizePresentationTitle, renamePresentationSource } from "./presentationTitle";
import type { Selection } from "./domain";
import { useLocalWorkbenchShortcuts } from "./useLocalWorkbenchShortcuts";
import type { useLocalDocument } from "./useLocalDocument";

type LocalDocumentState = ReturnType<typeof useLocalDocument>;
const slidexWordmarkSource = slidexWordmark;

export function LocalMotionDocEditor({ documentState }: { documentState: LocalDocumentState }) {
  const { tx } = usePitchI18n();
  const [source, setSource] = useState(documentState.source);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [dragOverBlockIndex, setDragOverBlockIndex] = useState<number | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [openTool, setOpenTool] = useState<LocalToolMenuId | null>(null);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [localChartAnimationsActive, setLocalChartAnimationsActive] = useState(false);
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const chartReplayTimerRef = useRef<number | null>(null);
  const exportInFlightRef = useRef(false);
  const syncedRevisionRef = useRef(documentState.snapshot?.revision);
  const {
    activeCanvasTool,
    canvasViewMode,
    canvasShapeTool,
    exportMenuRef,
    isCanvasGridVisible,
    isCanvasSnapEnabled,
    isCodeEditorOpen,
    isExportMenuOpen,
    isMobileInspectorOpen,
    isMobileSidebarOpen,
    isPresentationPreviewOpen,
    notice,
    replayNonce,
    setActiveCanvasTool,
    setCanvasViewMode,
    setCanvasShapeTool,
    setIsCanvasGridVisible,
    setIsCanvasSnapEnabled,
    setIsCodeEditorOpen,
    setIsExportMenuOpen,
    setIsMobileInspectorOpen,
    setIsMobileSidebarOpen,
    setIsPresentationPreviewOpen,
    setNotice,
    setReplayNonce
  } = usePitchWorkspaceViewState();
  const revision = documentState.snapshot?.revision ?? "";
  const {
    activeSlide,
    activeSlideAccent,
    activeSlideBackground,
    activeSlideLayoutPreset,
    activeSlideMutedColor,
    activeSlideShader,
    activeSlideShaderAngle,
    activeSlideShaderColor1,
    activeSlideShaderColor2,
    activeSlideShaderColor3,
    activeSlideShaderColor4,
    activeSlideShaderColor5,
    activeSlideShaderColor6,
    activeSlideShaderDetail,
    activeSlideShaderEngine,
    activeSlideShaderIntensity,
    activeSlideShaderPreset,
    activeSlideShaderScale,
    activeSlideShaderSoftness,
    activeSlideShaderSpeed,
    activeSlideTextColor,
    activeSlideTheme,
    canvasSource,
    slideRows,
    sliderDocument,
    stats
  } = useMotionDocDocument({ activeSlideIndex, source });
  const {
    clearBlockSelection,
    selectBlock,
    selectBlocks,
    selectedBlockIndex,
    selectedBlockIndices,
    selectSingleBlock
  } = useLayerSelection(activeSlide?.blocks ?? []);
  const { commitSource, pushUndoSnapshot, redoLastChange, undoLastChange } = usePitchUndo({
    clearBlockSelection,
    markProjectDirty: () => undefined,
    redoStackRef,
    setNotice,
    setSource,
    source,
    undoStackRef
  });
  const projectName = sliderDocument.title || documentState.snapshot?.title || tx("Untitled presentation");
  const workspaceHomeUrl = __OPEN_SLIDEX_WORKSPACE_URL__ || (
    /^\/workspace\/[A-Za-z0-9._-]+\/?$/.test(window.location.pathname)
      ? `${window.location.origin}/workspace`
      : ""
  );

  const restoreSavedCanvas = useCallback(async () => {
    const next = await documentState.reload("Restored the saved Canvas and discarded the invalid browser draft.");
    syncedRevisionRef.current = next.revision;
    setSource(next.source);
    clearBlockSelection();
  }, [clearBlockSelection, documentState]);

  const renamePresentation = useCallback((value: string) => {
    const title = normalizePresentationTitle(value);
    if (!title || title === sliderDocument.title) return;
    commitSource((current) => renamePresentationSource(current, title));
    setNotice(tx("Presentation renamed"));
  }, [commitSource, setNotice, sliderDocument.title, tx]);

  const triggerChartReplay = useCallback(() => {
    if (chartReplayTimerRef.current !== null) window.clearTimeout(chartReplayTimerRef.current);
    setLocalChartAnimationsActive(true);
    setReplayNonce((value) => value + 1);
    chartReplayTimerRef.current = window.setTimeout(() => {
      setLocalChartAnimationsActive(false);
      chartReplayTimerRef.current = null;
    }, 1_400);
  }, [setReplayNonce]);

  useEffect(() => () => {
    if (chartReplayTimerRef.current !== null) window.clearTimeout(chartReplayTimerRef.current);
  }, []);

  const runExport = useCallback(async (format: "html" | "mdx" | "pptx") => {
    if (exportInFlightRef.current) return;
    exportInFlightRef.current = true;
    const label = format === "pptx" ? "PowerPoint" : format.toUpperCase();
    setNotice(tx(`Exporting ${label}…`));
    try {
      const result = await exportDocument({
        fileName: localExportFileName(projectName),
        format,
        overwrite: false,
        source,
        target: "download"
      });
      setNotice(`${label} ${tx("downloaded")} · ${result.output}`);
    } catch (error) {
      setNotice(error instanceof Error ? `${tx("Export failed")} · ${error.message}` : tx("Export failed"));
    } finally {
      exportInFlightRef.current = false;
    }
  }, [projectName, setNotice, source, tx]);

  useEffect(() => {
    document.title = `${projectName} — SlideX`;
  }, [projectName]);

  useEffect(() => {
    if (source !== documentState.source) documentState.applySource(source);
  }, [documentState, source]);

  useEffect(() => {
    const nextRevision = documentState.snapshot?.revision;
    if (!nextRevision || syncedRevisionRef.current === nextRevision) return;
    syncedRevisionRef.current = nextRevision;
    if (documentState.source !== source) {
      setSource(documentState.source);
      clearBlockSelection();
      setNotice(tx("Reloaded presentation.mdx"));
    }
  }, [clearBlockSelection, documentState.snapshot?.revision, documentState.source, setNotice, source]);

  useEffect(() => {
    setActiveSlideIndex((current) => Math.min(current, Math.max(sliderDocument.scenes.length - 1, 0)));
  }, [sliderDocument.scenes.length]);

  const assetAdapter = useMemo<SlideXEditorAssetAdapter>(() => ({
    async import(file) {
      if (!revision) throw new Error("The local document is not ready yet");
      const { asset } = await uploadAsset(file, revision);
      return { mimeType: file.type || "image/webp", name: asset.name, source: asset.source };
    },
    async remove(assetSource) {
      if (!revision) throw new Error("The local document is not ready yet");
      await deleteAsset(assetSource, revision);
    }
  }), [revision]);

  const pitchCommands = usePitchCommands({
    activeSlide,
    activeSlideIndex,
    assetAdapter,
    commitSource,
    markProjectDirty: () => undefined,
    onImageRemovalAuthRequired: () => undefined,
    onImageUploadAuthRequired: () => undefined,
    pushUndoSnapshot,
    scenes: sliderDocument.scenes,
    selectBlock,
    selectBlocks,
    selectedBlockIndex,
    selectedBlockIndices,
    selectSingleBlock,
    setActiveSlideIndex,
    setNotice,
    setSelectedTemplateId,
    setSource,
    source
  });

  const selectionMdx = useMemo(
    () => getSelectionMdx(activeSlide, selectedBlockIndex, activeSlideIndex, selectedBlockIndices),
    [activeSlide, activeSlideIndex, selectedBlockIndex, selectedBlockIndices]
  );
  const selectedBlock = selectedBlockIndex === null ? undefined : activeSlide?.blocks[selectedBlockIndex];
  const localSelection = useMemo<Selection>(() => {
    const nodeId = selectedBlock && selectedBlockIndex !== null
      ? motionDocBlockKey(selectedBlock, selectedBlockIndex)
      : undefined;
    return {
      ...(selectedBlock ? { blockLabel: `${tx(selectionBlockLabel(selectedBlock.type))} ${tx("selected")}` } : {}),
      ...(selectedBlockIndex === null ? {} : { blockIndex: selectedBlockIndex }),
      ...(nodeId ? { nodeId } : {}),
      slideIndex: activeSlideIndex
    };
  }, [activeSlideIndex, selectedBlock, selectedBlockIndex, tx]);

  useEffect(() => {
    if (!revision) return;
    void updateContext({ ...localSelection, revision }).catch(() => undefined);
  }, [localSelection, revision]);

  const newProject = useCallback(() => {
    pushUndoSnapshot();
    setSource(defaultMdx);
    setActiveSlideIndex(0);
    clearBlockSelection();
    setSelectedTemplateId("");
    setNotice(tx("New local presentation"));
  }, [clearBlockSelection, pushUndoSnapshot, setNotice, tx]);

  usePitchShortcuts({
    activeCanvasTool,
    activeSlideIndex,
    blocked: false,
    closeCodeEditor: () => setIsCodeEditorOpen(false),
    closeExportMenu: () => setIsExportMenuOpen(false),
    closeMobileInspector: () => setIsMobileInspectorOpen(false),
    closeMobileSidebar: () => setIsMobileSidebarOpen(false),
    closePresentationPreview: () => setIsPresentationPreviewOpen(false),
    closeTemplateModal: () => undefined,
    copySelectedBlock: pitchCommands.copySelectedBlock,
    copySlide: pitchCommands.copySlide,
    cutSelectedBlocks: pitchCommands.cutSelectedBlocks,
    deleteSelectedBlocks: pitchCommands.deleteSelectedBlocks,
    deleteSlide: pitchCommands.deleteSlide,
    duplicateSelectedBlock: pitchCommands.duplicateSelectedBlock,
    goToNextSlide: pitchCommands.goToNextSlide,
    goToPreviousSlide: pitchCommands.goToPreviousSlide,
    groupSelectedBlocks: pitchCommands.groupSelectedBlocks,
    isCodeEditorOpen,
    isExportMenuOpen,
    isMobileInspectorOpen,
    isMobileSidebarOpen,
    isPresentationPreviewOpen,
    isTemplateModalOpen: false,
    newProject,
    nudgeSelectedBlocks: pitchCommands.nudgeSelectedBlocks,
    pasteCopiedBlock: pitchCommands.pasteCopiedBlock,
    pasteSlide: pitchCommands.pasteSlide,
    pasteImageFile: pitchCommands.pasteImageFile,
    redoLastChange,
    selectedBlockIndex,
    selectedBlockIndices,
    setActiveCanvasTool,
    undoLastChange,
    ungroupSelectedBlocks: pitchCommands.ungroupSelectedBlocks
  });

  useLocalWorkbenchShortcuts({
    blocked: isCodeEditorOpen || isPresentationPreviewOpen || shortcutHelpOpen,
    onAddChart: () => pitchCommands.addBlockToActiveSlide("Chart"),
    onAddText: () => pitchCommands.addBlockToActiveSlide("Text"),
    onRedo: redoLastChange,
    onToggleCommandMenu: () => setCommandOpen((value) => !value),
    onToggleShortcutHelp: () => setShortcutHelpOpen((value) => !value),
    setOpenTool
  });

  const chartInspector = selectedBlock?.type === "Chart" && selectedBlockIndex !== null ? (
    <ChartInspector block={selectedBlock} onPreviewMotion={triggerChartReplay} update={(props) => pitchCommands.updateBlock(selectedBlockIndex, props)} />
  ) : undefined;

  return (
    <div className="local-workbench-shell">
      <MotionDocEditor
        commands={{
          addAllSlidesFromTemplate: pitchCommands.addAllSlidesFromTemplate,
          addBlockToActiveSlide: pitchCommands.addBlockToActiveSlide,
          addSlide: pitchCommands.addSlide,
          addSlideFromTemplate: pitchCommands.addSlideFromTemplate,
          addSlideWithLayout: pitchCommands.addSlideWithLayout,
          alignSelectedBlocks: pitchCommands.alignSelectedBlocks,
          applyTemplateDeck: pitchCommands.applyTemplateDeck,
          beginBlockTransform: pitchCommands.beginBlockTransform,
          commitMdxSource: commitSource,
          copySelectedBlock: pitchCommands.copySelectedBlock,
          copySlide: pitchCommands.copySlide,
          copySource: async () => { await navigator.clipboard.writeText(source); setNotice(tx("MDX copied")); },
          deleteBlock: pitchCommands.deleteBlock,
          deleteSelectedBlocks: pitchCommands.deleteSelectedBlocks,
          deleteSlide: pitchCommands.deleteSlide,
          duplicateSelectedBlock: pitchCommands.duplicateSelectedBlock,
          duplicateSlide: pitchCommands.duplicateSlide,
          distributeSelectedBlocks: pitchCommands.distributeSelectedBlocks,
          goToNextSlide: pitchCommands.goToNextSlide,
          goToPreviousSlide: pitchCommands.goToPreviousSlide,
          groupSelectedBlocks: pitchCommands.groupSelectedBlocks,
          imageSourceRequiresAbsoluteUrl: pitchCommands.imageSourceRequiresAbsoluteUrl,
          importImageUrlForBlock: pitchCommands.importImageUrlForBlock,
          insertSlideNearActive: pitchCommands.insertSlideNearActive,
          moveBlock: pitchCommands.moveBlock,
          moveBlockToEdge: pitchCommands.moveBlockToEdge,
          moveSelectedBlocksToEdge: pitchCommands.moveSelectedBlocksToEdge,
          snapSelectedBlocksToGrid: pitchCommands.snapSelectedBlocksToGrid,
          newProject,
          onAddActiveSlideComment: () => undefined,
          onPassActiveSlideComment: () => undefined,
          openExport: () => { void runExport("html"); },
          openExportWithFormat: (format) => { void runExport(format); },
          openPresentationPreview: () => setIsPresentationPreviewOpen(true),
          pasteCopiedBlock: pitchCommands.pasteCopiedBlock,
          pasteSlide: pitchCommands.pasteSlide,
          persistActiveSlideShaderFrame: pitchCommands.persistActiveSlideShaderFrame,
          pushUndoSnapshot,
          redoLastChange,
          removeImageForBlock: pitchCommands.removeImageForBlock,
          requestImageRemoval: pitchCommands.requestImageRemoval,
          requestImageUpload: pitchCommands.requestImageUpload,
          renameBlock: pitchCommands.renameBlock,
          reorderBlock: pitchCommands.reorderBlock,
          reorderSlide: pitchCommands.reorderSlide,
          setActiveSlideIndex,
          toggleBlockPositionLock: pitchCommands.toggleBlockPositionLock,
          toggleSelectedBlocksPositionLock: pitchCommands.toggleSelectedBlocksPositionLock,
          undoLastChange,
          ungroupSelectedBlocks: pitchCommands.ungroupSelectedBlocks,
          updateActiveSlideStyle: pitchCommands.updateActiveSlideStyle,
          updateAllSlidesStyle: pitchCommands.updateAllSlidesStyle,
          updateSelectedBlockColor: pitchCommands.updateSelectedBlockColor,
          updateBlock: pitchCommands.updateBlock,
          updatePositionedBlockFrames: pitchCommands.updatePositionedBlockFrames,
          updateSelectionMdx: pitchCommands.updateSelectionMdx,
          uploadImageForBlock: pitchCommands.uploadImageForBlock,
          uploadVideoForBlock: pitchCommands.uploadVideoForBlock,
          useSelectedImageAsBackground: pitchCommands.useSelectedImageAsBackground
        }}
        document={{
          activeSlide,
          activeSlideAccent,
          activeSlideBackground,
          activeSlideComments: [],
          activeSlideIndex,
          activeSlideLayoutPreset,
          activeSlideMutedColor,
          activeSlideShader,
          activeSlideShaderAngle,
          activeSlideShaderColor1,
          activeSlideShaderColor2,
          activeSlideShaderColor3,
          activeSlideShaderColor4,
          activeSlideShaderColor5,
          activeSlideShaderColor6,
          activeSlideShaderDetail,
          activeSlideShaderEngine,
          activeSlideShaderIntensity,
          activeSlideShaderPreset,
          activeSlideShaderScale,
          activeSlideShaderSoftness,
          activeSlideShaderSpeed,
          activeSlideTextColor,
          activeSlideTheme,
          canvasSource,
          isProjectDirty: documentState.saveState !== "saved",
          projectName,
          scenes: sliderDocument.scenes,
          selectedTemplateId,
          slideRows,
          source,
          totalDuration: stats.totalDuration
        }}
        selection={{
          clearBlockSelection,
          draggedBlockIndex,
          dragOverBlockIndex,
          hasCopiedBlock: pitchCommands.hasCopiedBlock,
          selectBlock,
          selectBlockFromLayer: pitchCommands.selectBlockFromLayer,
          selectBlocks,
          selectedBlockIndex,
          selectedBlockIndices,
          selectedBlocksLocked: pitchCommands.selectedBlocksLocked,
          selectionMdx,
          selectSingleBlock,
          setDraggedBlockIndex,
          setDragOverBlockIndex
        }}
        view={{
          accessMode: "guest",
          activeCanvasTool,
          assetUrl: localWorkbenchAssetUrl,
          canvasViewMode,
          canvasShapeTool,
          commentsEnabled: false,
          exportInteraction: "format-menu",
          exportMenuRef,
          headerBadge: null,
          headerBrand: workspaceHomeUrl
            ? <button
                aria-label={tx("Back to OpenSlideX Workspace")}
                className="slidex-header-brand slidex-header-brand-button"
                onClick={() => window.location.assign(workspaceHomeUrl)}
                title={tx("Back to OpenSlideX Workspace")}
                type="button"
              >
                <img alt="SlideX" src={slidexWordmarkSource} />
              </button>
            : <span className="slidex-header-brand"><img alt="SlideX" src={slidexWordmarkSource} /></span>,
          headerTools: <LocalWorkbenchToolbar
            activeCanvasTool={activeCanvasTool}
            disabled={false}
            onAddBlock={pitchCommands.addBlockToActiveSlide}
            onCanvasToolChange={setActiveCanvasTool}
            onSelectShapeTool={(tool) => {
              setActiveCanvasTool("select");
              setCanvasShapeTool(tool);
            }}
            openTool={openTool}
            setOpenTool={setOpenTool}
            shortcutHelpOpen={shortcutHelpOpen}
            setShortcutHelpOpen={setShortcutHelpOpen}
          />,
          headerVariant: "local",
          homeHref: "#",
          inspectorExtension: chartInspector,
          localAssetsOnly: true,
          localChartAnimationsActive,
          interactionDisabled: false,
          isCanvasGridVisible,
          isCanvasSnapEnabled,
          isCodeEditorOpen,
          isExportMenuOpen,
          isMobileInspectorOpen,
          isMobileSidebarOpen,
          notice: `${tx(saveLabel(documentState.saveState))} · ${notice}`,
          onProjectNameChange: renamePresentation,
          replayNonce,
          setActiveCanvasTool,
          setCanvasViewMode,
          setCanvasShapeTool,
          setIsCanvasGridVisible,
          setIsCanvasSnapEnabled,
          setIsCodeEditorOpen,
          setIsExportMenuOpen,
          setIsMobileInspectorOpen,
          setIsMobileSidebarOpen,
          templateLibraryEnabled: false
        }}
      />

      {documentState.message ? (
        <LocalNotice documentState={documentState} onRestoreSaved={restoreSavedCanvas} />
      ) : null}
      <PreviewMediaPolicyProvider assetUrl={localWorkbenchAssetUrl} animateCharts localAssetsOnly>
        <PresentationPreviewModal
          activeSlideIndex={activeSlideIndex}
          documentTitle={projectName}
          isOpen={isPresentationPreviewOpen}
          onClose={() => setIsPresentationPreviewOpen(false)}
          onExport={() => { setIsPresentationPreviewOpen(false); void runExport("html"); }}
          scenes={sliderDocument.scenes}
          source={canvasSource}
        />
      </PreviewMediaPolicyProvider>
      {commandOpen ? <LocalCommandMenu onClose={() => setCommandOpen(false)} onExport={() => void runExport("html")} onRender={() => void renderMontage()} /> : null}
    </div>
  );
}

function LocalNotice({ documentState, onRestoreSaved }: { documentState: LocalDocumentState; onRestoreSaved: () => Promise<void> }) {
  const { tx } = usePitchI18n();
  return (
    <div className={`notice notice-${documentState.saveState}`}>
      <span>{documentState.message}</span>
      <div>
        {documentState.saveState === "conflict" || documentState.saveState === "invalid" ? (
          <>
            <button onClick={() => void navigator.clipboard.writeText(documentState.source)} type="button">{tx("Copy draft")}</button>
            <button onClick={documentState.downloadDraft} type="button">{tx("Download draft")}</button>
            <button onClick={() => void (documentState.saveState === "invalid" ? onRestoreSaved() : documentState.reload())} type="button">{documentState.saveState === "invalid" ? tx("Use saved Canvas") : tx("Reload disk")}</button>
          </>
        ) : <button onClick={documentState.clearMessage} type="button">{tx("Dismiss")}</button>}
      </div>
    </div>
  );
}

function LocalCommandMenu({ onClose, onExport, onRender }: { onClose: () => void; onExport: () => void; onRender: () => void }) {
  const { tx } = usePitchI18n();
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  const actions = [
    [tx("Render montage"), onRender],
    [tx("Export deck"), onExport]
  ] as const;
  return (
    <div className="dialog-backdrop" onMouseDown={onClose} role="presentation">
      <section aria-label={tx("Command menu")} className="command-menu" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <div><Sparkles size={16} /><input autoFocus placeholder={tx("Run a command")} /></div>
        <ul>{actions.map(([label, action]) => <li key={label}><button onClick={() => { action(); onClose(); }} type="button">{label}<span>↵</span></button></li>)}</ul>
      </section>
    </div>
  );
}

function saveLabel(state: LocalDocumentState["saveState"]) {
  if (state === "loading") return "Opening";
  if (state === "saving") return "Saving";
  if (state === "saved") return "Saved";
  if (state === "dirty") return "Editing";
  if (state === "invalid") return "Invalid draft";
  if (state === "conflict") return "Conflict";
  return "Save error";
}

function selectionBlockLabel(type: string) {
  if (type === "ImageBlock") return "Image";
  if (type === "VideoBlock") return "Video";
  return type;
}
