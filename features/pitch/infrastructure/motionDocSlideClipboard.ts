import { motionDocSlideSourceRanges } from "@/core/motion-doc/application/motionDocSourceEditor";

export const MOTION_DOC_SLIDE_CLIPBOARD_FORMAT = "application/vnd.open-slidex.motiondoc-slide+json";
const MOTION_DOC_SLIDE_CLIPBOARD_VERSION = 1;

type MotionDocSlideClipboardPacket = {
  format: typeof MOTION_DOC_SLIDE_CLIPBOARD_FORMAT;
  slideSource: string;
  version: typeof MOTION_DOC_SLIDE_CLIPBOARD_VERSION;
};

export function createMotionDocSlideClipboardPacket(source: string, slideIndex: number): MotionDocSlideClipboardPacket | null {
  const slideSource = motionDocSlideSourceRanges(source)[slideIndex]?.source;
  if (!slideSource) return null;
  return { format: MOTION_DOC_SLIDE_CLIPBOARD_FORMAT, slideSource, version: MOTION_DOC_SLIDE_CLIPBOARD_VERSION };
}

export function serializeMotionDocSlideClipboardPacket(packet: MotionDocSlideClipboardPacket) {
  return JSON.stringify(packet);
}

export function parseMotionDocSlideClipboardPacket(value: string | null | undefined): MotionDocSlideClipboardPacket | null {
  if (!value?.trim()) return null;
  try {
    const packet = JSON.parse(value) as Partial<MotionDocSlideClipboardPacket>;
    if (
      packet.format !== MOTION_DOC_SLIDE_CLIPBOARD_FORMAT
      || packet.version !== MOTION_DOC_SLIDE_CLIPBOARD_VERSION
      || typeof packet.slideSource !== "string"
      || motionDocSlideSourceRanges(packet.slideSource).length !== 1
    ) return null;
    return packet as MotionDocSlideClipboardPacket;
  } catch {
    return null;
  }
}

export function writeMotionDocSlideClipboardData(data: DataTransfer, packet: MotionDocSlideClipboardPacket) {
  const serialized = serializeMotionDocSlideClipboardPacket(packet);
  try { data.setData(MOTION_DOC_SLIDE_CLIPBOARD_FORMAT, serialized); } catch { /* portable fallback below */ }
  data.setData("text/plain", serialized);
}

export function readMotionDocSlideClipboardData(data: DataTransfer | null | undefined) {
  if (!data) return null;
  return parseMotionDocSlideClipboardPacket(data.getData(MOTION_DOC_SLIDE_CLIPBOARD_FORMAT))
    ?? parseMotionDocSlideClipboardPacket(data.getData("text/plain"));
}

export async function writeMotionDocSlideSystemClipboard(packet: MotionDocSlideClipboardPacket) {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(serializeMotionDocSlideClipboardPacket(packet));
    return true;
  } catch {
    return false;
  }
}

export async function readMotionDocSlideSystemClipboard() {
  if (typeof navigator === "undefined" || !navigator.clipboard) return null;
  try {
    return parseMotionDocSlideClipboardPacket(await navigator.clipboard.readText());
  } catch {
    return null;
  }
}
