import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";

export type MotionDocSceneCache = {
  scenes: MotionDocScene[];
  signatures: string[];
};

const sceneSourcePattern = /<(?:Slide|Scene)\b[^>]*>[\s\S]*?<\/(?:Slide|Scene)>/g;

/**
 * Uses the exact MDX for each scene as its identity. Editing one slide can then
 * preserve every other parsed scene object, allowing memoized previews and
 * thumbnails to skip work without weakening source validation.
 */
export function motionDocSceneSourceSignatures(source: string) {
  return Array.from(source.matchAll(sceneSourcePattern), (match) => match[0]);
}

export function stabilizeMotionDocScenes(
  scenes: MotionDocScene[],
  signatures: string[],
  previous?: MotionDocSceneCache
): MotionDocSceneCache {
  if (!previous) return { scenes, signatures };

  let reusedScene = false;
  const stableScenes = scenes.map((scene, index) => {
    if (
      previous.signatures[index] === signatures[index]
      && previous.scenes[index]
    ) {
      reusedScene = true;
      return previous.scenes[index];
    }
    return scene;
  });

  return {
    scenes: reusedScene ? stableScenes : scenes,
    signatures
  };
}
