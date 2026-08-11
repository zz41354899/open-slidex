"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { resolveBlockFrameUpdateIndices } from "@/features/pitch/application/blockFrameIdentity";
import {
  findAlignmentGuides,
  type AlignmentGuide
} from "@/features/pitch/application/previewCanvas";
import type {
  BlockFrameOverrides,
  BlockFramePatch,
  ResolvedBlockFrameUpdate
} from "@/features/pitch/application/pitchGeometry";

type UseTransientFramePreviewArgs = {
  blocks: MotionDocScene["blocks"];
  onCommit: (updates: BlockFramePatch[]) => void;
};

const emptyFrameOverrides: BlockFrameOverrides = new Map();

export function useTransientFramePreview({ blocks, onCommit }: UseTransientFramePreviewArgs) {
  const rafRef = useRef<number | null>(null);
  const blocksRef = useRef(blocks);
  const pendingUpdatesRef = useRef<ResolvedBlockFrameUpdate[] | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const [frameOverrides, setFrameOverrides] = useState<BlockFrameOverrides>(emptyFrameOverrides);

  useLayoutEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const resolveCurrentBlockIndices = useCallback((updates: readonly ResolvedBlockFrameUpdate[]) => {
    return resolveBlockFrameUpdateIndices(blocksRef.current, updates);
  }, []);

  const cancelScheduledPreview = useCallback(() => {
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    pendingUpdatesRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cancelScheduledPreview();
    setAlignmentGuides([]);
    setFrameOverrides(emptyFrameOverrides);
  }, [cancelScheduledPreview]);

  const preview = useCallback((updates: ResolvedBlockFrameUpdate[]) => {
    pendingUpdatesRef.current = updates;
    if (rafRef.current !== null) return;

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const pendingUpdates = pendingUpdatesRef.current;
      pendingUpdatesRef.current = null;
      if (!pendingUpdates) return;
      const resolvedUpdates = resolveCurrentBlockIndices(pendingUpdates);
      setAlignmentGuides(findAlignmentGuides(blocksRef.current, resolvedUpdates));
      setFrameOverrides(new Map(resolvedUpdates.map((update) => [update.blockId, update.frame])));
    });
  }, [resolveCurrentBlockIndices]);

  const commit = useCallback((updates: ResolvedBlockFrameUpdate[]) => {
    cancelScheduledPreview();
    setAlignmentGuides([]);
    setFrameOverrides(emptyFrameOverrides);
    onCommit(resolveCurrentBlockIndices(updates).map(({ blockIndex, frame }) => ({ blockIndex, frame })));
  }, [cancelScheduledPreview, onCommit, resolveCurrentBlockIndices]);

  useEffect(() => () => cancelScheduledPreview(), [cancelScheduledPreview]);

  return { alignmentGuides, commit, frameOverrides, preview, reset };
}
