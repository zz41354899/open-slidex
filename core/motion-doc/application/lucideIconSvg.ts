import { isSlideXIconName, lucideIconPaths } from "@/core/motion-doc/domain/lucideIconRegistry";
import { escapeSvgAttribute, svgDataUri } from "@/core/motion-doc/application/svgDataUri";

type LucideIconSvgOptions = {
  color?: string;
  strokeWidth?: number;
};

export function renderLucideIconSvg(name: string, options: LucideIconSvgOptions = {}) {
  if (!isSlideXIconName(name)) return "";

  const color = options.color?.trim() || "currentColor";
  const strokeWidth = Math.min(Math.max(options.strokeWidth ?? 2, 0), 24);
  const children = lucideIconPaths[name]
    .map(renderLucideIconPath)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="none" preserveAspectRatio="xMidYMid meet" stroke="${escapeSvgAttribute(color)}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${strokeWidth}" viewBox="0 0 24 24">${children}</svg>`;
}

export function lucideIconSvgDataUri(name: string, options: LucideIconSvgOptions = {}) {
  const svg = renderLucideIconSvg(name, options);
  if (!svg) return undefined;
  return svgDataUri(svg);
}

function renderLucideIconPath(path: string) {
  const [shape, ...parts] = path.split(" ");

  if (shape === "circle") {
    return `<circle cx="${parts[0]}" cy="${parts[1]}" r="${parts[2]}" />`;
  }

  if (shape === "ellipse") {
    return `<ellipse cx="${parts[0]}" cy="${parts[1]}" rx="${parts[2]}" ry="${parts[3]}" />`;
  }

  if (shape === "rect") {
    return `<rect x="${parts[0]}" y="${parts[1]}" width="${parts[2]}" height="${parts[3]}" rx="${parts[4]}" ry="${parts[5]}" />`;
  }

  return `<path d="${escapeSvgAttribute(shape === "path" ? parts.join(" ") : path)}" />`;
}
