import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

const localAssetPattern = /^assets\/[A-Za-z0-9._-]+\.webp$/i;
const localMediaAttributePattern = /\s+(backgroundImage|poster|src)=("[^"]*"|'[^']*')/g;

export type LocalMotionDocMediaIssue = {
  blockIndex?: number;
  message: string;
  prop: "backgroundImage" | "poster" | "src";
  slideIndex: number;
};

/** OpenSlideX decks store media as root-confined, hashed WebP asset paths. */
export function isOpenSlideXLocalAssetSource(value: unknown) {
  return typeof value === "string" && localAssetPattern.test(value.trim());
}

export function validateOpenSlideXLocalMedia(source: string) {
  const issues: LocalMotionDocMediaIssue[] = [];
  const document = parseMotionDoc(source);

  document.scenes.forEach((scene, slideIndex) => {
    collectMediaIssue(issues, scene.props, "backgroundImage", slideIndex);
    scene.blocks.forEach((block, blockIndex) => {
      if (block.type !== "ImageBlock" && block.type !== "VideoBlock") return;
      collectMediaIssue(issues, block.props, "src", slideIndex, blockIndex);
      collectMediaIssue(issues, block.props, "poster", slideIndex, blockIndex);
    });
  });

  return { isValid: issues.length === 0, issues };
}

/**
 * Layout presets can be shared with Cloud Pitch, but Local must never copy a
 * remote URL into presentation.mdx. Removing the attribute preserves the
 * frame and turns it into the existing local import placeholder.
 */
export function stripNonLocalMotionDocMedia(source: string) {
  return source.replace(localMediaAttributePattern, (attribute, prop: string, quotedValue: string) => {
    const value = quotedValue.slice(1, -1);
    return isOpenSlideXLocalAssetSource(value) ? attribute : "";
  });
}

function collectMediaIssue(
  issues: LocalMotionDocMediaIssue[],
  props: MotionDocProps,
  prop: LocalMotionDocMediaIssue["prop"],
  slideIndex: number,
  blockIndex?: number
) {
  const value = props[prop];
  if (value === undefined || value === "") return;
  if (isOpenSlideXLocalAssetSource(value)) return;
  issues.push({
    ...(blockIndex === undefined ? {} : { blockIndex }),
    message: `OpenSlideX local decks only allow assets/*.webp for ${prop}. Import the media through Local Assets first.`,
    prop,
    slideIndex
  });
}
