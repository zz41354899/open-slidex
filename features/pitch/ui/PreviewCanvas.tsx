
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent } from "react";
import { InteractiveDotField } from "@/common/ui/InteractiveDotField";
import { applyImageCropRect, fullImageCropRect, type ImageCropRect } from "@/core/motion-doc/application/imageCrop";
import { autoSizeTextFrameProps } from "@/core/motion-doc/application/textFrameSizing";
import { applyShapeImageCropRect } from "@/core/motion-doc/application/shapeImage";
import { blockAspectRatioLocked, blockRotation } from "@/core/motion-doc/domain/blockTransform";
import type { MotionDocFrame } from "@/core/motion-doc/domain/frame";
import type { MotionDocProps, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import type { CanvasTool } from "@/features/pitch/application/canvasTools";
import {
  CANVAS_KEYBOARD_INTENT_EVENT,
  canvasKeyboardIntentFromUnknown,
  type CanvasKeyboardIntent
} from "@/features/pitch/application/canvasKeyboard";
import { nextCanvasZoomScale } from "@/features/pitch/application/canvasZoom";
import {
  MAIN_CANVAS_INACTIVE_SHADER_MAX_PIXEL_COUNT,
  MAIN_CANVAS_PRELOAD_MARGIN,
  mainCanvasShaderMaxPixelCount
} from "@/features/pitch/application/canvasPerformance";
import { initialCanvasScrollPositions, type CanvasViewMode } from "@/features/pitch/application/canvasViewMode";
import type { CanvasShapeTool } from "@/features/pitch/application/shapeDrawing";
import type { BlockFramePatch } from "@/features/pitch/application/pitchGeometry";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  blockFrame,
  canvasPointFromRect,
  gridLineColor,
  hiddenEditablePreviewBlockIndices,
  isEditableTextBlock,
  lineFrameForEndpoint,
  marqueeRect,
  nextStackedBlockIndex,
  selectedMovableBlockIndices,
  visiblePreviewFrameOverrides,
  resolveSnapFrameUpdates,
  rotationForPointer,
  shouldClearActiveSlideFrameSelection,
  stackedBlockIndicesAtPoint,
  type CanvasInteraction,
  type ResizeHandle
} from "@/features/pitch/application/previewCanvas";
import { canGroupBlocks, isPositionLocked, type AddBlockOptions, type InsertSlidePlacement } from "@/features/pitch/application/motionDocCommands";
import type { SlideRow } from "@/features/pitch/application/slideRows";
import {
  canvasSlideRowsForRender,
  singleCanvasSlideRowForRender
} from "@/features/pitch/application/canvasSlideRender";
import { CanvasBlockDock, CanvasSlideNav } from "@/features/pitch/ui/preview/CanvasChrome";
import { MobileEdgePanelHandles } from "@/features/pitch/ui/preview/MobileCanvasChrome";
import { CanvasContextMenu } from "@/features/pitch/ui/preview/CanvasContextMenu";
import { CanvasSelectionLayer } from "@/features/pitch/ui/preview/CanvasSelectionLayer";
import { CanvasSafeAreaOverlay } from "@/features/pitch/ui/preview/CanvasSafeAreaOverlay";
import { CanvasGridView } from "@/features/pitch/ui/preview/CanvasGridView";
import { RemoteMcpActivityRail } from "@/features/pitch/ui/preview/RemoteMcpActivityRail";
import { ActiveCanvasOverlay } from "@/features/pitch/ui/preview/ActiveCanvasOverlay";
import { CanvasSlideFrame } from "@/features/pitch/ui/preview/CanvasSlideFrame";
import type { RemoteMcpOperation } from "@/features/pitch/domain/remoteMcpOperation";
import type { AssistantCanvasActivity, AssistantCanvasTrace } from "@/core/motion-doc/domain/assistantCanvasActivity";
import type { AssistantCanvasTone } from "@/features/pitch/ui/preview/assistantCanvasAppearance";
import { ShapeDrawOverlay } from "@/features/pitch/ui/preview/ShapeDrawOverlay";
import { useCanvasContextMenu } from "@/features/pitch/ui/preview/interaction/useCanvasContextMenu";
import { useCanvasInteractionEngine } from "@/features/pitch/ui/preview/interaction/useCanvasInteractionEngine";
import { useCanvasPanZoom } from "@/features/pitch/ui/preview/interaction/useCanvasPanZoom";
import { useTransientFramePreview } from "@/features/pitch/ui/preview/interaction/useTransientFramePreview";
import { useCanvasViewportMetrics } from "@/features/pitch/ui/preview/interaction/useCanvasViewportMetrics";
import { useRemoteMcpCanvasCursor } from "@/features/pitch/ui/hooks/useRemoteMcpCanvasCursor";
import type { BlockUpdater } from "@/features/pitch/application/pitchCommandTypes";
import type { AddBlockType } from "@/features/pitch/ui/pitchOptions";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { sharedHtmlDeckRuntime } from "@/features/pitch/application/htmlRuntimePolicy";
import { SharedHtmlCanvasOverlay } from "@/features/pitch/ui/preview/SharedHtmlCanvasOverlay";
import { CanvasMorphPreviewOverlay } from "@/features/pitch/ui/preview/CanvasMorphPreviewOverlay";
import {
  MORPH_CANVAS_PREVIEW_EVENT,
  normalizeMorphCanvasPreviewRange,
  type MorphCanvasPreviewRequest
} from "@/features/pitch/application/morphCanvasPreview";

