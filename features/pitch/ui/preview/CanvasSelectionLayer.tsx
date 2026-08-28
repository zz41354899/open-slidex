
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { ImageCropRect } from "@/core/motion-doc/application/imageCrop";
import type { MotionDocFrame } from "@/core/motion-doc/domain/frame";
import { blockRotation } from "@/core/motion-doc/domain/blockTransform";
import { resolveSlideThemeColors } from "@/core/motion-doc/application/slideTheme";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import { motionSequenceFromProps, type MotionTweenAction } from "@/core/motion-doc/domain/motionSequence";
import { updateMotionActionProps } from "@/features/pitch/application/motionModel";
import type { BlockFrameOverrides } from "@/features/pitch/application/pitchGeometry";
import {
  combinedSelectionFrame,
  selectedCanvasIndices
} from "@/features/pitch/application/canvasSelection";
import type { CanvasTool } from "@/features/pitch/application/canvasTools";
import { isPositionLocked } from "@/features/pitch/application/motionDocCommands";
import type { BlockUpdater } from "@/features/pitch/application/pitchCommandTypes";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import {
  blockFrame,
  isEditableTableBlock,
  isEditableTextBlock,
  isMovableBlock,
  selectedGroupId,
  selectionSpacingGuides,
  type AlignmentGuide,
  type MarqueeSelection,
  type ResizeHandle
} from "@/features/pitch/application/previewCanvas";
import { tableEditorSelectionProps } from "@/features/pitch/application/tableEditorSelection";
import { visualFrameToolbarPlacement } from "@/features/pitch/application/visualFrameToolbar";
import {
  AlignmentGuideLine,
  FrameInteractionHalo,
  MarqueeOverlay,
  MultiSelectionFrame,
  SelectedFrameControls
} from "@/features/pitch/ui/preview/CanvasSelectionChrome";
import { TableFrameEditor } from "@/features/pitch/ui/preview/TableFrameEditor";
import { TextFrameEditor } from "@/features/pitch/ui/preview/TextFrameEditor";
import { VisualFrameEditor } from "@/features/pitch/ui/preview/VisualFrameEditor";
import { ImageCropEditor } from "@/features/pitch/ui/preview/ImageCropEditor";
import type { CanvasInteractionMode } from "@/features/pitch/ui/preview/interaction/useCanvasInteractionEngine";

type CanvasSelectionLayerProps = {
  activeCanvasTool: CanvasTool;
  activeSlide: MotionDocScene | undefined;
  alignmentGuides: AlignmentGuide[];
  canvasScale: number;
  frameOverrides: BlockFrameOverrides;
  interactionBlockId: string | null;
  interactionMode: CanvasInteractionMode;
  imageCropBlockIndex: number | null;
  imageCropRect: ImageCropRect | null;
  marqueeSelection: MarqueeSelection | null;
  onCancelMarquee: (event: PointerEvent<HTMLDivElement>) => void;
  onEndInteraction: (event: PointerEvent<HTMLDivElement>, blockId: string) => void;
  onEndMarquee: (event: PointerEvent<HTMLDivElement>) => void;
  onBeginTextEdit: (blockIndex: number) => void;
  onEndTextEdit: () => void;
  onBeginBlockTransform: () => void;
  onImageCropRectChange: (rect: ImageCropRect) => void;
  onSelectBlock: (index: number) => void;
  onStartMarquee: (event: PointerEvent<HTMLDivElement>) => void;
  onStartMove: (event: PointerEvent<HTMLDivElement>, blockIndex: number, frame: MotionDocFrame) => void;
  onStartResize: (event: PointerEvent<HTMLSpanElement>, blockIndex: number, handle: ResizeHandle, frame: MotionDocFrame, blockIndices?: readonly number[]) => void;
  onStartRotate: (event: PointerEvent<HTMLElement>, blockIndex: number, frame: MotionDocFrame) => void;
  onToggleImageCrop: (blockIndex: number) => void;
  onUpdateBlock: BlockUpdater;
  onUpdateInteraction: (event: PointerEvent<HTMLDivElement>) => void;
  onUpdateMarquee: (event: PointerEvent<HTMLDivElement>) => void;
  selectedBlockIndex: number | null;
  selectedBlockIndices: number[];
};

