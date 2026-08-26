import type { MotionDocBlock, MotionDocProps, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import {
  createMotionDocBlockId,
  ensureMotionDocBlockIds,
  ensureMotionDocSceneBlockIds,
  motionDocBlockId
} from "@/core/motion-doc/application/motionDocBlockIdentity";
import {
  motionDocSlideSourceRanges,
  replaceMotionDocSlideOpeningTag
} from "@/core/motion-doc/application/motionDocSourceEditor";

export function replaceSlideOpeningTag(source: string, slideIndex: number, props: MotionDocProps) {
  return replaceMotionDocSlideOpeningTag(source, slideIndex, formatSlideTag(props));
}

export function cloneBlock(block: MotionDocBlock): MotionDocBlock {
  return {
    ...block,
    props: { ...block.props }
  } as MotionDocBlock;
}

export function generateSlideString(slide: MotionDocScene) {
  const identifiedSlide = ensureMotionDocSceneBlockIds(slide);
  const tag = formatSlideTag(identifiedSlide.props);
  const blockStrings = identifiedSlide.blocks.map((block) => `  ${generateBlockString(block)}`);
  return `${tag}\n${blockStrings.join("\n")}\n</Slide>`;
}

function groupIdOf(block: MotionDocBlock) {
  return "props" in block && typeof block.props.groupId === "string" && block.props.groupId.trim() ? block.props.groupId : "";
}

export function generateBlockString(block: MotionDocBlock) {
  const identifiedBlock = ensureMotionDocBlockIds([block])[0] ?? block;
  return generateBlockStringWithProps(identifiedBlock, "props" in identifiedBlock ? identifiedBlock.props : undefined);
}

export function ensureMotionDocSourceBlockIds(source: string) {
  const candidates = motionDocSlideSourceRanges(source)
    .flatMap((range) => sourceBlockIdentityCandidates(range.source, range.start))
    .sort((left, right) => left.start - right.start);
  const seenIds = new Set<string>();
  const replacements: SourceReplacement[] = [];

  for (const candidate of candidates) {
    const currentId = candidate.id.trim();
    if (currentId && !seenIds.has(currentId)) {
      seenIds.add(currentId);
      continue;
    }

    let nextId = createMotionDocBlockId();
    while (seenIds.has(nextId)) nextId = createMotionDocBlockId();
    seenIds.add(nextId);
    replacements.push(candidate.replacement(nextId));
  }

  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce(
      (nextSource, replacement) => `${nextSource.slice(0, replacement.start)}${replacement.value}${nextSource.slice(replacement.end)}`,
      source
    );
}

function generateBlockStringWithProps(block: MotionDocBlock, overrideProps: MotionDocProps | undefined) {
  if (block.type === "Text") {
    const propsStr = formatTextProps(overrideProps ?? block.props);
    return `<${block.type}${propsStr ? " " + propsStr : ""}>${escapeMdxText(block.text)}</${block.type}>`;
  }

  if (block.type === "heading") {
    const id = motionDocBlockId(block);
    const marker = id ? ` <!-- slidex-block-id:${id} -->` : "";
    return `## ${block.text}${marker}`;
  }

  if ("props" in block) {
    const propsStr = formatProps(overrideProps ?? block.props);
    return `<${block.type}${propsStr ? " " + propsStr : ""} />`;
  }

  return "";
}

type SourceReplacement = {
  end: number;
  start: number;
  value: string;
};

type SourceBlockIdentityCandidate = {
  id: string;
  replacement: (id: string) => SourceReplacement;
  start: number;
};

const sourceBlockTagNames = new Set([
  "Chart",
  "HtmlEmbedBlock",
  "ImageBlock",
  "Shape",
  "Table",
  "Text",
  "SvgBlock",
  "VideoBlock"
]);

function sourceBlockIdentityCandidates(slideSource: string, sourceOffset: number) {
  const candidates = sourceTagIdentityCandidates(slideSource, sourceOffset);
  const protectedRanges = protectedSourceBlockRanges(slideSource);
  const openingTagEnd = slideSource.indexOf(">");
  const closingTagStart = slideSource.lastIndexOf("</");
  const bodyStart = openingTagEnd >= 0 ? openingTagEnd + 1 : 0;
  const bodyEnd = closingTagStart >= bodyStart ? closingTagStart : slideSource.length;
  const body = slideSource.slice(bodyStart, bodyEnd);

  for (const match of body.matchAll(/[^\r\n]+/g)) {
    const localStart = bodyStart + (match.index ?? 0);
    const localEnd = localStart + match[0].length;
    if (protectedRanges.some((range) => localStart >= range.start && localEnd <= range.end)) continue;

    const line = match[0];
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith("import ") ||
      trimmed.startsWith("export ") ||
      trimmed.startsWith("<") ||
      trimmed.startsWith("{")
    ) {
      continue;
    }

    const marker = line.match(/\s*<!--\s*slidex-block-id\s*:\s*([A-Za-z0-9._:-]+)\s*-->\s*$/);
    const markerStart = marker?.index;
    const markerLength = marker?.[0].length ?? 0;
    candidates.push({
      id: marker?.[1]?.trim() ?? "",
      replacement: (id) => markerStart === undefined
        ? {
            end: sourceOffset + localEnd,
            start: sourceOffset + localEnd,
            value: ` <!-- slidex-block-id:${id} -->`
          }
        : {
            end: sourceOffset + localStart + markerStart + markerLength,
            start: sourceOffset + localStart + markerStart,
            value: ` <!-- slidex-block-id:${id} -->`
          },
      start: sourceOffset + localStart
    });
  }

  return candidates;
}

