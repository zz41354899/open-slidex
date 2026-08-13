import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

export const TEXT_STYLE_RANGES_PROP = "textStyleRanges";

export type MotionDocTextStyle = {
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  href?: string;
  italic?: boolean;
  letterSpacing?: number;
  underline?: boolean;
};

export type MotionDocTextStyleRange = MotionDocTextStyle & {
  end: number;
  start: number;
};

export type MotionDocTextStylePatch = {
  color?: string | null;
  fontFamily?: string | null;
  fontSize?: number | null;
  fontWeight?: number | null;
  italic?: boolean | null;
  letterSpacing?: number | null;
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
      const fontSize = finiteTextMetric(value.fontSize, 1, 512);
      const fontWeight = finiteFontWeight(value.fontWeight);
      const href = typeof value.href === "string" && value.href.trim() ? value.href.trim() : undefined;
      const italic = typeof value.italic === "boolean" ? value.italic : undefined;
      const letterSpacing = finiteTextMetric(value.letterSpacing, -20, 100);
      const underline = typeof value.underline === "boolean" ? value.underline : undefined;
      if (
        end <= start ||
        (!color &&
          !fontFamily &&
          fontSize === undefined &&
          fontWeight === undefined &&
          !href &&
          italic === undefined &&
          letterSpacing === undefined &&
          underline === undefined)
      ) {
        return [];
      }

      return [{
        ...(color ? { color } : {}),
        ...(fontFamily ? { fontFamily } : {}),
        ...(fontSize === undefined ? {} : { fontSize }),
        ...(fontWeight === undefined ? {} : { fontWeight }),
        ...(href ? { href } : {}),
        ...(italic === undefined ? {} : { italic }),
        ...(letterSpacing === undefined ? {} : { letterSpacing }),
        ...(underline === undefined ? {} : { underline }),
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
  applyBlockProp(nextProps, "fontSize", patch.fontSize);
  applyBlockProp(nextProps, "fontWeight", patch.fontWeight);
  applyBlockProp(nextProps, "letterSpacing", patch.letterSpacing);
  if (patch.italic !== undefined) {
    delete nextProps.fontStyle;
    if (patch.italic === true) nextProps.fontStyle = "italic";
  }

  const ranges = textStyleRangesFromProps(props, textLength).flatMap((range) => {
    const nextRange = { ...range };
    if (patch.color !== undefined) delete nextRange.color;
    if (patch.fontFamily !== undefined) delete nextRange.fontFamily;
    if (patch.fontSize !== undefined) delete nextRange.fontSize;
    if (patch.fontWeight !== undefined) delete nextRange.fontWeight;
    if (patch.italic !== undefined) delete nextRange.italic;
    if (patch.letterSpacing !== undefined) delete nextRange.letterSpacing;
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

export function replaceTextSelectionWithStyleRanges(
  props: MotionDocProps,
  previousText: string,
  selection: { end: number; start: number },
  insertedText: string,
  insertedRanges: MotionDocTextStyleRange[] = []
) {
  const start = clampTextOffset(Math.min(selection.start, selection.end), previousText.length);
  const end = clampTextOffset(Math.max(selection.start, selection.end), previousText.length);
  const nextText = `${previousText.slice(0, start)}${insertedText}${previousText.slice(end)}`;
  const delta = insertedText.length - (end - start);
  const retainedRanges = textStyleRangesFromProps(props, previousText.length).flatMap((range) => {
    if (range.end <= start) return [range];
    if (range.start >= end) return [{ ...range, end: range.end + delta, start: range.start + delta }];

    const pieces: MotionDocTextStyleRange[] = [];
    if (range.start < start) pieces.push({ ...range, end: start });
    if (range.end > end) {
      pieces.push({
        ...range,
        end: range.end + delta,
        start: start + insertedText.length
      });
    }
    return pieces;
  });
  const pastedRanges = insertedRanges.map((range) => ({
    ...range,
    end: start + clampTextOffset(range.end, insertedText.length),
    start: start + clampTextOffset(range.start, insertedText.length)
  }));

  return {
    props: withTextStyleRanges(props, normalizeTextStyleRanges([...retainedRanges, ...pastedRanges], nextText.length)),
    selection: { end: start + insertedText.length, start: start + insertedText.length },
    text: nextText
  };
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
      ...(range.fontSize === undefined ? {} : { fontSize: range.fontSize }),
      ...(range.fontWeight === undefined ? {} : { fontWeight: range.fontWeight }),
      ...(range.href ? { href: range.href } : {}),
      ...(range.italic === undefined ? {} : { italic: range.italic }),
      ...(range.letterSpacing === undefined ? {} : { letterSpacing: range.letterSpacing }),
      ...(range.underline === undefined ? {} : { underline: range.underline }),
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
    ...(range.fontSize === undefined ? {} : { fontSize: range.fontSize }),
    ...(range.fontWeight === undefined ? {} : { fontWeight: range.fontWeight }),
    ...(range.href ? { href: range.href } : {}),
    ...(range.italic === undefined ? {} : { italic: range.italic }),
    ...(range.letterSpacing === undefined ? {} : { letterSpacing: range.letterSpacing }),
    ...(range.underline === undefined ? {} : { underline: range.underline })
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
  if (patch.fontSize !== undefined) {
    if (patch.fontSize !== null) nextStyle.fontSize = patch.fontSize;
    else delete nextStyle.fontSize;
  }
  if (patch.fontWeight !== undefined) {
    if (patch.fontWeight !== null) nextStyle.fontWeight = patch.fontWeight;
    else delete nextStyle.fontWeight;
  }
  if (patch.italic !== undefined) {
    if (patch.italic !== null) nextStyle.italic = patch.italic;
    else delete nextStyle.italic;
  }
  if (patch.letterSpacing !== undefined) {
    if (patch.letterSpacing !== null) nextStyle.letterSpacing = patch.letterSpacing;
    else delete nextStyle.letterSpacing;
  }
  return nextStyle;
}

function hasTextStyle(style: MotionDocTextStyle) {
  return (
    Boolean(style.color) ||
    Boolean(style.fontFamily) ||
    style.fontSize !== undefined ||
    style.fontWeight !== undefined ||
    Boolean(style.href) ||
    style.italic !== undefined ||
    style.letterSpacing !== undefined ||
    style.underline !== undefined
  );
}

function sameTextStyle(left: MotionDocTextStyle, right: MotionDocTextStyle) {
  return (
    left.color === right.color &&
    left.fontFamily === right.fontFamily &&
    left.fontSize === right.fontSize &&
    left.fontWeight === right.fontWeight &&
    left.href === right.href &&
    left.italic === right.italic &&
    left.letterSpacing === right.letterSpacing &&
    left.underline === right.underline
  );
}

function applyBlockProp(
  props: MotionDocProps,
  key: "color" | "fontFamily" | "fontSize" | "fontWeight" | "letterSpacing",
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

function finiteTextMetric(value: unknown, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(Math.max(parsed, min), max);
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
