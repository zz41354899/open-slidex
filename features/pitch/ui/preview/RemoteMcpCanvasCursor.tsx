"use client";

import { CheckCircle2, CircleAlert, MousePointer2 } from "lucide-react";
import type { RefObject } from "react";

import type { McpCanvasCursorState } from "@/features/pitch/ui/hooks/useRemoteMcpCanvasCursor";

type RemoteMcpCanvasCursorProps = {
  cursor: McpCanvasCursorState | null;
  layerRef: RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
};

export function RemoteMcpCanvasCursor({
  cursor,
  layerRef,
  reducedMotion
}: RemoteMcpCanvasCursorProps) {
  const settledSuccess = cursor?.phase === "settled-success";
  const settledFailure = cursor?.phase === "settled-failure";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[55] overflow-hidden"
      data-mcp-cursor-layer
      ref={layerRef}
    >
      {cursor?.position ? (
        <div
          className={`pointer-events-none absolute left-0 top-0 will-change-transform ${reducedMotion ? "" : "transition-[transform,left,top,opacity] duration-200 ease-out"}`}
          data-mcp-cursor-position-source={cursor.position.source}
          data-mcp-cursor-state={cursor.phase}
          data-mcp-operation-id={cursor.activity.id}
          data-mcp-operation-status={cursor.activity.status}
          style={{
            left: `${cursor.position.xPercent}%`,
            top: `${cursor.position.yPercent}%`,
            transform: `translate(-18%, -12%) scale(${cursor.phase === "pressing" ? 0.86 : 1})`
          }}
        >
          <div className={`relative ${cursor.phase === "running" ? "motion-safe:animate-pulse" : ""}`}>
            <MousePointer2
              className={`h-8 w-8 fill-[#8b5cf6] text-[#f5f3ff] drop-shadow-[0_5px_9px_rgba(46,16,101,0.65)] ${cursor.phase === "pressing" ? "text-white" : ""}`}
              strokeWidth={1.8}
            />
            {cursor.phase === "pressing" ? (
              <span className="absolute -left-2 -top-2 h-11 w-11 rounded-full border-2 border-[#a78bfa]/70 motion-safe:animate-ping" />
            ) : null}
            {settledSuccess || settledFailure ? (
              <span className={`absolute -right-4 -top-3 flex h-6 w-6 items-center justify-center rounded-full border text-white shadow-lg ${settledSuccess ? "border-emerald-300/80 bg-emerald-500" : "border-rose-300/80 bg-rose-500"}`}>
                {settledSuccess
                  ? <CheckCircle2 className="h-4 w-4" />
                  : <CircleAlert className="h-4 w-4" />}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