export function CanvasSelectionLayer({
  activeCanvasTool,
  activeSlide,
  alignmentGuides,
  canvasScale,
  frameOverrides,
  interactionBlockId,
  interactionMode,
  imageCropBlockIndex,
  imageCropRect,
  marqueeSelection,
  onCancelMarquee,
  onEndInteraction,
  onEndMarquee,
  onBeginTextEdit,
  onEndTextEdit,
  onBeginBlockTransform,
  onImageCropRectChange,
  onSelectBlock,
  onStartMarquee,
  onStartMove,
  onStartResize,
  onStartRotate,
  onToggleImageCrop,
  onUpdateBlock,
  onUpdateInteraction,
  onUpdateMarquee,
  selectedBlockIndex,
  selectedBlockIndices
}: CanvasSelectionLayerProps) {
  const { locale, tx } = usePitchI18n();
  const slideTextColors = activeSlide ? resolveSlideThemeColors(activeSlide.props) : null;
  const selectedIndices = selectedCanvasIndices(activeSlide, selectedBlockIndex, selectedBlockIndices);
  const isMultiSelection = selectedIndices.length > 1;
  const activeGroupId = selectedGroupId(activeSlide?.blocks ?? [], selectedIndices);
  const isGroupedSelection = activeGroupId !== null;
  const [groupFocus, setGroupFocus] = useState<{ blockIndex: number; groupId: string } | null>(null);
  const focusedGroupBlockIndex = groupFocus?.groupId === activeGroupId ? groupFocus.blockIndex : null;
  const isGroupFocusMode = focusedGroupBlockIndex !== null;
  const focusedGroupBlock = focusedGroupBlockIndex === null ? undefined : activeSlide?.blocks[focusedGroupBlockIndex];
  const isGroupedTextFocusMode = focusedGroupBlock !== undefined
    && isEditableTextBlock(focusedGroupBlock)
    && interactionMode === "editingText";
  const multiSelectionFrame = isMultiSelection ? combinedSelectionFrame(activeSlide, selectedIndices, frameOverrides) : null;
  const spacingGuides = isMultiSelection
    ? selectionSpacingGuides(selectedIndices.map((index) => {
        const block = activeSlide?.blocks[index];
        return block
          ? frameOverrides.get(motionDocBlockKey(block, index)) ?? blockFrame(block)
          : blockFrame(undefined);
      }))
    : [];
  const unlockedSelectedIndices = selectedIndices.filter((index) => {
    const block = activeSlide?.blocks[index];
    return block ? !isPositionLocked(block) : false;
  });
  const groupInteractionIndex = unlockedSelectedIndices.includes(selectedBlockIndex ?? -1)
    ? selectedBlockIndex
    : unlockedSelectedIndices[0] ?? null;

  useEffect(() => {
    if (!isGroupFocusMode) return;

    function exitGroupFocusOnOutsidePointer(event: globalThis.PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-group-focus-mode='true']")) return;
      if (target.closest("[data-group-focus-surface]")) return;
      if (target.closest("[data-radix-popper-content-wrapper]")) return;
      setGroupFocus(null);
    }

    document.addEventListener("pointerdown", exitGroupFocusOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", exitGroupFocusOnOutsidePointer, true);
  }, [isGroupFocusMode]);

  return (
    <div
      className={`absolute inset-0 z-40 ${activeCanvasTool === "select" ? "" : "pointer-events-none"}`}
      data-canvas-tool={activeCanvasTool}
      data-canvas-interaction-mode={interactionMode}
      onPointerCancel={onCancelMarquee}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && isGroupedSelection) {
          setGroupFocus(null);
        }
        onStartMarquee(event);
      }}
      onPointerMove={(event) => {
        if (interactionBlockId !== null) {
          onUpdateInteraction(event);
          return;
        }
        onUpdateMarquee(event);
      }}
      onPointerUp={(event) => {
        if (interactionBlockId !== null) {
          onEndInteraction(event, interactionBlockId);
          if (isGroupedSelection) setGroupFocus(null);
          return;
        }
        onEndMarquee(event);
      }}
    >
      {activeSlide && selectedBlockIndex !== null ? (
        <MotionGhostEditor
          blockIndex={selectedBlockIndex}
          onBegin={onBeginBlockTransform}
          onUpdateBlock={onUpdateBlock}
          slide={activeSlide}
        />
      ) : null}
      {alignmentGuides.map((guide, index) => (
        <AlignmentGuideLine guide={guide} index={index} key={`${guide.orientation}-${guide.position}-${index}`} />
      ))}
      {marqueeSelection ? <MarqueeOverlay marqueeSelection={marqueeSelection} /> : null}
      {activeSlide?.blocks.map((block, blockIndex) => {
        if (!isMovableBlock(block)) return null;

        const isSelected = selectedIndices.includes(blockIndex);
        const isPrimarySelection = selectedBlockIndex === blockIndex || (selectedBlockIndex === null && selectedIndices[0] === blockIndex);
        const isLocked = isPositionLocked(block);
        const tableBlock = isEditableTableBlock(block) ? block : null;
        const isTextBlock = isEditableTextBlock(block);
        const isShapeImage = block.type === "Shape" && block.props.shape !== "line" && Boolean(block.props.shapeImageSrc);
        const isVisualBlock = block.type === "ImageBlock" || block.type === "VideoBlock" || (block.type === "Shape" && block.props.shape !== "line");
        const isImageCropActive = (block.type === "ImageBlock" || isShapeImage) && imageCropBlockIndex === blockIndex;
        const isLineShape = block.type === "Shape" && block.props.shape === "line";
        const isGroupedTextEditor = isGroupedSelection && isSelected && isTextBlock;
        const isGroupedBlockFocused = isGroupedSelection && isSelected && focusedGroupBlockIndex === blockIndex;
        const isGroupedTextEditing = isGroupedTextEditor && isGroupedBlockFocused && interactionMode === "editingText";
        const isTextEditing = isTextBlock
          && isSelected
          && isPrimarySelection
          && interactionMode === "editingText"
          && (!isGroupedSelection || isGroupedBlockFocused);
        const showIndividualTextEditor = isGroupedTextEditor || (
          isSelected && isTextBlock && !isMultiSelection && isPrimarySelection
        );
        const showIndividualControls = !isMultiSelection && isPrimarySelection;
        const blockKey = motionDocBlockKey(block, blockIndex);
        const frame = frameOverrides.get(blockKey) ?? blockFrame(block);

        return (
          <div
            aria-label={locale === "zh-TW"
              ? `移動${tx(block.type)}圖層 ${blockIndex + 1}`
              : `Move ${block.type} layer ${blockIndex + 1}`}
            className={frameControlClass({
              isInteracting: interactionBlockId === blockKey,
              isGroupedTextEditor,
              isGroupedBlockFocused,
              isGroupedTextEditing,
              isLineShape,
              isLocked,
              isPrimarySelection,
              isSelected,
              isTextBlock,
              isImageCropActive
            })}
            data-block-index={blockIndex}
            data-frame-control
            data-group-focus-mode={isGroupedBlockFocused ? "true" : undefined}
            key={blockKey}
            onPointerDown={(event) => {
              event.currentTarget.focus({ preventScroll: true });
              if (isGroupedSelection && isSelected && activeGroupId) {
                event.preventDefault();
                event.stopPropagation();
                setGroupFocus({ blockIndex, groupId: activeGroupId });
                onSelectBlock(blockIndex);
                return;
              }
              if (!isImageCropActive) onStartMove(event, blockIndex, frame);
            }}
            onDoubleClick={(event) => {
              if (!isTextBlock || isLocked || !isSelected || !isPrimarySelection) return;
              event.preventDefault();
              event.stopPropagation();
              if (isGroupedSelection && activeGroupId) {
                setGroupFocus({ blockIndex, groupId: activeGroupId });
              }
              onSelectBlock(blockIndex);
              onBeginTextEdit(blockIndex);
              const frameControl = event.currentTarget;
              window.requestAnimationFrame(() => {
                frameControl.querySelector<HTMLElement>("[data-text-frame-editor]")?.focus({ preventScroll: true });
              });
            }}
            onKeyDown={(event) => {
              if (
                !isTextBlock
                || !isSelected
                || !isPrimarySelection
                || (event.key !== "Enter" && event.key !== "F2")
              ) return;
              event.preventDefault();
              event.stopPropagation();
              if (isGroupedSelection && activeGroupId) {
                setGroupFocus({ blockIndex, groupId: activeGroupId });
              }
              onSelectBlock(blockIndex);
              onBeginTextEdit(blockIndex);
              const frameControl = event.currentTarget;
              window.requestAnimationFrame(() => {
                frameControl.querySelector<HTMLElement>("[data-text-frame-editor]")?.focus({ preventScroll: true });
              });
            }}
            role="button"
            style={{
              height: `${frame.h}%`,
              left: `${frame.x}%`,
              rotate: `${blockRotation(block.props)}deg`,
              top: `${frame.y}%`,
              width: `${frame.w}%`
            }}
            tabIndex={0}
          >
            {!isImageCropActive ? (
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 z-0 h-full min-h-8 w-full min-w-8 -translate-x-1/2 -translate-y-1/2 bg-transparent"
              />
            ) : null}
            {isImageCropActive && imageCropRect && (block.type === "ImageBlock" || isShapeImage) ? (
              <ImageCropEditor
                block={block}
                blockIndex={blockIndex}
                cropRect={imageCropRect}
                onBeginBlockTransform={onBeginBlockTransform}
                onCropRectChange={onImageCropRectChange}
                onUpdateBlock={onUpdateBlock}
              />
            ) : null}
            {isSelected && showIndividualControls && !isLocked && !isLineShape && !isVisualBlock ? <FrameInteractionHalo isTextBlock={isTextBlock} /> : null}
            {showIndividualTextEditor ? (
              <TextFrameEditor
                block={block}
                blockIndex={blockIndex}
                canvasScale={canvasScale}
                inheritedTextColor={
                  block.type === "heading" || block.props.role === "title"
                    ? slideTextColors?.foreground
                    : slideTextColors?.muted
                }
                isEditingEnabled={isTextEditing}
                toolbarAlignment={frame.x + frame.w / 2 >= 50 ? "right" : "left"}
                toolbarPlacement={frame.y < 11 ? "below" : "above"}
                onBeginTextEdit={() => onBeginTextEdit(blockIndex)}
                onEndTextEdit={onEndTextEdit}
                onRequestEdit={() => {
                  if (isGroupedSelection && activeGroupId) {
                    setGroupFocus({ blockIndex, groupId: activeGroupId });
                  }
                  onSelectBlock(blockIndex);
                  onBeginTextEdit(blockIndex);
                }}
                onSelectBlock={onSelectBlock}
                onUpdateBlock={onUpdateBlock}
                resizeDuringEdit={isGroupedSelection}
                showToolbar={!isGroupedSelection || isPrimarySelection && isGroupedTextEditing}
              />
            ) : null}
            {isSelected && isPrimarySelection && (!isMultiSelection || isGroupedSelection) && isVisualBlock && !isLocked ? (
              <VisualFrameEditor
                block={block}
                blockIndex={blockIndex}
                isImageCropActive={isImageCropActive}
                onSelectBlock={onSelectBlock}
                onToggleImageCrop={onToggleImageCrop}
                onUpdateBlock={onUpdateBlock}
                placement={visualFrameToolbarPlacement(frame, canvasScale)}
              />
            ) : null}
            {isSelected && isPrimarySelection && !isMultiSelection && tableBlock ? (
              <TableFrameEditor
                block={tableBlock}
                blockIndex={blockIndex}
                onSelectionChange={(selection) => onUpdateBlock(blockIndex, tableEditorSelectionProps(tableBlock.props, selection), undefined, { transient: true })}
                onSelectBlock={onSelectBlock}
                onUpdateBlock={onUpdateBlock}
              />
            ) : null}
            {isSelected && !isImageCropActive ? (
              <SelectedFrameControls
                frame={frame}
                interactionMode={interactionBlockId === blockKey ? interactionMode : "idle"}
                isTextBlock={isTextBlock}
                isLineShape={isLineShape}
                isLocked={isLocked}
                showHandles={showIndividualControls && activeCanvasTool === "select"}
                onStartResize={(event, handle) => onStartResize(event, blockIndex, handle, frame)}
                onStartRotate={(event) => onStartRotate(event, blockIndex, frame)}
              />
            ) : null}
          </div>
        );
      })}
      {multiSelectionFrame && groupInteractionIndex !== null ? (
        <MultiSelectionFrame
          blockIndex={groupInteractionIndex}
          canResize={unlockedSelectedIndices.length === selectedIndices.length}
          count={selectedIndices.length}
          frame={multiSelectionFrame}
          interactionMode={interactionMode}
          isFocusMode={isGroupedTextFocusMode}
          isGroup={isGroupedSelection}
          isTransforming={interactionBlockId !== null}
          lockedCount={selectedIndices.length - unlockedSelectedIndices.length}
          onStartMove={(event) => {
            setGroupFocus(null);
            onStartMove(event, groupInteractionIndex, multiSelectionFrame);
          }}
          onStartResize={(event, handle) => {
            setGroupFocus(null);
            onStartResize(event, groupInteractionIndex, handle, multiSelectionFrame, unlockedSelectedIndices);
          }}
          spacingGuides={spacingGuides}
        />
      ) : null}
    </div>
  );
}

