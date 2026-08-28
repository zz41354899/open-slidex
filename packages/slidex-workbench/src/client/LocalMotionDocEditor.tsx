import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Sparkles } from "lucide-react";
import { MotionDocEditor } from "@open-slidex/editor-ui";

import { defaultMdx } from "@/core/motion-doc/presets/defaultMdx";
import { getSelectionMdx } from "@/core/motion-doc/application/motionDocSerialize";
import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import { htmlSourceWorkspace } from "@/features/pitch/application/htmlRuntimePolicy";
import { useLayerSelection } from "@/features/pitch/ui/hooks/useLayerSelection";
import { useMotionDocDocument } from "@/features/pitch/ui/hooks/useMotionDocDocument";
import { usePitchCommands } from "@/features/pitch/ui/hooks/usePitchCommands";
import { usePitchShortcuts } from "@/features/pitch/ui/hooks/usePitchShortcuts";
import { usePitchUndo } from "@/features/pitch/ui/hooks/usePitchUndo";
import { usePitchWorkspaceViewState } from "@/features/pitch/ui/hooks/usePitchWorkspaceViewState";
import { PresentationPreviewModal } from "@/features/pitch/ui/PresentationPreviewModal";
import { PresentationPlaybackModePicker, type PresentationPlaybackMode } from "@/features/pitch/ui/PresentationPlaybackModePicker";
import { PreviewMediaPolicyProvider } from "@/features/pitch/ui/preview/PreviewMediaPolicy";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import type { SlideXEditorAssetAdapter } from "@/features/pitch/domain/localEditor";

import {
  deleteAsset,
  exportDocument,
  localWorkbenchAssetUrl,
  materializeLocalExportMedia,
  prepareExportDestination,
  renderMontage,
  updateContext,
  updateHtmlAsset,
  uploadAsset
} from "./api";
import slidexWordmark from "./assets/slidex-wordmark.png";
import { ChartInspector } from "./ChartInspector";
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

