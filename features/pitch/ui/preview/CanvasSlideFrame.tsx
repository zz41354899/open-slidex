import { useLayoutEffect, type CSSProperties, type DragEventHandler, type MouseEventHandler, type PointerEventHandler, type ReactNode, type RefObject } from "react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { sceneContainsHtmlRuntime } from "@/features/pitch/application/htmlRuntimePolicy";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH
} from "@/features/pitch/application/previewCanvas";
import {
  MAIN_CANVAS_INACTIVE_SHADER_MAX_PIXEL_COUNT,
  MAIN_CANVAS_PRELOAD_MARGIN
} from "@/features/pitch/application/canvasPerformance";
import type { SlideRow } from "@/features/pitch/application/slideRows";
import type { BlockFrameOverrides } from "@/features/pitch/application/pitchGeometry";
import type { InsertSlidePlacement } from "@/features/pitch/application/motionDocCommands";
import { CanvasSlideAddControls } from "@/features/pitch/ui/preview/CanvasChrome";
import { PreviewPane } from "@/features/pitch/ui/preview/PreviewPane";
import { ViewportDeferredPreview } from "@/features/pitch/ui/preview/ViewportDeferredPreview";
import { HtmlPageThumbnail } from "@/features/pitch/ui/preview/HtmlPageThumbnail";
import { createMotionPlaybackController } from "@/features/pitch/application/motionPlayback";

type CanvasSlideFrameProps = {
  actualScale: number;
  activeSlideFrameRef: RefObject<HTMLDivElement | null>;
  activeSlideIndex: number;
  canvasFrameStyle: CSSProperties;
  canvasRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  frameOverrides?: BlockFrameOverrides;
  hiddenBlockIndices: number[];
  hideSharedHtmlBlocks: boolean;
  isActive: boolean;
  isMouseOverCanvas: boolean;
  locale: string;
  onCanvasDoubleClick?: MouseEventHandler<HTMLDivElement>;
  onFramePointerDown: PointerEventHandler<HTMLDivElement>;
  onInsertSlideNearActive: (placement: InsertSlidePlacement) => void;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  onShaderFrameCapture?: (frame: number) => void;
  onToolDragOver?: DragEventHandler<HTMLDivElement>;
  onToolDrop?: DragEventHandler<HTMLDivElement>;
  replayNonce: number;
  previewSuspended: boolean;
  rootRef: RefObject<HTMLDivElement | null>;
  shaderMaxPixelCount: number;
  shaderPlaybackActive: boolean;
  slide: SlideRow;
  scene: MotionDocScene | undefined;
};

