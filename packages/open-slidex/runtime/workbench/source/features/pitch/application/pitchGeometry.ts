import type { MotionDocFrame, MotionDocFramePatch } from "@/core/motion-doc/domain/frame";

export type PositionDelta = {
  x: number;
  y: number;
};

export type BlockFramePatch = {
  blockIndex: number;
  frame: MotionDocFramePatch;
};

export type ResolvedBlockFrameUpdate = {
  blockId: string;
  blockIndex: number;
  frame: MotionDocFrame;
};

export type BlockFrameOverrides = ReadonlyMap<string, MotionDocFrame>;
