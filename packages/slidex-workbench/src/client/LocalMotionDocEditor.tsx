import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Sparkles } from "lucide-react";
import { MotionDocEditor } from "@open-slidex/editor-ui";

import { defaultMdx } from "@/core/motion-doc/presets/defaultMdx";
import { PresentationPlaybackModePicker } from "@/features/pitch/ui/PresentationPlaybackModePicker";
import { motionDocChartAnimationDuration, motionDocChartModel, motionDocToReactPresentationSource } from "@open-slidex/sdk";
import { getSelectionMdx } from "@/core/motion-doc/application/motionDocSerialize";
import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import type { CanvasShapeTool } from "@/features/pitch/application/shapeDrawing";
import type { SourceHistoryEntry } from "@/features/pitch/application/sourceHistory";
import { htmlSourceWorkspace } from "@/features/pitch/application/htmlRuntimePolicy";
import { useLayerSelection } from "@/features/pitch/ui/hooks/useLayerSelection";
import { useMotionDocDocument } from "@/features/pitch/ui/hooks/useMotionDocDocument";
import { usePitchCommands } from "@/features/pitch/ui/hooks/usePitchCommands";
import { usePitchShortcuts } from "@/features/pitch/ui/hooks/usePitchShortcuts";
import { usePitchUndo } from "@/features/pitch/ui/hooks/usePitchUndo";
import { usePitchWorkspaceViewState } from "@/features/pitch/ui/hooks/usePitchWorkspaceViewState";
import { PresentationPreviewModal } from "@/features/pitch/ui/PresentationPreviewModal";
import { PresentationConsoleModal } from "@/features/pitch/ui/PresentationConsoleModal";
import { PresentationProjectionWindow } from "@/features/pitch/ui/PresentationProjectionWindow";
import { PresenterNotesFab } from "@/features/pitch/ui/PresenterNotesFab";
import { MotionSequencePanel } from "@/features/pitch/ui/MotionSequenceStrip";
import { presenterNotesKey } from "@/features/pitch/application/presenterNotes";
import { PreviewMediaPolicyProvider } from "@/features/pitch/ui/preview/PreviewMediaPolicy";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import type { SlideXEditorAssetAdapter } from "@/features/pitch/domain/localEditor";

import {
  deleteAsset,
  closePresenterRemoteSession,
  createPresenterRemoteSession,
  exportDocument,
  localWorkbenchAssetUrl,
  materializeLocalExportMedia,
  prepareExportDestination,
  renderMontage,
  subscribePresenterRemoteSession,
  updateContext,
  updateHtmlAsset,
  updatePresenterRemoteSession,
  uploadAsset
} from "./api";
import slidexWordmark from "./assets/slidex-wordmark.png";
import { latestRequest } from "./latestRequest";
const ChartInspector = lazy(() => import("./ChartInspector").then((module) => ({ default: module.ChartInspector })));
import { HtmlCanvasToolbar } from "./HtmlCanvasToolbar";
import { HtmlWorkspaceEditor, type HtmlWorkspaceSaveReason } from "./HtmlWorkspaceEditor";
import { LocalWorkbenchToolbar, type LocalToolMenuId } from "./LocalWorkbenchToolbar";
import { localExportFileName, localExportOptionsForMode, localExportPreflightError } from "./localExport";
import { normalizePresentationTitle, renamePresentationSource } from "./presentationTitle";
import type { Selection } from "./domain";
import { useLocalWorkbenchShortcuts } from "./useLocalWorkbenchShortcuts";
import type { useLocalDocument } from "./useLocalDocument";

type LocalDocumentState = ReturnType<typeof useLocalDocument>;
const slidexWordmarkSource = slidexWordmark;
const emptySlideComments: ComponentProps<typeof MotionDocEditor>["document"]["activeSlideComments"] = [];
const ignoreLocalComment = () => undefined;
const chartReplayBufferMs = 180;

function chartReplayDuration(activeSlide: ReturnType<typeof useMotionDocDocument>["activeSlide"]) {
  const longestChartMotion = activeSlide?.blocks.reduce((longest, block) => {
    if (block.type !== "Chart") return longest;
    return Math.max(longest, motionDocChartAnimationDuration(motionDocChartModel(block.props)));
  }, 0) ?? 0;
  return longestChartMotion + chartReplayBufferMs;
}

