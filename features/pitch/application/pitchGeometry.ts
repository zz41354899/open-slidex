import type { MotionDocFrame, MotionDocFramePatch } from "@/core/motion-doc/domain/frame";

export type PositionDelta = {
  x: number;
  y: number;
};

export type BlockFramePatch = {
  blockIndex: number;
  frame: MotionDocFramePatch;
  rotation?: number;
};

export type ResolvedBlockFrameUpdate = {
  blockId: string;
  blockIndex: number;
  frame: MotionDocFrame;
  rotation?: number;
};

export type BlockFrameOverride = MotionDocFrame & { rotation?: number };

export type BlockFrameOverrides = ReadonlyMap<string, BlockFrameOverride>;

export const EMPTY_BLOCK_FRAME_OVERRIDES: BlockFrameOverrides = new Map();
