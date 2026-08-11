import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cable, Sparkles } from "lucide-react";
import { MotionDocEditor } from "@open-slidex/editor-ui";

import { defaultMdx } from "@/core/motion-doc/presets/defaultMdx";
import { getSelectionMdx } from "@/core/motion-doc/application/motionDocSerialize";
import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import type { AssistantCanvasActivity, AssistantCanvasTarget } from "@/core/motion-doc/domain/assistantCanvasActivity";
import { useLayerSelection } from "@/features/pitch/ui/hooks/useLayerSelection";
import { useMotionDocDocument } from "@/features/pitch/ui/hooks/useMotionDocDocument";
import { usePitchCommands } from "@/features/pitch/ui/hooks/usePitchCommands";
import { usePitchShortcuts } from "@/features/pitch/ui/hooks/usePitchShortcuts";
import { usePitchUndo } from "@/features/pitch/ui/hooks/usePitchUndo";
import { usePitchWorkspaceViewState } from "@/features/pitch/ui/hooks/usePitchWorkspaceViewState";
import { PresentationPreviewModal } from "@/features/pitch/ui/PresentationPreviewModal";
import type { SlideXEditorAssetAdapter } from "@/features/pitch/domain/localEditor";

import { deleteAsset, exportDocument, renderMontage, updateContext, uploadAsset } from "./api";
import { AiChatPanel } from "./AiChatPanel";
import type { AiCanvasActivityUpdate } from "./useAiCanvasPreview";
import { useAiCanvasPreview } from "./useAiCanvasPreview";
import slidexWordmark from "./assets/slidex-wordmark.png";
import { activeAssistantActivities, aiCompletedEditFocusTarget, aiRunningFocusTarget } from "./aiChatPresentation";
import { ChartInspector } from "./ChartInspector";
import { ConnectAiPanel } from "./ConnectAiPanel";
import { LocalWorkbenchToolbar, type LocalToolMenuId } from "./LocalWorkbenchToolbar";
import { localExportFileName } from "./localExport";
import type { Selection } from "./domain";
import { useLocalWorkbenchShortcuts } from "./useLocalWorkbenchShortcuts";
import type { useLocalDocument } from "./useLocalDocument";

type LocalDocumentState = ReturnType<typeof useLocalDocument>;
const slidexWordmarkSource = slidexWordmark;

