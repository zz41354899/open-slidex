export type MotionDocSlidePlacement = "after" | "before";

export type MotionDocSlideSourceRange = {
  end: number;
  openingTag: string;
  source: string;
  start: number;
};

export function motionDocSlideSourceRanges(source: string): MotionDocSlideSourceRange[] {
  return [...source.matchAll(slidePattern())].map((match) => ({
    end: (match.index ?? 0) + match[0].length,
    openingTag: match[0].slice(0, match[0].indexOf(">") + 1),
    source: match[0],
    start: match.index ?? 0
  }));
}

export function appendMotionDocSlideSource(source: string, slideSource: string) {
  return joinMotionDocSources(source.trim() || "# Untitled Deck", slideSource);
}

export function insertMotionDocSlideSource(
  source: string,
  slideIndex: number,
  slideSource: string,
  placement: MotionDocSlidePlacement
) {
  const normalizedSource = source.trim() || "# Untitled Deck";
  const ranges = motionDocSlideSourceRanges(normalizedSource);

  if (ranges.length === 0) {
    return appendMotionDocSlideSource(normalizedSource, slideSource);
  }

  const range = ranges[slideIndex];
  if (!range) return source;
  const insertAt = placement === "before" ? range.start : range.end;
  const before = normalizedSource.slice(0, insertAt).trimEnd();
  const after = normalizedSource.slice(insertAt).trimStart();
  return [before, slideSource.trim(), after].filter(Boolean).join("\n\n");
}

export function replaceMotionDocSlideSource(source: string, slideIndex: number, slideSource: string) {
  const range = motionDocSlideSourceRanges(source)[slideIndex];
  if (!range) return source;
  return `${source.slice(0, range.start)}${slideSource}${source.slice(range.end)}`;
}

export function appendMotionDocSlideBodySource(
  source: string,
  slideIndex: number,
  fragmentSource: string
) {
  const range = motionDocSlideSourceRanges(source)[slideIndex];
  if (!range) {
    throw new Error(`slideIndex ${slideIndex} is outside the slide range.`);
  }
  const closingTagStart = range.source.lastIndexOf("</");
  if (closingTagStart < 0) {
    throw new Error(`Slide ${slideIndex} has no closing tag.`);
  }
  const insertAt = range.start + closingTagStart;
  const before = source.slice(0, insertAt).trimEnd();
  const after = source.slice(insertAt);
  const indentedFragment = fragmentSource
    .trim()
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");

  return `${before}\n${indentedFragment}\n${after}`;
}

export function replaceMotionDocSlideOpeningTag(source: string, slideIndex: number, openingTag: string) {
  const range = motionDocSlideSourceRanges(source)[slideIndex];
  if (!range) return source;
  return `${source.slice(0, range.start)}${openingTag}${source.slice(range.start + range.openingTag.length)}`;
}

export function deleteMotionDocSlideSource(source: string, slideIndex: number) {
  const range = motionDocSlideSourceRanges(source)[slideIndex];
  if (!range) return source;
  return normalizeMotionDocSpacing(`${source.slice(0, range.start)}${source.slice(range.end)}`);
}

export function reorderMotionDocSlideSource(source: string, fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return source;
  const ranges = motionDocSlideSourceRanges(source);
  if (!ranges[fromIndex] || !ranges[toIndex]) return source;

  const slideSources = ranges.map((range) => range.source);
  const [movedSlide] = slideSources.splice(fromIndex, 1);
  slideSources.splice(toIndex, 0, movedSlide);

  let replacementIndex = 0;
  return source.replace(slidePattern(), () => slideSources[replacementIndex++]);
}

function slidePattern() {
  return /<(Slide|Scene)\b[^>]*>[\s\S]*?<\/\1>/g;
}

function joinMotionDocSources(source: string, slideSource: string) {
  return `${source.trimEnd()}\n\n${slideSource.trim()}`;
}

function normalizeMotionDocSpacing(source: string) {
  return source.replace(/\n{3,}/g, "\n\n").trim();
}
