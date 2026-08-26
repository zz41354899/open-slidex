import { useCallback, useEffect, useRef, useState } from "react";
import type { MotionDocBlock } from "@/core/motion-doc/domain/motionDocTypes";

export function useLayerSelection(activeBlocks: MotionDocBlock[]) {
  const activeBlocksRef = useRef(activeBlocks);
  activeBlocksRef.current = activeBlocks;
  const activeBlockCount = activeBlocks.length;
  const [selection, setSelection] = useState<LayerSelectionState>(emptyLayerSelection);

  useEffect(() => {
    setSelection((current) => {
      const indices = current.indices.filter((index) => index >= 0 && index < activeBlockCount);
      const primaryIndex = current.primaryIndex !== null && current.primaryIndex >= 0 && current.primaryIndex < activeBlockCount
        ? current.primaryIndex
        : indices[indices.length - 1] ?? null;
      return primaryIndex === current.primaryIndex && indices.length === current.indices.length
        ? current
        : { indices, primaryIndex };
    });
  }, [activeBlockCount]);

  const selectSingleBlock = useCallback((index: number | null) => {
    setSelection(index === null ? emptyLayerSelection : { indices: [index], primaryIndex: index });
  }, []);

  const clearBlockSelection = useCallback(() => {
    selectSingleBlock(null);
  }, [selectSingleBlock]);

  const selectBlock = useCallback((index: number, options: { additive?: boolean; bypassGroup?: boolean; range?: boolean } = {}) => {
    const blocks = activeBlocksRef.current;
    const block = blocks[index];
    const groupId = !options.bypassGroup && block && "props" in block && typeof block.props.groupId === "string"
      ? block.props.groupId
      : "";
    const groupedIndices = groupId
      ? blocks.flatMap((candidate, candidateIndex) => (
          "props" in candidate && candidate.props.groupId === groupId ? [candidateIndex] : []
        ))
      : [];

    setSelection((current) => {
      if (options.range && current.primaryIndex !== null) {
        const start = Math.min(current.primaryIndex, index);
        const end = Math.max(current.primaryIndex, index);
        return {
          indices: Array.from({ length: end - start + 1 }, (_, offset) => start + offset),
          primaryIndex: index
        };
      }

      if (options.additive && groupedIndices.length > 0) {
        const groupIsSelected = groupedIndices.every((groupedIndex) => current.indices.includes(groupedIndex));
        const nextSelection = groupIsSelected
          ? current.indices.filter((currentIndex) => !groupedIndices.includes(currentIndex))
          : [...new Set([...current.indices, ...groupedIndices])].sort((a, b) => a - b);
        return {
          indices: nextSelection,
          primaryIndex: nextSelection.includes(index) ? index : nextSelection[nextSelection.length - 1] ?? null
        };
      }

      if (options.additive) {
        const nextSelection = current.indices.includes(index)
          ? current.indices.filter((item) => item !== index)
          : [...current.indices, index].sort((a, b) => a - b);
        return {
          indices: nextSelection,
          primaryIndex: nextSelection.includes(index) ? index : nextSelection[nextSelection.length - 1] ?? null
        };
      }

      if (groupedIndices.length > 0) {
        return { indices: groupedIndices, primaryIndex: index };
      }

      return { indices: [index], primaryIndex: index };
    });
  }, []);

  const selectBlocks = useCallback((indices: number[], options: { additive?: boolean } = {}) => {
    const uniqueIndices = indices
      .filter((index, offset, items) => items.indexOf(index) === offset)
      .sort((a, b) => a - b);

    if (options.additive) {
      setSelection((current) => {
        const indices = [...new Set([...current.indices, ...uniqueIndices])].sort((a, b) => a - b);
        return { indices, primaryIndex: indices[indices.length - 1] ?? null };
      });
      return;
    }

    setSelection({
      indices: uniqueIndices,
      primaryIndex: uniqueIndices[uniqueIndices.length - 1] ?? null
    });
  }, []);

  return {
    clearBlockSelection,
    selectBlock,
    selectBlocks,
    selectedBlockIndex: selection.primaryIndex,
    selectedBlockIndices: selection.indices,
    selectSingleBlock
  };
}

type LayerSelectionState = {
  indices: number[];
  primaryIndex: number | null;
};

const emptyLayerSelection: LayerSelectionState = { indices: [], primaryIndex: null };
