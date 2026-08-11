import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

export const TEXT_STYLE_RANGES_PROP = "textStyleRanges";

export type MotionDocTextStyle = {
  color?: string;
  fontFamily?: string;
  fontWeight?: number;
  href?: string;
  italic?: boolean;
  underline?: boolean;
};

export type MotionDocTextStyleRange = MotionDocTextStyle & {
  end: number;
  start: number;
};

export type MotionDocTextStylePatch = {
  color?: string | null;
  fontFamily?: string | null;
  fontWeight?: number | null;
};

export type MotionDocTextStyleSegment = MotionDocTextStyleRange & {
  text: string;
};

export function textStyleRangesFromProps(props: MotionDocProps, textLength: number): MotionDocTextStyleRange[] {
  const raw = props[TEXT_STYLE_RANGES_PROP];
  if (typeof raw !== "string" || !raw.trim() || textLength <= 0) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return normalizeTextStyleRanges(parsed.flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") return [];
      const value = candidate as Record<string, unknown>;
      const start = clampTextOffset(value.start, textLength);
      const end = clampTextOffset(value.end, textLength);
      const color = typeof value.color === "string" && value.color.trim() ? value.color.trim() : undefined;
      const fontFamily = typeof value.fontFamily === "string" && value.fontFamily.trim() ? value.fontFamily.trim() : undefined;
      const fontWeight = finiteFontWeight(value.fontWeight);
      const href = typeof value.href === "string" && value.href.trim() ? value.href.trim() : undefined;
      const italic = value.italic === true;
      const underline = value.underline === true;
      if (
        end <= start ||
        (!color &&
          !fontFamily &&
          fontWeight === undefined &&
          !href &&
          !italic &&
          !underline)
      ) {
        return [];
      }

      return [{
        ...(color ? { color } : {}),
        ...(fontFamily ? { fontFamily } : {}),
        ...(fontWeight === undefined ? {} : { fontWeight }),
        ...(href ? { href } : {}),
        ...(italic ? { italic } : {}),
        ...(underline ? { underline } : {}),
        end,
        start
      }];
    }), textLength);
  } catch {
    return [];
  }
}

export function textStyleSegments(text: string, props: MotionDocProps): MotionDocTextStyleSegment[] {
  if (!text) return [];

  const ranges = textStyleRangesFromProps(props, text.length);
  const boundaries = new Set([0, text.length]);
  ranges.forEach(({ end, start }) => {
    boundaries.add(start);
    boundaries.add(end);
  });
  const offsets = [...boundaries].sort((left, right) => left - right);

  return offsets.slice(0, -1).map((start, index) => {
    const end = offsets[index + 1];
    const style = styleAtOffset(ranges, start);
    return { ...style, end, start, text: text.slice(start, end) };
  });
}

export function textStyleLines(text: string, props: MotionDocProps): MotionDocTextStyleSegment[][] {
  const lines: MotionDocTextStyleSegment[][] = [[]];

  for (const segment of textStyleSegments(text, props)) {
    const parts = segment.text.split("\n");
    parts.forEach((part, index) => {
      if (part) {
        const consumedLength = parts.slice(0, index).reduce((sum, value) => sum + value.length + 1, 0);
        const start = segment.start + consumedLength;
        lines[lines.length - 1].push({ ...segment, end: start + part.length, start, text: part });
      }
      if (index < parts.length - 1) lines.push([]);
    });
  }

  return lines;
}

