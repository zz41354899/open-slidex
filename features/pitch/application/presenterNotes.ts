import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";

// Native scenes do not require an ID. A stable layer ID keeps session notes
// attached when slides are reordered; empty legacy slides fall back to position.
export function presenterNotesKey(scene: MotionDocScene, index: number) {
  const sceneId = scene.props.id;
  if (typeof sceneId === "string" && sceneId) return "slide:" + sceneId;
  const layerId = scene.blocks.find(block => typeof block.props.id === "string" && block.props.id)?.props.id;
  return layerId ? "layer:" + String(layerId) : "position:" + index;
}
