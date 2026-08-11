import { cloneBlock } from "@/core/motion-doc/application/motionDocSerialize";
import type { MotionDocBlock } from "@/core/motion-doc/domain/motionDocTypes";

export const MOTION_DOC_CLIPBOARD_FORMAT = "application/vnd.open-slidex.motiondoc-blocks+json";
export const MOTION_DOC_CLIPBOARD_VERSION = 1;

export type MotionDocClipboardPacket = {
  blocks: MotionDocBlock[];
  format: typeof MOTION_DOC_CLIPBOARD_FORMAT;
  version: typeof MOTION_DOC_CLIPBOARD_VERSION;
};

export function createMotionDocClipboardPacket(blocks: readonly MotionDocBlock[]): MotionDocClipboardPacket {
  return {
    blocks: blocks.map(cloneBlock),
    format: MOTION_DOC_CLIPBOARD_FORMAT,
    version: MOTION_DOC_CLIPBOARD_VERSION
  };
}

export function motionDocClipboardBlocks(packet: MotionDocClipboardPacket | null) {
  if (!packet || packet.format !== MOTION_DOC_CLIPBOARD_FORMAT || packet.version !== MOTION_DOC_CLIPBOARD_VERSION) {
    return [];
  }

  return packet.blocks.map(cloneBlock);
}
