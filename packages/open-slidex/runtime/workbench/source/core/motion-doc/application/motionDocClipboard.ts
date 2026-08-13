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

export function serializeMotionDocClipboardPacket(packet: MotionDocClipboardPacket) {
  return JSON.stringify(packet);
}

export function parseMotionDocClipboardPacket(value: string | null | undefined): MotionDocClipboardPacket | null {
  if (!value?.trim()) return null;
  try {
    const parsed = JSON.parse(value) as Partial<MotionDocClipboardPacket>;
    if (
      parsed.format !== MOTION_DOC_CLIPBOARD_FORMAT
      || parsed.version !== MOTION_DOC_CLIPBOARD_VERSION
      || !Array.isArray(parsed.blocks)
    ) return null;
    return createMotionDocClipboardPacket(parsed.blocks as MotionDocBlock[]);
  } catch {
    return null;
  }
}

export function motionDocClipboardHtml(packet: MotionDocClipboardPacket) {
  const payload = encodeURIComponent(serializeMotionDocClipboardPacket(packet));
  return `<meta data-open-slidex-motiondoc="${payload}"><p>OpenSlideX MotionDoc selection</p>`;
}

export function motionDocClipboardPacketFromHtml(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/data-open-slidex-motiondoc=["']([^"']+)["']/i);
  if (!match?.[1]) return null;
  try {
    return parseMotionDocClipboardPacket(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}
