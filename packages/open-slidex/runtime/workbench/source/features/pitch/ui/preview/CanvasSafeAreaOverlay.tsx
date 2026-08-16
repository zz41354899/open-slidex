import {
  CANVAS_SAFE_AREA_INSET_PERCENT,
  canvasSafeAreaPixels
} from "@/features/pitch/application/canvasPerformance";

export function CanvasSafeAreaOverlay({ visible }: { visible: boolean }) {
  const insets = canvasSafeAreaPixels();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[31]"
      data-canvas-pasteboard-boundary
    >
      {visible ? (
        <div
          className="absolute border border-dashed border-[#ff3b30] shadow-[0_0_0_1px_rgba(255,255,255,0.4)]"
          data-canvas-safe-area
          data-canvas-safe-area-tone="red"
          data-canvas-safe-area-horizontal={insets.horizontal}
          data-canvas-safe-area-vertical={insets.vertical}
          style={{ inset: `${CANVAS_SAFE_AREA_INSET_PERCENT}%` }}
        />
      ) : null}
    </div>
  );
}
