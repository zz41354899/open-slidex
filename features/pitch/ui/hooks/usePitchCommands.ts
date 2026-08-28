
import { useRef, useState, type Dispatch, type MouseEvent as ReactMouseEvent, type SetStateAction } from "react";
import {
  createMotionDocClipboardPacket,
  motionDocClipboardBlocks,
  type MotionDocClipboardPacket
} from "@/core/motion-doc/application/motionDocClipboard";
import type { MotionDocBlock, MotionDocProps, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { textStyleRangesFromProps } from "@/core/motion-doc/domain/textStyleRanges";
import { motionSequenceFromProps, withMotionSequence } from "@/core/motion-doc/domain/motionSequence";
import { createSharedMorphId, isMorphSupportedBlock } from "@/core/motion-doc/domain/sharedMorph";
import {
  deleteTableColumn,
  deleteTableRow,
  tableSizeFromProps
} from "@/core/motion-doc/application/tableBlock";
import {
  appendBlockToSlide,
  appendTextBlockAtPosition,
  applySelectionMdxSource,
  canGroupBlocks,
  deleteBlockAt,
  deleteBlocks,
  duplicateBlockAt,
  imageBlockAsSlideBackground,
  isPositionLocked,
  groupBlocks,
  moveBlockByDirection,
  moveBlocksToEdge,
  nudgeBlocks,
  pasteBlocksIntoSlide,
  renameLayer,
  reorderBlocks,
  replaceSlideSource,
  selectedLayerIndices,
  toggleBlocksPositionLock,
  ungroupBlocks,
  updateBlockInSlide,
  updatePositionedBlockFrames as buildPositionedBlockFramesSlide,
  type AddBlockOptions
} from "@/features/pitch/application/motionDocCommands";
import type { BlockFramePatch } from "@/features/pitch/application/pitchGeometry";
import {
  alignSelectedBlocks as alignBlocksInSelection,
  distributeSelectedBlocks as distributeBlocksInSelection,
  snapSelectedBlocksToGrid as snapBlocksInSelection,
  type SelectionAlignment,
  type SelectionDistribution
} from "@/features/pitch/application/multiSelectionLayout";
import { updateSelectedBlockColor as updateBlockColorInSelection } from "@/features/pitch/application/multiSelectionColors";
import {
  clearTableEditorSelectionProps,
  tableEditorSelectionFromProps
} from "@/features/pitch/application/tableEditorSelection";
import type { BlockUpdateOptions } from "@/features/pitch/application/pitchCommandTypes";
import { type AddBlockType } from "@/features/pitch/ui/pitchOptions";
import { usePitchAssetCommands } from "@/features/pitch/ui/hooks/usePitchAssetCommands";
import { usePitchSlideCommands } from "@/features/pitch/ui/hooks/usePitchSlideCommands";
import type { SlideXEditorAssetAdapter, SlideXEditorCloudAssetAdapter } from "@/features/pitch/domain/localEditor";
import {
  readMotionDocClipboardData,
  readMotionDocSystemClipboard,
  writeMotionDocSystemClipboard
} from "@/features/pitch/infrastructure/motionDocSystemClipboard";

type UsePitchCommandsArgs = {
  activeSlide: MotionDocScene | undefined;
  activeSlideIndex: number;
  assetAdapter?: SlideXEditorAssetAdapter;
  cloudAssetAdapter?: SlideXEditorCloudAssetAdapter;
  commitSource: (
    nextSource: string | ((current: string) => string),
    options?: { captureUndo?: boolean }
  ) => void;
  markProjectDirty: () => void;
  onImageUploadAuthRequired: () => void;
  onImageRemovalAuthRequired: () => void;
  presentationId?: string;
  pushUndoSnapshot: () => void;
  scenes: MotionDocScene[];
  selectBlock: (index: number, options?: { additive?: boolean; bypassGroup?: boolean; range?: boolean }) => void;
  selectBlocks: (indices: number[], options?: { additive?: boolean }) => void;
  selectedBlockIndex: number | null;
  selectedBlockIndices: number[];
  selectSingleBlock: (index: number | null) => void;
  setActiveSlideIndex: Dispatch<SetStateAction<number>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setSelectedTemplateId: Dispatch<SetStateAction<string>>;
  setSource: Dispatch<SetStateAction<string>>;
  source: string;
};

export function usePitchCommands({
  activeSlide,
  activeSlideIndex,
  assetAdapter,
  cloudAssetAdapter,
  commitSource,
  markProjectDirty,
  onImageUploadAuthRequired,
  onImageRemovalAuthRequired,
  presentationId,
  pushUndoSnapshot,
  scenes,
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
}: UsePitchCommandsArgs) {
  const [clipboardPacket, setClipboardPacket] = useState<MotionDocClipboardPacket | null>(null);
  const lastUsedFontFamilyRef = useRef("");
  const slideCommands = usePitchSlideCommands({
    activeSlide,
    activeSlideIndex,
    commitSource,
    scenes,
    selectSingleBlock,
    setActiveSlideIndex,
    setNotice,
    setSelectedTemplateId,
    source
  });
  const assetCommands = usePitchAssetCommands({
    activeSlide,
    activeSlideIndex,
    assetAdapter,
    cloudAssetAdapter,
    commitSource,
    onImageUploadAuthRequired,
    onImageRemovalAuthRequired,
    presentationId,
    scenes,
    selectedBlockIndex,
    selectSingleBlock,
    setNotice,
    updateBlock
  });

  function selectBlockFromLayer(
    index: number,
    event: ReactMouseEvent<HTMLDivElement>,
    target: "group" | "layer" = "layer"
  ) {
    selectBlock(index, {
      additive: event.metaKey || event.ctrlKey,
      bypassGroup: target === "layer",
      range: event.shiftKey
    });
  }

  function beginBlockTransform() {
    pushUndoSnapshot();
  }

  function deleteBlock(blockIndex: number) {
    if (!activeSlide) return;

    const nextSlide = deleteBlockAt(activeSlide, blockIndex);
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, nextSlide));
    selectSingleBlock(null);
    setNotice("Layer deleted");
  }

  function deleteSelectedBlocks() {
    if (!activeSlide) return;

    if (deleteSelectedTablePart()) {
      return;
    }

    const indices = selectedLayerIndices(selectedBlockIndices, selectedBlockIndex, "desc");

    if (indices.length === 0) {
      return;
    }

    const nextSlide = deleteBlocks(activeSlide, indices);
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, nextSlide));
    selectSingleBlock(null);
    setNotice(indices.length > 1 ? "Layers deleted" : "Layer deleted");
  }

  function deleteSelectedTablePart() {
    const isSingleSelectedBlock = selectedBlockIndices.length === 0 || (
      selectedBlockIndices.length === 1 && selectedBlockIndices[0] === selectedBlockIndex
    );

    if (!activeSlide || selectedBlockIndex === null || !isSingleSelectedBlock) {
      return false;
    }

    const block = activeSlide.blocks[selectedBlockIndex];

    if (!block || block.type !== "Table" || !("props" in block)) {
      return false;
    }

    const tableSelection = tableEditorSelectionFromProps(block.props);

    if (!tableSelection) {
      return false;
    }

    const beforeSize = tableSizeFromProps(block.props);
    const nextTableProps = tableSelection.kind === "row"
      ? deleteTableRow(block.props, tableSelection.index)
      : deleteTableColumn(block.props, tableSelection.index);
    const afterSize = tableSizeFromProps(nextTableProps);

    if (beforeSize.rows === afterSize.rows && beforeSize.columns === afterSize.columns) {
      setNotice(tableSelection.kind === "row" ? "Cannot delete last row" : "Cannot delete last column");
      return true;
    }

    const nextSlide = updateBlockInSlide(
      activeSlide,
      selectedBlockIndex,
      clearTableEditorSelectionProps(nextTableProps)
    );

    if (!nextSlide) {
      return true;
    }

    commitSource((current) => replaceSlideSource(current, activeSlideIndex, nextSlide));
    setNotice(tableSelection.kind === "row" ? "Row deleted" : "Column deleted");
    return true;
  }

  function cutSelectedBlocks() {
    if (!activeSlide || selectedBlockIndex === null) {
      return;
    }

    copySelectedBlock();
    const indices = selectedLayerIndices(selectedBlockIndices, selectedBlockIndex, "desc");

    if (indices.length === 0) {
      return;
    }

    const nextSlide = deleteBlocks(activeSlide, indices);
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, nextSlide));
    selectSingleBlock(null);
    setNotice(indices.length > 1 ? "Layers cut" : "Layer cut");
  }

  function duplicateSelectedBlock() {
    if (!activeSlide || selectedBlockIndex === null) {
      return;
    }

    const indices = selectedLayerIndices(selectedBlockIndices, selectedBlockIndex);
    if (indices.length > 1) {
      const blocks = indices.map((index) => activeSlide.blocks[index]).filter((block): block is MotionDocBlock => Boolean(block));
      const result = pasteBlocksIntoSlide(activeSlide, blocks, indices[indices.length - 1], { offset: true });
      commitSource((current) => replaceSlideSource(current, activeSlideIndex, result.slide));
      selectBlocks(result.blockIndices);
      setNotice("Layers duplicated");
      return;
    }

    const result = duplicateBlockAt(activeSlide, selectedBlockIndex);

    if (!result) {
      return;
    }

    commitSource((current) => replaceSlideSource(current, activeSlideIndex, result.slide));
    selectSingleBlock(result.blockIndex);
    setNotice("Layer duplicated");
  }

  function moveBlock(blockIndex: number, direction: -1 | 1) {
    if (!activeSlide) return;
    const nextSlide = moveBlockByDirection(activeSlide, blockIndex, direction);
    if (!nextSlide) return;

    commitSource((current) => replaceSlideSource(current, activeSlideIndex, nextSlide));
    setNotice("Layer reordered");
  }

  function copySelectedBlock() {
    if (!activeSlide || selectedBlockIndex === null) {
      return;
    }

    const indices = selectedLayerIndices(selectedBlockIndices, selectedBlockIndex);
    const blocks = indices.map((index) => activeSlide.blocks[index]).filter((block): block is MotionDocBlock => Boolean(block));
    if (blocks.length === 0) {
      return;
    }

    const packet = createMotionDocClipboardPacket(blocks);
    setClipboardPacket(packet);
    void writeMotionDocSystemClipboard(packet);
    setNotice(blocks.length > 1 ? `${blocks.length} layers copied` : "Layer copied");
  }

  async function pasteCopiedBlock(data?: DataTransfer | null) {
    const eventPacket = readMotionDocClipboardData(data);
    const systemPacket = eventPacket ?? await readMotionDocSystemClipboard();
    const resolvedPacket = systemPacket ?? clipboardPacket;
    const copiedBlocks = motionDocClipboardBlocks(resolvedPacket);
    if (!activeSlide || copiedBlocks.length === 0) {
      setNotice("No SlideX layer on clipboard");
      return;
    }

    setClipboardPacket(resolvedPacket);
    const { blockIndices, slide } = pasteBlocksIntoSlide(activeSlide, copiedBlocks, selectedBlockIndex, { offset: true });
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, slide));
    selectBlocks(blockIndices);
    setNotice(blockIndices.length > 1 ? `${blockIndices.length} layers pasted` : "Layer pasted");
  }

  function moveSelectedBlocksToEdge(edge: "back" | "front") {
    if (!activeSlide) return;
    const indices = selectedLayerIndices(selectedBlockIndices, selectedBlockIndex);
    if (indices.length === 0) return;
    const result = moveBlocksToEdge(activeSlide, indices, edge);
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, result.slide));
    selectBlocks(result.blockIndices);
    setNotice(edge === "front" ? "Moved to front" : "Moved to back");
  }

  function moveBlockToEdge(blockIndex: number, edge: "back" | "front") {
    if (!activeSlide) return;
    const result = moveBlocksToEdge(activeSlide, [blockIndex], edge);
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, result.slide));
    selectSingleBlock(result.blockIndices[0]);
    setNotice(edge === "front" ? "Moved to front" : "Moved to back");
  }

  function groupSelectedBlocks() {
    if (!activeSlide) return;
    const indices = selectedLayerIndices(selectedBlockIndices, selectedBlockIndex);
    if (!canGroupBlocks(activeSlide, indices)) return;
    const groupId = `group-${Date.now().toString(36)}`;
    const result = groupBlocks(activeSlide, indices, groupId);
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, result.slide));
    selectBlocks(result.blockIndices);
    setNotice(`${indices.length} layers grouped`);
  }

  function alignSelectedBlocks(alignment: SelectionAlignment) {
    if (!activeSlide) return;
    const indices = selectedLayerIndices(selectedBlockIndices, selectedBlockIndex);
    const result = alignBlocksInSelection(activeSlide, indices, alignment);
    if (!result.didUpdate) return;
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, result.slide));
    setNotice("Layers aligned");
  }

  function distributeSelectedBlocks(distribution: SelectionDistribution) {
    if (!activeSlide) return;
    const indices = selectedLayerIndices(selectedBlockIndices, selectedBlockIndex);
    const result = distributeBlocksInSelection(activeSlide, indices, distribution);
    if (!result.didUpdate) return;
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, result.slide));
    setNotice("Layer spacing distributed");
  }

  function snapSelectedBlocksToGrid() {
    if (!activeSlide) return;
    const indices = selectedLayerIndices(selectedBlockIndices, selectedBlockIndex);
    const result = snapBlocksInSelection(activeSlide, indices);
    if (!result.didUpdate) {
      setNotice("Selection already follows the grid");
      return;
    }
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, result.slide));
    setNotice("Selection snapped to 8 px grid");
  }

  function updateSelectedBlockColor(blockIndex: number, color: string) {
    if (!activeSlide) return;
    const indices = selectedLayerIndices(selectedBlockIndices, selectedBlockIndex);
    if (!indices.includes(blockIndex)) return;
    const result = updateBlockColorInSelection(activeSlide, blockIndex, color);
    if (!result.didUpdate) return;
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, result.slide));
    setNotice("Layer color updated");
  }

  function ungroupSelectedBlocks() {
    if (!activeSlide) return;
    const indices = selectedLayerIndices(selectedBlockIndices, selectedBlockIndex);
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, ungroupBlocks(activeSlide, indices)));
    setNotice("Group released");
  }

  function renameBlock(blockIndex: number, name: string) {
    if (!activeSlide) return;
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, renameLayer(activeSlide, blockIndex, name)));
    setNotice(name.trim() ? "Layer renamed" : "Layer name reset");
  }

  function reorderBlock(fromIndex: number, toIndex: number) {
    if (!activeSlide) return;
    const nextSlide = reorderBlocks(activeSlide, fromIndex, toIndex);
    if (!nextSlide) return;

    commitSource((current) => replaceSlideSource(current, activeSlideIndex, nextSlide));
    setNotice("Layer reordered");
  }

  function toggleSelectedBlocksPositionLock() {
    if (!activeSlide) {
      return;
    }

    const indices = selectedLayerIndices(selectedBlockIndices, selectedBlockIndex);

    if (indices.length === 0) {
      return;
    }

    const { didUpdate, locked, slide } = toggleBlocksPositionLock(activeSlide, indices);

    if (!didUpdate) {
      return;
    }

    commitSource((current) => replaceSlideSource(current, activeSlideIndex, slide));
    setNotice(locked ? "Layer position locked" : "Layer position unlocked");
  }

  function toggleBlockPositionLock(blockIndex: number) {
    if (!activeSlide) return;
    const { didUpdate, locked, slide } = toggleBlocksPositionLock(activeSlide, [blockIndex]);
    if (!didUpdate) return;
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, slide));
    setNotice(locked ? "Layer position locked" : "Layer position unlocked");
  }

  function useSelectedImageAsBackground() {
    if (!activeSlide || selectedBlockIndex === null) {
      return;
    }

    const result = imageBlockAsSlideBackground(activeSlide, selectedBlockIndex);

    if (!result) {
      setNotice("Select an image layer first");
      return;
    }

    commitSource((current) => replaceSlideSource(current, activeSlideIndex, result.slide));
    selectSingleBlock(null);
    setNotice("Image used as background");
  }

  function addBlockToActiveSlide(type: AddBlockType, options?: AddBlockOptions) {
    if (!activeSlide) return;
    const inheritedFontFamily = isTextAddBlockType(type) ? textCreationFontFamily() : "";
    const resolvedOptions = inheritedFontFamily && options?.props?.fontFamily === undefined
      ? { ...options, props: { ...options?.props, fontFamily: inheritedFontFamily } }
      : options;
    const { blockIndex, slide } = appendBlockToSlide(activeSlide, type, resolvedOptions);

    commitSource((current) => replaceSlideSource(current, activeSlideIndex, slide));
    selectSingleBlock(blockIndex);
    setNotice(`${type} added`);
  }

  function addTextAtPosition(position: { x: number; y: number }) {
    if (!activeSlide) return;

    const fontFamily = textCreationFontFamily();
    const { blockIndex, slide } = appendTextBlockAtPosition(
      activeSlide,
      position,
      fontFamily ? { fontFamily } : {}
    );
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, slide));
    selectSingleBlock(blockIndex);
    setNotice("Text added");
  }

  function updatePositionedBlockFrames(updates: BlockFramePatch[]) {
    if (!activeSlide) return;

    const nextSlide = buildPositionedBlockFramesSlide(activeSlide, updates);
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, nextSlide), { captureUndo: false });
    setNotice(updates.length > 1 ? "Layers updated" : "Layer updated");
  }

  function nudgeSelectedBlocks(delta: { x: number; y: number }) {
    if (!activeSlide) return;

    const indices = selectedLayerIndices(selectedBlockIndices, selectedBlockIndex);

    if (indices.length === 0) {
      return;
    }

    const { didMove, slide } = nudgeBlocks(activeSlide, indices, delta);
    if (!didMove) {
      return;
    }

    commitSource((current) => replaceSlideSource(current, activeSlideIndex, slide));
    setNotice(indices.length > 1 ? "Layers nudged" : "Layer nudged");
  }

  function updateBlock(blockIndex: number, newProps: MotionDocProps, newText?: string, options?: BlockUpdateOptions) {
    if (!activeSlide) return;

    const currentBlock = activeSlide.blocks[blockIndex];
    if (
      currentBlock &&
      (currentBlock.type === "Text" || currentBlock.type === "heading") &&
      currentBlock.props.fontFamily !== newProps.fontFamily
    ) {
      lastUsedFontFamilyRef.current = typeof newProps.fontFamily === "string" ? newProps.fontFamily.trim() : "";
    } else if (
      currentBlock &&
      (currentBlock.type === "Text" || currentBlock.type === "heading") &&
      currentBlock.props.textStyleRanges !== newProps.textStyleRanges
    ) {
      const textLength = (newText ?? currentBlock.text).length;
      const previousFamilies = new Set(
        textStyleRangesFromProps(currentBlock.props, currentBlock.text.length)
          .flatMap((range) => range.fontFamily ? [range.fontFamily] : [])
      );
      const newlyUsedFamily = textStyleRangesFromProps(newProps, textLength)
        .flatMap((range) => range.fontFamily ? [range.fontFamily] : [])
        .find((fontFamily) => !previousFamilies.has(fontFamily));
      if (newlyUsedFamily) lastUsedFontFamilyRef.current = newlyUsedFamily;
    }

    const nextSlide = updateBlockInSlide(activeSlide, blockIndex, newProps, newText);
    if (!nextSlide) return;

    if (options?.transient) {
      setSource((current) => replaceSlideSource(current, activeSlideIndex, nextSlide));
      markProjectDirty();
      return;
    }

    commitSource((current) => replaceSlideSource(current, activeSlideIndex, nextSlide), { captureUndo: options?.captureUndo });
    setNotice("Block updated");
  }

  function reorderMotionActions(sourceActionId: string, targetActionId: string) {
    if (!activeSlide || sourceActionId === targetActionId) return;
    const entries = activeSlide.blocks.flatMap((block, blockIndex) =>
      (motionSequenceFromProps(block.props)?.actions ?? []).map((action) => ({ action, blockIndex }))
    );
    const sourceEntry = entries.find((entry) => entry.action.id === sourceActionId);
    const targetEntry = entries.find((entry) => entry.action.id === targetActionId);
    if (!sourceEntry || !targetEntry) return;
    const blocks = activeSlide.blocks.map((block, blockIndex) => {
      const sequence = motionSequenceFromProps(block.props);
      if (!sequence || (blockIndex !== sourceEntry.blockIndex && blockIndex !== targetEntry.blockIndex)) return block;
      const actions = sequence.actions.map((action) => {
        if (action.id === sourceActionId) return { ...action, order: targetEntry.action.order };
        if (action.id === targetActionId) return { ...action, order: sourceEntry.action.order };
        return action;
      });
      return { ...block, props: withMotionSequence(block.props, { actions, version: 1 }) } as MotionDocBlock;
    });
    const ordered = blocks.flatMap((block, blockIndex) =>
      (motionSequenceFromProps(block.props)?.actions ?? []).map((action) => ({ action, blockIndex }))
    ).sort((left, right) => left.action.order - right.action.order);
    const first = ordered[0];
    if (first?.action.start === "withPrevious") {
      const firstBlock = blocks[first.blockIndex];
      const sequence = firstBlock ? motionSequenceFromProps(firstBlock.props) : null;
      if (firstBlock && sequence) {
        blocks[first.blockIndex] = {
          ...firstBlock,
          props: withMotionSequence(firstBlock.props, {
            actions: sequence.actions.map((action) => action.id === first.action.id ? { ...action, start: "onClick" as const } : action),
            version: 1
          })
        } as MotionDocBlock;
      }
    }
    commitSource((current) => replaceSlideSource(current, activeSlideIndex, { ...activeSlide, blocks }));
    setNotice("Action order updated");
  }

  function setSharedMorphLink(sourceBlockIndex: number, targetBlockIndex: number | null, sourceSlideIndex = activeSlideIndex) {
    const sourceSlide = scenes[sourceSlideIndex];
    if (!sourceSlide) return;
    const targetSlide = scenes[sourceSlideIndex + 1];
    const sourceBlock = sourceSlide.blocks[sourceBlockIndex];
    const targetBlock = targetBlockIndex === null ? undefined : targetSlide?.blocks[targetBlockIndex];
    if (!sourceBlock || !isMorphSupportedBlock(sourceBlock)) return;
    if (targetBlockIndex !== null && (!targetSlide || !targetBlock || !isMorphSupportedBlock(targetBlock) || targetBlock.type !== sourceBlock.type)) return;
    const existingSharedId = typeof sourceBlock.props.sharedId === "string" ? sourceBlock.props.sharedId.trim() : "";
    const sharedId = targetBlock
      ? existingSharedId || (typeof targetBlock.props.sharedId === "string" ? targetBlock.props.sharedId.trim() : "") || createSharedMorphId()
      : "";
    const sourceBlocks = sourceSlide.blocks.map((block, blockIndex) => {
      if (blockIndex !== sourceBlockIndex && sharedId && block.props.sharedId === sharedId) return withoutSharedId(block);
      if (blockIndex !== sourceBlockIndex) return block;
      return sharedId ? { ...block, props: { ...block.props, sharedId } } : withoutSharedId(block);
    });
    let nextSource = replaceSlideSource(source, sourceSlideIndex, { ...sourceSlide, blocks: sourceBlocks });
    if (targetSlide) {
      const targetBlocks = targetSlide.blocks.map((block, blockIndex) => {
        if (blockIndex === targetBlockIndex) return { ...block, props: { ...block.props, sharedId } } as MotionDocBlock;
        if (sharedId && block.props.sharedId === sharedId) return withoutSharedId(block);
        if (!sharedId && existingSharedId && block.props.sharedId === existingSharedId) return withoutSharedId(block);
        return block;
      });
      nextSource = replaceSlideSource(nextSource, sourceSlideIndex + 1, { ...targetSlide, blocks: targetBlocks });
    }
    commitSource(nextSource);
    setNotice(targetBlock ? "Morph layers linked" : "Morph link removed");
  }

  function textCreationFontFamily() {
    const selectedBlock = selectedBlockIndex === null ? undefined : activeSlide?.blocks[selectedBlockIndex];
    const selectedFontFamily = selectedBlock && "props" in selectedBlock && typeof selectedBlock.props.fontFamily === "string"
      ? selectedBlock.props.fontFamily.trim()
      : "";
    return selectedFontFamily || lastUsedFontFamilyRef.current;
  }

  function updateSelectionMdx(value: string) {
    if (!activeSlide) {
      return;
    }

    const result = applySelectionMdxSource({
      activeSlide,
      activeSlideIndex,
      selectedBlockIndex,
      selectedBlockIndices,
      source,
      value
    });

    if ("error" in result) {
      setNotice(result.error);
      return;
    }

    commitSource(result.source);
    setNotice(result.notice);
  }

  const { imageSourceRequiresAbsoluteUrl, ...latestActions } = {
    ...assetCommands,
    ...slideCommands,
    addBlockToActiveSlide,
    addTextAtPosition,
    alignSelectedBlocks,
    beginBlockTransform,
    copySelectedBlock,
    cutSelectedBlocks,
    deleteBlock,
    deleteSelectedBlocks,
    duplicateSelectedBlock,
    distributeSelectedBlocks,
    groupSelectedBlocks,
    moveBlock,
    moveBlockToEdge,
    nudgeSelectedBlocks,
    moveSelectedBlocksToEdge,
    snapSelectedBlocksToGrid,
    pasteCopiedBlock,
    reorderBlock,
    reorderMotionActions,
    setSharedMorphLink,
    renameBlock,
    selectBlockFromLayer,
    toggleSelectedBlocksPositionLock,
    toggleBlockPositionLock,
    ungroupSelectedBlocks,
    updateSelectedBlockColor,
    updateBlock,
    updatePositionedBlockFrames,
    updateSelectionMdx,
    useSelectedImageAsBackground
  };

  const actions = useLatestStableActions(latestActions);
  const hasCopiedBlock = (clipboardPacket?.blocks.length ?? 0) > 0;
  const selectedBlocksLocked = selectedLayerIndices(selectedBlockIndices, selectedBlockIndex).some((index) => {
    const block = activeSlide?.blocks[index];
    return Boolean(block && isPositionLocked(block));
  });

  return {
    ...actions,
    commandActions: actions,
    hasCopiedBlock,
    imageSourceRequiresAbsoluteUrl,
    selectedBlocksLocked
  };
}

function withoutSharedId(block: MotionDocBlock): MotionDocBlock {
  const props = { ...block.props };
  delete props.sharedId;
  return { ...block, props } as MotionDocBlock;
}

type StableActions<T extends object> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Result ? (...args: Args) => Result : never;
};

/**
 * Keep event handlers referentially stable without making their behaviour stale.
 * The canvas and editor subscribe to many commands; changing an unrelated local
 * state value should not invalidate their memoized props.
 */
function useLatestStableActions<T extends object>(latestActions: T): StableActions<T> {
  const latestActionsRef = useRef(latestActions);
  latestActionsRef.current = latestActions;
  const stableActionsRef = useRef<StableActions<T> | null>(null);

  if (!stableActionsRef.current) {
    stableActionsRef.current = Object.fromEntries(
      Object.keys(latestActions).map((key) => [
        key,
        (...args: unknown[]) => {
          const action = latestActionsRef.current[key as keyof T];
          return typeof action === "function"
            ? (action as (...actionArgs: unknown[]) => unknown)(...args)
            : action;
        }
      ])
    ) as StableActions<T>;
  }

  return stableActionsRef.current;
}

function isTextAddBlockType(type: AddBlockType) {
  return type === "Text" || type.startsWith("Text");
}