function sourceTagIdentityCandidates(slideSource: string, sourceOffset: number) {
  const candidates: SourceBlockIdentityCandidate[] = [];
  const openingPattern = /<([A-Z][A-Za-z0-9]*)\b/g;

  for (const match of slideSource.matchAll(openingPattern)) {
    const tagName = match[1];
    if (!sourceBlockTagNames.has(tagName)) continue;
    const localStart = match.index ?? 0;
    const localEnd = sourceOpeningTagEnd(slideSource, localStart);
    if (localEnd <= localStart) continue;
    const openingTag = slideSource.slice(localStart, localEnd);
    const idMatch = openingTag.match(/\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/);
    const currentId = idMatch?.[1] ?? idMatch?.[2] ?? idMatch?.[3] ?? "";

    candidates.push({
      id: currentId,
      replacement: (id) => {
        if (idMatch?.index !== undefined) {
          const idStart = sourceOffset + localStart + idMatch.index;
          return {
            end: idStart + idMatch[0].length,
            start: idStart,
            value: `id="${id}"`
          };
        }

        const closeLength = openingTag.endsWith("/>") ? 2 : 1;
        const insertionEnd = openingTag.length - closeLength;
        const beforeClose = openingTag.slice(0, insertionEnd);
        const trailingWhitespace = beforeClose.match(/\s*$/)?.[0] ?? "";
        const base = beforeClose.slice(0, beforeClose.length - trailingWhitespace.length);
        const close = openingTag.slice(insertionEnd);
        const spacingBeforeClose = trailingWhitespace || (close === "/>" ? " " : "");
        return {
          end: sourceOffset + localEnd,
          start: sourceOffset + localStart,
          value: `${base} id="${id}"${spacingBeforeClose}${close}`
        };
      },
      start: sourceOffset + localStart
    });
  }

  return candidates;
}

function sourceOpeningTagEnd(source: string, start: number) {
  let quote: "\"" | "'" | null = null;
  let braceDepth = 0;

  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote && source[index - 1] !== "\\") quote = null;
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === "{") {
      braceDepth += 1;
      continue;
    }
    if (character === "}" && braceDepth > 0) {
      braceDepth -= 1;
      continue;
    }
    if (character === ">" && braceDepth === 0) return index + 1;
  }

  return -1;
}

