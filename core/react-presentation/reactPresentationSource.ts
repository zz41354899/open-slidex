import { motionDocSlideSourceRanges } from "@/core/motion-doc/application/motionDocSourceEditor";
import { BoundedCache } from "@/common/util/boundedCache";

const convertedSources = new BoundedCache<string, string>(4, 8 * 1024 * 1024);

export const REACT_PRESENTATION_FILE = "presentation.tsx";
export const LEGACY_MDX_PRESENTATION_FILE = "presentation.mdx";

const reactPresentationImport = `import {
  Chart,
  Deck,
  HtmlEmbed,
  Image,
  Shape,
  Slide,
  Svg,
  Table,
  Text,
  Video,
  definePresentation,
} from "@open-slidex/sdk/react";`;

export function isReactPresentationSource(source: string) {
  return /(?:^|\n)\s*(?:import\s|export\s+default\s+definePresentation\b)/.test(source)
    && /<Deck\b/.test(source);
}

export function reactPresentationTitle(source: string) {
  const definitionTitle = source.match(definitionTitlePattern())?.[2];
  if (definitionTitle) return decodeSourceString(definitionTitle);
  const deckTitle = source.match(deckTitlePattern())?.[2];
  return deckTitle ? decodeJsxAttribute(deckTitle.slice(1, -1)) : "Untitled Presentation";
}

export function reactPresentationToMotionDocSource(source: string) {
  if (!isReactPresentationSource(source)) return source;
  const cached = convertedSources.get(source);
  if (cached !== undefined) return cached;
  const title = reactPresentationTitle(source);
  const slides = motionDocSlideSourceRanges(source).map((range) => (
    reactPrimitivesToMotionDocNames(dedentJsxBlock(range.source))
  ));
  const result = `# ${escapeMotionDocTitle(title)}\n\n${slides.join("\n\n")}`.trimEnd();
  convertedSources.set(source, result, (source.length + result.length) * 2);
  return result;
}

