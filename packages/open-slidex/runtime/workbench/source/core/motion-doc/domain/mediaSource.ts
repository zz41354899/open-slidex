const absoluteProtocolPattern = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const embeddedMediaPattern = /^data:(?:image\/(?:avif|gif|jpeg|png|webp)|video\/(?:mp4|ogg|quicktime|webm));base64,[A-Za-z0-9+/]+={0,2}$/i;
const controlCharacterPattern = /[\u0000-\u001f\u007f]/;
const localHttpHosts = new Set(["127.0.0.1", "::1", "localhost"]);

export function sanitizeMotionDocMediaSource(value: string) {
  const source = value.trim();
  if (!source || controlCharacterPattern.test(source) || source.includes("\\")) return "";

  if (!absoluteProtocolPattern.test(source)) {
    if (source.startsWith("//") || source.split("/").includes("..")) return "";
    return source;
  }

  // Portable HTML exports embed only a narrow raster-image/video MIME allowlist.
  // SVG and document-capable data URLs remain blocked.
  if (embeddedMediaPattern.test(source)) return source;

  try {
    const url = new URL(source);
    if (url.protocol === "https:") return source;
    if (url.protocol === "http:" && localHttpHosts.has(url.hostname)) return source;
    if (url.protocol === "blob:" && /^blob:(?:https?:\/\/|null\/)/i.test(source)) return source;
  } catch {
    return "";
  }

  return "";
}
