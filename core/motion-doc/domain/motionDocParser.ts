import type {
  MotionDocBlock,
  MotionDocProps,
  ParsedMotionDoc
} from "@/core/motion-doc/domain/motionDocTypes";
import { parseMotionDocMarkdown } from "@/core/motion-doc/domain/motionDocMarkdown";
import { BoundedCache } from "@/common/util/boundedCache";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";

const parsedScenes = new BoundedCache<string, MotionDocScene>(2048, 16 * 1024 * 1024);
import {
  sanitizeMotionDocHtmlSource,
  sanitizeMotionDocMediaSource
} from "@/core/motion-doc/domain/mediaSource";
import { sanitizeMotionDocVideoSource } from "@/core/motion-doc/domain/videoSource";
import {
  isReactPresentationSource,
  reactPresentationToMotionDocSource,
  reactPresentationTitle
} from "@/core/react-presentation/reactPresentationSource";

const mediaSourcePropNames = new Set(["backgroundImage", "poster", "shapeImageSrc", "src"]);
const removedComponentPattern = /<(Card|Metric|Stack|Group|Title|Icon|Notes)\b/;

export function parseMotionDoc(source: string): ParsedMotionDoc {
  const motionDocSource = reactPresentationToMotionDocSource(source);
  const removedComponent = motionDocSource.match(removedComponentPattern)?.[1];
  if (removedComponent) {
    throw new Error(
      `Unsupported MotionDoc component: ${removedComponent}. ` +
      "Rebuild it with Text, ImageBlock, VideoBlock, SvgBlock, Chart, Table, or Shape."
    );
  }
  const firstSlideOffset = motionDocSource.search(/<(?:Slide|Scene)\b/);
  const documentHeader =
    firstSlideOffset >= 0 ? motionDocSource.slice(0, firstSlideOffset) : motionDocSource;
  const title =
    documentHeader.match(/^#\s+(.+)$/m)?.[1]?.trim()
    ?? (isReactPresentationSource(source) ? reactPresentationTitle(source) : "Slider Preview");
  const sceneMatches = Array.from(
    motionDocSource.matchAll(/<(?:Slide|Scene)\b([^>]*)>([\s\S]*?)<\/(?:Slide|Scene)>/g)
  );

  return {
    title,
    scenes: sceneMatches.map((match) => {
      const cached = parsedScenes.get(match[0]);
      if (cached) return structuredClone(cached);
      const props = parseProps(match[1] ?? "");
      const durationValue = props.duration;
      const sceneSource = match[2] ?? "";

      const scene = {
        duration:
          typeof durationValue === "number" && Number.isFinite(durationValue)
            ? durationValue
            : 0,
        props,
        blocks: parseSceneBlocks(sceneSource)
      };
      parsedScenes.set(match[0], scene, match[0].length * 6);
      return structuredClone(scene);
    })
  };
}

function parseSceneBlocks(sceneSource: string): MotionDocBlock[] {
  const blocks: MotionDocBlock[] = [];
  const blockPattern =
    /<(Text)\b([^>]*)>([\s\S]*?)<\/\1>|<(Chart|HtmlEmbedBlock|ImageBlock|VideoBlock|SvgBlock|Shape|Table)\b([\s\S]*?)\/>/g;
  let cursor = 0;

  for (const match of sceneSource.matchAll(blockPattern)) {
    const matchStart = match.index ?? cursor;
    blocks.push(
      ...parseMotionDocMarkdown(sceneSource.slice(cursor, matchStart))
    );
    const pairedType = match[1] as "Text" | undefined;
    const selfClosingType = match[4] as
      | "Chart"
      | "HtmlEmbedBlock"
      | "ImageBlock"
      | "Shape"
      | "Table"
      | "SvgBlock"
      | "VideoBlock"
      | undefined;
    cursor = matchStart + match[0].length;

    if (pairedType) {
      blocks.push({
        type: pairedType,
        props: parseProps(match[2] ?? ""),
        text: normalizeText(match[3] ?? "")
      });
      continue;
    }

    if (selfClosingType) {
      const props = parseProps(match[5] ?? "", selfClosingType === "HtmlEmbedBlock");
      if (selfClosingType === "VideoBlock") {
        delete props.sourceType;
        if (typeof props.src === "string") props.src = sanitizeMotionDocVideoSource(props.src);
      }
      blocks.push({
        type: selfClosingType,
        props
      });
    }

  }

  blocks.push(...parseMotionDocMarkdown(sceneSource.slice(cursor)));

  return blocks;
}

function parseProps(rawProps: string, allowEmbeddedHtml = false): MotionDocProps {
  const props: MotionDocProps = {};
  for (const attribute of scanMdxAttributes(rawProps)) {
    const { key } = attribute;
    const value = attribute.kind === "quoted"
      ? decodeMdxAttribute(attribute.value)
      : attribute.value;
    const numericValue = Number(value);

    props[key] = mediaSourcePropNames.has(key)
      ? allowEmbeddedHtml && key === "src"
        ? sanitizeMotionDocHtmlSource(value)
        : sanitizeMotionDocMediaSource(value)
      : key !== "text" && Number.isFinite(numericValue) && value.trim() !== "" ? numericValue : value;
  }

  return props;
}

type ScannedMdxAttribute = {
  key: string;
  kind: "expression" | "quoted";
  value: string;
};

function scanMdxAttributes(source: string): ScannedMdxAttribute[] {
  const attributes: ScannedMdxAttribute[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    while (/\s/.test(source[cursor] ?? "")) cursor += 1;
    const keyMatch = source.slice(cursor).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (!keyMatch) {
      cursor += 1;
      continue;
    }

    const key = keyMatch[0];
    cursor += key.length;
    while (/\s/.test(source[cursor] ?? "")) cursor += 1;

    if (source[cursor] !== "=") {
      attributes.push({ key, kind: "quoted", value: "true" });
      continue;
    }

    cursor += 1;
    while (/\s/.test(source[cursor] ?? "")) cursor += 1;
    const opening = source[cursor];
    if (opening === '"' || opening === "'") {
      const start = cursor + 1;
      cursor += 1;
      while (cursor < source.length) {
        if (source[cursor] === opening && source[cursor - 1] !== "\\") break;
        cursor += 1;
      }
      attributes.push({ key, kind: "quoted", value: source.slice(start, cursor) });
      cursor += 1;
      continue;
    }

    if (opening === "{") {
      const start = cursor + 1;
      let depth = 1;
      let quote: '"' | "'" | null = null;
      cursor += 1;
      while (cursor < source.length && depth > 0) {
        const character = source[cursor];
        if (quote) {
          if (character === quote && source[cursor - 1] !== "\\") quote = null;
        } else if (character === '"' || character === "'") {
          quote = character;
        } else if (character === "{") {
          depth += 1;
        } else if (character === "}") {
          depth -= 1;
        }
        cursor += 1;
      }
      if (depth === 0) {
        attributes.push({ key, kind: "expression", value: source.slice(start, cursor - 1).trim() });
      }
      continue;
    }
  }

  return attributes;
}

function decodeMdxAttribute(value: string) {
  return value
    .replaceAll("&#10;", "\n")
    .replaceAll("&#xA;", "\n")
    .replaceAll("&#xa;", "\n")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function normalizeText(value: string) {
  const decoded = decodeMdxText(value).replace(/\r\n?/g, "\n");
  if (!value.includes("\n")) return decoded;

  const lines = decoded.split("\n");
  while (lines[0]?.trim() === "") lines.shift();
  while (lines.at(-1)?.trim() === "") lines.pop();
  const indent = Math.min(
    ...lines
      .filter((line) => line.trim())
      .map((line) => line.match(/^[ \t]*/)?.[0].length ?? 0)
  );

  return lines
    .map((line) => line.slice(Number.isFinite(indent) ? indent : 0))
    .join("\n");
}

function decodeMdxText(value: string) {
  return value
    .replaceAll("&amp;#10;", "\n")
    .replaceAll("&amp;#xA;", "\n")
    .replaceAll("&amp;#xa;", "\n")
    .replaceAll("&#10;", "\n")
    .replaceAll("&#xA;", "\n")
    .replaceAll("&#xa;", "\n")
    .replaceAll("&#123;", "{")
    .replaceAll("&#x7B;", "{")
    .replaceAll("&#x7b;", "{")
    .replaceAll("&#125;", "}")
    .replaceAll("&#x7D;", "}")
    .replaceAll("&#x7d;", "}")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}
