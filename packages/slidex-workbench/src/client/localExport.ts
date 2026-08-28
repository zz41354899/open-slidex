import { summarizeMotionDoc } from "@open-slidex/sdk";

import type { ExportFormat } from "./api";
import type { SaveState, ValidationResult } from "./domain";

export const localExportOptions = [
  { description: "Interactive presentation", id: "html", label: "HTML" },
  { description: "Editable PowerPoint", id: "pptx", label: "PowerPoint" },
  { description: "Portable source with images", id: "mdx", label: "MDX" }
] as const satisfies readonly { description: string; id: ExportFormat; label: string }[];

export type LocalExportMode = "html-source" | "native";

const mediaSourceAttributePattern = /\b(backgroundImage|poster|shapeImageSrc|src)\s*=\s*(?:(["'])([^"']*)\2|\{\s*(["'])([^"']*)\4\s*\})/g;
const legacyRasterAssetPattern = /^assets\/[A-Za-z0-9._-]+\.(?:avif|gif|jpe?g|png)$/i;
const embeddedRasterImagePattern = /^data:image\/(?:avif|gif|jpe?g|png|webp)[;,]/i;
const localWorkspaceAssetUrlPattern = /^(?:(?:https?:)?\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?|\/)(?:api\/v1\/workspace\/presentations\/[A-Za-z0-9._-]+\/editor\/)?assets\/[A-Za-z0-9._-]+\.(?:avif|gif|jpe?g|png|webp)$/i;

export type LocalExportMediaSource = {
  prop: "backgroundImage" | "poster" | "shapeImageSrc" | "src";
  source: string;
};

/** HTML-backed decks preserve their source file and never offer a lossy PPTX path. */
export function localExportOptionsForMode(mode: LocalExportMode) {
  return mode === "html-source"
    ? localExportOptions.filter((option) => option.id !== "pptx")
    : [...localExportOptions];
}

export function localExportFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "presentation";
}

/**
 * The native save picker creates the selected file immediately. Reject known
 * Canvas failures before opening it so a failed export cannot leave behind a
 * misleading zero-byte HTML, MDX, or PPTX file.
 */
export function localExportPreflightError(source: string, saveState: SaveState) {
  if (saveState === "conflict") {
    return "Resolve the recovered Canvas draft before exporting.";
  }
  if (saveState === "loading" || saveState === "saving") {
    return "Wait for the Canvas to finish opening or saving, then export again.";
  }
  if (saveState === "error") {
    return "Fix the Canvas save error before exporting.";
  }

  try {
    const validation = (summarizeMotionDoc(source) as { validation: ValidationResult }).validation;
    if (validation.isValid) return null;
    const issue = validation.issues.find((candidate) => candidate.severity === "error") ?? validation.issues[0];
    return issue
      ? `${issue.path ? `${issue.path}: ` : ""}${issue.message}`
      : "Fix the Canvas validation error before exporting.";
  } catch (error) {
    return error instanceof Error ? error.message : "Fix the Canvas source before exporting.";
  }
}

/**
 * Blob URLs disappear outside the current browser tab, while legacy raster
 * paths have not yet been converted to the Workspace's WebP asset contract.
 * Collect them before export so the caller can import each source once and
 * rewrite the transient export source to a portable asset path.
 */
export function localExportMediaSourcesToMaterialize(source: string): LocalExportMediaSource[] {
  const found = new Map<string, LocalExportMediaSource>();
  for (const match of source.matchAll(mediaSourceAttributePattern)) {
    const prop = match[1] as LocalExportMediaSource["prop"];
    const value = (match[3] ?? match[5] ?? "").trim();
    if (!value || !isLocalExportMediaSource(value)) continue;
    found.set(`${prop}:${value}`, { prop, source: value });
  }
  return [...found.values()];
}

function isLocalExportMediaSource(value: string) {
  return value.startsWith("blob:") ||
    legacyRasterAssetPattern.test(value) ||
    embeddedRasterImagePattern.test(value) ||
    localWorkspaceAssetUrlPattern.test(value);
}

export function replaceLocalExportMediaSources(
  source: string,
  replacements: ReadonlyMap<string, string>
) {
  return source.replace(mediaSourceAttributePattern, (attribute, prop: string, _quote: string, staticValue: string | undefined, _expressionQuote: string, expressionValue: string | undefined) => {
    const value = (staticValue ?? expressionValue ?? "").trim();
    const replacement = replacements.get(`${prop}:${value}`);
    return replacement ? attribute.replace(value, replacement) : attribute;
  });
}