type PreviewCanvasProps = {
  assistantActivities: readonly AssistantCanvasActivity[];
  assistantTrace?: AssistantCanvasTrace;
  assistantTone?: AssistantCanvasTone;
  activeCanvasTool: CanvasTool;
  canvasViewMode: CanvasViewMode;
  canvasShapeTool: CanvasShapeTool | null;
  zoomLevel: number | "fit";
  onFitScaleChange?: (scale: number) => void;
  onSetZoomLevel: (zoomLevel: number | "fit") => void;
  activeSlide: MotionDocScene | undefined;
  activeSlideIndex: number;
  canPasteBlock: boolean;
  isGridVisible: boolean;
  isSafeAreaVisible: boolean;
  interactionDisabled: boolean;
  previewSuspended?: boolean;
  isSnapEnabled: boolean;
  onAddBlock: (type: AddBlockType, options?: AddBlockOptions) => void;

  onBeginBlockTransform: () => void;
  onClearSelection: () => void;
  onCopySelectedBlock: () => void;
  onDeleteSelectedBlocks: () => void;
  onDuplicateSelectedBlock: () => void;
  onGroupSelectedBlocks: () => void;
  onMoveSelectedBlocksToEdge: (edge: "back" | "front") => void;
  onOpenMobileInspector: () => void;
  onOpenMobileLayers: () => void;
  onNextSlide: () => void;
  onPasteCopiedBlock: () => void;
  onPreviousSlide: () => void;
  onShaderFrameCapture: (frame: number) => void;
  onSelectBlock: (index: number, options?: { additive?: boolean; bypassGroup?: boolean; range?: boolean }) => void;
  onSelectBlocks: (indices: number[], options?: { additive?: boolean }) => void;
  onSelectSlide: (index: number) => void;
  onReorderSlide: (fromIndex: number, toIndex: number) => void;
  onInsertSlideNearActive: (placement: InsertSlidePlacement) => void;
  onCanvasToolChange: (tool: CanvasTool) => void;
  onCanvasViewModeChange: (mode: CanvasViewMode) => void;
  onCanvasShapeToolChange: (tool: CanvasShapeTool | null) => void;
  onToggleSelectedBlocksPositionLock: () => void;
  onUngroupSelectedBlocks: () => void;
  onUndo: () => void;
  onUpdateBlock: BlockUpdater;
  onUpdateBlockFrames: (updates: BlockFramePatch[]) => void;
  onUseSelectedImageAsBackground: () => void;
  replayNonce: number;
  remoteMcpActivityWarning?: string | null;
  remoteMcpOperations: readonly RemoteMcpOperation[];
  sceneCount: number;
  scenes: MotionDocScene[];
  selectedBlockIndex: number | null;
  selectedBlockIndices: number[];
  selectedBlocksLocked: boolean;
  showDesktopBlockDock?: boolean;
  singleSlidePreview?: boolean;
  slideRows: SlideRow[];
};