export function LocalMotionDocEditor({ documentState }: { documentState: LocalDocumentState }) {
  const { tx } = usePitchI18n();
  const {
    acceptExternalMutation: acceptExternalDocumentMutation,
    applySource: applyDocumentSource,
    beginExternalMutation: beginExternalDocumentMutation,
    cancelExternalMutation: cancelExternalDocumentMutation,
    commit: commitDocument,
    reload: reloadDocument,
    saveState: documentSaveState,
    snapshot: documentSnapshot,
    source: persistedDocumentSource
  } = documentState;
  const [source, setSource] = useState(persistedDocumentSource);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [dragOverBlockIndex, setDragOverBlockIndex] = useState<number | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [openTool, setOpenTool] = useState<LocalToolMenuId | null>(null);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [localChartAnimationsActive, setLocalChartAnimationsActive] = useState(false);
  const [isPresenterConsoleOpen, setIsPresenterConsoleOpen] = useState(false);
  const [isPlaybackModePickerOpen, setIsPlaybackModePickerOpen] = useState(false);
  // Session-only notes never mutate the source or trigger document autosave.
  const [presenterNotes, setPresenterNotes] = useState<Record<string, string>>({});
  const changePresenterNotes = useCallback((id: string, value: string) => {
    setPresenterNotes(current => ({ ...current, [id]: value }));
  }, []);
  const undoStackRef = useRef<SourceHistoryEntry[]>([]);
  const redoStackRef = useRef<SourceHistoryEntry[]>([]);
  const chartReplayTimerRef = useRef<number | null>(null);
  const exportInFlightRef = useRef(false);
  const syncedRevisionRef = useRef(documentSnapshot?.revision);
  const {
    activeCanvasTool,
    canvasViewMode,
    canvasShapeTool,
    exportMenuRef,
    isCanvasGridVisible,
    isCanvasSafeAreaVisible,
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
    setIsCanvasSafeAreaVisible,
    setIsCanvasSnapEnabled,
    setIsCodeEditorOpen,
    setIsExportMenuOpen,
    setIsMobileInspectorOpen,
    setIsMobileSidebarOpen,
    setIsPresentationPreviewOpen,
    setNotice,
    setReplayNonce
  } = usePitchWorkspaceViewState();
  const revision = documentSnapshot?.revision ?? "";
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
  const projectName = sliderDocument.title || documentSnapshot?.title || tx("Untitled presentation");
  const isProjectionWindow = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("slidexProjection") === "1";
  const [presenterWindowId] = useState(() => new URLSearchParams(window.location.search).get("presenterWindow") || crypto.randomUUID());
  const projectionChannel = `openslidex-presenter:${window.location.pathname}:${presenterWindowId}`;
  const workspaceHomeUrl = __OPEN_SLIDEX_WORKSPACE_URL__ || (
    /^\/workspace\/[A-Za-z0-9._-]+\/?$/.test(window.location.pathname)
      ? `${window.location.origin}/workspace`
      : ""
  );
  const htmlWorkspace = useMemo(() => htmlSourceWorkspace(sliderDocument), [sliderDocument]);
  const hasOriginalHtml = Boolean(htmlWorkspace);
  const availableExportFormats = useMemo(
    () => localExportOptionsForMode(hasOriginalHtml ? "html-source" : "native").map((option) => option.id),
    [hasOriginalHtml]
  );
  const setWorkspaceActiveSlideIndex = useCallback<typeof setActiveSlideIndex>((next) => {
    if (hasOriginalHtml) setCanvasViewMode("slide");
    setActiveSlideIndex(next);
  }, [hasOriginalHtml, setCanvasViewMode]);

  const saveHtmlSource = useCallback(async (
    sourcePath: string,
    html: string,
    reason: HtmlWorkspaceSaveReason = "manual"
  ) => {
    const mutation = beginExternalDocumentMutation();
    if (!mutation) {
      throw new Error(tx("Wait for presentation.tsx to finish saving before editing HTML"));
    }
    let externalMutationActive = true;
    try {
      const result = await updateHtmlAsset(sourcePath, html, mutation.expectedRevision);
      syncedRevisionRef.current = result.document.revision;
      const nextSource = acceptExternalDocumentMutation(result.document);
      externalMutationActive = false;
      setSource(nextSource);
      clearBlockSelection();
      if (reason === "manual") setNotice(tx("HTML source saved"));
      return { source: result.source };
    } catch (error) {
      if (externalMutationActive) cancelExternalDocumentMutation();
      throw error;
    }
  }, [acceptExternalDocumentMutation, beginExternalDocumentMutation, cancelExternalDocumentMutation, clearBlockSelection, setNotice, tx]);

  const restoreSavedCanvas = useCallback(async () => {
    const next = await reloadDocument("Restored the saved Canvas and discarded the invalid browser draft.");
    syncedRevisionRef.current = next.revision;
    setSource(next.source);
    clearBlockSelection();
  }, [clearBlockSelection, reloadDocument]);

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
    }, chartReplayDuration(activeSlide));
  }, [activeSlide, setReplayNonce]);

  useEffect(() => () => {
    if (chartReplayTimerRef.current !== null) window.clearTimeout(chartReplayTimerRef.current);
  }, []);

  const executeExport = useCallback(async (format: "html" | "mdx" | "pptx", htmlMode?: "original" | "player") => {
    if (exportInFlightRef.current) return;
    exportInFlightRef.current = true;
    const label = format === "pptx" ? "PowerPoint" : format.toUpperCase();
    setNotice(tx(`Exporting ${label}…`));
    try {
      const preflightError = localExportPreflightError(source, documentSaveState);
      if (preflightError) throw new Error(preflightError);
      const fileName = localExportFileName(projectName);
      // Ask where to save while this call still belongs to the user's menu
      // click. Chromium may otherwise block the eventual synthetic download
      // after an asynchronous HTML/PPTX render has completed.
      const destination = await prepareExportDestination(fileName, format);
      if (!destination) {
        setNotice(tx("Export cancelled"));
        return;
      }
      // The Canvas is optimistically editable while its MDX autosave is in
      // flight. Do not send that transient draft straight to /export: an
      // asset or MotionDoc validation failure there would otherwise surface
      // only as a browser-console 422 and leave the user without a usable
      // export. Commit first and export the canonical server source.
      const savedDocument = documentSaveState === "saved" && persistedDocumentSource === source
        ? documentSnapshot
        : await commitDocument();
      if (!savedDocument) {
        throw new Error(tx("The Canvas could not be saved. Fix the Canvas error or restore the saved version before exporting."));
      }
      setNotice(tx(`Exporting ${label}…`));
      const preparedMedia = await materializeLocalExportMedia({
        expectedRevision: savedDocument.revision,
        source: savedDocument.source
      });
      if (preparedMedia.source !== savedDocument.source) {
        setSource(preparedMedia.source);
        setNotice(tx("Prepared shape image for export"));
      }
      const result = await exportDocument({
        fileName,
        format,
        htmlMode,
        overwrite: false,
        source: preparedMedia.source,
        target: "download"
      }, destination);
      setNotice(`${label} ${tx("downloaded")} · ${result.output}`);
    } catch (error) {
      setNotice(error instanceof Error ? `${tx("Export failed")} · ${error.message}` : tx("Export failed"));
    } finally {
      exportInFlightRef.current = false;
    }
  }, [commitDocument, documentSaveState, documentSnapshot, persistedDocumentSource, projectName, setNotice, source, tx]);

  const runExport = useCallback(async (format: "html" | "mdx" | "pptx") => {
    if (hasOriginalHtml && format === "pptx") {
      setIsExportMenuOpen(false);
      setNotice(tx("HTML source presentations can export only HTML or MDX"));
      return;
    }
    if (format === "html") {
      setIsExportMenuOpen(false);
      await executeExport("html", hasOriginalHtml ? "original" : "player");
      return;
    }
    await executeExport(format);
  }, [executeExport, hasOriginalHtml, setIsExportMenuOpen, setNotice, tx]);

  useEffect(() => {
    document.title = `${projectName} — SlideX`;
  }, [projectName]);

  useEffect(() => {
    if (source !== persistedDocumentSource) applyDocumentSource(source);
  }, [applyDocumentSource, persistedDocumentSource, source]);

  useEffect(() => {
    const nextRevision = documentSnapshot?.revision;
    if (!nextRevision || syncedRevisionRef.current === nextRevision) return;
    syncedRevisionRef.current = nextRevision;
    if (persistedDocumentSource !== source) {
      setSource(persistedDocumentSource);
      clearBlockSelection();
      setNotice(tx("Reloaded presentation.tsx"));
    }
  }, [clearBlockSelection, documentSnapshot?.revision, persistedDocumentSource, setNotice, source]);

  useEffect(() => {
    setActiveSlideIndex((current) => Math.min(current, Math.max(sliderDocument.scenes.length - 1, 0)));
  }, [sliderDocument.scenes.length]);

  useEffect(() => {
    if (!htmlWorkspace) return;
    clearBlockSelection();
    setCanvasShapeTool(null);
    setIsCodeEditorOpen(false);
  }, [clearBlockSelection, htmlWorkspace?.source, setCanvasShapeTool, setIsCodeEditorOpen]);

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
    setActiveSlideIndex: setWorkspaceActiveSlideIndex,
    setNotice,
    setSelectedTemplateId,
    setSource,
    source
  });
  const {
    commandActions: pitchCommandActions,
    hasCopiedBlock,
    imageSourceRequiresAbsoluteUrl,
    selectedBlocksLocked
  } = pitchCommands;

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

  const contextSyncRef = useRef<ReturnType<typeof latestRequest<Selection & { revision: string }>> | null>(null);
  useEffect(() => {
    const sync = latestRequest((value: Selection & { revision: string }) => updateContext(value).catch(() => undefined));
    contextSyncRef.current = sync;
    return () => { sync.dispose(); contextSyncRef.current = null; };
  }, []);
  const { slideIndex: contextSlide, blockIndex: contextBlock, nodeId: contextNode } = localSelection;
  useEffect(() => {
    if (revision) contextSyncRef.current?.schedule({ slideIndex: contextSlide, blockIndex: contextBlock, nodeId: contextNode, revision });
  }, [contextSlide, contextBlock, contextNode, revision]);

  const newProject = useCallback(() => {
    pushUndoSnapshot();
    setSource(motionDocToReactPresentationSource(defaultMdx));
    setActiveSlideIndex(0);
    clearBlockSelection();
    setSelectedTemplateId("");
    setNotice(tx("New local presentation"));
  }, [clearBlockSelection, pushUndoSnapshot, setNotice, tx]);

  usePitchShortcuts({
    activeSlideIndex,
    blocked: Boolean(htmlWorkspace) || isPresenterConsoleOpen || isPlaybackModePickerOpen,
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
    navigationOnly: Boolean(htmlWorkspace),
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
    blocked: Boolean(htmlWorkspace) || isCodeEditorOpen || isPresentationPreviewOpen || isPresenterConsoleOpen || isPlaybackModePickerOpen || shortcutHelpOpen,
    onAddChart: () => pitchCommands.addBlockToActiveSlide("Chart"),
    onAddText: () => pitchCommands.addBlockToActiveSlide("Text"),
    onRedo: redoLastChange,
    onToggleCommandMenu: () => setCommandOpen((value) => !value),
    onToggleShortcutHelp: () => setShortcutHelpOpen((value) => !value),
    setOpenTool
  });

  const chartInspector = useMemo(() => (
    selectedBlock?.type === "Chart" && selectedBlockIndex !== null ? (
      <Suspense fallback={<div aria-busy="true" className="min-h-24" />}>
        <ChartInspector block={selectedBlock} onPreviewMotion={triggerChartReplay} update={(props) => pitchCommandActions.updateBlock(selectedBlockIndex, props)} />
      </Suspense>
    ) : undefined
  ), [pitchCommandActions.updateBlock, selectedBlock, selectedBlockIndex, triggerChartReplay]);

  const activeHtmlPage = htmlWorkspace
    ? Number(activeSlide?.blocks.find((block) => block.type === "HtmlEmbedBlock")?.props.page ?? activeSlideIndex + 1)
    : activeSlideIndex + 1;
  const closeMobileInspector = useCallback(() => setIsMobileInspectorOpen(false), [setIsMobileInspectorOpen]);
  const copySource = useCallback(async () => {
    await navigator.clipboard.writeText(source);
    setNotice(tx("TSX copied"));
  }, [setNotice, source, tx]);
  const openDefaultExport = useCallback(() => { void runExport("html"); }, [runExport]);
  const openExportWithFormat = useCallback((format: "html" | "mdx" | "pptx") => {
    void runExport(format);
  }, [runExport]);
  const openProjectionWindow = useCallback(() => {
    const projectionUrl = new URL(window.location.href);
    projectionUrl.searchParams.set("slidexProjection", "1");
    projectionUrl.searchParams.set("presenterWindow", presenterWindowId);
    const projectionWindow = window.open(projectionUrl.toString(), `openslidex-projection-${presenterWindowId}`, "popup=yes,width=1600,height=900");
    if (!projectionWindow) setNotice(tx("Allow pop-ups to open the projection window."));
  }, [presenterWindowId, setNotice, tx]);
  const openPresentationPreview = useCallback(() => {
    setIsPlaybackModePickerOpen(true);
  }, []);
  const selectShapeTool = useCallback((tool: CanvasShapeTool | null) => {
    setActiveCanvasTool("select");
    setCanvasShapeTool(tool);
  }, [setActiveCanvasTool, setCanvasShapeTool]);
  const headerBrand = useMemo(() => workspaceHomeUrl
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
    [tx, workspaceHomeUrl]
  );
  const headerTools = useMemo(() => htmlWorkspace ? (
    <HtmlCanvasToolbar activeTool={activeCanvasTool} onToolChange={setActiveCanvasTool} />
  ) : (
    <LocalWorkbenchToolbar
      activeCanvasTool={activeCanvasTool}
      disabled={false}
      onAddBlock={pitchCommandActions.addBlockToActiveSlide}
      onCanvasToolChange={setActiveCanvasTool}
      onSelectShapeTool={selectShapeTool}
      openTool={openTool}
      setOpenTool={setOpenTool}
      shortcutHelpOpen={shortcutHelpOpen}
      setShortcutHelpOpen={setShortcutHelpOpen}
    />
  ), [
    activeCanvasTool,
    htmlWorkspace,
    openTool,
    pitchCommandActions.addBlockToActiveSlide,
    selectShapeTool,
    setActiveCanvasTool,
    setOpenTool,
    setShortcutHelpOpen,
    shortcutHelpOpen
  ]);
  const inspectorOverride = useMemo(() => htmlWorkspace ? (
    <HtmlWorkspaceEditor
      activePage={Number.isInteger(activeHtmlPage) && activeHtmlPage > 0 ? activeHtmlPage : activeSlideIndex + 1}
      onCloseMobile={closeMobileInspector}
      onSave={saveHtmlSource}
      pageCount={htmlWorkspace.pageCount}
      sourcePath={htmlWorkspace.source}
    />
  ) : undefined, [activeHtmlPage, activeSlideIndex, closeMobileInspector, htmlWorkspace, saveHtmlSource]);
  const motionSequenceInspector = useMemo(() => htmlWorkspace ? undefined : (
    <MotionSequencePanel
      onPreview={triggerChartReplay}
      onReorder={pitchCommandActions.reorderMotionActions}
      onSelectBlock={selectSingleBlock}
      scene={activeSlide}
    />
  ), [activeSlide, htmlWorkspace, pitchCommandActions.reorderMotionActions, selectSingleBlock, triggerChartReplay]);
  const inspectorExtension = htmlWorkspace ? undefined : chartInspector;

  const editorCommands = useMemo<ComponentProps<typeof MotionDocEditor>["commands"]>(() => ({
          addAllSlidesFromTemplate: pitchCommandActions.addAllSlidesFromTemplate,
          addBlockToActiveSlide: pitchCommandActions.addBlockToActiveSlide,
          addSlide: pitchCommandActions.addSlide,
          addSlideFromTemplate: pitchCommandActions.addSlideFromTemplate,
          addSlideWithLayout: pitchCommandActions.addSlideWithLayout,
          alignSelectedBlocks: pitchCommandActions.alignSelectedBlocks,
          applyTemplateDeck: pitchCommandActions.applyTemplateDeck,
          beginBlockTransform: pitchCommandActions.beginBlockTransform,
          commitMdxSource: commitSource,
          copySelectedBlock: pitchCommandActions.copySelectedBlock,
          copySlide: pitchCommandActions.copySlide,
          copySource,
          deleteBlock: pitchCommandActions.deleteBlock,
          deleteSelectedBlocks: pitchCommandActions.deleteSelectedBlocks,
          deleteSlide: pitchCommandActions.deleteSlide,
          duplicateSelectedBlock: pitchCommandActions.duplicateSelectedBlock,
          duplicateSlide: pitchCommandActions.duplicateSlide,
          distributeSelectedBlocks: pitchCommandActions.distributeSelectedBlocks,
          goToNextSlide: pitchCommandActions.goToNextSlide,
          goToPreviousSlide: pitchCommandActions.goToPreviousSlide,
          groupSelectedBlocks: pitchCommandActions.groupSelectedBlocks,
          imageSourceRequiresAbsoluteUrl,
          importImageUrlForBlock: pitchCommandActions.importImageUrlForBlock,
          insertSlideNearActive: pitchCommandActions.insertSlideNearActive,
          moveBlock: pitchCommandActions.moveBlock,
          moveBlockToEdge: pitchCommandActions.moveBlockToEdge,
          moveSlideIntoMorphGroup: pitchCommandActions.moveSlideIntoMorphGroup,
          moveSlideOutOfMorphGroup: pitchCommandActions.moveSlideOutOfMorphGroup,
          moveSelectedBlocksToEdge: pitchCommandActions.moveSelectedBlocksToEdge,
          snapSelectedBlocksToGrid: pitchCommandActions.snapSelectedBlocksToGrid,
          newProject,
          onAddActiveSlideComment: ignoreLocalComment,
          onPassActiveSlideComment: ignoreLocalComment,
          openExport: openDefaultExport,
          openExportWithFormat,
          openPresentationPreview,
          pasteCopiedBlock: pitchCommandActions.pasteCopiedBlock,
          pasteSlide: pitchCommandActions.pasteSlide,
          persistActiveSlideShaderFrame: pitchCommandActions.persistActiveSlideShaderFrame,
          pushUndoSnapshot,
          redoLastChange,
          removeImageForBlock: pitchCommandActions.removeImageForBlock,
          requestImageRemoval: pitchCommandActions.requestImageRemoval,
          requestImageUpload: pitchCommandActions.requestImageUpload,
          renameBlock: pitchCommandActions.renameBlock,
          reorderBlock: pitchCommandActions.reorderBlock,
          reorderMotionActions: pitchCommandActions.reorderMotionActions,
          setSharedMorphLink: pitchCommandActions.setSharedMorphLink,
          setSharedMorphReturnLink: pitchCommandActions.setSharedMorphReturnLink,
          reorderSlide: pitchCommandActions.reorderSlide,
          setActiveSlideIndex: setWorkspaceActiveSlideIndex,
          toggleBlockPositionLock: pitchCommandActions.toggleBlockPositionLock,
          toggleSelectedBlocksPositionLock: pitchCommandActions.toggleSelectedBlocksPositionLock,
          undoLastChange,
          ungroupSelectedBlocks: pitchCommandActions.ungroupSelectedBlocks,
          unlinkSharedMorphGroup: pitchCommandActions.unlinkSharedMorphGroup,
          extendSharedMorphGroup: pitchCommandActions.extendSharedMorphGroup,
          updateActiveSlideStyle: pitchCommandActions.updateActiveSlideStyle,
          updateAllSlidesStyle: pitchCommandActions.updateAllSlidesStyle,
          updateSlideStyle: pitchCommandActions.updateSlideStyle,
          updateSelectedBlockColor: pitchCommandActions.updateSelectedBlockColor,
          updateBlock: pitchCommandActions.updateBlock,
          updatePositionedBlockFrames: pitchCommandActions.updatePositionedBlockFrames,
          updateSelectionMdx: pitchCommandActions.updateSelectionMdx,
          uploadImageForBlock: pitchCommandActions.uploadImageForBlock,
          uploadVideoForBlock: pitchCommandActions.uploadVideoForBlock,
          useSelectedImageAsBackground: pitchCommandActions.useSelectedImageAsBackground
  }), [
    commitSource,
    copySource,
    imageSourceRequiresAbsoluteUrl,
    newProject,
    openDefaultExport,
    openExportWithFormat,
    openPresentationPreview,
    pitchCommandActions,
    pushUndoSnapshot,
    redoLastChange,
    setWorkspaceActiveSlideIndex,
    undoLastChange
  ]);
  const editorDocument = useMemo<ComponentProps<typeof MotionDocEditor>["document"]>(() => ({
          activeSlide,
          activeSlideAccent,
          activeSlideBackground,
          activeSlideComments: emptySlideComments,
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
          isProjectDirty: documentSaveState !== "saved",
          projectName,
          scenes: sliderDocument.scenes,
          selectedTemplateId,
          slideRows,
          source,
          totalDuration: stats.totalDuration
  }), [
    activeSlide,
    activeSlideAccent,
    activeSlideBackground,
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
    documentSaveState,
    projectName,
    selectedTemplateId,
    slideRows,
    sliderDocument.scenes,
    source,
    stats.totalDuration
  ]);
  const editorSelection = useMemo<ComponentProps<typeof MotionDocEditor>["selection"]>(() => ({
          clearBlockSelection,
          draggedBlockIndex,
          dragOverBlockIndex,
          hasCopiedBlock,
          selectBlock,
          selectBlockFromLayer: pitchCommandActions.selectBlockFromLayer,
          selectBlocks,
          selectedBlockIndex,
          selectedBlockIndices,
          selectedBlocksLocked,
          selectionMdx,
          selectSingleBlock,
          setDraggedBlockIndex,
          setDragOverBlockIndex
  }), [
    clearBlockSelection,
    draggedBlockIndex,
    dragOverBlockIndex,
    hasCopiedBlock,
    pitchCommandActions.selectBlockFromLayer,
    selectBlock,
    selectBlocks,
    selectedBlockIndex,
    selectedBlockIndices,
    selectedBlocksLocked,
    selectionMdx,
    selectSingleBlock
  ]);
  const editorView = useMemo<ComponentProps<typeof MotionDocEditor>["view"]>(() => ({
          accessMode: "guest",
          activeCanvasTool,
          authoringDisabled: Boolean(htmlWorkspace),
          assetUrl: localWorkbenchAssetUrl,
          canvasPreviewSuspended: isPresentationPreviewOpen || isPresenterConsoleOpen,
          canvasViewMode,
          canvasShapeTool,
          commentsEnabled: false,
          exportFormats: availableExportFormats,
          exportInteraction: "format-menu",
          exportMenuRef,
          headerBadge: null,
          headerBrand,
          headerTools,
          headerVariant: "local",
          homeHref: "#",
          inspectorHeaderExtension: motionSequenceInspector,
          inspectorExtension,
          inspectorOverride,
          localAssetsOnly: true,
          localChartAnimationsActive,
          interactionDisabled: false,
          isCanvasGridVisible,
          isCanvasSafeAreaVisible,
          isCanvasSnapEnabled,
          isCodeEditorOpen: htmlWorkspace ? false : isCodeEditorOpen,
          isExportMenuOpen,
          isMobileInspectorOpen,
          isMobileSidebarOpen,
          notice: `${tx(saveLabel(documentSaveState))} · ${notice}`,
          onProjectNameChange: renamePresentation,
          onReplayAnimations: triggerChartReplay,
          replayNonce,
          setActiveCanvasTool,
          setCanvasViewMode,
          setCanvasShapeTool,
          setIsCanvasGridVisible,
          setIsCanvasSafeAreaVisible,
          setIsCanvasSnapEnabled,
          setIsCodeEditorOpen,
          setIsExportMenuOpen,
          setIsMobileInspectorOpen,
          setIsMobileSidebarOpen,
          singleSlideCanvas: Boolean(htmlWorkspace),
          templateLibraryEnabled: false
  }), [
    activeCanvasTool,
    availableExportFormats,
    canvasShapeTool,
    canvasViewMode,
    htmlWorkspace,
    headerBrand,
    headerTools,
    inspectorExtension,
    inspectorOverride,
    documentSaveState,
    exportMenuRef,
    isCanvasGridVisible,
    isCanvasSafeAreaVisible,
    isCanvasSnapEnabled,
    isCodeEditorOpen,
    isExportMenuOpen,
    isMobileInspectorOpen,
    isMobileSidebarOpen,
    motionSequenceInspector,
    isPresentationPreviewOpen,
    isPresenterConsoleOpen,
    localChartAnimationsActive,
    notice,
    replayNonce,
    renamePresentation,
    setActiveCanvasTool,
    setCanvasShapeTool,
    setCanvasViewMode,
    setIsCanvasGridVisible,
    setIsCanvasSafeAreaVisible,
    setIsCanvasSnapEnabled,
    setIsCodeEditorOpen,
    setIsExportMenuOpen,
    setIsMobileInspectorOpen,
    setIsMobileSidebarOpen,
    tx,
    triggerChartReplay
  ]);
  const editorProps = useMemo<ComponentProps<typeof MotionDocEditor>>(() => ({
    commands: editorCommands,
    document: editorDocument,
    selection: editorSelection,
    view: editorView
  }), [editorCommands, editorDocument, editorSelection, editorView]);

  if (isProjectionWindow) {
    return <PreviewMediaPolicyProvider assetUrl={localWorkbenchAssetUrl} animateCharts localAssetsOnly><PresentationProjectionWindow channelName={projectionChannel} initialSlideIndex={activeSlideIndex} scenes={sliderDocument.scenes} onSubscribeRemoteSession={subscribePresenterRemoteSession} /></PreviewMediaPolicyProvider>;
  }

  return (
    <div className="local-workbench-shell">
      <MotionDocEditor {...editorProps} />
      <PresenterNotesFab
        notes={presenterNotes[presenterNotesKey(activeSlide, activeSlideIndex)] ?? String(activeSlide?.props.presenterNotes ?? "")}
        onChange={(notes) => changePresenterNotes(presenterNotesKey(activeSlide, activeSlideIndex), notes)}
        slideNumber={activeSlideIndex + 1}
      />

      {documentState.message ? (
        <LocalNotice documentState={documentState} onRestoreSaved={restoreSavedCanvas} />
      ) : null}
      <PreviewMediaPolicyProvider assetUrl={localWorkbenchAssetUrl} animateCharts localAssetsOnly>
        <PresentationPlaybackModePicker
          isOpen={isPlaybackModePickerOpen}
          scene={activeSlide}
          index={activeSlideIndex}
          onClose={() => setIsPlaybackModePickerOpen(false)}
          onSelect={(mode) => {
            setIsPlaybackModePickerOpen(false);
            if (mode === "presenter") { openProjectionWindow(); setIsPresenterConsoleOpen(true); }
            else setIsPresentationPreviewOpen(true);
          }}
        />
        <PresentationPreviewModal
          activeSlideIndex={activeSlideIndex}
          documentTitle={projectName}
          isOpen={isPresentationPreviewOpen}
          onClose={() => setIsPresentationPreviewOpen(false)}
          scenes={sliderDocument.scenes}
          startInFullscreen
        />
        <PresentationConsoleModal
          activeSlideIndex={activeSlideIndex}
          documentTitle={projectName}
          isOpen={isPresenterConsoleOpen}
          onClose={() => setIsPresenterConsoleOpen(false)}
          onCloseRemoteSession={closePresenterRemoteSession}
          onCreateRemoteSession={createPresenterRemoteSession}
          onOpenProjection={openProjectionWindow}
          onSubscribeRemoteSession={subscribePresenterRemoteSession}
          onUpdateRemoteSession={updatePresenterRemoteSession}
          projectionChannel={projectionChannel}
          notes={presenterNotes}
          onNotesChange={changePresenterNotes}
          scenes={sliderDocument.scenes}
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
