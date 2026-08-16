
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent } from "react";
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
import { canvasSlideRowsForRender } from "@/features/pitch/application/canvasSlideRender";
import { CanvasBlockDock, CanvasSlideAddControls, CanvasSlideNav } from "@/features/pitch/ui/preview/CanvasChrome";
import { MobileEdgePanelHandles } from "@/features/pitch/ui/preview/MobileCanvasChrome";
import { CanvasContextMenu } from "@/features/pitch/ui/preview/CanvasContextMenu";
import { CanvasSelectionLayer } from "@/features/pitch/ui/preview/CanvasSelectionLayer";
import { CanvasSafeAreaOverlay } from "@/features/pitch/ui/preview/CanvasSafeAreaOverlay";
import { CanvasGridView } from "@/features/pitch/ui/preview/CanvasGridView";
import { ViewportDeferredPreview } from "@/features/pitch/ui/preview/ViewportDeferredPreview";
import { RemoteMcpActivityOverlay } from "@/features/pitch/ui/preview/RemoteMcpActivityOverlay";
import { AssistantCanvasActivityOverlay } from "@/features/pitch/ui/preview/AssistantCanvasActivityOverlay";
import { RemoteMcpCanvasCursor } from "@/features/pitch/ui/preview/RemoteMcpCanvasCursor";
import { RemoteMcpActivityRail } from "@/features/pitch/ui/preview/RemoteMcpActivityRail";
import type { RemoteMcpOperation } from "@/features/pitch/domain/remoteMcpOperation";
import type { AssistantCanvasActivity, AssistantCanvasTrace } from "@/core/motion-doc/domain/assistantCanvasActivity";
import type { AssistantCanvasTone } from "@/features/pitch/ui/preview/assistantCanvasAppearance";
import { PreviewPane } from "@/features/pitch/ui/preview/PreviewPane";
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
  slideRows
}: PreviewCanvasProps) {
  const { locale } = usePitchI18n();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const activeSlideFrameRef = useRef<HTMLDivElement | null>(null);
  const activeCanvasToolRef = useRef<CanvasTool>(activeCanvasTool);
  const previousActiveSlideIndexRef = useRef(activeSlideIndex);
  const requestedSlideFocusRef = useRef(false);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const scrollPositionsRef = useRef(initialCanvasScrollPositions());
  const canvasInteraction = useCanvasInteractionEngine();
  const transientFramePreview = useTransientFramePreview({
    blocks: activeSlide?.blocks ?? emptyBlocks,
    onCommit: onUpdateBlockFrames
  });
  const { syncSelection } = canvasInteraction;
  const [canvasViewportOffset, setCanvasViewportOffset] = useState({ x: 0, y: 0 });
  const [isMouseOverCanvas, setIsMouseOverCanvas] = useState(false);
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
  const canvasPanZoom = useCanvasPanZoom({
    activeCanvasTool,
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
    zoomDirection
  } = canvasPanZoom;
  const gridColor = gridLineColor(activeSlide);
  const viewportCursorClass = activeCanvasTool === "hand"
    ? isPanningCanvas ? "cursor-grabbing" : "cursor-grab"
    : activeCanvasTool === "zoom" ? zoomDirection === "out" ? "cursor-zoom-out" : "cursor-zoom-in" : "";
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
  useEffect(() => {
    activeCanvasToolRef.current = activeCanvasTool;
  }, [activeCanvasTool]);

  useEffect(() => {
    if (activeCanvasTool !== "select" && canvasShapeTool) {
      onCanvasShapeToolChange(null);
    }
  }, [activeCanvasTool, canvasShapeTool, onCanvasShapeToolChange]);

  useEffect(() => {
    syncSelection({
      primaryIndex: selectedBlockIndex,
      selectedIndices: selectedBlockIndices.length > 0
        ? selectedBlockIndices
        : selectedBlockIndex === null ? [] : [selectedBlockIndex]
    });
  }, [selectedBlockIndex, selectedBlockIndices, syncSelection]);

  useEffect(() => {
    const transform = canvasInteraction.transform;
    if (!transform) return;
    const transformStillExists = activeSlide?.blocks.some(
      (block, blockIndex) => motionDocBlockKey(block, blockIndex) === transform.blockId
    );
    if (transformStillExists) return;
    transientFramePreview.reset();
    canvasInteraction.clearInteraction();
  }, [activeSlide?.blocks, canvasInteraction, transientFramePreview]);

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
    if (activeCanvasTool !== "select") {
      return;
    }

    if ((event.target as HTMLElement).closest("button")) {
      return;
    }
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
    if (activeCanvasTool !== "select") {
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
    if (activeCanvasTool !== "select") {
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
    if (activeCanvasTool !== "select" || event.button !== 0) return;
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
    if (activeCanvasTool !== "select") {
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

    canvasInteraction.select({
      primaryIndex: selectedIndices[0] ?? null,
      selectedIndices
    });
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
    if (event.button !== 0 || activeCanvasTool !== "select") {
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
        if (activeCanvasTool === "select") {
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
    if (activeCanvasTool === "zoom") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (activeCanvasTool !== "select") {
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
      data-canvas-mode={canvasViewMode}
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
          if (activeCanvasTool === "select" && event.target === event.currentTarget) {
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
          className={`relative min-h-full min-w-full shrink-0 ${canvasViewMode === "slide"
            ? "flex flex-col items-center gap-10 pb-24 pt-2 sm:min-h-0 sm:gap-12"
            : "flex items-start justify-center pb-24 pt-2 sm:min-h-0"
          }`}
          onPointerDown={(event) => {
            if (activeCanvasTool === "select" && event.target === event.currentTarget) {
              canvasInteraction.clearInteraction();
              onClearSelection();
            }
          }}
          style={{
            paddingLeft: canvasStripSidePadding,
            paddingRight: canvasStripSidePadding,
            transform: `translate3d(${canvasViewportOffset.x}px, ${canvasViewportOffset.y}px, 0)`
          }}
        >
          {canvasViewMode === "grid" ? <CanvasGridView
            activeSlideIndex={activeSlideIndex}
            onOpenSlide={openSlideFromGrid}
            onReorderSlide={onReorderSlide}
            replayNonce={replayNonce}
            scenes={scenes}
            slideRows={renderedSlideRows}
          /> : renderedSlideRows.map((slide) => {
            const isActiveSlideFrame = slide.index === activeSlideIndex;
            const slideScene = scenes[slide.index];

            return (
              <div
                className={`relative flex shrink-0 flex-col gap-2 transition-opacity ${isActiveSlideFrame ? "z-10" : "z-0 opacity-80 hover:opacity-100"}`}
                data-slide-frame-index={slide.index}
                key={slide.index}
                onPointerDown={(event) => handleSlideFramePointerDown(event, slide.index)}
                ref={isActiveSlideFrame ? activeSlideFrameRef : undefined}
              >
                <div className="hidden h-7 items-center justify-between px-1 font-mono text-[14px] font-semibold uppercase tracking-[0.12em] text-neutral-500 sm:flex">
                  <span className={isActiveSlideFrame ? "text-neutral-300" : undefined}>{locale === "zh-TW" ? `投影片 ${slide.index + 1}` : `Slide ${slide.index + 1}`}</span>
                  <span>{slideScene?.duration ?? slide.duration}s</span>
                </div>
                <div
                  className="relative"
                  style={isActiveSlideFrame ? undefined : {
                    containIntrinsicSize: `${Math.round(CANVAS_WIDTH * actualScale)}px ${Math.round(CANVAS_HEIGHT * actualScale)}px`,
                    contentVisibility: "auto"
                  }}
                >
                  {isActiveSlideFrame && !isMouseOverCanvas ? <CanvasSlideAddControls onInsertSlideNearActive={onInsertSlideNearActive} orientation="vertical" /> : null}
                  <div
                    aria-current={isActiveSlideFrame ? "true" : undefined}
                    aria-label={locale === "zh-TW"
                      ? `第 ${slide.index + 1} 張投影片畫布，16:9，${CANVAS_WIDTH} × ${CANVAS_HEIGHT}`
                      : `Slide ${slide.index + 1} canvas, 16:9 ${CANVAS_WIDTH} by ${CANVAS_HEIGHT}`}
                    className={`group relative shrink-0 bg-black shadow-xl ring-1 transition-shadow duration-200 ${isActiveSlideFrame ? "overflow-visible" : "overflow-hidden"} ${
                      isActiveSlideFrame
                        ? "ring-neutral-500/55 shadow-[0_18px_54px_rgba(0,0,0,0.48)]"
                        : "ring-neutral-800/80 hover:ring-white/20"
                    }`}
                    onDoubleClick={isActiveSlideFrame ? handleCanvasDoubleClick : undefined}
                    onDragOver={isActiveSlideFrame ? handleToolDragOver : undefined}
                    onDrop={isActiveSlideFrame ? handleToolDrop : undefined}
                    onMouseEnter={isActiveSlideFrame ? () => setIsMouseOverCanvas(true) : undefined}
                    onMouseLeave={isActiveSlideFrame ? () => setIsMouseOverCanvas(false) : undefined}
                    ref={isActiveSlideFrame ? canvasRef : undefined}
                    style={canvasFrameStyle}
                  >
                    <div
                      className={`absolute left-0 top-0 ${isActiveSlideFrame ? "overflow-visible" : "overflow-hidden"}`}
                      style={{
                        height: CANVAS_HEIGHT,
                        transform: `scale(${actualScale})`,
                        transformOrigin: "left top",
                        width: CANVAS_WIDTH
                      }}
                    >
                      <ViewportDeferredPreview
                        eager={isActiveSlideFrame}
                        rootMargin={MAIN_CANVAS_PRELOAD_MARGIN}
                        rootRef={scrollAreaRef}
                      >
                        <PreviewPane
                          activeSlideIndex={slide.index}
                          allowOverflow={isActiveSlideFrame}
                          hiddenBlockIndices={isActiveSlideFrame ? hiddenPreviewBlockIndices : emptyBlockIndices}
                          frameOverrides={isActiveSlideFrame ? previewFrameOverrides : undefined}
                          imageFetchPriority={isActiveSlideFrame ? "high" : "low"}
                          imageLoading={isActiveSlideFrame ? "eager" : "lazy"}
                          onShaderFrameCapture={isActiveSlideFrame ? onShaderFrameCapture : undefined}
                          replayNonce={replayNonce}
                          scene={slideScene}
                          shaderMaxPixelCount={isActiveSlideFrame
                            ? canvasInteraction.mode === "idle"
                              ? activeShaderMaxPixelCount
                              : MAIN_CANVAS_INACTIVE_SHADER_MAX_PIXEL_COUNT
                            : MAIN_CANVAS_INACTIVE_SHADER_MAX_PIXEL_COUNT}
                          shaderPlaybackActive={isActiveSlideFrame && canvasInteraction.mode === "idle"}
                        />
                      </ViewportDeferredPreview>
                    </div>
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
                    {isActiveSlideFrame ? <CanvasSafeAreaOverlay visible={isSafeAreaVisible} /> : null}
                    {isActiveSlideFrame && !interactionDisabled ? (
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
                        activeCanvasTool={activeCanvasTool}
                        selectedBlockIndex={selectedBlockIndex}
                        selectedBlockIndices={selectedBlockIndices}
                      />
                    ) : null}
                    {isActiveSlideFrame && canvasShapeTool && !interactionDisabled ? (
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
                    <RemoteMcpActivityOverlay
                      activeSlideIndex={activeSlideIndex}
                      activities={remoteMcpOperations}
                      scene={slideScene}
                      slideIndex={slide.index}
                    />
                    <AssistantCanvasActivityOverlay
                      activities={assistantActivities}
                      scene={slideScene}
                      showCursor={isActiveSlideFrame}
                      slideIndex={slide.index}
                      tone={assistantTone}
                      trace={assistantTrace}
                    />
                    {isActiveSlideFrame ? (
                      <RemoteMcpCanvasCursor
                        cursor={remoteMcpCursor}
                        layerRef={remoteMcpCursorLayerRef}
                        reducedMotion={remoteMcpCursorReducedMotion}
                      />
                    ) : null}
                    {isActiveSlideFrame && contextMenu && !interactionDisabled ? (
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {!interactionDisabled ? <CanvasBlockDock
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