function MotionGhostEditor({ blockIndex, onBegin, onUpdateBlock, slide }: {
  blockIndex: number;
  onBegin: () => void;
  onUpdateBlock: BlockUpdater;
  slide: MotionDocScene;
}) {
  const block = slide.blocks[blockIndex];
  const { tx } = usePitchI18n();
  const tweens = block ? motionSequenceFromProps(block.props)?.actions.filter((candidate): candidate is MotionTweenAction => candidate.type === "tween") ?? [] : [];
  const [selectedActionId, setSelectedActionId] = useState("");
  const action = tweens.find((candidate) => candidate.id === selectedActionId);
  const dragRef = useRef<null | { from: MotionTweenAction["from"]; pointerX: number; pointerY: number }>(null);
  const resizeRef = useRef<null | { from: MotionTweenAction["from"]; pointerX: number; pointerY: number }>(null);
  const rotateRef = useRef<null | { centerX: number; centerY: number; pointerAngle: number; rotation: number }>(null);
  const pathDragRef = useRef(false);
  useEffect(() => {
    const selectAction = (event: Event) => setSelectedActionId((event as CustomEvent<string>).detail ?? "");
    window.addEventListener("slidex:motion-action-selected", selectAction);
    return () => window.removeEventListener("slidex:motion-action-selected", selectAction);
  }, []);
  if (!block || !action || action.preset === "numberRange") return null;
  const actionId = action.id;

  function updateAction(next: MotionTweenAction, transient: boolean) {
    onUpdateBlock(blockIndex, updateMotionActionProps(block.props, actionId, (candidate) => candidate.type === "tween" ? next : candidate), undefined, transient ? { transient: true } : { captureUndo: false });
  }

  const fromCenter = { x: action.from.x + action.from.w / 2, y: action.from.y + action.from.h / 2 };
  const toCenter = { x: action.to.x + action.to.w / 2, y: action.to.y + action.to.h / 2 };
  const control = action.path ?? { controlX: (fromCenter.x + toCenter.x) / 2, controlY: (fromCenter.y + toCenter.y) / 2 };

  return (
    <>
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-[47] h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
        <path d={`M ${fromCenter.x} ${fromCenter.y} Q ${control.controlX} ${control.controlY} ${toCenter.x} ${toCenter.y}`} fill="none" stroke="rgba(76,29,149,.28)" strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
        <path d={`M ${fromCenter.x} ${fromCenter.y} Q ${control.controlX} ${control.controlY} ${toCenter.x} ${toCenter.y}`} fill="none" stroke="rgba(196,181,253,.95)" strokeWidth="0.34" vectorEffect="non-scaling-stroke" />
      </svg>
      <div aria-hidden="true" className="pointer-events-none absolute z-[52] flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-neutral-900 bg-white text-[9px] font-black text-black shadow-lg" style={{ left: `${toCenter.x}%`, top: `${toCenter.y}%` }}>2</div>
      <div
        aria-label={tx("Action start ghost")}
        className="absolute z-50 cursor-move rounded-sm border-2 border-dashed border-violet-300/85 bg-violet-400/12 shadow-[0_0_0_1px_rgba(139,92,246,.18),0_0_28px_rgba(139,92,246,.18)]"
        data-motion-start-ghost
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onBegin();
          dragRef.current = { from: action.from, pointerX: event.clientX, pointerY: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag) return;
          const rect = event.currentTarget.parentElement?.getBoundingClientRect();
          if (!rect?.width || !rect.height) return;
          const from = { ...drag.from, x: drag.from.x + (event.clientX - drag.pointerX) / rect.width * 100, y: drag.from.y + (event.clientY - drag.pointerY) / rect.height * 100 };
          updateAction({ ...action, from }, true);
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          dragRef.current = null;
          if (!drag) return;
          const rect = event.currentTarget.parentElement?.getBoundingClientRect();
          if (!rect?.width || !rect.height) return;
          const from = { ...drag.from, x: drag.from.x + (event.clientX - drag.pointerX) / rect.width * 100, y: drag.from.y + (event.clientY - drag.pointerY) / rect.height * 100 };
          updateAction({ ...action, from }, false);
        }}
        role="button"
        style={{ height: `${action.from.h}%`, left: `${action.from.x}%`, opacity: Math.max(0.35, action.from.opacity), rotate: `${action.from.rotation}deg`, top: `${action.from.y}%`, width: `${action.from.w}%` }}
        tabIndex={0}
      >
        <span className="absolute -left-2.5 -top-2.5 flex size-5 items-center justify-center rounded-full border-2 border-neutral-900 bg-violet-500 text-[9px] font-black text-white shadow-lg">1</span>
        <button
          aria-label={tx("Resize action start ghost")}
          className="absolute -bottom-2 -right-2 size-4 cursor-nwse-resize rounded-sm border-2 border-violet-500 bg-white"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onBegin();
            resizeRef.current = { from: action.from, pointerX: event.clientX, pointerY: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = resizeRef.current;
            if (!drag) return;
            const rect = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
            if (!rect?.width || !rect.height) return;
            const from = { ...drag.from, w: Math.max(0.5, drag.from.w + (event.clientX - drag.pointerX) / rect.width * 100), h: Math.max(0.5, drag.from.h + (event.clientY - drag.pointerY) / rect.height * 100) };
            updateAction({ ...action, from }, true);
          }}
          onPointerUp={(event) => {
            const drag = resizeRef.current;
            resizeRef.current = null;
            if (!drag) return;
            const rect = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
            if (!rect?.width || !rect.height) return;
            const from = { ...drag.from, w: Math.max(0.5, drag.from.w + (event.clientX - drag.pointerX) / rect.width * 100), h: Math.max(0.5, drag.from.h + (event.clientY - drag.pointerY) / rect.height * 100) };
            updateAction({ ...action, from }, false);
          }}
          type="button"
        />
        <button
          aria-label={tx("Rotate action start ghost")}
          className="absolute -right-2 -top-2 size-4 cursor-grab rounded-full border-2 border-violet-500 bg-white"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const rect = event.currentTarget.parentElement?.getBoundingClientRect();
            if (!rect) return;
            onBegin();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            rotateRef.current = { centerX, centerY, pointerAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI, rotation: action.from.rotation };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = rotateRef.current;
            if (!drag) return;
            const angle = Math.atan2(event.clientY - drag.centerY, event.clientX - drag.centerX) * 180 / Math.PI;
            updateAction({ ...action, from: { ...action.from, rotation: drag.rotation + angle - drag.pointerAngle } }, true);
          }}
          onPointerUp={(event) => {
            const drag = rotateRef.current;
            rotateRef.current = null;
            if (!drag) return;
            const angle = Math.atan2(event.clientY - drag.centerY, event.clientX - drag.centerX) * 180 / Math.PI;
            updateAction({ ...action, from: { ...action.from, rotation: drag.rotation + angle - drag.pointerAngle } }, false);
          }}
          type="button"
        />
      </div>
      {action.path ? (
        <button
          aria-label={tx("Action curve control")}
          className="absolute z-[51] size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-500 shadow-lg"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onBegin();
            pathDragRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!pathDragRef.current) return;
            const rect = event.currentTarget.parentElement?.getBoundingClientRect();
            if (!rect?.width || !rect.height) return;
            updateAction({ ...action, path: { controlX: (event.clientX - rect.left) / rect.width * 100, controlY: (event.clientY - rect.top) / rect.height * 100 } }, true);
          }}
          onPointerUp={(event) => {
            pathDragRef.current = false;
            const rect = event.currentTarget.parentElement?.getBoundingClientRect();
            if (!rect?.width || !rect.height) return;
            updateAction({ ...action, path: { controlX: (event.clientX - rect.left) / rect.width * 100, controlY: (event.clientY - rect.top) / rect.height * 100 } }, false);
          }}
          style={{ left: `${control.controlX}%`, top: `${control.controlY}%` }}
          type="button"
        />
      ) : null}
    </>
  );
}

