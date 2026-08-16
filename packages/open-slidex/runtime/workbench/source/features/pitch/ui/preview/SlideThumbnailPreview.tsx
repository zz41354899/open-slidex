import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { MotionDocSlidePreview } from "@/features/pitch/ui/preview/MotionDocSlidePreview";

type SlideThumbnailPreviewProps = {
  activeSlideIndex: number;
  eager?: boolean;
  replayNonce: number;
  scene: MotionDocScene;
};

export function SlideThumbnailPreview({
  activeSlideIndex,
  eager = false,
  replayNonce,
  scene
}: SlideThumbnailPreviewProps) {
  return (
    <MotionDocSlidePreview
      activeSlideIndex={activeSlideIndex}
      eager={eager}
      replayNonce={replayNonce}
      scene={scene}
    />
  );
}