export function applyTextStylePatch(
  props: MotionDocProps,
  selection: { end: number; start: number },
  patch: MotionDocTextStylePatch,
  textLength: number
): MotionDocProps {
  const start = clampTextOffset(Math.min(selection.start, selection.end), textLength);
  const end = clampTextOffset(Math.max(selection.start, selection.end), textLength);
  if (end <= start) return props;

  const ranges = textStyleRangesFromProps(props, textLength);
  const boundaries = new Set([0, textLength, start, end]);
  ranges.forEach((range) => {
    boundaries.add(range.start);
    boundaries.add(range.end);
  });
  const offsets = [...boundaries].sort((left, right) => left - right);
  const nextRanges = offsets.slice(0, -1).flatMap((segmentStart, index) => {
    const segmentEnd = offsets[index + 1];
    const currentStyle = styleAtOffset(ranges, segmentStart);
    const selected = segmentStart >= start && segmentEnd <= end;
    const nextStyle = selected ? applyStylePatch(currentStyle, patch) : currentStyle;
    if (!hasTextStyle(nextStyle)) return [];
    return [{ ...nextStyle, end: segmentEnd, start: segmentStart }];
  });

  return withTextStyleRanges(props, normalizeTextStyleRanges(nextRanges, textLength));
}

export function applyTextStyleSelection(
  props: MotionDocProps,
  selection: { end: number; start: number },
  patch: MotionDocTextStylePatch,
  textLength: number
): MotionDocProps {
  const start = clampTextOffset(Math.min(selection.start, selection.end), textLength);
  const end = clampTextOffset(Math.max(selection.start, selection.end), textLength);

  return start === 0 && end === textLength
    ? applyBlockTextStyle(props, patch, textLength)
    : applyTextStylePatch(props, { end, start }, patch, textLength);
}

export function applyBlockTextStyle(
  props: MotionDocProps,
  patch: MotionDocTextStylePatch,
  textLength: number
): MotionDocProps {
  const nextProps = { ...props };

  applyBlockProp(nextProps, "color", patch.color);
  applyBlockProp(nextProps, "fontFamily", patch.fontFamily);
  applyBlockProp(nextProps, "fontWeight", patch.fontWeight);

  const ranges = textStyleRangesFromProps(props, textLength).flatMap((range) => {
    const nextRange = { ...range };
    if (patch.color !== undefined) delete nextRange.color;
    if (patch.fontFamily !== undefined) delete nextRange.fontFamily;
    if (patch.fontWeight !== undefined) delete nextRange.fontWeight;
    return hasTextStyle(nextRange) ? [nextRange] : [];
  });

  return withTextStyleRanges(nextProps, normalizeTextStyleRanges(ranges, textLength));
}

export function rebaseTextStyleRanges(props: MotionDocProps, previousText: string, nextText: string): MotionDocProps {
  if (previousText === nextText) return props;
  const ranges = textStyleRangesFromProps(props, previousText.length);
  if (ranges.length === 0) return props;

  const editStart = commonPrefixLength(previousText, nextText);
  const suffixLength = commonSuffixLength(previousText, nextText, editStart);
  const previousEditEnd = previousText.length - suffixLength;
  const nextEditEnd = nextText.length - suffixLength;
  const delta = nextText.length - previousText.length;
  const insertionOnly = editStart === previousEditEnd;

  const rebased = ranges.flatMap((range) => {
    if (range.end <= editStart) return [range];
    if (range.start >= previousEditEnd) {
      return [{ ...range, end: range.end + delta, start: range.start + delta }];
    }

    if (insertionOnly) {
      if (range.start >= editStart) {
        return [{ ...range, end: range.end + delta, start: range.start + delta }];
      }
      return [{ ...range, end: range.end + delta }];
    }

    const start = range.start <= editStart ? range.start : nextEditEnd;
    const end = range.end >= previousEditEnd ? range.end + delta : nextEditEnd;
    return end > start ? [{ ...range, end, start }] : [];
  });

  return withTextStyleRanges(props, normalizeTextStyleRanges(rebased, nextText.length));
}

function withTextStyleRanges(props: MotionDocProps, ranges: MotionDocTextStyleRange[]): MotionDocProps {
  const nextProps = { ...props };
  delete nextProps[TEXT_STYLE_RANGES_PROP];
  if (ranges.length > 0) nextProps[TEXT_STYLE_RANGES_PROP] = JSON.stringify(ranges);
  return nextProps;
}