/** Keeps per-slide rendering separate from the canvas interaction controller. */
export function CanvasSlideFrame({
  actualScale,
  activeSlideFrameRef,
  activeSlideIndex,
  canvasFrameStyle,
  canvasRef,
  children,
  frameOverrides,
  hiddenBlockIndices,
  hideSharedHtmlBlocks,
  isActive,
  isMouseOverCanvas,
  locale,
  onCanvasDoubleClick,
  onFramePointerDown,
  onInsertSlideNearActive,
  onMouseEnter,
  onMouseLeave,
  onShaderFrameCapture,
  onToolDragOver,
  onToolDrop,
  replayNonce,
  previewSuspended,
  rootRef,
  shaderMaxPixelCount,
  shaderPlaybackActive,
  slide,
  scene
}: CanvasSlideFrameProps) {
  const containsHtmlRuntime = sceneContainsHtmlRuntime(scene);
  const htmlBlock = scene?.blocks.find((block) => block.type === "HtmlEmbedBlock");
  const htmlPage = htmlBlock?.type === "HtmlEmbedBlock" && Number.isInteger(Number(htmlBlock.props.page))
    ? Math.max(1, Number(htmlBlock.props.page))
    : slide.index + 1;

  useLayoutEffect(() => {
    if (!isActive || replayNonce < 1) return;
    const root = canvasRef.current;
    if (!root) return;
    const playback = createMotionPlaybackController(root);
    playback.playAll();
    return playback.cancel;
  }, [canvasRef, isActive, replayNonce]);

  return (
    <div
      className={`relative flex shrink-0 flex-col gap-2 transition-opacity ${isActive ? "z-30" : "z-0 opacity-80 hover:opacity-100"}`}
      data-slide-frame-index={slide.index}
      onPointerDown={onFramePointerDown}
      ref={isActive ? activeSlideFrameRef : undefined}
    >
      <div className="hidden h-7 items-center justify-between px-1 font-mono text-[14px] font-semibold uppercase tracking-[0.12em] text-neutral-500 sm:flex">
        <span className={isActive ? "text-neutral-300" : undefined}>{locale === "zh-TW" ? `投影片 ${slide.index + 1}` : `Slide ${slide.index + 1}`}</span>
        <span>{scene?.duration ?? slide.duration}s</span>
      </div>
      <div
        className="relative"
        style={isActive ? undefined : {
          containIntrinsicSize: `${Math.round(CANVAS_WIDTH * actualScale)}px ${Math.round(CANVAS_HEIGHT * actualScale)}px`,
          contentVisibility: "auto"
        }}
      >
        {isActive && !isMouseOverCanvas && !hideSharedHtmlBlocks ? <CanvasSlideAddControls onInsertSlideNearActive={onInsertSlideNearActive} orientation="vertical" /> : null}
        <div
          aria-current={isActive ? "true" : undefined}
          aria-label={locale === "zh-TW"
            ? `第 ${slide.index + 1} 張投影片畫布，16:9，${CANVAS_WIDTH} × ${CANVAS_HEIGHT}`
            : `Slide ${slide.index + 1} canvas, 16:9 ${CANVAS_WIDTH} by ${CANVAS_HEIGHT}`}
          className={`group relative shrink-0 shadow-xl ring-1 transition-shadow duration-200 ${hideSharedHtmlBlocks && containsHtmlRuntime && isActive ? "bg-transparent" : "bg-black"} ${isActive ? "overflow-visible" : "overflow-hidden"} ${
            isActive
              ? "ring-neutral-500/55 shadow-[0_18px_54px_rgba(0,0,0,0.48)]"
              : "ring-neutral-800/80 hover:ring-white/20"
          }`}
          onDoubleClick={isActive ? onCanvasDoubleClick : undefined}
          onDragOver={isActive ? onToolDragOver : undefined}
          onDrop={isActive ? onToolDrop : undefined}
          onMouseEnter={isActive ? onMouseEnter : undefined}
          onMouseLeave={isActive ? onMouseLeave : undefined}
          ref={isActive ? canvasRef : undefined}
          style={canvasFrameStyle}
        >
          <div
            className={`absolute left-0 top-0 ${isActive ? "overflow-visible" : "overflow-hidden"}`}
            data-motion-canvas-content={isActive ? "active" : undefined}
            style={{
              height: CANVAS_HEIGHT,
              transform: `scale(${actualScale})`,
              transformOrigin: "left top",
              width: CANVAS_WIDTH
            }}
          >
            <ViewportDeferredPreview
              eager={isActive}
              renderWhenVisible={!containsHtmlRuntime || hideSharedHtmlBlocks}
              rootMargin={MAIN_CANVAS_PRELOAD_MARGIN}
              rootRef={rootRef}
              suspended={previewSuspended}
            >
              <PreviewPane
                activeSlideIndex={slide.index}
                allowOverflow={isActive}
                frameOverrides={isActive ? frameOverrides : undefined}
                hiddenBlockIndices={isActive ? hiddenBlockIndices : emptyBlockIndices}
                hideSharedHtmlBlocks={hideSharedHtmlBlocks}
                hideHtmlSourceTextBlocks={hideSharedHtmlBlocks}
                imageFetchPriority={isActive ? "high" : "low"}
                imageLoading={isActive ? "eager" : "lazy"}
                onShaderFrameCapture={isActive ? onShaderFrameCapture : undefined}
                replayNonce={replayNonce}
                scene={scene}
                shaderMaxPixelCount={isActive ? shaderMaxPixelCount : MAIN_CANVAS_INACTIVE_SHADER_MAX_PIXEL_COUNT}
                shaderPlaybackActive={isActive && shaderPlaybackActive}
                transparentCanvas={hideSharedHtmlBlocks && containsHtmlRuntime && isActive}
              />
            </ViewportDeferredPreview>
            {hideSharedHtmlBlocks && containsHtmlRuntime && !isActive ? (
              <div
                className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
                data-html-canvas-placeholder
              >
                <HtmlPageThumbnail page={htmlPage} source={String(htmlBlock?.props.src ?? "")} />
              </div>
            ) : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

const emptyBlockIndices: number[] = [];