export function PreviewCanvas({
  assistantActivities,
  assistantTrace,
  assistantTone,
  activeCanvasTool,
  canvasViewMode,
  canvasShapeTool,
  zoomLevel,
  onFitScaleChange,
  onSetZoomLevel,
  activeSlide,
  activeSlideIndex,
  canPasteBlock,
  isGridVisible,
  isSafeAreaVisible,
  interactionDisabled,
  previewSuspended = false,
  isSnapEnabled,
  onAddBlock,

  onBeginBlockTransform,
  onClearSelection,
  onCopySelectedBlock,
  onDeleteSelectedBlocks,
  onDuplicateSelectedBlock,
  onGroupSelectedBlocks,
  onMoveSelectedBlocksToEdge,
  onOpenMobileInspector,
  onOpenMobileLayers,
  onPasteCopiedBlock,
  onSelectBlock,
  onSelectBlocks,
  onToggleSelectedBlocksPositionLock,
  onUngroupSelectedBlocks,
  onUndo,
  onUpdateBlock,
  onUpdateBlockFrames,
  onUseSelectedImageAsBackground,
  onNextSlide,
  onPreviousSlide,
  onShaderFrameCapture,
  onSelectSlide,
  onReorderSlide,
  onInsertSlideNearActive,
  onCanvasToolChange,
  onCanvasViewModeChange,
  onCanvasShapeToolChange,
  replayNonce,
  remoteMcpActivityWarning,
  remoteMcpOperations,
  sceneCount,
  scenes,
  selectedBlockIndex,
  selectedBlockIndices,
  selectedBlocksLocked,
  showDesktopBlockDock = true,
  singleSlidePreview = false,
  slideRows
}: PreviewCanvasProps) {
  const selectedBlock = selectedBlockIndex === null ? undefined : activeSlide?.blocks[selectedBlockIndex];
  const { locale } = usePitchI18n();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const canvasStripRef = useRef<HTMLDivElement | null>(null);
  const activeSlideFrameRef = useRef<HTMLDivElement | null>(null);
  const activeCanvasToolRef = useRef<CanvasTool>(activeCanvasTool);
  const previousActiveSlideIndexRef = useRef(activeSlideIndex);
  const requestedSlideFocusRef = useRef(false);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const scrollPositionsRef = useRef(initialCanvasScrollPositions());
  const controlledCanvasSelection = useMemo(() => ({
    primaryIndex: selectedBlockIndex,
    selectedIndices: selectedBlockIndices.length > 0
      ? selectedBlockIndices
      : selectedBlockIndex === null ? emptyBlockIndices : [selectedBlockIndex]
  }), [selectedBlockIndex, selectedBlockIndices]);
  const canvasInteraction = useCanvasInteractionEngine(controlledCanvasSelection);
  const transientFramePreview = useTransientFramePreview({
    blocks: activeSlide?.blocks ?? emptyBlocks,
    onCommit: onUpdateBlockFrames
  });
  const [canvasViewportOffset, setCanvasViewportOffset] = useState({ x: 0, y: 0 });
  const [isMouseOverCanvas, setIsMouseOverCanvas] = useState(false);
  const [isTemporaryHandActive, setIsTemporaryHandActive] = useState(false);
  const [morphPreview, setMorphPreview] = useState<{ endSlideIndex: number; nonce: number; startSlideIndex: number } | null>(null);
  const [imageCropTarget, setImageCropTarget] = useState<{ blockIndex: number; cropRect: ImageCropRect; slideIndex: number } | null>(null);
  const { closeContextMenu, contextMenu, openContextMenu } = useCanvasContextMenu();
  const { actualScale, canvasFrameStyle, canvasStripSidePadding } = useCanvasViewportMetrics({
    onFitScaleChange,
    scrollAreaRef,
    zoomLevel
  });
  const {
    cursor: remoteMcpCursor,
    cursorLayerRef: remoteMcpCursorLayerRef,
    reducedMotion: remoteMcpCursorReducedMotion
  } = useRemoteMcpCanvasCursor({
    activeSlideIndex,
    activities: remoteMcpOperations,
    actualScale,
    canvasViewportOffset,
    scene: activeSlide,
    scrollAreaRef
  });
  const cropTargetBlock = imageCropTarget?.slideIndex === activeSlideIndex
    ? activeSlide?.blocks[imageCropTarget.blockIndex]
    : undefined;
  const imageCropBlockIndex = imageCropTarget?.slideIndex === activeSlideIndex
    && imageCropTarget.blockIndex === selectedBlockIndex
    && (cropTargetBlock?.type === "ImageBlock" || (
      cropTargetBlock?.type === "Shape"
      && cropTargetBlock.props.shape !== "line"
      && Boolean(cropTargetBlock.props.shapeImageSrc)
    ))
    ? imageCropTarget.blockIndex
    : null;
  const imageCropRect = imageCropBlockIndex === null ? null : imageCropTarget?.cropRect ?? null;
  const finishMorphPreview = useCallback(() => setMorphPreview(null), []);

  useEffect(() => {
    function requestMorphPreview(event: Event) {
      const range = normalizeMorphCanvasPreviewRange(scenes, (event as CustomEvent<MorphCanvasPreviewRequest>).detail);
      if (!range) return;
      const start = () => setMorphPreview({ ...range, nonce: Date.now() });
      if (range.startSlideIndex !== activeSlideIndex) {
        onSelectSlide(range.startSlideIndex);
        window.requestAnimationFrame(() => window.requestAnimationFrame(start));
      } else {
        start();
      }
    }
    window.addEventListener(MORPH_CANVAS_PREVIEW_EVENT, requestMorphPreview);
    return () => window.removeEventListener(MORPH_CANVAS_PREVIEW_EVENT, requestMorphPreview);
  }, [activeSlideIndex, onSelectSlide, scenes]);
  const canvasInputTool: CanvasTool = isTemporaryHandActive ? "hand" : activeCanvasTool;
  const canvasPanZoom = useCanvasPanZoom({
    activeCanvasTool: canvasInputTool,
    actualScale,
    canvasRef,
    canvasViewportOffset,
    clearCanvasInteraction: canvasInteraction.clearInteraction,
    closeContextMenu,
    onSetZoomLevel,
    preserveNativeScrollPosition: canvasViewMode === "slide",
    resetFramePreview: transientFramePreview.reset,
    scrollAreaRef,
    setCanvasViewportOffset
  });
  const {
    endCanvasPan,
    fitCanvasToViewport,
    handleCanvasToolPointerDown,
    isPanActive,
    isPanningCanvas,
    setZoomDirection,
    updateCanvasPan,
    zoomCanvasFromBridge,
    zoomDirection
  } = canvasPanZoom;
  const canvasKeyboardActionsRef = useRef({
    actualScale,
    fitCanvasToViewport,
    interactionDisabled,
    onCanvasToolChange,
    onSetZoomLevel,
    zoomCanvasFromBridge
  });
  canvasKeyboardActionsRef.current = {
    actualScale,
    fitCanvasToViewport,
    interactionDisabled,
    onCanvasToolChange,
    onSetZoomLevel,
    zoomCanvasFromBridge
  };
  const gridColor = gridLineColor(activeSlide);
  const viewportCursorClass = canvasInputTool === "hand"
    ? isPanningCanvas ? "cursor-grabbing" : "cursor-grab"
    : canvasInputTool === "zoom" ? zoomDirection === "out" ? "cursor-zoom-out" : "cursor-zoom-in" : "";
  const activeShaderMaxPixelCount = mainCanvasShaderMaxPixelCount(
    actualScale,
    typeof window === "undefined" ? 1 : window.devicePixelRatio
  );
  const hiddenPreviewBlockIndices = useMemo(
    () => hiddenEditablePreviewBlockIndices(activeSlide?.blocks ?? [], selectedBlockIndex, selectedBlockIndices),
    [activeSlide?.blocks, selectedBlockIndex, selectedBlockIndices]
  );
  const previewFrameOverrides = useMemo(
    () => visiblePreviewFrameOverrides(
      activeSlide?.blocks ?? [],
      hiddenPreviewBlockIndices,
      transientFramePreview.frameOverrides
    ),
    [activeSlide?.blocks, hiddenPreviewBlockIndices, transientFramePreview.frameOverrides]
  );
  const canGroupSelection = activeSlide ? canGroupBlocks(activeSlide, selectedBlockIndices) : false;
  const canUngroupSelection = selectedBlockIndices.some((index) => {
    const block = activeSlide?.blocks[index];
    return Boolean(block && "props" in block && block.props.groupId);
  });
  const renderedSlideRows = useMemo(
    () => canvasSlideRowsForRender(slideRows),
    [slideRows]
  );
  const sharedHtmlRuntime = useMemo(() => sharedHtmlDeckRuntime(scenes), [scenes]);
  const canvasSlideRows = useMemo(
    () => singleSlidePreview && sharedHtmlRuntime
      ? singleCanvasSlideRowForRender(renderedSlideRows, activeSlideIndex)
      : renderedSlideRows,
    [activeSlideIndex, renderedSlideRows, sharedHtmlRuntime, singleSlidePreview]
  );
  useEffect(() => {
    activeCanvasToolRef.current = canvasInputTool;
  }, [canvasInputTool]);

  useEffect(() => {
    if (activeCanvasTool !== "select" && canvasShapeTool) {
      onCanvasShapeToolChange(null);
    }
  }, [activeCanvasTool, canvasShapeTool, onCanvasShapeToolChange]);

  useEffect(() => {
    const transform = canvasInteraction.transform;
    if (!transform) return;
    const transformStillExists = activeSlide?.blocks.some(
      (block, blockIndex) => motionDocBlockKey(block, blockIndex) === transform.blockId
    );
    if (transformStillExists) return;
    transientFramePreview.reset();
    canvasInteraction.clearInteraction();
  }, [activeSlide?.blocks, canvasInteraction.clearInteraction, canvasInteraction.transform, transientFramePreview.reset]);

  useEffect(() => {
    const handleKeyboardIntent = (event: Event) => {
      const intent = canvasKeyboardIntentFromUnknown((event as CustomEvent<CanvasKeyboardIntent>).detail);
      if (!intent) return;
      const actions = canvasKeyboardActionsRef.current;
      if (actions.interactionDisabled) {
        setIsTemporaryHandActive(false);
        return;
      }
      if (intent.kind === "tool") {
        actions.onCanvasToolChange(intent.tool);
        return;
      }
      if (intent.kind === "temporary-hand") {
        setIsTemporaryHandActive(intent.active);
        return;
      }
      if (intent.kind === "wheel-zoom") {
        actions.zoomCanvasFromBridge(intent);
        return;
      }
      if (intent.command === "fit") {
        actions.fitCanvasToViewport();
        return;
      }
      actions.onSetZoomLevel(nextCanvasZoomScale(actions.actualScale, intent.command));
    };

    window.addEventListener(CANVAS_KEYBOARD_INTENT_EVENT, handleKeyboardIntent);
    return () => window.removeEventListener(CANVAS_KEYBOARD_INTENT_EVENT, handleKeyboardIntent);
  }, []);

  useEffect(() => {
    if (activeCanvasTool !== "zoom") {
      setZoomDirection("in");
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Alt") {
        setZoomDirection("out");
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Alt") {
        setZoomDirection("in");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [activeCanvasTool, setZoomDirection]);

  useEffect(() => {
    const activeSlideFrame = activeSlideFrameRef.current;
    const activeSlideChanged = previousActiveSlideIndexRef.current !== activeSlideIndex;
    previousActiveSlideIndexRef.current = activeSlideIndex;

    if (
      canvasViewMode === "grid"
      || !activeSlideFrame
      || (!activeSlideChanged && !requestedSlideFocusRef.current)
      || isPanActive()
      || activeCanvasToolRef.current === "hand"
    ) {
      return;
    }
    requestedSlideFocusRef.current = false;

    const animationFrame = window.requestAnimationFrame(() => {
      scrollSlideFrameIntoView(activeSlideFrame, scrollAreaRef.current);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeSlideIndex, canvasViewMode, isPanActive, sceneCount]);

  useLayoutEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const restoreScrollPosition = () => {
      const position = scrollPositionsRef.current[canvasViewMode];
      scrollArea.scrollTo({ left: position.left, top: position.top });
    };
    const animationFrame = window.requestAnimationFrame(restoreScrollPosition);
    const captureScrollPosition = () => {
      scrollPositionsRef.current[canvasViewMode] = {
        left: scrollArea.scrollLeft,
        top: scrollArea.scrollTop
      };
    };

    scrollArea.addEventListener("scroll", captureScrollPosition, { passive: true });
    return () => {
      window.cancelAnimationFrame(animationFrame);
      captureScrollPosition();
      scrollArea.removeEventListener("scroll", captureScrollPosition);
    };
  }, [canvasViewMode]);

  function getCanvasPosition(
    event: { clientX: number; clientY: number },
    options?: { allowOverflow?: boolean }
  ) {
    return canvasPointFromRect(event, canvasRef.current?.getBoundingClientRect(), options);
  }

  function handleCanvasDoubleClick(event: MouseEvent<HTMLDivElement>) {
    if (canvasInputTool !== "select") {
      return;
    }

    if ((event.target as HTMLElement).closest("button")) {
      return;
    }

    const frameControl = (event.target as HTMLElement).closest<HTMLElement>("[data-frame-control][data-block-index]");
    const blockIndex = Number(frameControl?.dataset.blockIndex);
    const block = Number.isInteger(blockIndex) ? activeSlide?.blocks[blockIndex] : undefined;
    if (!frameControl || !block || !isEditableTextBlock(block)) return;

    event.preventDefault();
    event.stopPropagation();
    onSelectBlock(blockIndex);
    canvasInteraction.beginEditingText(blockIndex);
    onBeginBlockTransform();
    window.requestAnimationFrame(() => {
      frameControl.querySelector<HTMLElement>("[data-text-frame-editor]")?.focus({ preventScroll: true });
    });
  }

  function handleToolDragOver(event: DragEvent<HTMLDivElement>) {
    if (event.dataTransfer.types.includes("application/x-slidex-tool")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  }

  function handleToolDrop(event: DragEvent<HTMLDivElement>) {
    if (interactionDisabled) return;
    const payload = event.dataTransfer.getData("application/x-slidex-tool");
    if (!payload) {
      return;
    }

    event.preventDefault();
    try {
      const tool = JSON.parse(payload) as { props?: MotionDocProps; type?: AddBlockType };
      if (tool.type) {
        onAddBlock(tool.type, { position: getCanvasPosition(event), props: tool.props });
      }
    } catch {
      // Ignore malformed drag payloads from outside the app.
    }
  }

  function startMove(event: PointerEvent<HTMLDivElement>, blockIndex: number, frame: MotionDocFrame) {
    if (canvasInputTool !== "select") {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    if (event.altKey) {
      event.stopPropagation();
      const indices = stackedBlockIndicesAtPoint(activeSlide?.blocks ?? [], getCanvasPosition(event));
      const nextIndex = nextStackedBlockIndex(indices, selectedBlockIndex);
      if (nextIndex !== null) onSelectBlock(nextIndex, { bypassGroup: true });
      return;
    }
    const additive = event.metaKey || event.ctrlKey;
    const range = event.shiftKey;
    const block = activeSlide?.blocks[blockIndex];

    if (additive || range) {
      onSelectBlock(blockIndex, { additive, range });
      return;
    }

    if (block && isPositionLocked(block)) {
      onSelectBlock(blockIndex);
      return;
    }

    const wasSelected = selectedBlockIndices.includes(blockIndex) || selectedBlockIndex === blockIndex;

    if (!wasSelected) {
      onSelectBlock(blockIndex);
      if (block && isEditableTextBlock(block)) {
        return;
      }
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    transientFramePreview.reset();

    const moveIndices = (selectedBlockIndices.includes(blockIndex) ? selectedBlockIndices : [blockIndex])
      .filter((index) => {
        const selectedBlock = activeSlide?.blocks[index];
        return selectedBlock ? !isPositionLocked(selectedBlock) : false;
      });

    const interaction: CanvasInteraction = {
      blockId: block ? motionDocBlockKey(block, blockIndex) : `missing-${blockIndex}`,
      blockIndex,
      mode: "move",
      startFrame: frame,
      startFrames: moveIndices.map((index) => ({
        blockId: activeSlide?.blocks[index]
          ? motionDocBlockKey(activeSlide.blocks[index], index)
          : `missing-${index}`,
        blockIndex: index,
        frame: blockFrame(activeSlide?.blocks[index])
      })),
      startPointer: getCanvasPosition(event, { allowOverflow: true })
    };
    canvasInteraction.beginDragging(interaction);
    onBeginBlockTransform();
  }

  function startResize(
    event: PointerEvent<HTMLSpanElement>,
    blockIndex: number,
    handle: ResizeHandle,
    frame: MotionDocFrame,
    blockIndices: readonly number[] = [blockIndex]
  ) {
    if (canvasInputTool !== "select") {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    transientFramePreview.reset();
    const block = activeSlide?.blocks[blockIndex];

    if (block && isPositionLocked(block)) {
      return;
    }

    const frameControl = event.currentTarget.closest("[data-frame-control]");

    if (frameControl instanceof HTMLElement) {
      frameControl.setPointerCapture(event.pointerId);
    }

    const interaction: CanvasInteraction = {
      blockId: block ? motionDocBlockKey(block, blockIndex) : `missing-${blockIndex}`,
      blockIndex,
      handle,
      lockAspectRatio: Boolean(
        block
        && !(block.type === "Shape" && block.props.shape === "line")
        && blockAspectRatioLocked(block.props)
      ),
      mode: block?.type === "Shape" && block.props.shape === "line" && (handle === "w" || handle === "e")
        ? "line-endpoint"
        : "resize",
      rotation: block ? blockRotation(block.props) : 0,
      startFrame: frame,
      startFrames: blockIndices.map((index) => ({
        blockId: activeSlide?.blocks[index]
          ? motionDocBlockKey(activeSlide.blocks[index], index)
          : `missing-${index}`,
        blockIndex: index,
        frame: blockFrame(activeSlide?.blocks[index])
      })),
      startPointer: getCanvasPosition(event, { allowOverflow: true })
    };
    canvasInteraction.beginResizing(interaction);
    onBeginBlockTransform();
    if (blockIndices.length === 1) {
      onSelectBlock(blockIndex);
    }
  }

  function startRotate(event: PointerEvent<HTMLElement>, blockIndex: number, frame: MotionDocFrame) {
    if (canvasInputTool !== "select" || event.button !== 0) return;
    const block = activeSlide?.blocks[blockIndex];
    if (!block || isPositionLocked(block)) return;

    event.preventDefault();
    event.stopPropagation();
    const frameControl = event.currentTarget.closest("[data-frame-control]");
    if (frameControl instanceof HTMLElement) frameControl.setPointerCapture(event.pointerId);
    const blockId = motionDocBlockKey(block, blockIndex);
    const interaction: CanvasInteraction = {
      blockId,
      blockIndex,
      mode: "rotate",
      rotation: blockRotation(block.props),
      rotationCenter: { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 },
      startFrame: frame,
      startFrames: [{ blockId, blockIndex, frame }],
      startPointer: getCanvasPosition(event, { allowOverflow: true })
    };
    canvasInteraction.beginRotating(interaction);
    onBeginBlockTransform();
    onSelectBlock(blockIndex);
  }

  function toggleImageCrop(blockIndex: number) {
    if (imageCropBlockIndex === blockIndex) {
      const block = activeSlide?.blocks[blockIndex];
      if ((block?.type === "ImageBlock" || block?.type === "Shape") && imageCropRect) {
        onBeginBlockTransform();
        onUpdateBlock(
          blockIndex,
          block.type === "Shape"
            ? applyShapeImageCropRect(block.props, imageCropRect)
            : applyImageCropRect(block.props, imageCropRect)
        );
      }
      setImageCropTarget(null);
      return;
    }

    onSelectBlock(blockIndex);
    setImageCropTarget({ blockIndex, cropRect: fullImageCropRect, slideIndex: activeSlideIndex });
  }

  function updateImageCropRect(cropRect: ImageCropRect) {
    setImageCropTarget((current) => current ? { ...current, cropRect } : current);
  }

  function updateInteraction(event: PointerEvent<HTMLDivElement>, commit = false) {
    const transform = canvasInteraction.transform;
    if (transform?.mode === "line-endpoint") {
      const block = activeSlide?.blocks[transform.blockIndex];
      if (block?.type === "Shape" && block.props.shape === "line") {
        const update = lineFrameForEndpoint(
          transform.startFrame,
          transform.rotation ?? 0,
          transform.handle === "w" ? "start" : "end",
          getCanvasPosition(event, { allowOverflow: true })
        );
        onUpdateBlock(
          transform.blockIndex,
          { ...block.props, ...update.frame, rotation: update.rotation },
          undefined,
          { transient: true }
        );
      }
      return;
    }

    if (transform?.mode === "rotate") {
      const block = activeSlide?.blocks[transform.blockIndex];
      if (block) {
        onUpdateBlock(
          transform.blockIndex,
          { ...block.props, rotation: rotationForPointer(transform, getCanvasPosition(event, { allowOverflow: true }), event.shiftKey) },
          "text" in block ? block.text : undefined,
          { transient: true }
        );
      }
      return;
    }

    const rawUpdates = canvasInteraction.frameUpdatesForPointer(getCanvasPosition(event, { allowOverflow: true }), {
      preserveAspectRatio: Boolean(transform?.lockAspectRatio) !== event.shiftKey
    });

    if (!rawUpdates) {
      return;
    }
    const snapInteraction = transform?.mode === "move" || transform?.mode === "resize"
      ? { handle: transform.handle, mode: transform.mode }
      : undefined;
    const updates = isSnapEnabled && snapInteraction
      ? resolveSnapFrameUpdates(activeSlide?.blocks ?? [], rawUpdates, snapInteraction)
      : rawUpdates;

    if (commit) {
      transientFramePreview.commit(updates);
      return;
    }
    transientFramePreview.preview(updates);
  }

  function endInteraction(event: PointerEvent<HTMLDivElement>, blockId: string) {
    if (!canvasInteraction.isTransformingBlock(blockId)) {
      return;
    }

    updateInteraction(event, true);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    canvasInteraction.finishTransform();
  }

  function startMarquee(event: PointerEvent<HTMLDivElement>) {
    if (canvasInputTool !== "select") {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    const pointer = getCanvasPosition(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    canvasInteraction.beginMarquee({
      additive: event.metaKey || event.ctrlKey || event.shiftKey,
      current: pointer,
      pointerId: event.pointerId,
      start: pointer
    });
  }

  function updateMarquee(event: PointerEvent<HTMLDivElement>) {
    canvasInteraction.updateMarquee(event.pointerId, getCanvasPosition(event));
  }

  function endMarquee(event: PointerEvent<HTMLDivElement>) {
    const selection = canvasInteraction.marqueeSelection
      ? { ...canvasInteraction.marqueeSelection, current: getCanvasPosition(event) }
      : null;

    if (!selection || selection.pointerId !== event.pointerId) {
      return;
    }

    const rect = marqueeRect(selection);
    const selectedIndices = selectedMovableBlockIndices(activeSlide?.blocks ?? [], rect);
    const isClick = rect.w < 0.6 && rect.h < 0.6;

    event.currentTarget.releasePointerCapture(event.pointerId);

    if (isClick) {
      canvasInteraction.clearInteraction();
      onClearSelection();
      return;
    }

    canvasInteraction.clearInteraction();
    onSelectBlocks(selectedIndices, { additive: selection.additive });
  }

  function cancelMarquee(event: PointerEvent<HTMLDivElement>) {
    canvasInteraction.cancelMarquee(event.pointerId);
  }

  function openLayerContextMenu(event: MouseEvent<HTMLDivElement>, blockIndex: number | null) {
    event.preventDefault();
    event.stopPropagation();

    if (blockIndex !== null && !selectedBlockIndices.includes(blockIndex) && selectedBlockIndex !== blockIndex) {
      onSelectBlock(blockIndex);
    }

    openContextMenu(event, blockIndex);
  }

  function fitTextBlock(blockIndex: number | null) {
    if (blockIndex === null) return;
    const block = activeSlide?.blocks[blockIndex];
    if (!block || (block.type !== "Text" && block.type !== "heading")) return;

    onUpdateBlock(
      blockIndex,
      autoSizeTextFrameProps(block, block.text, { mode: "fit", props: block.props }),
      block.text
    );
  }

  function handleSlideFramePointerDown(event: PointerEvent<HTMLDivElement>, slideIndex: number) {
    if (event.button !== 0 || canvasInputTool !== "select") {
      return;
    }

    const target = event.target as HTMLElement | null;

    if (target?.closest("button, [data-canvas-context-menu]")) {
      return;
    }

    if (slideIndex === activeSlideIndex) {
      // Pointer gestures inside the actual canvas are owned by CanvasSelectionLayer.
      // Clearing here used to cancel a marquee immediately after it started.
      if (shouldClearActiveSlideFrameSelection({
        insideCanvas: Boolean(target?.closest("[aria-current='true']")),
        isFrameControl: Boolean(target?.closest("[data-frame-control]"))
      })) {
        scrollSlideFrameIntoView(event.currentTarget, scrollAreaRef.current);
        if (canvasInputTool === "select") {
          canvasInteraction.clearInteraction();
          onClearSelection();
        }
      }
      return;
    }

    scrollSlideFrameIntoView(event.currentTarget, scrollAreaRef.current);
    closeContextMenu();
    canvasInteraction.clearInteraction();
    onSelectSlide(slideIndex);
  }

  function openSlideFromGrid(slideIndex: number) {
    requestedSlideFocusRef.current = true;
    onSelectSlide(slideIndex);
    onCanvasViewModeChange("slide");
  }

  function handleCanvasContextMenu(event: MouseEvent<HTMLDivElement>) {
    if (interactionDisabled) {
      event.preventDefault();
      return;
    }
    if (canvasInputTool === "zoom") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (canvasInputTool !== "select") {
      return;
    }

    const target = event.target;

    if (!(target instanceof HTMLElement) || target.closest("[data-canvas-context-menu]")) {
      return;
    }

    if (target.closest("[data-table-context-target], [data-table-context-menu], [data-table-style-popover]")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const slideFrameIndex = slideIndexFromTarget(target);

    if (slideFrameIndex !== null && slideFrameIndex !== activeSlideIndex) {
      closeContextMenu();
      canvasInteraction.clearInteraction();
      onSelectSlide(slideFrameIndex);
      return;
    }

    const frameControl = target.closest("[data-frame-control][data-block-index]");

    if (frameControl instanceof HTMLElement) {
      const blockIndex = Number(frameControl.dataset.blockIndex);

      if (Number.isInteger(blockIndex)) {
        openLayerContextMenu(event, blockIndex);
        return;
      }
    }

    openLayerContextMenu(event, selectedBlockIndex ?? selectedBlockIndices[selectedBlockIndices.length - 1] ?? null);
  }

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#212121]"
      data-canvas-input-tool={canvasInputTool}
      data-canvas-mode={canvasViewMode}
      data-canvas-single-slide={singleSlidePreview ? "true" : undefined}
      id="canvas-v4"
      onContextMenuCapture={handleCanvasContextMenu}
    >
      <InteractiveDotField
        className="z-0 opacity-25"
        interactive={false}
      />
      <CanvasSlideNav
        activeSlideIndex={activeSlideIndex}
        canvasViewMode={canvasViewMode}
        onCanvasViewModeChange={onCanvasViewModeChange}
        onNextSlide={onNextSlide}
        onPreviousSlide={onPreviousSlide}
        sceneCount={sceneCount}
        singleSlidePreview={singleSlidePreview}
      />
      <RemoteMcpActivityRail activities={remoteMcpOperations} />
      {remoteMcpActivityWarning ? (
        <div className="pointer-events-none absolute bottom-4 right-4 z-[60] max-w-[320px] rounded-[7px] border border-dashed border-[#8b5cf6]/55 bg-[#24133f]/92 px-2.5 py-1.5 text-[14px] leading-5 text-[#ddd6fe]/78">
          {remoteMcpActivityWarning}
        </div>
      ) : null}
      <MobileEdgePanelHandles onOpenInspector={onOpenMobileInspector} onOpenLayers={onOpenMobileLayers} />

      <div
        className={`custom-scrollbar relative z-0 flex min-h-0 flex-1 touch-none items-center justify-center overflow-auto bg-transparent px-3 pb-24 pt-12 sm:touch-auto sm:items-start sm:justify-start sm:p-4 sm:pb-20 sm:pt-12 md:p-8 md:pb-24 md:pt-16 ${viewportCursorClass}`}
        onPointerCancelCapture={endCanvasPan}
        onPointerDownCapture={handleCanvasToolPointerDown}
        onPointerDown={(event) => {
          if (canvasInputTool === "select" && event.target === event.currentTarget) {
            canvasInteraction.clearInteraction();
            onClearSelection();
          }
        }}
        onPointerMoveCapture={updateCanvasPan}
        onPointerUpCapture={endCanvasPan}
        ref={scrollAreaRef}
        style={{ overflowAnchor: "none" }}
      >
        <div
          className={`relative min-h-full min-w-full ${canvasViewMode === "slide"
            ? singleSlidePreview
              ? "shrink-0 flex flex-col items-center justify-center pb-20 pt-16 sm:min-h-full"
              : "shrink-0 flex flex-col items-center gap-10 pb-24 pt-2 sm:min-h-0 sm:gap-12"
            : "flex w-full max-w-full items-start justify-center pb-24 pt-2 sm:min-h-0"
          }`}
          onPointerDown={(event) => {
            if (canvasInputTool === "select" && event.target === event.currentTarget) {
              canvasInteraction.clearInteraction();
              onClearSelection();
            }
          }}
          ref={canvasStripRef}
          style={{
            paddingLeft: canvasViewMode === "slide" ? canvasStripSidePadding : 0,
            paddingRight: canvasViewMode === "slide" ? canvasStripSidePadding : 0,
            transform: `translate3d(${canvasViewportOffset.x}px, ${canvasViewportOffset.y}px, 0)`
          }}
        >
          {canvasViewMode === "grid" ? <CanvasGridView
            activeSlideIndex={activeSlideIndex}
            onOpenSlide={openSlideFromGrid}
            onReorderSlide={onReorderSlide}
            reorderDisabled={Boolean(sharedHtmlRuntime)}
            replayNonce={replayNonce}
            scenes={scenes}
            slideRows={renderedSlideRows}
            zoomLevel={zoomLevel}
          /> : canvasSlideRows.map((slide) => {
            const isActiveSlideFrame = slide.index === activeSlideIndex;
            const slideScene = scenes[slide.index];

            return (
              <CanvasSlideFrame
                actualScale={actualScale}
                activeSlideFrameRef={activeSlideFrameRef}
                activeSlideIndex={activeSlideIndex}
                canvasFrameStyle={canvasFrameStyle}
                canvasRef={canvasRef}
                frameOverrides={previewFrameOverrides}
                hiddenBlockIndices={hiddenPreviewBlockIndices}
                hideSharedHtmlBlocks={Boolean(sharedHtmlRuntime)}
                isActive={isActiveSlideFrame}
                isMouseOverCanvas={isMouseOverCanvas}
                key={slide.index}
                locale={locale}
                onCanvasDoubleClick={handleCanvasDoubleClick}
                onFramePointerDown={(event) => handleSlideFramePointerDown(event, slide.index)}
                onInsertSlideNearActive={onInsertSlideNearActive}
                onMouseEnter={() => setIsMouseOverCanvas(true)}
                onMouseLeave={() => setIsMouseOverCanvas(false)}
                onShaderFrameCapture={onShaderFrameCapture}
                onToolDragOver={handleToolDragOver}
                onToolDrop={handleToolDrop}
                replayNonce={replayNonce}
                previewSuspended={previewSuspended}
                rootRef={scrollAreaRef}
                shaderMaxPixelCount={canvasInteraction.mode === "idle" ? activeShaderMaxPixelCount : MAIN_CANVAS_INACTIVE_SHADER_MAX_PIXEL_COUNT}
                shaderPlaybackActive={canvasInteraction.mode === "idle"}
                slide={slide}
                scene={slideScene}
              >
                    {isActiveSlideFrame && isGridVisible ? (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-30"
                        style={{
                          backgroundImage: `linear-gradient(to right, ${gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
                          backgroundSize: `${40 * actualScale}px ${40 * actualScale}px`
                        }}
                      />
                    ) : null}
                    {isActiveSlideFrame && morphPreview?.startSlideIndex === slide.index && slideScene && scenes[morphPreview.endSlideIndex] && canvasRef.current?.querySelector<HTMLElement>("[data-motion-canvas-content=active]") ? (
                      <CanvasMorphPreviewOverlay
                        actualScale={actualScale}
                        endSlideIndex={morphPreview.endSlideIndex}
                        key={morphPreview.nonce}
                        onFinish={finishMorphPreview}
                        scenes={scenes}
                        sourceRoot={canvasRef.current.querySelector<HTMLElement>("[data-motion-canvas-content=active]")!}
                        startSlideIndex={morphPreview.startSlideIndex}
                      />
                    ) : null}
                    {isActiveSlideFrame ? <CanvasSafeAreaOverlay visible={isSafeAreaVisible} /> : null}
                    {isActiveSlideFrame && !interactionDisabled && !sharedHtmlRuntime ? (
                      <CanvasSelectionLayer
                        activeSlide={activeSlide}
                        alignmentGuides={transientFramePreview.alignmentGuides}
                        canvasScale={actualScale}
                        frameOverrides={transientFramePreview.frameOverrides}
                        interactionBlockId={canvasInteraction.transform?.blockId ?? null}
                        interactionMode={canvasInteraction.mode}
                        imageCropBlockIndex={imageCropBlockIndex}
                        imageCropRect={imageCropRect}
                        marqueeSelection={canvasInteraction.marqueeSelection}
                        onCancelMarquee={cancelMarquee}
                        onEndInteraction={endInteraction}
                        onEndMarquee={endMarquee}
                        onSelectBlock={onSelectBlock}
                        onBeginTextEdit={(blockIndex) => {
                          canvasInteraction.beginEditingText(blockIndex);
                          onBeginBlockTransform();
                        }}
                        onEndTextEdit={canvasInteraction.finishEditingText}
                        onBeginBlockTransform={onBeginBlockTransform}
                        onImageCropRectChange={updateImageCropRect}
                        onStartMarquee={startMarquee}
                        onStartMove={startMove}
                        onStartResize={startResize}
                        onStartRotate={startRotate}
                        onToggleImageCrop={toggleImageCrop}
                        onUpdateBlock={onUpdateBlock}
                        onUpdateInteraction={updateInteraction}
                        onUpdateMarquee={updateMarquee}
                        activeCanvasTool={canvasInputTool}
                        selectedBlockIndex={selectedBlockIndex}
                        selectedBlockIndices={selectedBlockIndices}
                      />
                    ) : null}
                    {isActiveSlideFrame && canvasShapeTool && canvasInputTool === "select" && !interactionDisabled && !sharedHtmlRuntime ? (
                      <ShapeDrawOverlay
                        getCanvasPoint={getCanvasPosition}
                        onCancel={() => onCanvasShapeToolChange(null)}
                        onComplete={(props) => {
                          onAddBlock(canvasShapeTool.type, { props });
                          onCanvasShapeToolChange(null);
                        }}
                        tool={canvasShapeTool}
                      />
                    ) : null}
                    {isActiveSlideFrame && !interactionDisabled && (
                      canvasInputTool === "hand" || canvasInputTool === "zoom"
                    ) ? (
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 z-[55]"
                        data-canvas-navigation-gesture-surface
                      />
                    ) : null}
                    <ActiveCanvasOverlay
                      activeSlideIndex={activeSlideIndex}
                      activities={remoteMcpOperations}
                      assistantActivities={assistantActivities}
                      assistantTone={assistantTone}
                      assistantTrace={assistantTrace}
                      cursor={remoteMcpCursor}
                      cursorLayerRef={remoteMcpCursorLayerRef}
                      reducedMotion={remoteMcpCursorReducedMotion}
                      scene={slideScene}
                      slideIndex={slide.index}
                      showCursor={isActiveSlideFrame}
                    />
                    {isActiveSlideFrame && contextMenu && !interactionDisabled && !sharedHtmlRuntime ? (
                      <CanvasContextMenu
                        canGroup={canGroupSelection}
                        canPaste={canPasteBlock}
                        canUngroup={canUngroupSelection}
                        onClose={closeContextMenu}
                        onCopy={onCopySelectedBlock}
                        onDelete={onDeleteSelectedBlocks}
                        onDuplicate={onDuplicateSelectedBlock}
                        onFitTextBox={() => fitTextBlock(contextMenu.blockIndex)}
                        onGroup={onGroupSelectedBlocks}
                        onMoveToBack={() => onMoveSelectedBlocksToEdge("back")}
                        onMoveToFront={() => onMoveSelectedBlocksToEdge("front")}
                        onPaste={onPasteCopiedBlock}
                        onToggleLock={onToggleSelectedBlocksPositionLock}
                        onUngroup={onUngroupSelectedBlocks}
                        onUseAsBackground={onUseSelectedImageAsBackground}
                        position={contextMenu.position}
                        selectedBlock={contextMenu.blockIndex === null ? undefined : activeSlide?.blocks[contextMenu.blockIndex]}
                        selectedBlocksLocked={selectedBlocksLocked}
                      />
                    ) : null}
              </CanvasSlideFrame>
            );
          })}
          {canvasViewMode === "slide" && sharedHtmlRuntime ? (
            <SharedHtmlCanvasOverlay
              activeSlideIndex={activeSlideIndex}
              actualScale={actualScale}
              canvasRef={canvasRef}
              hostRef={canvasStripRef}
              interactive={canvasInputTool === "select"}
              onRequestSlide={onSelectSlide}
              scenes={scenes}
              suspended={previewSuspended}
            />
          ) : null}
        </div>
      </div>
      {!interactionDisabled && !sharedHtmlRuntime ? <CanvasBlockDock
        activeCanvasTool={activeCanvasTool}
        onAddBlock={onAddBlock}
        onCanvasToolChange={onCanvasToolChange}
        onCanvasShapeToolChange={onCanvasShapeToolChange}
        onFitMobile={fitCanvasToViewport}
        onInsertSlideAfter={() => onInsertSlideNearActive("after")}
        onOpenMobileInspector={onOpenMobileInspector}
        onOpenMobileLayers={onOpenMobileLayers}
        onUndoMobile={onUndo}
        showDesktopBlockDock={showDesktopBlockDock}
        zoomDirection={zoomDirection}
      /> : null}
    </div>
  );
}

const emptyBlockIndices: number[] = [];
const emptyBlocks: MotionDocScene["blocks"] = [];
function slideIndexFromTarget(target: HTMLElement) {
  const slideFrame = target.closest("[data-slide-frame-index]");

  if (!(slideFrame instanceof HTMLElement)) {
    return null;
  }

  const slideIndex = Number(slideFrame.dataset.slideFrameIndex);
  return Number.isInteger(slideIndex) ? slideIndex : null;
}

function scrollSlideFrameIntoView(slideFrame: HTMLElement, scrollArea: HTMLElement | null) {
  if (!scrollArea) {
    slideFrame.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center"
    });
    return;
  }

  const slideRect = slideFrame.getBoundingClientRect();
  const viewportRect = scrollArea.getBoundingClientRect();
  const slideCenterX = slideRect.left + slideRect.width / 2;
  const slideCenterY = slideRect.top + slideRect.height / 2;
  const viewportCenterX = viewportRect.left + viewportRect.width / 2;
  const viewportCenterY = viewportRect.top + viewportRect.height / 2;

  scrollArea.scrollTo({
    behavior: "smooth",
    left: scrollArea.scrollLeft + slideCenterX - viewportCenterX,
    top: scrollArea.scrollTop + slideCenterY - viewportCenterY
  });
}
