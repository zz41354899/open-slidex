
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import {
  THUMBNAIL_SHADER_MAX_PIXEL_COUNT,
  THUMBNAIL_SHADER_MIN_PIXEL_RATIO
} from "@/features/pitch/application/canvasPerformance";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH
} from "@/features/pitch/application/previewCanvas";
import { PreviewPane } from "@/features/pitch/ui/preview/PreviewPane";

type MotionDocSlidePreviewProps = {
  activeSlideIndex: number;
  eager?: boolean;
  interactive?: boolean;
  replayNonce: number;
  scene: MotionDocScene;
};

export function MotionDocSlidePreview({
  activeSlideIndex,
  eager = false,
  interactive = false,
  replayNonce,
  scene
}: MotionDocSlidePreviewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(eager);
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    if (eager) {
      setShouldRender(true);
      return;
    }

    const frame = frameRef.current;
    if (!frame) return;

    if (!("IntersectionObserver" in window)) {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShouldRender(Boolean(entry?.isIntersecting));
      },
      { rootMargin: "240px 0px" }
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [eager]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateScale = () => {
      const rect = frame.getBoundingClientRect();
      if (rect.width > 0) {
        setScale(rect.width / CANVAS_WIDTH);
      }
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-hidden={interactive ? undefined : "true"}
      className="absolute inset-0 overflow-hidden"
      data-interactive={interactive ? "true" : "false"}
      data-motion-doc-slide-preview
      data-motion-doc-thumbnail-mode="static"
      data-motion-doc-slide-preview-height={CANVAS_HEIGHT}
      data-motion-doc-slide-preview-width={CANVAS_WIDTH}
      ref={frameRef}
    >
      <div
        className={`absolute left-0 top-0 bg-black ${
          interactive ? "" : "pointer-events-none"
        }`}
        style={{
          height: CANVAS_HEIGHT,
          opacity: scale === null ? 0 : 1,
          transform: `scale(${scale ?? 1})`,
          transformOrigin: "left top",
          transition: "opacity 80ms ease-out",
          width: CANVAS_WIDTH
        }}
      >
        {shouldRender ? (
          <PreviewPane
            activeSlideIndex={activeSlideIndex}
            imageFetchPriority={eager ? "high" : "low"}
            imageLoading={eager ? "eager" : "lazy"}
            replayNonce={replayNonce}
            scene={scene}
            shaderMaxPixelCount={THUMBNAIL_SHADER_MAX_PIXEL_COUNT}
            shaderMinPixelRatio={THUMBNAIL_SHADER_MIN_PIXEL_RATIO}
            shaderPlaybackActive={false}
          />
        ) : null}
      </div>
    </div>
  );
}
