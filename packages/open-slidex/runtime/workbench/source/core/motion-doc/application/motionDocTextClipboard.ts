import { numberValue } from "@/core/motion-doc/domain/frame";
import type { MotionDocProps, MotionDocTextBlock } from "@/core/motion-doc/domain/motionDocTypes";
import {
  replaceTextSelectionWithStyleRanges,
  textStyleSegments,
  type MotionDocTextStyleRange
} from "@/core/motion-doc/domain/textStyleRanges";
import { motionDocDefaultFontSize } from "@/core/motion-doc/domain/typography";

export const MOTION_DOC_TEXT_CLIPBOARD_FORMAT = "application/vnd.open-slidex.motiondoc-text+json";
export const MOTION_DOC_TEXT_CLIPBOARD_VERSION = 1;

export type MotionDocTextClipboardPacket = {
  format: typeof MOTION_DOC_TEXT_CLIPBOARD_FORMAT;
  ranges: MotionDocTextStyleRange[];
  text: string;
  version: typeof MOTION_DOC_TEXT_CLIPBOARD_VERSION;
};

export function createMotionDocTextClipboardPacket(
  block: MotionDocTextBlock,
  selection: { end: number; start: number }
): MotionDocTextClipboardPacket | null {
  const start = Math.max(0, Math.min(selection.start, selection.end, block.text.length));
  const end = Math.max(start, Math.min(Math.max(selection.start, selection.end), block.text.length));
  if (end <= start) return null;

  const baseStyle = blockTextStyle(block);
  const ranges = textStyleSegments(block.text, block.props).flatMap((segment) => {
    const segmentStart = Math.max(segment.start, start);
    const segmentEnd = Math.min(segment.end, end);
    if (segmentEnd <= segmentStart) return [];
    return [{
      ...baseStyle,
      ...styleWithoutTextOffsets(segment),
      end: segmentEnd - start,
      start: segmentStart - start
    }];
  });

  const packet: MotionDocTextClipboardPacket = {
    format: MOTION_DOC_TEXT_CLIPBOARD_FORMAT,
    ranges,
    text: block.text.slice(start, end),
    version: MOTION_DOC_TEXT_CLIPBOARD_VERSION
  };
  return packet;
}

export function parseMotionDocTextClipboardPacket(value: string) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<MotionDocTextClipboardPacket>;
    if (
      parsed.format !== MOTION_DOC_TEXT_CLIPBOARD_FORMAT ||
      parsed.version !== MOTION_DOC_TEXT_CLIPBOARD_VERSION ||
      typeof parsed.text !== "string" ||
      !Array.isArray(parsed.ranges)
    ) {
      return null;
    }
    return parsed as MotionDocTextClipboardPacket;
  } catch {
    return null;
  }
}

export function motionDocTextClipboardHtml(packet: MotionDocTextClipboardPacket) {
  const encodedPacket = encodeURIComponent(JSON.stringify(packet));
  return `<span data-open-slidex-text="${escapeHtmlAttribute(encodedPacket)}">${escapeHtmlText(packet.text)}</span>`;
}

export function motionDocTextClipboardPacketFromHtml(value: string) {
  const encodedPacket = value.match(/\bdata-open-slidex-text=(?:"([^"]*)"|'([^']*)')/i)?.slice(1).find(Boolean);
  if (!encodedPacket) return null;
  try {
    return parseMotionDocTextClipboardPacket(decodeURIComponent(decodeHtmlAttribute(encodedPacket)));
  } catch {
    return null;
  }
}

export function pasteMotionDocTextClipboard(
  props: MotionDocProps,
  previousText: string,
  selection: { end: number; start: number },
  packet: Pick<MotionDocTextClipboardPacket, "ranges" | "text">
) {
  return replaceTextSelectionWithStyleRanges(props, previousText, selection, packet.text, packet.ranges);
}

function blockTextStyle(block: MotionDocTextBlock): Omit<MotionDocTextStyleRange, "end" | "start"> {
  const fontSize = numberValue(block.props.fontSize) ?? motionDocDefaultFontSize(block.type);
  const fontWeight = numberValue(block.props.fontWeight) ?? (block.type === "heading" ? 600 : 400);
  const letterSpacing = numberValue(block.props.letterSpacing);
  const color = stringProp(block.props.color ?? block.props.textColor);
  const fontFamily = stringProp(block.props.fontFamily);

  return {
    ...(color ? { color } : {}),
    ...(fontFamily ? { fontFamily } : {}),
    fontSize,
    fontWeight,
    ...(block.props.fontStyle === "italic" ? { italic: true } : {}),
    ...(letterSpacing === undefined ? {} : { letterSpacing })
  };
}

function styleWithoutTextOffsets(
  segment: ReturnType<typeof textStyleSegments>[number]
): Omit<MotionDocTextStyleRange, "end" | "start"> {
  const { end, start, text, ...style } = segment;
  void end;
  void start;
  void text;
  return style;
}

function stringProp(value: string | number | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function escapeHtmlAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function decodeHtmlAttribute(value: string) {
  return value.replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

function escapeHtmlText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
