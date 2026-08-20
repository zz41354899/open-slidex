import { useCallback, useEffect, useRef, useState } from "react";
import type { MotionDocBlock } from "@/core/motion-doc/domain/motionDocTypes";

export function useLayerSelection(activeBlocks: MotionDocBlock[]) {
  const activeBlocksRef = useRef(activeBlocks);
  activeBlocksRef.current = activeBlocks;
  const activeBlockCount = activeBlocks.length;
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [selectedBlockIndices, setSelectedBlockIndices] = useState<number[]>([]);

  useEffect(() => {
    setSelectedBlockIndices((current) => current.filter((index) => index >= 0 && index < activeBlockCount));
    setSelectedBlockIndex((current) => {
      if (current === null || current < activeBlockCount) {
        return current;
      }

      return null;
    });
  }, [activeBlockCount]);

  const selectSingleBlock = useCallback((index: number | null) => {
    setSelectedBlockIndex(index);
    setSelectedBlockIndices(index === null ? [] : [index]);
  }, []);

  const clearBlockSelection = useCallback(() => {
    selectSingleBlock(null);
  }, [selectSingleBlock]);

  const selectBlock = useCallback((index: number, options: { additive?: boolean; bypassGroup?: boolean; range?: boolean } = {}) => {
    if (options.range && selectedBlockIndex !== null) {
      const start = Math.min(selectedBlockIndex, index);
      const end = Math.max(selectedBlockIndex, index);
      const range = Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
      setSelectedBlockIndices(range);
      setSelectedBlockIndex(index);
      return;
    }

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

    if (options.additive && groupedIndices.length > 0) {
      setSelectedBlockIndices((current) => {
        const groupIsSelected = groupedIndices.every((groupedIndex) => current.includes(groupedIndex));
        const nextSelection = groupIsSelected
          ? current.filter((currentIndex) => !groupedIndices.includes(currentIndex))
          : [...new Set([...current, ...groupedIndices])].sort((a, b) => a - b);

        setSelectedBlockIndex(nextSelection.includes(index) ? index : nextSelection[nextSelection.length - 1] ?? null);
        return nextSelection;
      });
      return;
    }

    if (options.additive) {
      setSelectedBlockIndices((current) => {
        const nextSelection = current.includes(index)
          ? current.filter((item) => item !== index)
          : [...current, index].sort((a, b) => a - b);

        setSelectedBlockIndex(nextSelection.includes(index) ? index : nextSelection[nextSelection.length - 1] ?? null);
        return nextSelection;
      });
      return;
    }

    if (groupedIndices.length > 0) {
      setSelectedBlockIndices(groupedIndices);
      setSelectedBlockIndex(index);
      return;
    }

    selectSingleBlock(index);
  }, [selectSingleBlock, selectedBlockIndex]);

  const selectBlocks = useCallback((indices: number[], options: { additive?: boolean } = {}) => {
    const uniqueIndices = indices
      .filter((index, offset, items) => items.indexOf(index) === offset)
      .sort((a, b) => a - b);

    if (options.additive) {
      setSelectedBlockIndices((current) => {
        const nextSelection = [...new Set([...current, ...uniqueIndices])].sort((a, b) => a - b);
        setSelectedBlockIndex(nextSelection[nextSelection.length - 1] ?? null);
        return nextSelection;
      });
      return;
    }

    setSelectedBlockIndices(uniqueIndices);
    setSelectedBlockIndex(uniqueIndices[uniqueIndices.length - 1] ?? null);
  }, []);

  return {
    clearBlockSelection,
    selectBlock,
    selectBlocks,
    selectedBlockIndex,
    selectedBlockIndices,
    selectSingleBlock,
    setSelectedBlockIndex
  };
}
