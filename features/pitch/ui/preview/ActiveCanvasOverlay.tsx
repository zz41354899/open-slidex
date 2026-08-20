import type { RefObject } from "react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import type { AssistantCanvasActivity, AssistantCanvasTrace } from "@/core/motion-doc/domain/assistantCanvasActivity";
import type { AssistantCanvasTone } from "@/features/pitch/ui/preview/assistantCanvasAppearance";
import type { RemoteMcpOperation } from "@/features/pitch/domain/remoteMcpOperation";
import type { McpCanvasCursorState } from "@/features/pitch/ui/hooks/useRemoteMcpCanvasCursor";
import { AssistantCanvasActivityOverlay } from "@/features/pitch/ui/preview/AssistantCanvasActivityOverlay";
import { RemoteMcpActivityOverlay } from "@/features/pitch/ui/preview/RemoteMcpActivityOverlay";
import { RemoteMcpCanvasCursor } from "@/features/pitch/ui/preview/RemoteMcpCanvasCursor";

type ActiveCanvasOverlayProps = {
  activeSlideIndex: number;
  activities: readonly RemoteMcpOperation[];
  assistantActivities: readonly AssistantCanvasActivity[];
  assistantTone?: AssistantCanvasTone;
  assistantTrace?: AssistantCanvasTrace;
  cursor: McpCanvasCursorState | null;
  cursorLayerRef: RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
  scene: MotionDocScene | undefined;
  showCursor: boolean;
  slideIndex: number;
};

/** Activity and remote-cursor decorations are independent of local canvas input. */
export function ActiveCanvasOverlay({
  activeSlideIndex,
  activities,
  assistantActivities,
  assistantTone,
  assistantTrace,
  cursor,
  cursorLayerRef,
  reducedMotion,
  scene,
  showCursor,
  slideIndex
}: ActiveCanvasOverlayProps) {
  return (
    <>
      <RemoteMcpActivityOverlay activeSlideIndex={activeSlideIndex} activities={activities} scene={scene} slideIndex={slideIndex} />
      <AssistantCanvasActivityOverlay
        activities={assistantActivities}
        scene={scene}
        showCursor
        slideIndex={slideIndex}
        tone={assistantTone}
        trace={assistantTrace}
      />
      {showCursor ? <RemoteMcpCanvasCursor cursor={cursor} layerRef={cursorLayerRef} reducedMotion={reducedMotion} /> : null}
    </>
  );
}