export function LocalMotionDocEditor({ documentState }: { documentState: LocalDocumentState }) {
  const { locale, tx } = usePitchI18n();
  const {
    acceptExternalMutation: acceptExternalDocumentMutation,
    applySource: applyDocumentSource,
    beginExternalMutation: beginExternalDocumentMutation,
    cancelExternalMutation: cancelExternalDocumentMutation
  } = documentState;
  const [source, setSource] = useState(documentState.source);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [dragOverBlockIndex, setDragOverBlockIndex] = useState<number | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [openTool, setOpenTool] = useState<LocalToolMenuId | null>(null);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [localChartAnimationsActive, setLocalChartAnimationsActive] = useState(false);
  const [isPlaybackModePickerOpen, setIsPlaybackModePickerOpen] = useState(false);
  const [presentationPlaybackMode, setPresentationPlaybackMode] = useState<PresentationPlaybackMode>("projection");
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
      throw new Error(tx("Wait for presentation.mdx to finish saving before editing HTML"));
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

  const executeExport = useCallback(async (format: "html" | "mdx" | "pptx", htmlMode?: "original" | "player") => {
    if (exportInFlightRef.current) return;
    exportInFlightRef.current = true;
    const label = format === "pptx" ? "PowerPoint" : format.toUpperCase();
    setNotice(tx(`Exporting ${label}…`));
    try {
      const preflightError = localExportPreflightError(source, documentState.saveState);
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
      const savedDocument = documentState.saveState === "saved" && documentState.source === source
        ? documentState.snapshot
        : await documentState.commit();
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
  }, [documentState, projectName, setNotice, source, tx]);

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
    if (source !== documentState.source) applyDocumentSource(source);
  }, [applyDocumentSource, documentState.source, source]);

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
    activeSlideIndex,
    blocked: Boolean(htmlWorkspace),
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
    blocked: Boolean(htmlWorkspace) || isCodeEditorOpen || isPresentationPreviewOpen || shortcutHelpOpen,
    onAddChart: () => pitchCommands.addBlockToActiveSlide("Chart"),
    onAddText: () => pitchCommands.addBlockToActiveSlide("Text"),
    onRedo: redoLastChange,
    onToggleCommandMenu: () => setCommandOpen((value) => !value),
    onToggleShortcutHelp: () => setShortcutHelpOpen((value) => !value),
    setOpenTool
  });

  const chartInspector = useMemo(() => (
    selectedBlock?.type === "Chart" && selectedBlockIndex !== null ? (
      <ChartInspector block={selectedBlock} onPreviewMotion={triggerChartReplay} update={(props) => pitchCommandActions.updateBlock(selectedBlockIndex, props)} />
    ) : undefined
  ), [pitchCommandActions.updateBlock, selectedBlock, selectedBlockIndex, triggerChartReplay]);

  const activeHtmlPage = htmlWorkspace
    ? Number(activeSlide?.blocks.find((block) => block.type === "HtmlEmbedBlock")?.props.page ?? activeSlideIndex + 1)
    : activeSlideIndex + 1;
  const inspectorOverride = htmlWorkspace ? (
    <HtmlWorkspaceEditor
      activePage={Number.isInteger(activeHtmlPage) && activeHtmlPage > 0 ? activeHtmlPage : activeSlideIndex + 1}
      onCloseMobile={() => setIsMobileInspectorOpen(false)}
      onSave={saveHtmlSource}
      pageCount={htmlWorkspace.pageCount}
      sourcePath={htmlWorkspace.source}
    />
  ) : undefined;
  const inspectorExtension = htmlWorkspace ? undefined : chartInspector;

  const editorProps = useMemo<ComponentProps<typeof MotionDocEditor>>(() => ({
    commands: {
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
          copySource: async () => { await navigator.clipboard.writeText(source); setNotice(tx("MDX copied")); },
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
          onAddActiveSlideComment: () => undefined,
          onPassActiveSlideComment: () => undefined,
          openExport: () => { void runExport("html"); },
          openExportWithFormat: (format: "html" | "mdx" | "pptx") => { void runExport(format); },
          openPresentationPreview: () => setIsPlaybackModePickerOpen(true),
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
    },
    document: {
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
    },
    selection: {
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
    },
    view: {
          accessMode: "guest",
          activeCanvasTool,
          authoringDisabled: Boolean(htmlWorkspace),
          assetUrl: localWorkbenchAssetUrl,
          canvasPreviewSuspended: isPresentationPreviewOpen,
          canvasViewMode,
          canvasShapeTool,
          commentsEnabled: false,
          exportFormats: availableExportFormats,
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
          headerTools: htmlWorkspace ? (
            <HtmlCanvasToolbar activeTool={activeCanvasTool} onToolChange={setActiveCanvasTool} />
          ) : <LocalWorkbenchToolbar
              activeCanvasTool={activeCanvasTool}
              disabled={false}
              onAddBlock={pitchCommandActions.addBlockToActiveSlide}
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
          notice: `${tx(saveLabel(documentState.saveState))} · ${notice}`,
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
    }
  }), [
    activeCanvasTool,
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
    availableExportFormats,
    canvasShapeTool,
    canvasSource,
    canvasViewMode,
    htmlWorkspace,
    inspectorExtension,
    inspectorOverride,
    clearBlockSelection,
    commitSource,
    documentState.saveState,
    draggedBlockIndex,
    dragOverBlockIndex,
    exportMenuRef,
    isCanvasGridVisible,
    isCanvasSafeAreaVisible,
    isCanvasSnapEnabled,
    isCodeEditorOpen,
    isExportMenuOpen,
    imageSourceRequiresAbsoluteUrl,
    isMobileInspectorOpen,
    isMobileSidebarOpen,
    isPresentationPreviewOpen,
    localChartAnimationsActive,
    locale,
    newProject,
    notice,
    openTool,
    pitchCommandActions,
    projectName,
    pushUndoSnapshot,
    redoLastChange,
    replayNonce,
    renamePresentation,
    runExport,
    selectedBlockIndex,
    selectedBlockIndices,
    selectedBlocksLocked,
    selectedTemplateId,
    selectionMdx,
    selectBlock,
    selectBlocks,
    selectSingleBlock,
    setActiveCanvasTool,
    setWorkspaceActiveSlideIndex,
    setCanvasShapeTool,
    setCanvasViewMode,
    setIsCanvasGridVisible,
    setIsCanvasSafeAreaVisible,
    setIsCanvasSnapEnabled,
    setIsCodeEditorOpen,
    setIsExportMenuOpen,
    setIsMobileInspectorOpen,
    setIsMobileSidebarOpen,
    setIsPresentationPreviewOpen,
    setOpenTool,
    setShortcutHelpOpen,
    setDraggedBlockIndex,
    setDragOverBlockIndex,
    setNotice,
    shortcutHelpOpen,
    slideRows,
    sliderDocument.scenes,
    source,
    stats.totalDuration,
    tx,
    undoLastChange,
    workspaceHomeUrl
  ]);

  return (
    <div className="local-workbench-shell">
      <MotionDocEditor {...editorProps} />

      {documentState.message ? (
        <LocalNotice documentState={documentState} onRestoreSaved={restoreSavedCanvas} />
      ) : null}
      <PreviewMediaPolicyProvider assetUrl={localWorkbenchAssetUrl} animateCharts localAssetsOnly>
        <PresentationPreviewModal
          activeSlideIndex={activeSlideIndex}
          documentTitle={projectName}
          isOpen={isPresentationPreviewOpen}
          onClose={() => setIsPresentationPreviewOpen(false)}
          scenes={sliderDocument.scenes}
          startInFullscreen={presentationPlaybackMode === "fullscreen"}
        />
      </PreviewMediaPolicyProvider>
      <PresentationPlaybackModePicker
        isOpen={isPlaybackModePickerOpen}
        onClose={() => setIsPlaybackModePickerOpen(false)}
        onSelect={(mode) => {
          setPresentationPlaybackMode(mode);
          setIsPlaybackModePickerOpen(false);
          setIsPresentationPreviewOpen(true);
        }}
      />
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