function protectedSourceBlockRanges(slideSource: string) {
  const ranges: Array<{ end: number; start: number }> = [];
  const pairedBlockPattern = /<((?!Slide\b|Scene\b)[A-Z][A-Za-z0-9]*)\b[^>]*>[\s\S]*?<\/\1>/g;
  for (const match of slideSource.matchAll(pairedBlockPattern)) {
    const start = match.index ?? 0;
    ranges.push({ end: start + match[0].length, start });
  }

  for (const match of slideSource.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)) {
    const start = match.index ?? 0;
    const end = sourceOpeningTagEnd(slideSource, start);
    if (end > start && slideSource.slice(start, end).endsWith("/>")) {
      ranges.push({ end, start });
    }
  }
  return ranges;
}

export function getSelectionMdx(slide: MotionDocScene | undefined, selectedBlockIndex: number | null, activeSlideIndex: number, selectedBlockIndices: number[] = []) {
  if (!slide) {
    return { label: "selection.mdx", source: "" };
  }

  if (selectedBlockIndex === null) {
    return {
      label: `slide-${activeSlideIndex + 1}.mdx`,
      source: generateSlideString(slide)
    };
  }

  const block = slide.blocks[selectedBlockIndex];
  const groupId = block ? groupIdOf(block) : "";
  if (groupId) {
    const groupBlocks = slide.blocks.filter((candidate) => groupIdOf(candidate) === groupId);
    return {
      label: `${groupId}.mdx`,
      source: groupBlocks.map(generateBlockString).join("\n")
    };
  }

  if (selectedBlockIndices.length > 1) {
    const selected = selectedBlockIndices.map((index) => slide.blocks[index]).filter((candidate): candidate is MotionDocBlock => Boolean(candidate));
    return {
      label: `layers-${selected.length}.mdx`,
      source: selected.map(generateBlockString).join("\n")
    };
  }

  return {
    label: block ? `${block.type.toLowerCase()}-${selectedBlockIndex + 1}.mdx` : "layer.mdx",
    source: block ? generateBlockString(block) : ""
  };
}

export function getSlideTitle(blocks: MotionDocBlock[], fallbackIndex: number) {
  const titleBlock = blocks.find((block) =>
    "text" in block && (block.props.role === "title" || Number(block.props.fontSize) >= 32)
  );

  if (titleBlock && "text" in titleBlock) {
    return titleBlock.text;
  }

  const firstText = blocks.find((block) => "text" in block && block.text.trim());
  if (firstText && "text" in firstText) return firstText.text;

  return `Slide ${fallbackIndex + 1}`;
}

function formatProps(props: MotionDocProps) {
  const entries = Object.entries(props).filter(
    ([key, value]) =>
      !key.startsWith("_") &&
      key !== "duration" &&
      key !== "mb" &&
      key !== "marginBottom" &&
      !removedGroupPropKeys.has(key) &&
      value !== undefined &&
      value !== ""
  );
  return entries
    .map(([key, value]) => (typeof value === "number" ? `${key}={${value}}` : `${key}="${escapeMdxAttribute(value)}"`))
    .join(" ");
}

function escapeMdxAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "&#10;");
}

function escapeMdxText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\n", "&#10;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("{", "&#123;")
    .replaceAll("}", "&#125;");
}

function formatTextProps(props: MotionDocProps) {
  return formatProps(withoutTextFrameOnlyProps(props));
}

function withoutTextFrameOnlyProps(props: MotionDocProps) {
  const { borderRadius, radius, ...rest } = props;
  void borderRadius;
  void radius;

  return rest;
}

function formatSlideTag(props: MotionDocProps) {
  const duration = typeof props.duration === "number" ? props.duration : 5;
  const rest = formatProps(props);
  return `<Slide duration={${duration}}${rest ? ` ${rest}` : ""}>`;
}

const removedGroupPropKeys = new Set([
  "cardFlow",
  "cardGap",
  "flow",
  "groupFlow",
  "metricFlow",
  "metricGap",
  "stackAlign",
  "stackBackground",
  "stackClipContent",
  "stackColor",
  "stackDirection",
  "stackGap",
  "stackGroup",
  "stackPaddingBottom",
  "stackPaddingLeft",
  "stackPaddingRight",
  "stackPaddingTop",
  "stackPaddingX",
  "stackPaddingY"
]);