export function motionDocToReactPresentationSource(source: string) {
  if (isReactPresentationSource(source)) return source;
  const title = source.match(/^#\s+(.+)$/m)?.[1]?.trim() || "Untitled Presentation";
  const slides = motionDocSlideSourceRanges(source).map((range) => (
    indent(motionDocPrimitivesToReactNames(range.source), 8)
  ));
  return `${reactPresentationImport}

export default definePresentation({
  title: ${JSON.stringify(title)},
  component: function Presentation() {
    return (
      <Deck title="${escapeJsxAttribute(title)}">
${slides.join("\n\n")}
      </Deck>
    );
  },
});
`;
}

export function replaceReactPresentationTitle(source: string, title: string) {
  if (!isReactPresentationSource(source)) return source;
  const value = title || "Untitled Presentation";
  let next = source.replace(definitionTitlePattern(), (_match, prefix: string) => `${prefix}${JSON.stringify(value)}`);
  next = next.replace(deckTitlePattern(), (_match, prefix: string) => `${prefix}"${escapeJsxAttribute(value)}"`);
  return next;
}

function reactPrimitivesToMotionDocNames(source: string) {
  return source
    .replace(/<(\/?)Image(?=[\s/>])/g, "<$1ImageBlock")
    .replace(/<(\/?)Video(?=[\s/>])/g, "<$1VideoBlock")
    .replace(/<(\/?)Svg(?=[\s/>])/g, "<$1SvgBlock")
    .replace(/<(\/?)HtmlEmbed(?=[\s/>])/g, "<$1HtmlEmbedBlock");
}

function motionDocPrimitivesToReactNames(source: string) {
  return source
    .replace(/<(\/?)ImageBlock(?=[\s/>])/g, "<$1Image")
    .replace(/<(\/?)VideoBlock(?=[\s/>])/g, "<$1Video")
    .replace(/<(\/?)SvgBlock(?=[\s/>])/g, "<$1Svg")
    .replace(/<(\/?)HtmlEmbedBlock(?=[\s/>])/g, "<$1HtmlEmbed");
}

export type ReactPresentationSourceIssue = {
  message: string;
  path?: string;
  severity: "error" | "warning";
};

export function validateReactPresentationSource(source: string): ReactPresentationSourceIssue[] {
  if (!isReactPresentationSource(source)) return [];
  const issues: ReactPresentationSourceIssue[] = [];
  const imports = [...source.matchAll(/^\s*import(?:[\s\S]*?)\sfrom\s*["']([^"']+)["'];?\s*$/gm)];
  for (const match of imports) {
    const specifier = match[1] ?? "";
    if (!isAllowedDeckImport(specifier)) {
      issues.push({
        message: `Import ${specifier} is not allowed. Use React, @open-slidex/sdk/react, or a relative deck component/asset.`,
        path: specifier,
        severity: "error"
      });
    }
  }
  if (!/export\s+default\s+definePresentation\s*\(/.test(source)) {
    issues.push({ message: "presentation.tsx must default-export definePresentation(...).", severity: "error" });
  }
  if (!/<Deck\b/.test(source) || !/<\/Deck>/.test(source)) {
    issues.push({ message: "presentation.tsx must render one <Deck> root.", severity: "error" });
  }
  if (motionDocSlideSourceRanges(source).length === 0) {
    issues.push({ message: "presentation.tsx must contain at least one <Slide>.", severity: "error" });
  }
  if (/\b(?:require|eval|Function)\s*\(/.test(source) || /\b(?:process|global)\s*\./.test(source)) {
    issues.push({ message: "Node and dynamic-code APIs are not allowed in presentation.tsx.", severity: "error" });
  }
  if (/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/.test(source)) {
    issues.push({ message: "External network APIs are not allowed in the presentation sandbox.", severity: "error" });
  }
  if (/\b(?:dangerouslySetInnerHTML|on[A-Z][A-Za-z0-9]*)\s*=/.test(source)) {
    issues.push({ message: "Event handlers and arbitrary HTML are not allowed in presentation.tsx.", severity: "error" });
  }
  return issues;
}

function isAllowedDeckImport(specifier: string) {
  if (specifier === "react" || specifier === "@open-slidex/sdk/react") return true;
  if (specifier.includes("\\") || specifier.split("/").includes("..")) return false;
  return specifier === "./components"
    || specifier.startsWith("./components/")
    || specifier.startsWith("./assets/")
    || specifier.startsWith("./styles/")
    || specifier === "./presentation.css";
}

function indent(source: string, spaces: number) {
  const prefix = " ".repeat(spaces);
  return source.split("\n").map((line) => `${prefix}${line}`).join("\n");
}

function dedentJsxBlock(source: string) {
  const lines = source.split("\n");
  const indentSize = Math.min(
    ...lines.slice(1).filter((line) => line.trim()).map((line) => line.match(/^\s*/)?.[0].length ?? 0)
  );
  if (!Number.isFinite(indentSize) || indentSize <= 0) return source;
  return lines.map((line, index) => index === 0 ? line : line.slice(Math.min(indentSize, line.length))).join("\n");
}

function escapeMotionDocTitle(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim() || "Untitled Presentation";
}

function definitionTitlePattern() {
  return /(definePresentation\s*\(\s*\{[\s\S]*?\btitle\s*:\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/;
}

function deckTitlePattern() {
  return /(<Deck\b[^>]*\btitle\s*=\s*)("[^"]*"|'[^']*')/;
}

function decodeSourceString(literal: string) {
  if (literal.startsWith('"')) return JSON.parse(literal) as string;
  return literal.slice(1, -1).replace(/\\(u\{[0-9a-f]+\}|u[0-9a-f]{4}|x[0-9a-f]{2}|[\s\S])/gi, (_match, escape: string) => {
    if (/^[ux]/i.test(escape)) {
      return String.fromCodePoint(parseInt(escape.replace(/^[ux]\{?|\}$/gi, ""), 16));
    }
    const escapes: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\0" };
    return escapes[escape] ?? escape;
  });
}

function escapeJsxAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll("\n", "&#10;").replaceAll("\r", "&#13;").replaceAll("\t", "&#9;");
}

function decodeJsxAttribute(value: string) {
  const entities: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return entities[entity.toLowerCase()] ?? match;
  });
}
