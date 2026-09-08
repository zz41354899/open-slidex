export function normalizePresentationTitle(value: string) {
  return value.replace(/[\r\n\t]+/g, " ").replace(/[<>{}]/g, "").trim().slice(0, 80);
}

export function renamePresentationSource(source: string, value: string) {
  const title = normalizePresentationTitle(value);
  if (!title) return source;
  if (/export\s+default\s+definePresentation\s*\(/.test(source)) {
    return replaceReactPresentationTitle(source, title);
  }
  return /^#\s+.*$/m.test(source)
    ? source.replace(/^#\s+.*$/m, () => `# ${title}`)
    : `# ${title}\n\n${source}`;
}
import { replaceReactPresentationTitle } from "@open-slidex/sdk";
