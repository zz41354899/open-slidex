import type { MotionDocBlock, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";

const blockIdPrefix = "block";
let fallbackBlockIdSequence = 0;

export function createMotionDocBlockId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${blockIdPrefix}-${globalThis.crypto.randomUUID()}`;
  }

  fallbackBlockIdSequence += 1;
  return `${blockIdPrefix}-${Date.now().toString(36)}-${fallbackBlockIdSequence.toString(36)}`;
}

export function motionDocBlockId(block: MotionDocBlock) {
  const id = block.props.id;
  return typeof id === "string" && id.trim() ? id.trim() : "";
}

export function motionDocBlockKey(block: MotionDocBlock, fallbackIndex: number) {
  const id = motionDocBlockId(block);
  return id || `${block.type}-legacy-${fallbackIndex}`;
}

export function withNewMotionDocBlockId(block: MotionDocBlock): MotionDocBlock {
  const id = createMotionDocBlockId();

  return {
    ...block,
    props: {
      ...block.props,
      id
    }
  } as MotionDocBlock;
}

export function ensureMotionDocBlockIds(blocks: readonly MotionDocBlock[]) {
  const seenIds = new Set<string>();
  let didChange = false;

  const nextBlocks = blocks.map((block) => {
    const currentId = motionDocBlockId(block);
    if (currentId && !seenIds.has(currentId)) {
      seenIds.add(currentId);
      return block;
    }

    didChange = true;
    let nextId = createMotionDocBlockId();
    while (seenIds.has(nextId)) nextId = createMotionDocBlockId();
    seenIds.add(nextId);

    return {
      ...block,
      props: {
        ...block.props,
        id: nextId
      }
    } as MotionDocBlock;
  });

  return didChange ? nextBlocks : blocks;
}

export function ensureMotionDocSceneBlockIds(scene: MotionDocScene) {
  const blocks = ensureMotionDocBlockIds(scene.blocks);
  return blocks === scene.blocks ? scene : { ...scene, blocks: [...blocks] };
}
