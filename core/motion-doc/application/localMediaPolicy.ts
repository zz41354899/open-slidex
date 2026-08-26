import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

const localImageAssetPattern = /^assets\/[A-Za-z0-9._-]+\.webp$/i;
const localVideoAssetPattern = /^assets\/[A-Za-z0-9._-]+\.mp4$/i;
const localSvgAssetPattern = /^assets\/[A-Za-z0-9._-]+\.svg$/i;
const localHtmlAssetPattern = /^assets\/[A-Za-z0-9._-]+\.html?$/i;
const localMediaAttributePattern = /\s+(backgroundImage|poster|shapeImageSrc|src)=("[^"]*"|'[^']*')/g;

export type LocalMotionDocMediaIssue = {
  blockIndex?: number;
  message: string;
  prop: "backgroundImage" | "poster" | "shapeImageSrc" | "src";
  slideIndex: number;
};

/** OpenSlideX deck assets are root-confined, hashed WebP images or MP4 videos. */
export function isOpenSlideXLocalAssetSource(value: unknown) {
  return isOpenSlideXLocalImageAssetSource(value) || isOpenSlideXLocalVideoAssetSource(value) ||
    isOpenSlideXLocalSvgAssetSource(value) || isOpenSlideXLocalHtmlAssetSource(value);
}

export function isOpenSlideXLocalImageAssetSource(value: unknown) {
  return typeof value === "string" && localImageAssetPattern.test(value.trim());
}

export function isOpenSlideXLocalVideoAssetSource(value: unknown) {
  return typeof value === "string" && localVideoAssetPattern.test(value.trim());
}

export function isOpenSlideXLocalSvgAssetSource(value: unknown) {
  return typeof value === "string" && localSvgAssetPattern.test(value.trim());
}

export function isOpenSlideXLocalHtmlAssetSource(value: unknown) {
  return typeof value === "string" && localHtmlAssetPattern.test(value.trim());
}

/**
 * Local decks can also reference a complete HTTPS media URL. Keep this narrow:
 * it makes user-provided image links portable without accepting executable,
 * embedded, or filesystem-like sources.
 */
export function isOpenSlideXCompatibleMediaSource(value: unknown) {
  if (isOpenSlideXLocalAssetSource(value)) return true;
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function validateOpenSlideXLocalMedia(source: string) {
  const issues: LocalMotionDocMediaIssue[] = [];
  const document = parseMotionDoc(source);

  document.scenes.forEach((scene, slideIndex) => {
    collectMediaIssue(issues, scene.props, "backgroundImage", slideIndex, undefined, "image");
    scene.blocks.forEach((block, blockIndex) => {
      if (block.type === "Shape") {
        collectMediaIssue(issues, block.props, "shapeImageSrc", slideIndex, blockIndex, "image");
        return;
      }
      if (block.type === "ImageBlock" || block.type === "VideoBlock") {
        collectMediaIssue(issues, block.props, "src", slideIndex, blockIndex, block.type === "VideoBlock" ? "video" : "image");
        collectMediaIssue(issues, block.props, "poster", slideIndex, blockIndex, "image");
      } else if (block.type === "SvgBlock") {
        collectMediaIssue(issues, block.props, "src", slideIndex, blockIndex, "svg");
      } else if (block.type === "HtmlEmbedBlock") {
        collectMediaIssue(issues, block.props, "src", slideIndex, blockIndex, "html");
      }
    });
  });

  return { isValid: issues.length === 0, issues };
}

/**
 * Local layout presets may retain complete HTTPS media URLs as well as
 * root-confined assets. Removing an unsupported source preserves the frame
 * and turns it into the existing local import placeholder.
 */
export function stripNonLocalMotionDocMedia(source: string) {
  return source.replace(localMediaAttributePattern, (attribute, prop: string, quotedValue: string) => {
    const value = quotedValue.slice(1, -1);
    return isOpenSlideXCompatibleMediaSource(value) ? attribute : "";
  });
}

function collectMediaIssue(
  issues: LocalMotionDocMediaIssue[],
  props: MotionDocProps,
  prop: LocalMotionDocMediaIssue["prop"],
  slideIndex: number,
  blockIndex: number | undefined,
  kind: "html" | "image" | "svg" | "video"
) {
  const value = props[prop];
  if (value === undefined || value === "") return;
  const isAllowedLocal = kind === "image"
    ? isOpenSlideXLocalImageAssetSource(value)
    : kind === "video"
      ? isOpenSlideXLocalVideoAssetSource(value)
      : kind === "svg"
        ? isOpenSlideXLocalSvgAssetSource(value)
        : isOpenSlideXLocalHtmlAssetSource(value);
  if (isAllowedLocal || ((kind === "image" || kind === "video") && isHttpsMediaSource(value))) return;
  const expected = kind === "image" ? "assets/*.webp" : kind === "video" ? "assets/*.mp4" : kind === "svg" ? "assets/*.svg" : "assets/*.html";
  issues.push({
    ...(blockIndex === undefined ? {} : { blockIndex }),
    message: `OpenSlideX local decks allow ${expected}${kind === "image" || kind === "video" ? " or complete HTTPS media URLs" : " only"} for ${prop}.`,
    prop,
    slideIndex
  });
}

function isHttpsMediaSource(value: unknown) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}
