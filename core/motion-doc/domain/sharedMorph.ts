import { createMotionDocBlockId } from "@/core/motion-doc/application/motionDocBlockIdentity";
import type { MotionDocBlock, MotionDocProps, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { interactionFromProps, withInteraction } from "@/core/motion-doc/domain/interaction";
import {
  createMotionActionId,
  motionSequenceFromProps,
  withMotionSequence
} from "@/core/motion-doc/domain/motionSequence";

export const morphSupportedBlockTypes = ["ImageBlock", "Shape", "SvgBlock", "Text"] as const;
export const sharedMorphEasings = [
  "linear",
  "easeIn",
  "easeOut",
  "easeInOut",
  "smooth",
  "emphasized",
  "spring",
  "backOut",
  "custom"
] as const;
export type SharedMorphEasing = (typeof sharedMorphEasings)[number];

export type SharedMorphCurve = {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
};

export const defaultSharedMorphCurve: SharedMorphCurve = {
  x1: 0.4,
  x2: 0.2,
  y1: 0,
  y2: 1
};

export function normalizeSharedMorphEasing(value: unknown): SharedMorphEasing {
  return sharedMorphEasings.includes(value as SharedMorphEasing) ? value as SharedMorphEasing : "easeInOut";
}

export function sharedMorphCurveFromProps(props: MotionDocProps): SharedMorphCurve {
  return {
    x1: clamp(Number(props.morphCurveX1), 0, 1, defaultSharedMorphCurve.x1),
    x2: clamp(Number(props.morphCurveX2), 0, 1, defaultSharedMorphCurve.x2),
    y1: clamp(Number(props.morphCurveY1), -1.5, 2.5, defaultSharedMorphCurve.y1),
    y2: clamp(Number(props.morphCurveY2), -1.5, 2.5, defaultSharedMorphCurve.y2)
  };
}

export function sharedMorphCssEasing(easing: SharedMorphEasing, curve = defaultSharedMorphCurve) {
  if (easing === "linear") return "linear";
  if (easing === "easeIn") return "cubic-bezier(.42,0,1,1)";
  if (easing === "easeOut") return "cubic-bezier(0,0,.58,1)";
  if (easing === "smooth") return "cubic-bezier(.45,0,.2,1)";
  if (easing === "emphasized") return "cubic-bezier(.2,0,0,1)";
  if (easing === "spring") return "cubic-bezier(.18,.9,.22,1.18)";
  if (easing === "backOut") return "cubic-bezier(.34,1.56,.64,1)";
  if (easing === "custom") return `cubic-bezier(${curve.x1},${curve.y1},${curve.x2},${curve.y2})`;
  return "cubic-bezier(.42,0,.58,1)";
}

export function isMorphSupportedBlock(block: MotionDocBlock) {
  return morphSupportedBlockTypes.includes(block.type as (typeof morphSupportedBlockTypes)[number]);
}

export function createSharedMorphId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return `shared-${globalThis.crypto.randomUUID()}`;
  return `shared-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sharedMorphId(block: MotionDocBlock) {
  const value = block.props.sharedId;
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function ensureSceneSharedMorphIds(scene: MotionDocScene) {
  let didChange = false;
  const blocks = scene.blocks.map((block) => {
    if (!isMorphSupportedBlock(block) || sharedMorphId(block)) return block;
    didChange = true;
    return { ...block, props: { ...block.props, sharedId: createSharedMorphId() } } as MotionDocBlock;
  });
  return didChange ? { ...scene, blocks } : scene;
}

export function autoLinkSharedMorphScenes(source: MotionDocScene, target: MotionDocScene) {
  const usedTargets = new Set<number>();
  const targetBlocks = [...target.blocks];
  const sourceBlocks = source.blocks.map((block, sourceIndex) => {
    if (!isMorphSupportedBlock(block)) return block;
    const existingId = sharedMorphId(block);
    let targetIndex = existingId
      ? targetBlocks.findIndex((candidate, index) => !usedTargets.has(index) && candidate.type === block.type && sharedMorphId(candidate) === existingId)
      : -1;
    if (targetIndex < 0) targetIndex = bestCompatibleTargetIndex(block, sourceIndex, targetBlocks, usedTargets);
    if (targetIndex < 0) return existingId ? block : { ...block, props: { ...block.props, sharedId: createSharedMorphId() } } as MotionDocBlock;
    usedTargets.add(targetIndex);
    const sharedId = existingId || sharedMorphId(targetBlocks[targetIndex]!) || createSharedMorphId();
    targetBlocks[targetIndex] = { ...targetBlocks[targetIndex]!, props: { ...targetBlocks[targetIndex]!.props, sharedId } } as MotionDocBlock;
    return { ...block, props: { ...block.props, sharedId } } as MotionDocBlock;
  });
  return [{ ...source, blocks: sourceBlocks }, { ...target, blocks: targetBlocks }] as const;
}

/** Links every adjacent edge in one contiguous Morph sequence. */
export function autoLinkSharedMorphSequenceScenes(
  scenes: MotionDocScene[],
  startIndex: number,
  endIndex: number
) {
  const nextScenes = [...scenes];
  const firstIndex = Math.max(0, Math.min(startIndex, nextScenes.length - 1));
  const lastIndex = Math.max(firstIndex, Math.min(endIndex, nextScenes.length - 1));
  for (let index = firstIndex; index < lastIndex; index += 1) {
    const source = nextScenes[index];
    const target = nextScenes[index + 1];
    if (!source || !target || source.props.slideTransition !== "morph") break;
    const [linkedSource, linkedTarget] = autoLinkSharedMorphScenes(source, target);
    nextScenes[index] = linkedSource;
    nextScenes[index + 1] = linkedTarget;
  }
  return nextScenes;
}

export function sharedMorphPairCount(source: MotionDocScene, target: MotionDocScene) {
  const targetPairs = new Set(target.blocks.flatMap((block) => {
    const id = isMorphSupportedBlock(block) ? sharedMorphId(block) : "";
    return id ? [`${block.type}\u0000${id}`] : [];
  }));
  return source.blocks.reduce((count, block) => {
    const id = isMorphSupportedBlock(block) ? sharedMorphId(block) : "";
    return id && targetPairs.has(`${block.type}\u0000${id}`) ? count + 1 : count;
  }, 0);
}

const sharedMorphSlidePropKeys = [
  "morphCurveX1",
  "morphCurveX2",
  "morphCurveY1",
  "morphCurveY2",
  "morphEasing",
  "morphEffectMode",
  "morphFadeUnmatched",
  "morphShapePrecision",
  "morphShapeSoftness"
] as const;

const sharedMorphEffectPropKeys = [
  "transitionDuration",
  "morphCurveX1",
  "morphCurveX2",
  "morphCurveY1",
  "morphCurveY2",
  "morphEasing",
  "morphFadeUnmatched",
  "morphShapePrecision",
  "morphShapeSoftness"
] as const;

/** Resolves the effect settings for one Morph edge, including group inheritance. */
export function sharedMorphEffectProps(scenes: MotionDocScene[], sourceSlideIndex: number): MotionDocProps {
  const source = scenes[sourceSlideIndex];
  if (!source) return {};
  if (source.props.morphEffectMode !== "inherit") return source.props;

  let groupStartIndex = sourceSlideIndex;
  while (groupStartIndex > 0 && scenes[groupStartIndex - 1]?.props.slideTransition === "morph") {
    groupStartIndex -= 1;
  }
  const groupStart = scenes[groupStartIndex];
  if (!groupStart || groupStartIndex === sourceSlideIndex) return source.props;

  const resolved = { ...source.props };
  sharedMorphEffectPropKeys.forEach((key) => {
    const value = groupStart.props[key];
    if (value === undefined) delete resolved[key];
    else resolved[key] = value;
  });
  return resolved;
}

/** Restores a Morph group to ordinary independent slides in one deterministic update. */
export function unlinkSharedMorphGroupScenes(scenes: MotionDocScene[], startIndex: number, endIndex: number) {
  return scenes.map((scene, sceneIndex) => {
    if (sceneIndex < startIndex || sceneIndex > endIndex) return scene;
    const props = { ...scene.props };
    sharedMorphSlidePropKeys.forEach((key) => delete props[key]);
    if (props.slideTransition === "morph") {
      props.slideTransition = "none";
      delete props.transitionDuration;
    }
    return {
      ...scene,
      blocks: scene.blocks.map(withoutSharedId),
      props
    };
  });
}

/** Links a detail slide back to its overview hotspot while preserving bidirectional Morph identity. */
export function setSharedMorphReturnLinkScenes(
  scenes: MotionDocScene[],
  groupStartIndex: number,
  detailSlideIndex: number,
  enabled: boolean
) {
  const overview = scenes[groupStartIndex];
  const detail = scenes[detailSlideIndex];
  if (!overview || !detail || detailSlideIndex <= groupStartIndex) return scenes;

  const expectedSlide = detailSlideIndex + 1;
  const overviewBlockIndex = overview.blocks.findIndex((block) => {
    if (!isMorphSupportedBlock(block)) return false;
    const action = interactionFromProps(block.props)?.action;
    return action?.type === "goToSlide" && action.slide === expectedSlide
      || action?.type === "nextSlide" && detailSlideIndex === groupStartIndex + 1;
  });
  const fallbackOverviewBlockIndex = overview.blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => isMorphSupportedBlock(block))[detailSlideIndex - groupStartIndex - 1]?.index ?? -1;
  const sourceIndex = overviewBlockIndex >= 0 ? overviewBlockIndex : fallbackOverviewBlockIndex;
  const sourceBlock = overview.blocks[sourceIndex];
  if (!sourceBlock || !isMorphSupportedBlock(sourceBlock)) return scenes;

  const existingId = sharedMorphId(sourceBlock);
  let targetIndex = existingId
    ? detail.blocks.findIndex((block) => block.type === sourceBlock.type && sharedMorphId(block) === existingId)
    : -1;
  if (targetIndex < 0) targetIndex = bestCompatibleTargetIndex(sourceBlock, sourceIndex, detail.blocks, new Set());
  const targetBlock = detail.blocks[targetIndex];
  if (!targetBlock || !isMorphSupportedBlock(targetBlock) || targetBlock.type !== sourceBlock.type) return scenes;

  const sharedId = existingId || sharedMorphId(targetBlock) || createSharedMorphId();
  const overviewBlocks = overview.blocks.map((block, index) => {
    if (index === sourceIndex) return { ...block, props: { ...block.props, sharedId } } as MotionDocBlock;
    return sharedMorphId(block) === sharedId ? withoutSharedId(block) : block;
  });
  const detailBlocks = detail.blocks.map((block, index) => {
    if (index !== targetIndex) return sharedMorphId(block) === sharedId ? withoutSharedId(block) : block;
    const currentAction = interactionFromProps(block.props)?.action;
    const removesReturn = !enabled && currentAction?.type === "goToSlide" && currentAction.slide === groupStartIndex + 1;
    const props = withInteraction(
      { ...block.props, sharedId },
      enabled
        ? { action: { slide: groupStartIndex + 1, type: "goToSlide" }, trigger: "click", version: 1 }
        : removesReturn ? null : interactionFromProps(block.props)
    );
    return { ...block, props } as MotionDocBlock;
  });

  return scenes.map((scene, index) => {
    if (index === groupStartIndex) return { ...scene, blocks: overviewBlocks };
    if (index === detailSlideIndex) return { ...scene, blocks: detailBlocks };
    return scene;
  });
}

/** Returns true only when a detail return action and its overview Morph identity both match. */
export function hasSharedMorphReturnLink(
  scenes: MotionDocScene[],
  groupStartIndex: number,
  detailSlideIndex: number
) {
  const overview = scenes[groupStartIndex];
  const detail = scenes[detailSlideIndex];
  if (!overview || !detail || detailSlideIndex <= groupStartIndex) return false;

  const overviewPairKeys = new Set(overview.blocks.flatMap((block) => {
    if (!isMorphSupportedBlock(block)) return [];
    const action = interactionFromProps(block.props)?.action;
    const targetsDetail = action?.type === "goToSlide" && action.slide === detailSlideIndex + 1
      || action?.type === "nextSlide" && detailSlideIndex === groupStartIndex + 1;
    const id = targetsDetail ? sharedMorphId(block) : "";
    return id ? [`${block.type}\u0000${id}`] : [];
  }));
  if (overviewPairKeys.size === 0) return false;

  return detail.blocks.some((block) => {
    if (!isMorphSupportedBlock(block)) return false;
    const action = interactionFromProps(block.props)?.action;
    const returnsToOverview = action?.type === "goToSlide" && action.slide === groupStartIndex + 1
      || action?.type === "previousSlide" && detailSlideIndex === groupStartIndex + 1;
    const id = returnsToOverview ? sharedMorphId(block) : "";
    return Boolean(id && overviewPairKeys.has(`${block.type}\u0000${id}`));
  });
}

export function cloneSceneForSharedMorph(scene: MotionDocScene) {
  return {
    ...scene,
    blocks: scene.blocks.map((block) => cloneBlockIdentity(block, true))
  };
}

export function cloneBlockForPaste(block: MotionDocBlock, preserveSharedId = false) {
  return cloneBlockIdentity(block, preserveSharedId);
}

function cloneBlockIdentity(block: MotionDocBlock, preserveSharedId: boolean) {
  const sequence = motionSequenceFromProps(block.props);
  let props: MotionDocProps = {
    ...block.props,
    id: createMotionDocBlockId()
  };
  if (!preserveSharedId) delete props.sharedId;
  if (sequence) {
    props = withMotionSequence(props, {
      actions: sequence.actions.map((action) => ({ ...action, id: createMotionActionId() })),
      version: 1
    });
  }
  return { ...block, props } as MotionDocBlock;
}

function withoutSharedId(block: MotionDocBlock) {
  if (!sharedMorphId(block)) return block;
  const props = { ...block.props };
  delete props.sharedId;
  return { ...block, props } as MotionDocBlock;
}

function bestCompatibleTargetIndex(source: MotionDocBlock, sourceIndex: number, targets: MotionDocBlock[], used: Set<number>) {
  const sourceName = comparableBlockName(source);
  if (sourceName) {
    const named = targets.findIndex((candidate, index) => !used.has(index) && candidate.type === source.type && comparableBlockName(candidate) === sourceName);
    if (named >= 0) return named;
  }
  if (!used.has(sourceIndex) && targets[sourceIndex]?.type === source.type && isMorphSupportedBlock(targets[sourceIndex]!)) return sourceIndex;
  return targets.findIndex((candidate, index) => !used.has(index) && candidate.type === source.type && isMorphSupportedBlock(candidate));
}

function comparableBlockName(block: MotionDocBlock) {
  const name = typeof block.props.name === "string" ? block.props.name.trim().toLowerCase() : "";
  if (name) return `name:${name}`;
  const groupName = typeof block.props.groupName === "string" ? block.props.groupName.trim().toLowerCase() : "";
  if (groupName) return `group:${groupName}`;
  if (block.type === "Text" && "text" in block && block.text.trim()) return `text:${block.text.trim().toLowerCase()}`;
  return "";
}

function clamp(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;
}
