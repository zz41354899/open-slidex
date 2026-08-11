import { withNewMotionDocBlockId } from "@/core/motion-doc/application/motionDocBlockIdentity";
import { cloneBlock, generateSlideString } from "@/core/motion-doc/application/motionDocSerialize";
import { replaceMotionDocSlideSource } from "@/core/motion-doc/application/motionDocSourceEditor";
import { autoSizeTextFrameProps } from "@/core/motion-doc/application/textFrameSizing";
import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import type { MotionDocBlock, MotionDocProps, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";

type TransferMode = "carry-current-media" | "keep-template-media";

type SceneSemanticLayout =
  | "closing"
  | "cover"
  | "editorial"
  | "image-gallery"
  | "image-story"
  | "metrics"
  | "overview"
  | "timeline";

type SemanticContentRole =
  | "bullet"
  | "bullet-index"
  | "eyebrow"
  | "generic-text"
  | "image"
  | "metric-detail"
  | "metric-label"
  | "metric-value"
  | "summary"
  | "table"
  | "title"
  | "video"
  | "visual";

export function applyLayoutBlocksToSlide(
  slide: MotionDocScene,
  layoutBlocks: readonly MotionDocBlock[],
  layoutId: string
) {
  return {
    ...slide,
    blocks: transferSlideContent(slide.blocks, layoutBlocks, "carry-current-media"),
    props: {
      ...slide.props,
      layoutPreset: layoutId
    }
  } satisfies MotionDocScene;
}

export function applyTemplateSlideSourceToSlide(
  slide: MotionDocScene,
  templateSlideSource: string,
  mode: TransferMode = "carry-current-media"
) {
  const templateSlide = parseMotionDoc(templateSlideSource).scenes[0];
  return templateSlide ? applyTemplateSceneToSlide(slide, templateSlide, mode) : slide;
}

export function applyTemplateDeckToSource(
  source: string,
  templateSlideSources: readonly string[]
) {
  const document = parseMotionDoc(source);
  const templateScenes = templateSlideSources.flatMap((templateSlideSource) => {
    const scene = parseMotionDoc(templateSlideSource).scenes[0];
    return scene ? [scene] : [];
  });
  if (document.scenes.length === 0 || templateScenes.length === 0) return source;

  return document.scenes.reduce((nextSource, slide, slideIndex) => {
    const proportionalIndex = proportionalTemplateIndex(
      slideIndex,
      document.scenes.length,
      templateScenes.length
    );
    const templateIndex = semanticTemplateIndex(
      slide,
      templateScenes,
      proportionalIndex
    );
    const nextSlide = applyTemplateSceneToSlide(
      slide,
      templateScenes[templateIndex]!,
      "keep-template-media"
    );
    return replaceMotionDocSlideSource(nextSource, slideIndex, generateSlideString(nextSlide));
  }, source);
}

function proportionalTemplateIndex(
  slideIndex: number,
  slideCount: number,
  templateSlideCount: number
) {
  if (slideCount <= 1 || templateSlideCount <= 1) return 0;
  return Math.round((slideIndex * (templateSlideCount - 1)) / (slideCount - 1));
}

function applyTemplateSceneToSlide(
  slide: MotionDocScene,
  templateSlide: MotionDocScene,
  mode: TransferMode
) {
  return {
    ...slide,
    blocks: transferSlideContent(slide.blocks, templateSlide.blocks, mode),
    notes: slide.notes,
    props: {
      ...slide.props,
      ...templateSlide.props,
      ...sourceIdentityProps(slide.props)
    }
  } satisfies MotionDocScene;
}

function transferSlideContent(
  currentBlocks: readonly MotionDocBlock[],
  targetBlocks: readonly MotionDocBlock[],
  mode: TransferMode
) {
  const currentContent = currentBlocks.filter((block) =>
    isTransferableCurrentContent(block, mode)
  );
  const assignments = new Map<number, MotionDocBlock>();
  const assignedCurrent = new Set<number>();

  for (let targetIndex = 0; targetIndex < targetBlocks.length; targetIndex += 1) {
    const target = targetBlocks[targetIndex]!;
    if (!isTransferableTargetSlot(target, mode)) continue;
    const currentIndex = bestContentMatchIndex(currentContent, assignedCurrent, target);
    if (currentIndex < 0) continue;
    assignedCurrent.add(currentIndex);
    assignments.set(targetIndex, mergeContentWithTargetLayout(currentContent[currentIndex]!, target));
  }

  assignStructuredOverflow(currentContent, targetBlocks, assignments, assignedCurrent);

  const nextBlocks = targetBlocks.flatMap((target, targetIndex) => {
    const assigned = assignments.get(targetIndex);
    if (assigned) return [assigned];
    // Layout content is also the fallback for an empty slot. Preserve the
    // default text/media whenever the active slide has no matching content to
    // carry into that frame.
    return [withNewMotionDocBlockId(cloneBlock(target))];
  });

  currentContent.forEach((block, index) => {
    if (!assignedCurrent.has(index)) nextBlocks.push(cloneBlock(block));
  });

  return nextBlocks;
}

function bestContentMatchIndex(
  currentBlocks: readonly MotionDocBlock[],
  assigned: ReadonlySet<number>,
  target: MotionDocBlock
) {
  const targetRole = semanticContentRole(target);
  const exactRole = currentBlocks.findIndex((block, index) =>
    !assigned.has(index) && semanticContentRole(block) === targetRole
  );
  if (exactRole >= 0) return exactRole;

  return currentBlocks.findIndex((block, index) =>
    !assigned.has(index) && contentRolesAreCompatible(block, target)
  );
}

function contentRolesAreCompatible(current: MotionDocBlock, target: MotionDocBlock) {
  const currentRole = semanticContentRole(current);
  const targetRole = semanticContentRole(target);
  if (currentRole === targetRole) return true;
  if (targetRole === "summary") return currentRole === "generic-text";
  if (targetRole === "bullet") {
    return currentRole === "generic-text" && current.props.listType === "bullet";
  }
  if (targetRole === "generic-text") {
    return currentRole === "summary" || currentRole === "bullet" || currentRole === "generic-text";
  }
  return false;
}

function isTransferableCurrentContent(block: MotionDocBlock, mode: TransferMode) {
  if (block.props.obsidianGenerated === 1 &&
    typeof block.props.obsidianBlockId !== "string" &&
    block.type !== "Title") {
    return false;
  }
  if (mode === "keep-template-media" && isMediaBlock(block)) return false;
  return semanticContentRole(block) !== "bullet-index" && isContentBlock(block);
}

function isTransferableTargetSlot(block: MotionDocBlock, mode: TransferMode) {
  if (mode === "keep-template-media" && isMediaBlock(block)) return false;
  return semanticContentRole(block) !== "bullet-index" && isContentBlock(block);
}

function isMediaBlock(block: MotionDocBlock) {
  return block.type === "ImageBlock" || block.type === "VideoBlock" || block.type === "Icon";
}

function isContentBlock(block: MotionDocBlock) {
  return block.type === "Title" ||
    block.type === "heading" ||
    block.type === "Text" ||
    block.type === "ImageBlock" ||
    block.type === "VideoBlock" ||
    block.type === "Table" ||
    block.type === "Metric" ||
    block.type === "Card" ||
    block.type === "Icon";
}

const preservedContentPropNames = new Set([
  "alt",
  "columns",
  "data",
  "headers",
  "icon",
  "id",
  "label",
  "name",
  "poster",
  "prefix",
  "rows",
  "src",
  "suffix",
  "unit",
  "value"
]);

function mergeContentWithTargetLayout(current: MotionDocBlock, target: MotionDocBlock) {
  // The target owns presentation styling. Starting from the current props
  // leaks stale fills, text colors, padding, and motion into the new layout
  // whenever the target intentionally relies on inherited slide defaults.
  const props: MotionDocProps = { ...target.props };
  for (const [name, value] of Object.entries(current.props)) {
    if (preservedContentPropNames.has(name) ||
      name.startsWith("obsidian") ||
      name.startsWith("notion") ||
      name.startsWith("source")) {
      props[name] = value;
    }
  }

  return {
    ...current,
    props: fitTransferredTextProps(current, target, props)
  } as MotionDocBlock;
}

function semanticTemplateIndex(
  slide: MotionDocScene,
  templateScenes: readonly MotionDocScene[],
  fallbackIndex: number
) {
  const sourceLayout = sceneSemanticLayout(slide);
  if (!sourceLayout) return fallbackIndex;

  const preferredLayouts = uniqueLayouts([
    sourceLayout,
    contentPreferredLayout(slide)
  ]);
  for (const layout of preferredLayouts) {
    const candidates = templateScenes
      .map((scene, index) => ({ index, scene }))
      .filter(({ scene }) => sceneSemanticLayout(scene) === layout);
    const fitting = candidates.find(({ scene }) => sceneCanAcceptStructuredContent(slide, scene));
    if (fitting) return fitting.index;
  }

  const sameLayout = templateScenes.findIndex((scene) => sceneSemanticLayout(scene) === sourceLayout);
  return sameLayout >= 0 ? sameLayout : fallbackIndex;
}

function sceneSemanticLayout(scene: MotionDocScene): SceneSemanticLayout | undefined {
  const counts = new Map<SceneSemanticLayout, number>();
  for (const block of scene.blocks) {
    const slotId = stringProp(block.props.slotId);
    const match = slotId.match(
      /(?:^|\.)(image-gallery|image-story|closing|cover|editorial|metrics|overview|timeline)(?:\.|$)/
    );
    const layout = match?.[1] as SceneSemanticLayout | undefined;
    if (layout) counts.set(layout, (counts.get(layout) ?? 0) + 1);
  }
  const layout = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  if (layout === "metrics" && !hasCompactMetricValue(scene)) return "overview";
  return layout;
}

function contentPreferredLayout(scene: MotionDocScene): SceneSemanticLayout {
  const roles = scene.blocks.map(semanticContentRole);
  if (roles.includes("metric-value") && hasCompactMetricValue(scene)) return "metrics";
  if (roles.includes("image")) {
    return roles.filter((role) => role === "image").length > 1 ? "image-gallery" : "image-story";
  }
  if (roles.filter((role) => role === "bullet").length >= 2) return "overview";
  return "editorial";
}

function sceneCanAcceptStructuredContent(source: MotionDocScene, target: MotionDocScene) {
  const sourceCounts = structuredContentCounts(source.blocks);
  const targetCounts = structuredContentCounts(target.blocks);
  return ([
    "bullet",
    "metric-detail",
    "metric-label",
    "metric-value"
  ] as const).every((role) => (sourceCounts.get(role) ?? 0) <= (targetCounts.get(role) ?? 0));
}

function structuredContentCounts(blocks: readonly MotionDocBlock[]) {
  const counts = new Map<SemanticContentRole, number>();
  blocks.forEach((block) => {
    if (!isContentBlock(block)) return;
    const role = semanticContentRole(block);
    if (role === "bullet-index") return;
    counts.set(role, (counts.get(role) ?? 0) + 1);
  });
  return counts;
}

function hasCompactMetricValue(scene: MotionDocScene) {
  return scene.blocks.some((block) => {
    if (!("text" in block) || semanticContentRole(block) !== "metric-value") return false;
    const text = block.text.trim();
    return text.length > 0 && text.length <= 32 && /[\d%$€£¥×x]/i.test(text);
  });
}

function semanticContentRole(block: MotionDocBlock): SemanticContentRole {
  const slotId = stringProp(block.props.slotId);
  const id = stringProp(block.props.id);
  if (/(?:^|[-_.])bullet-index(?:[-_.]|$)/.test(id) || isCompactBulletIndex(block)) {
    return "bullet-index";
  }
  if (/(?:^|[-_.])bullet-content(?:[-_.]|$)/.test(id) || /(?:^|[-_.])bullet-\d+$/.test(id)) {
    return "bullet";
  }
  if (/(?:^|\.)title(?:\.|$)/.test(slotId) || block.type === "Title" || block.type === "heading") {
    return "title";
  }
  if (/(?:^|\.)eyebrow(?:\.|$)/.test(slotId)) return "eyebrow";
  if (/(?:^|\.)summary(?:\.|$)/.test(slotId)) return "summary";
  if (/(?:^|\.)bullets(?:\.|$)/.test(slotId)) {
    return /(?:^|[-_.])index(?:[-_.]|$)/.test(id) ? "bullet-index" : "bullet";
  }
  if (/(?:^|\.)metrics(?:\.|$)/.test(slotId)) {
    if (/(?:^|\.)value$/.test(slotId) || /(?:^|[-_.])value(?:[-_.]|$)/.test(id)) return "metric-value";
    if (/(?:^|\.)label$/.test(slotId) || /(?:^|[-_.])label(?:[-_.]|$)/.test(id)) return "metric-label";
    if (/(?:^|\.)detail$/.test(slotId) || /(?:^|[-_.])detail(?:[-_.]|$)/.test(id)) return "metric-detail";
  }
  if (block.type === "ImageBlock") return "image";
  if (block.type === "VideoBlock") return "video";
  if (block.type === "Table") return "table";
  if (block.type === "Icon" || block.type === "Card" || block.type === "Metric") return "visual";
  if (block.type === "Text" && block.props.listType === "bullet") return "bullet";
  if (block.type === "Text" && Number(block.props.fontSize) >= 32) return "title";
  return "generic-text";
}

function isCompactBulletIndex(block: MotionDocBlock) {
  if (!("text" in block) || !/^\d{2}$/.test(block.text.trim())) return false;
  return (numericProp(block.props.h) ?? Number.POSITIVE_INFINITY) <= 6;
}

function assignStructuredOverflow(
  currentBlocks: readonly MotionDocBlock[],
  targetBlocks: readonly MotionDocBlock[],
  assignments: Map<number, MotionDocBlock>,
  assignedCurrent: Set<number>
) {
  currentBlocks.forEach((current, currentIndex) => {
    if (assignedCurrent.has(currentIndex) || !("text" in current)) return;
    const role = semanticContentRole(current);
    if (role !== "bullet") return;
    const candidateTargetIndices = targetBlocks.flatMap((target, targetIndex) =>
      semanticContentRole(target) === role && assignments.has(targetIndex) ? [targetIndex] : []
    );
    if (candidateTargetIndices.length === 0) return;
    const targetIndex = candidateTargetIndices.reduce((selected, candidate) => {
      const selectedText = assignments.get(selected);
      const candidateText = assignments.get(candidate);
      return textLength(candidateText) < textLength(selectedText) ? candidate : selected;
    });
    const assigned = assignments.get(targetIndex);
    const target = targetBlocks[targetIndex];
    if (!assigned || !target || !("text" in assigned)) return;
    const combined = { ...assigned, text: `${assigned.text}\n${current.text}` } as MotionDocBlock;
    assignments.set(targetIndex, {
      ...combined,
      props: fitTransferredTextProps(combined, target, combined.props)
    } as MotionDocBlock);
    assignedCurrent.add(currentIndex);
  });
}

function fitTransferredTextProps(
  current: MotionDocBlock,
  target: MotionDocBlock,
  props: MotionDocProps
) {
  if (!("text" in current) || !("text" in target)) return props;
  const maximumHeight = numericProp(target.props.h);
  let fontSize = numericProp(props.fontSize);
  if (maximumHeight === undefined || maximumHeight < 6 || fontSize === undefined) return props;
  const minimumFontSize = semanticContentRole(target) === "title" ? 17 : 7.5;
  let fitted = autoSizeTextFrameProps(current, current.text, {
    mode: "height",
    props: { ...props, h: maximumHeight }
  });
  while ((numericProp(fitted.h) ?? maximumHeight) > maximumHeight + 0.1 && fontSize > minimumFontSize) {
    fontSize = Math.max(minimumFontSize, fontSize - 0.75);
    fitted = autoSizeTextFrameProps(current, current.text, {
      mode: "height",
      props: { ...props, fontSize, h: maximumHeight }
    });
  }
  return {
    ...props,
    fontSize: Math.round(fontSize * 100) / 100,
    h: target.props.h,
    w: target.props.w
  };
}

function textLength(block: MotionDocBlock | undefined) {
  return block && "text" in block ? block.text.length : Number.POSITIVE_INFINITY;
}

function uniqueLayouts(layouts: readonly (SceneSemanticLayout | undefined)[]) {
  return [...new Set(layouts.filter((layout): layout is SceneSemanticLayout => Boolean(layout)))];
}

function numericProp(value: string | number | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringProp(value: string | number | undefined) {
  return typeof value === "string" ? value : "";
}

function sourceIdentityProps(props: MotionDocProps) {
  return Object.fromEntries(Object.entries(props).filter(([name]) =>
    name.startsWith("obsidian") || name.startsWith("notion") || name.startsWith("source")
  ));
}
