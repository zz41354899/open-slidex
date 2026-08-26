const forbiddenElementPattern = /<(?:script|foreignObject|iframe|object|embed|audio|video|animate|animateMotion|animateTransform|set|mpath)\b/i;
const eventHandlerPattern = /\son[a-z][a-z0-9_-]*\s*=/i;
const hrefPattern = /\b(?:href|xlink:href)\s*=\s*(["'])(.*?)\1/gi;
const cssUrlPattern = /url\(\s*(["']?)(.*?)\1\s*\)/gi;
const cssImportPattern = /@import\s+(?:url\(\s*)?(["'])(.*?)\1\s*\)?/gi;

/** SvgBlock assets are declarative only; stage motion is driven by data attributes. */
export function assertSafeMotionDocSvg(source: string) {
  if (!/^\s*(?:<\?xml\b[^>]*>\s*)?<svg\b/i.test(source)) {
    throw new Error("SvgBlock assets must contain an <svg> document.");
  }
  if (forbiddenElementPattern.test(source)) {
    throw new Error("SvgBlock assets cannot contain scripts, embedded documents, media, or SMIL animation elements.");
  }
  if (eventHandlerPattern.test(source) || /\bjavascript\s*:/i.test(source)) {
    throw new Error("SvgBlock assets cannot contain event handlers or JavaScript URLs.");
  }
  for (const match of source.matchAll(hrefPattern)) {
    const href = (match[2] ?? "").trim();
    if (href && !href.startsWith("#")) {
      throw new Error("SvgBlock assets cannot reference external resources.");
    }
  }
  for (const match of source.matchAll(cssUrlPattern)) {
    const href = (match[2] ?? "").trim();
    if (href && !href.startsWith("#")) {
      throw new Error("SvgBlock assets cannot reference external CSS resources.");
    }
  }
  if (cssImportPattern.test(source)) {
    throw new Error("SvgBlock assets cannot import external CSS resources.");
  }
  return source;
}