function frameControlClass({
  isInteracting,
  isGroupedTextEditor,
  isGroupedBlockFocused,
  isGroupedTextEditing,
  isLocked,
  isPrimarySelection,
  isLineShape,
  isSelected,
  isTextBlock,
  isImageCropActive
}: {
  isInteracting: boolean;
  isGroupedTextEditor: boolean;
  isGroupedBlockFocused: boolean;
  isGroupedTextEditing: boolean;
  isLocked: boolean;
  isPrimarySelection: boolean;
  isLineShape: boolean;
  isSelected: boolean;
  isTextBlock: boolean;
  isImageCropActive: boolean;
}) {
  const cursorClass = isLocked ? "cursor-default" : "cursor-move";
  const baseClass = "group/frame absolute box-border touch-none overflow-visible border bg-transparent text-left outline-none transition-[border-color,box-shadow,background-color] duration-150 focus-visible:ring-2 focus-visible:ring-violet-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

  if (isGroupedTextEditing) return `${baseClass} select-text cursor-text border-pink-300/50 bg-pink-300/[0.04] shadow-[0_0_0_1px_rgba(244,114,182,0.08),0_8px_24px_rgba(244,114,182,0.045)]`;
  if (isGroupedBlockFocused) return `${baseClass} select-none cursor-default border-violet-400/45 shadow-[0_0_0_1px_rgba(139,92,246,0.06)]`;
  if (isGroupedTextEditor) return `${baseClass} select-none border-transparent shadow-none ${cursorClass}`;
  if (isLineShape) return `${baseClass} select-none border-transparent shadow-none ${cursorClass}`;
  if (!isSelected) return `${baseClass} select-none border-white/0 hover:border-violet-400/70 ${cursorClass}`;
  if (isImageCropActive) return `${baseClass} select-none cursor-default border-transparent shadow-none`;
  if (!isPrimarySelection) return `${baseClass} select-none border-violet-400/60 ${cursorClass}`;
  if (isInteracting) return `${baseClass} select-none border-violet-400 ${cursorClass}`;
  if (isTextBlock) return `${baseClass} select-text border-violet-500 ${cursorClass}`;
  return `${baseClass} select-none border-violet-500 ${cursorClass}`;
}