export function LocalMotionDocEditor({ documentState }: { documentState: LocalDocumentState }) {
  const [source, setSource] = useState(documentState.source);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [dragOverBlockIndex, setDragOverBlockIndex] = useState<number | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [openTool, setOpenTool] = useState<LocalToolMenuId | null>(null);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [assistantActivities, setAssistantActivities] = useState<AssistantCanvasActivity[]>([]);
  const [localChartAnimationsActive, setLocalChartAnimationsActive] = useState(false);
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const pendingAssistantSlideRef = useRef<number | null>(null);
  const chartReplayTimerRef = useRef<number | null>(null);
  const exportInFlightRef = useRef(false);
  const syncedRevisionRef = useRef(documentState.snapshot?.revision);
  const {
    activeCanvasTool,
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
  const aiCanvasPreview = useAiCanvasPreview(source, revision);
  const aiCanvasTrace = aiCanvasPreview.trace;
  const aiCanvasFocusKey = aiCanvasTrace
    ? `${aiCanvasTrace.id}:${aiCanvasTrace.gesture ?? "move"}:${aiCanvasTrace.target.kind}:${aiCanvasTrace.target.kind === "presentation" ? "deck" : aiCanvasTrace.target.slideIndex}:${aiCanvasTrace.target.kind === "block" ? aiCanvasTrace.target.nodeId ?? aiCanvasTrace.target.blockIndex ?? "block" : "slide"}`
    : "";
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
  } = useMotionDocDocument({ activeSlideIndex, source: aiCanvasPreview.displaySource });
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
  const projectName = sliderDocument.title || documentState.snapshot?.title || "Untitled presentation";

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
    setNotice(`Exporting ${label}…`);
    try {
      const result = await exportDocument({
        fileName: localExportFileName(projectName),
        format,
        overwrite: false,
        source,
        target: "download"
      });
      setNotice(`${label} downloaded · ${result.output}`);
    } catch (error) {
      setNotice(error instanceof Error ? `Export failed · ${error.message}` : "Export failed");
    } finally {
      exportInFlightRef.current = false;
    }
  }, [projectName, setNotice, source]);

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
      if (pendingAssistantSlideRef.current !== null) {
        setActiveSlideIndex(pendingAssistantSlideRef.current);
        pendingAssistantSlideRef.current = null;
      }
      setNotice("Reloaded presentation.mdx");
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
      ...(selectedBlock ? { blockLabel: `${selectionBlockLabel(selectedBlock.type)} selected` } : {}),
      ...(selectedBlockIndex === null ? {} : { blockIndex: selectedBlockIndex }),
      ...(nodeId ? { nodeId } : {}),
      slideIndex: activeSlideIndex
    };
  }, [activeSlideIndex, selectedBlock, selectedBlockIndex]);

  const focusAssistantTarget = useCallback((target: AssistantCanvasTarget) => {
    if (target.kind === "presentation") {
      clearBlockSelection();
      return;
    }
    setActiveSlideIndex(target.slideIndex);
    if (target.kind === "slide") {
      selectSingleBlock(null);
      return;
    }
    const scene = sliderDocument.scenes[target.slideIndex];
    const nodeBlockIndex = target.nodeId
      ? scene?.blocks.findIndex((block, index) => motionDocBlockKey(block, index) === target.nodeId) ?? -1
      : -1;
    const blockIndex = nodeBlockIndex >= 0 ? nodeBlockIndex : target.blockIndex ?? -1;
    selectSingleBlock(blockIndex >= 0 ? blockIndex : null);
  }, [clearBlockSelection, selectSingleBlock, sliderDocument.scenes]);

  useEffect(() => {
    const target = aiCanvasTrace?.target;
    if (!target || target.kind === "presentation") return;
    setActiveSlideIndex(target.slideIndex);
    clearBlockSelection();
  }, [aiCanvasFocusKey, aiCanvasTrace?.target, clearBlockSelection]);

  const updateAssistantActivity = useCallback((update: AiCanvasActivityUpdate) => {
    const { activity } = update;
    if (update.canvasPreview) {
      aiCanvasPreview.start(activity, update.canvasPreview);
      setActiveCanvasTool("select");
      setCanvasShapeTool(null);
      setIsCodeEditorOpen(false);
      setIsMobileInspectorOpen(false);
      setIsMobileSidebarOpen(false);
      setOpenTool(null);
    }
    if (activity.toolName === "open_slidex_edit" && activity.status !== "running") {
      aiCanvasPreview.finish(activity.id, activity.status);
    }
    const runningTarget = aiRunningFocusTarget(activity);
    if (runningTarget) focusAssistantTarget(runningTarget);
    const target = aiCompletedEditFocusTarget(activity);
    if (target) {
      pendingAssistantSlideRef.current = target.slideIndex;
      setActiveSlideIndex(target.slideIndex);
      clearBlockSelection();
      void documentState.reload("");
    }
    setAssistantActivities((current) => activeAssistantActivities(current, activity));
  }, [aiCanvasPreview, clearBlockSelection, documentState, focusAssistantTarget, setActiveCanvasTool, setCanvasShapeTool, setIsCodeEditorOpen, setIsMobileInspectorOpen, setIsMobileSidebarOpen]);

  useEffect(() => {
    if (!revision || aiCanvasPreview.isActive) return;
    void updateContext({ ...localSelection, revision }).catch(() => undefined);
  }, [aiCanvasPreview.isActive, localSelection, revision]);

  const newProject = useCallback(() => {
    pushUndoSnapshot();
    setSource(defaultMdx);
    setActiveSlideIndex(0);
    clearBlockSelection();
    setSelectedTemplateId("");
    setNotice("New local presentation");
  }, [clearBlockSelection, pushUndoSnapshot, setNotice]);

  usePitchShortcuts({
    activeCanvasTool,
    activeSlideIndex,
    blocked: aiCanvasPreview.isActive,
    closeCodeEditor: () => setIsCodeEditorOpen(false),
    closeExportMenu: () => setIsExportMenuOpen(false),
    closeMobileInspector: () => setIsMobileInspectorOpen(false),
    closeMobileSidebar: () => setIsMobileSidebarOpen(false),
    closePresentationPreview: () => setIsPresentationPreviewOpen(false),
    closeTemplateModal: () => undefined,
    copySelectedBlock: pitchCommands.copySelectedBlock,
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
    pasteImageFile: pitchCommands.pasteImageFile,
    redoLastChange,
    selectedBlockIndex,
    selectedBlockIndices,
    setActiveCanvasTool,
    undoLastChange,
    ungroupSelectedBlocks: pitchCommands.ungroupSelectedBlocks
  });

  const focusAssistant = useCallback(() => {
    setAiOpen(true);
    setOpenTool(null);
    window.setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>("[data-ai-composer-input]")?.focus();
    }, 0);
  }, []);

  useLocalWorkbenchShortcuts({
    blocked: aiCanvasPreview.isActive || connectOpen || isCodeEditorOpen || isPresentationPreviewOpen || shortcutHelpOpen,
    onAddChart: () => pitchCommands.addBlockToActiveSlide("Chart"),
    onAddText: () => pitchCommands.addBlockToActiveSlide("Text"),
    onFocusAssistant: focusAssistant,
    onRedo: redoLastChange,
    onToggleCommandMenu: () => setCommandOpen((value) => !value),
    onToggleShortcutHelp: () => setShortcutHelpOpen((value) => !value),
    setOpenTool
  });

  const chartInspector = selectedBlock?.type === "Chart" && selectedBlockIndex !== null ? (
    <ChartInspector block={selectedBlock} onPreviewMotion={triggerChartReplay} update={(props) => pitchCommands.updateBlock(selectedBlockIndex, props)} />
  ) : undefined;

  return (
    <div className={`local-workbench-shell ${aiOpen ? "has-ai-panel" : ""}`}>
      <MotionDocEditor
        assistant={{ activities: assistantActivities, tone: "periwinkle", trace: aiCanvasTrace }}
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
          copySource: async () => { await navigator.clipboard.writeText(source); setNotice("MDX copied"); },
          deleteBlock: pitchCommands.deleteBlock,
          deleteSelectedBlocks: pitchCommands.deleteSelectedBlocks,
          deleteSlide: pitchCommands.deleteSlide,
          duplicateSelectedBlock: pitchCommands.duplicateSelectedBlock,
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
          newProject,
          onAddActiveSlideComment: () => undefined,
          onPassActiveSlideComment: () => undefined,
          openExport: () => { void runExport("html"); },
          openExportWithFormat: (format) => { void runExport(format); },
          openPresentationPreview: () => setIsPresentationPreviewOpen(true),
          pasteCopiedBlock: pitchCommands.pasteCopiedBlock,
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
          canvasShapeTool,
          commentsEnabled: false,
          exportInteraction: "format-menu",
          exportMenuRef,
          headerBadge: null,
          headerBrand: <span className="slidex-header-brand"><img alt="SlideX" src={slidexWordmarkSource} /></span>,
          headerTools: <LocalWorkbenchToolbar
            disabled={aiCanvasPreview.isActive}
            onAddBlock={pitchCommands.addBlockToActiveSlide}
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
          hideInspector: aiOpen,
          homeHref: "#",
          inspectorExtension: chartInspector,
          localAssetsOnly: true,
          localChartAnimationsActive,
          interactionDisabled: aiCanvasPreview.isActive,
          isCanvasGridVisible,
          isCanvasSnapEnabled,
          isCodeEditorOpen,
          isExportMenuOpen,
          isMobileInspectorOpen,
          isMobileSidebarOpen,
          notice: `${saveLabel(documentState.saveState)} · ${notice}`,
          replayNonce,
          setActiveCanvasTool,
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
        <LocalNotice documentState={documentState} />
      ) : null}
      <PresentationPreviewModal
        activeSlideIndex={activeSlideIndex}
        documentTitle={projectName}
        isOpen={isPresentationPreviewOpen}
        onClose={() => setIsPresentationPreviewOpen(false)}
        onExport={() => { setIsPresentationPreviewOpen(false); void runExport("html"); }}
        scenes={sliderDocument.scenes}
        source={canvasSource}
      />
      {!aiOpen ? <button className="ai-fab" onClick={focusAssistant} type="button"><Sparkles size={18} /><span>Ask AI</span></button> : null}
      {aiOpen && revision ? <AiChatPanel expectedRevision={revision} onActivityChange={updateAssistantActivity} onApplied={documentState.reload} onCanvasPreviewClear={aiCanvasPreview.clear} onClearScope={() => selectSingleBlock(null)} onClose={() => { aiCanvasPreview.clear(); setAiOpen(false); }} onConnect={() => setConnectOpen(true)} onFocusTarget={focusAssistantTarget} projectName={projectName} saveState={documentState.saveState} selection={localSelection} /> : null}
      {connectOpen ? <ConnectAiPanel onClose={() => setConnectOpen(false)} /> : null}
      {commandOpen ? <LocalCommandMenu onClose={() => setCommandOpen(false)} onConnect={() => setConnectOpen(true)} onExport={() => void runExport("html")} onOpenAi={() => setAiOpen(true)} onRender={() => void renderMontage()} /> : null}
    </div>
  );
}

