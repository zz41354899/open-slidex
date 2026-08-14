import type { ExportFormat } from "./api";

export const localExportOptions = [
  { description: "Interactive presentation", id: "html", label: "HTML" },
  { description: "Editable PowerPoint", id: "pptx", label: "PowerPoint" },
  { description: "Portable source with images", id: "mdx", label: "MDX" }
] as const satisfies readonly { description: string; id: ExportFormat; label: string }[];

export function localExportFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "presentation";
}
