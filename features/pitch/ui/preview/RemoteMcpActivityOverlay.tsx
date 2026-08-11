"use client";

import { Bot, CheckCircle2, CircleAlert } from "lucide-react";

import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import {
  remoteMcpOperationAction,
  remoteMcpOperationTargetsSlide
} from "@/features/pitch/application/remoteMcpOperation";
import type { RemoteMcpOperation } from "@/features/pitch/domain/remoteMcpOperation";
import { blockFrame } from "@/features/pitch/application/previewCanvas";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type RemoteMcpActivityOverlayProps = {
  activeSlideIndex: number;
  activities: readonly RemoteMcpOperation[];
  scene: MotionDocScene | undefined;
  slideIndex: number;
};

export function RemoteMcpActivityOverlay({
  activeSlideIndex,
  activities,
  scene,
  slideIndex
}: RemoteMcpActivityOverlayProps) {
  const { locale } = usePitchI18n();

  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-0 z-50">
      {activities.filter((activity) => remoteMcpOperationTargetsSlide(
        activity,
        slideIndex,
        activeSlideIndex
      )).map((activity, index) => {
        const frame = operationFrame(activity, scene, slideIndex, activeSlideIndex);
        if (!frame) return null;
        const isConflict = activity.errorCode === "revision_conflict";

        return (
          <div
            className={`absolute rounded-[5px] border-2 border-[#8b5cf6] shadow-[0_0_0_1px_rgba(139,92,246,0.24),0_0_20px_rgba(139,92,246,0.28)] ${activity.status === "running" ? "motion-safe:animate-pulse" : "motion-safe:animate-[mcp-activity-settle_6s_ease-out_forwards]"} ${activity.status === "failed" ? "border-dashed" : "border-solid"}`}
            data-mcp-completed-revision={activity.completedRevision}
            data-mcp-operation-id={activity.id}
            data-mcp-operation-status={isConflict ? "conflict" : activity.status}
            key={activity.id}
            style={{
              height: `${frame.h}%`,
              left: `${frame.x}%`,
              opacity: Math.max(0.62, 1 - index * 0.12),
              top: `${frame.y}%`,
              width: `${frame.w}%`
            }}
          >
            <div className={`absolute left-0 flex max-w-[min(280px,90vw)] items-center gap-1.5 whitespace-nowrap rounded-[5px] border border-[#a78bfa]/65 bg-[#2e1065]/94 px-2 py-1 text-[11px] font-semibold leading-4 text-[#ede9fe] shadow-[0_6px_22px_rgba(46,16,101,0.38)] ${frame.y < 8 ? "top-1" : "-top-1 -translate-y-full"}`}>
              {activity.status === "running" ? <Bot className="h-3.5 w-3.5 shrink-0" /> : activity.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <CircleAlert className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">AI · {activity.clientName}</span>
              <span className="font-normal text-[#ddd6fe]/70">· {remoteMcpOperationAction(activity, locale)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function operationFrame(
  activity: RemoteMcpOperation,
  scene: MotionDocScene | undefined,
  slideIndex: number,
  activeSlideIndex: number
) {
  if (activity.target.kind !== "block" || slideIndex !== activeSlideIndex) {
    return { h: 100, w: 100, x: 0, y: 0 };
  }

  const nodeId = activity.target.nodeId;
  const blockIndex = scene?.blocks.findIndex(
    (block, index) => (
      motionDocBlockKey(block, index) === nodeId || `${block.type}-legacy-${index}` === nodeId
    )
  ) ?? -1;
  const block = blockIndex >= 0 ? scene?.blocks[blockIndex] : undefined;
  return block ? blockFrame(block) : { h: 100, w: 100, x: 0, y: 0 };
}
