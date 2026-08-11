import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";

const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const presentationImageSourcePrefix = "/api/presentation-images/";
const presentationImageStoragePathPattern = new RegExp(
  `^${uuidPattern}/${uuidPattern}/${uuidPattern}[.](?:avif|gif|jpg|png|webp)$`,
  "i"
);

export function isPresentationImageStoragePath(value: string) {
  return presentationImageStoragePathPattern.test(value);
}

export function presentationImageStoragePathIdentity(value: string) {
  if (!isPresentationImageStoragePath(value)) return null;
  const [userId, presentationId] = value.split("/");
  return { presentationId, userId };
}

export function presentationImageSource(storagePath: string) {
  if (!isPresentationImageStoragePath(storagePath)) {
    throw new Error("Invalid presentation image path");
  }

  return `${presentationImageSourcePrefix}${storagePath}`;
}

export function presentationImageStoragePathFromSource(source: string) {
  const normalizedSource = source.trim();
  if (!normalizedSource.startsWith(presentationImageSourcePrefix)) return null;

  const storagePath = normalizedSource.slice(presentationImageSourcePrefix.length);
  return isPresentationImageStoragePath(storagePath) ? storagePath : null;
}

export function presentationImageReferenceCount(
  scenes: readonly MotionDocScene[],
  source: string
) {
  return scenes.reduce((count, scene) => {
    const backgroundReference = scene.props.backgroundImage === source ? 1 : 0;
    const blockReferences = scene.blocks.reduce((blockCount, block) => (
      "props" in block && (block.props.src === source || block.props.shapeImageSrc === source)
        ? blockCount + 1
        : blockCount
    ), 0);
    return count + backgroundReference + blockReferences;
  }, 0);
}
