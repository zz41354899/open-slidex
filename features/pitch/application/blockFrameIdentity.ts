import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import type { ResolvedBlockFrameUpdate } from "@/features/pitch/application/pitchGeometry";

export function resolveBlockFrameUpdateIndices(
  blocks: MotionDocScene["blocks"],
  updates: readonly ResolvedBlockFrameUpdate[]
) {
  const currentIndexById = new Map(
    blocks.map((block, index) => [motionDocBlockKey(block, index), index])
  );

  return updates.flatMap((update) => {
    const blockIndex = currentIndexById.get(update.blockId);
    return blockIndex === undefined ? [] : [{ ...update, blockIndex }];
  });
}