function LocalNotice({ documentState }: { documentState: LocalDocumentState }) {
  return (
    <div className={`notice notice-${documentState.saveState}`}>
      <span>{documentState.message}</span>
      <div>
        {documentState.saveState === "conflict" ? (
          <>
            <button onClick={() => void navigator.clipboard.writeText(documentState.source)} type="button">Copy draft</button>
            <button onClick={documentState.downloadDraft} type="button">Download draft</button>
            <button onClick={() => void documentState.reload()} type="button">Reload disk</button>
          </>
        ) : <button onClick={documentState.clearMessage} type="button">Dismiss</button>}
      </div>
    </div>
  );
}

function LocalCommandMenu({ onClose, onConnect, onExport, onOpenAi, onRender }: { onClose: () => void; onConnect: () => void; onExport: () => void; onOpenAi: () => void; onRender: () => void }) {
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  const actions = [
    ["Render montage", onRender],
    ["Export deck", onExport],
    ["Open AI workspace", onOpenAi],
    ["Connect Codex or Claude", onConnect]
  ] as const;
  return (
    <div className="dialog-backdrop" onMouseDown={onClose} role="presentation">
      <section aria-label="Command menu" className="command-menu" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <div><Sparkles size={16} /><input autoFocus placeholder="Run a command" /></div>
        <ul>{actions.map(([label, action]) => <li key={label}><button onClick={() => { action(); onClose(); }} type="button">{label}<span>{label.includes("Connect") ? <Cable size={12} /> : "↵"}</span></button></li>)}</ul>
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