function normalizeTextStyleRanges(ranges: MotionDocTextStyleRange[], textLength: number) {
  const sorted = ranges
    .map((range) => ({
      ...(range.color ? { color: range.color } : {}),
      ...(range.fontFamily ? { fontFamily: range.fontFamily } : {}),
      ...(range.fontWeight === undefined ? {} : { fontWeight: range.fontWeight }),
      ...(range.href ? { href: range.href } : {}),
      ...(range.italic ? { italic: true } : {}),
      ...(range.underline ? { underline: true } : {}),
      end: clampTextOffset(range.end, textLength),
      start: clampTextOffset(range.start, textLength)
    }))
    .filter((range) => range.end > range.start && hasTextStyle(range))
    .sort((left, right) => left.start - right.start || left.end - right.end);

  return sorted.reduce<MotionDocTextStyleRange[]>((merged, range) => {
    const previous = merged.at(-1);
    if (previous && previous.end === range.start && sameTextStyle(previous, range)) {
      previous.end = range.end;
      return merged;
    }
    merged.push(range);
    return merged;
  }, []);
}

function styleAtOffset(ranges: MotionDocTextStyleRange[], offset: number): MotionDocTextStyle {
  const range = ranges.findLast((candidate) => candidate.start <= offset && candidate.end > offset);
  return range ? styleFromRange(range) : {};
}

function styleFromRange(range: MotionDocTextStyleRange): MotionDocTextStyle {
  return {
    ...(range.color ? { color: range.color } : {}),
    ...(range.fontFamily ? { fontFamily: range.fontFamily } : {}),
    ...(range.fontWeight === undefined ? {} : { fontWeight: range.fontWeight }),
    ...(range.href ? { href: range.href } : {}),
    ...(range.italic ? { italic: true } : {}),
    ...(range.underline ? { underline: true } : {})
  };
}

function applyStylePatch(style: MotionDocTextStyle, patch: MotionDocTextStylePatch): MotionDocTextStyle {
  const nextStyle = { ...style };
  if (patch.color !== undefined) {
    if (patch.color) nextStyle.color = patch.color;
    else delete nextStyle.color;
  }
  if (patch.fontFamily !== undefined) {
    if (patch.fontFamily) nextStyle.fontFamily = patch.fontFamily;
    else delete nextStyle.fontFamily;
  }
  if (patch.fontWeight !== undefined) {
    if (patch.fontWeight !== null) nextStyle.fontWeight = patch.fontWeight;
    else delete nextStyle.fontWeight;
  }
  return nextStyle;
}

function hasTextStyle(style: MotionDocTextStyle) {
  return (
    Boolean(style.color) ||
    Boolean(style.fontFamily) ||
    style.fontWeight !== undefined ||
    Boolean(style.href) ||
    Boolean(style.italic) ||
    Boolean(style.underline)
  );
}

function sameTextStyle(left: MotionDocTextStyle, right: MotionDocTextStyle) {
  return (
    left.color === right.color &&
    left.fontFamily === right.fontFamily &&
    left.fontWeight === right.fontWeight &&
    left.href === right.href &&
    left.italic === right.italic &&
    left.underline === right.underline
  );
}

function applyBlockProp(
  props: MotionDocProps,
  key: "color" | "fontFamily" | "fontWeight",
  value: string | number | null | undefined
) {
  if (value === undefined) return;
  delete props[key];
  if (value !== null && value !== "") props[key] = value;
}

function finiteFontWeight(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(Math.max(Math.round(parsed), 100), 900);
}

function clampTextOffset(value: unknown, textLength: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(Math.round(parsed), 0), Math.max(textLength, 0));
}

function commonPrefixLength(left: string, right: string) {
  const maxLength = Math.min(left.length, right.length);
  let index = 0;
  while (index < maxLength && left[index] === right[index]) index += 1;
  return index;
}

function commonSuffixLength(left: string, right: string, prefixLength: number) {
  const maxLength = Math.min(left.length, right.length) - prefixLength;
  let length = 0;
  while (length < maxLength && left[left.length - 1 - length] === right[right.length - 1 - length]) length += 1;
  return length;
}
