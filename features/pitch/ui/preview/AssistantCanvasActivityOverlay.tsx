"use client";

import { useEffect, useState } from "react";
import { Bot, CheckCircle2, CircleAlert, MousePointer2 } from "lucide-react";

import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import type { AssistantCanvasActivity, AssistantCanvasTarget, AssistantCanvasTrace } from "@/core/motion-doc/domain/assistantCanvasActivity";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { blockFrame } from "@/features/pitch/application/previewCanvas";
import type { AssistantCanvasTone } from "@/features/pitch/ui/preview/assistantCanvasAppearance";

type AssistantCanvasActivityOverlayProps = {
  activities: readonly AssistantCanvasActivity[];
  scene: MotionDocScene | undefined;
  showCursor: boolean;
  slideIndex: number;
  tone?: AssistantCanvasTone;
  trace?: AssistantCanvasTrace;
};

export function AssistantCanvasActivityOverlay({
  activities,
  scene,
  showCursor,
  slideIndex,
  tone = "lime",
  trace
}: AssistantCanvasActivityOverlayProps) {
  if (tone === "periwinkle") {
    return <LocalAssistantCanvasActivityOverlay activities={activities} scene={scene} showCursor={showCursor} slideIndex={slideIndex} trace={trace} />;
  }
  return <LegacyAssistantCanvasActivityOverlay activities={activities} scene={scene} showCursor={showCursor} slideIndex={slideIndex} />;
}

function LocalAssistantCanvasActivityOverlay({
  activities,
  scene,
  showCursor,
  slideIndex,
  trace
}: Omit<AssistantCanvasActivityOverlayProps, "tone">) {
  const traceVisible = trace && targetsSlide(trace.target, slideIndex);
  const visible = activities.filter((activity) => activity.status === "running" && activity.id !== trace?.id).flatMap((activity) => activity.targets
    .filter((target) => targetsSlide(target, slideIndex))
    .map((target) => ({ activity, target })));
  const cursorItems = traceVisible ? [{ activity: traceActivity(trace), target: trace.target }] : visible;
  const [cursorIndex, setCursorIndex] = useState(0);
  const cursorItem = cursorItems[cursorIndex % Math.max(cursorItems.length, 1)];
  const cursorFrame = traceVisible
    ? trace.frame ?? targetFrame(trace.target, scene)
    : cursorItem ? targetFrame(cursorItem.target, scene) : undefined;

  useEffect(() => {
    setCursorIndex(0);
    if (cursorItems.length <= 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setCursorIndex((value) => (value + 1) % cursorItems.length), 900);
    return () => window.clearInterval(timer);
  }, [cursorItems.length, activities]);

  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-0 z-[54] overflow-hidden" data-assistant-activity-layer>
      {visible.map(({ activity, target }, index) => {
        const frame = targetFrame(target, scene);
        return (
          <div
            className="absolute rounded-[3px] border-[1.5px] border-solid border-[#8ea5ff] opacity-100"
            data-assistant-activity-id={activity.id}
            data-assistant-activity-status={activity.status}
            key={`${activity.id}-${index}`}
            style={{
              height: `${frame.h}%`,
              left: `${frame.x}%`,
              opacity: Math.max(0.62, 1 - index * 0.08),
              top: `${frame.y}%`,
              width: `${frame.w}%`
            }}
          >
            <span className="absolute -left-[3px] -top-[3px] h-[7px] w-[7px] border-l-2 border-t-2 border-[#c7d0ff]" />
            <span className="absolute -right-[3px] -top-[3px] h-[7px] w-[7px] border-r-2 border-t-2 border-[#c7d0ff]" />
            <span className="absolute -bottom-[3px] -left-[3px] h-[7px] w-[7px] border-b-2 border-l-2 border-[#c7d0ff]" />
            <span className="absolute -bottom-[3px] -right-[3px] h-[7px] w-[7px] border-b-2 border-r-2 border-[#c7d0ff]" />
            <div className={`absolute left-0 flex max-w-[170px] items-center gap-1.5 whitespace-nowrap rounded-[4px] border border-[#8ea5ff]/45 bg-[#11141b] px-1.5 py-0.5 text-[9px] font-semibold leading-4 text-[#dce2ff] ${frame.y < 5 ? "top-1" : "-top-1 -translate-y-full"}`}>
              <Bot className="h-3 w-3 shrink-0" />
              <span className="truncate">{canvasStatusLabel(activity)}</span>
            </div>
          </div>
        );
      })}
      {traceVisible ? <TraceTarget trace={trace} scene={scene} /> : null}
      {showCursor && cursorItem && cursorFrame ? (
        <div
          aria-hidden="true"
          className={`absolute left-0 top-0 transition-[left,top,transform,opacity] duration-700 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none ${trace?.gesture === "press" ? "translate-x-0.5 translate-y-0.5" : ""}`}
          data-assistant-cursor-status={cursorItem.activity.status}
          data-assistant-cursor-gesture={trace?.gesture}
          style={{ left: `${Math.min(cursorFrame.x + Math.max(3, cursorFrame.w * 0.08), 96)}%`, top: `${Math.min(cursorFrame.y + Math.max(3, cursorFrame.h * 0.08), 96)}%` }}
        >
          {trace?.gesture === "press" ? <span className="pointer-events-none absolute -left-2 -top-2 h-9 w-9 rounded-full border border-[#9facff]/70 motion-safe:animate-ping" /> : null}
          <MousePointer2 className="h-7 w-7 fill-[#6670f2] text-[#d8deff] drop-shadow-[0_4px_7px_rgba(22,25,57,0.68)]" strokeWidth={1.8} />
        </div>
      ) : null}
    </div>
  );
}

function TraceTarget({ scene, trace }: { scene: MotionDocScene | undefined; trace: AssistantCanvasTrace }) {
  const frame = trace.frame ?? targetFrame(trace.target, scene);
  const failed = trace.status === "failed";
  const settled = trace.status === "completed";
  const moving = trace.gesture === "move";
  return (
    <div
      className={`absolute rounded-[3px] border-[1.5px] transition-[left,top,width,height,opacity] duration-700 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none ${failed ? "border-dashed border-[#fb7185]" : moving ? "border-dashed border-[#8ea5ff]/55" : "border-solid border-[#8ea5ff] shadow-[0_0_0_3px_rgba(142,165,255,.08)]"} ${settled ? "opacity-75" : moving ? "opacity-60" : "opacity-100"}`}
      data-assistant-trace-id={trace.id}
      data-assistant-trace-gesture={trace.gesture}
      data-assistant-trace-status={trace.status}
      style={{ height: `${frame.h}%`, left: `${frame.x}%`, top: `${frame.y}%`, width: `${frame.w}%` }}
    >
      <div className={`absolute left-0 flex max-w-[190px] items-center gap-1.5 whitespace-nowrap rounded-[4px] border bg-[#11141b] px-1.5 py-0.5 text-[9px] font-semibold leading-4 ${failed ? "border-[#fb7185]/55 text-[#fecdd3]" : "border-[#8ea5ff]/45 text-[#dce2ff]"} ${frame.y < 5 ? "top-1" : "-top-1 -translate-y-full"}`}>
        {trace.status === "running" ? <Bot className="h-3 w-3 shrink-0" /> : trace.status === "completed" ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <CircleAlert className="h-3 w-3 shrink-0" />}
        <span className="truncate">{trace.label}</span>
      </div>
    </div>
  );
}

function traceActivity(trace: AssistantCanvasTrace): AssistantCanvasActivity {
  return {
    clientName: "OpenSlideX",
    createdAt: "",
    details: [],
    id: trace.id,
    status: trace.status,
    summary: trace.label,
    targets: [trace.target],
    toolName: "open_slidex_edit",
    updatedAt: ""
  };
}

function LegacyAssistantCanvasActivityOverlay({
  activities,
  scene,
  showCursor,
  slideIndex
}: Omit<AssistantCanvasActivityOverlayProps, "tone">) {
  const visible = activities.flatMap((activity) => activity.targets
    .filter((target) => targetsSlide(target, slideIndex))
    .map((target) => ({ activity, target })));
  const cursorItem = visible.find(({ activity }) => activity.status === "running") ?? visible[0];
  const cursorFrame = cursorItem ? targetFrame(cursorItem.target, scene) : undefined;

  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-0 z-[54] overflow-hidden" data-assistant-activity-layer>
      {visible.map(({ activity, target }, index) => {
        const frame = targetFrame(target, scene);
        return (
          <div
            className={`absolute rounded-[4px] border-2 border-[#b7d97a] shadow-[0_0_0_1px_rgba(183,217,122,0.22),0_0_18px_rgba(183,217,122,0.2)] ${activity.status === "running" ? "motion-safe:animate-pulse" : "motion-safe:animate-[mcp-activity-settle_6s_ease-out_forwards]"} ${activity.status === "failed" ? "border-dashed" : "border-solid"}`}
            data-assistant-activity-id={activity.id}
            data-assistant-activity-status={activity.status}
            key={`${activity.id}-${index}`}
            style={{ height: `${frame.h}%`, left: `${frame.x}%`, opacity: Math.max(0.62, 1 - index * 0.08), top: `${frame.y}%`, width: `${frame.w}%` }}
          >
            <div className={`absolute left-0 flex max-w-[min(280px,88vw)] items-center gap-1.5 whitespace-nowrap rounded-[4px] border border-[#b7d97a]/55 bg-[#172016]/94 px-2 py-1 text-[11px] font-semibold leading-4 text-[#ecf6dd] shadow-[0_6px_20px_rgba(5,7,14,0.48)] ${frame.y < 8 ? "top-1" : "-top-1 -translate-y-full"}`}>
              {activity.status === "running" ? <Bot className="h-3.5 w-3.5 shrink-0" /> : activity.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <CircleAlert className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">AI · {activity.summary}</span>
            </div>
          </div>
        );
      })}
      {showCursor && cursorItem && cursorFrame ? (
        <div aria-hidden="true" className="absolute left-0 top-0 transition-[left,top,transform,opacity] duration-200 ease-out motion-reduce:transition-none" data-assistant-cursor-status={cursorItem.activity.status} style={{ left: `${Math.min(cursorFrame.x + Math.max(3, cursorFrame.w * 0.08), 96)}%`, top: `${Math.min(cursorFrame.y + Math.max(3, cursorFrame.h * 0.08), 96)}%` }}>
          <MousePointer2 className={`h-8 w-8 fill-[#b7d97a] text-[#f4ffe0] drop-shadow-[0_5px_9px_rgba(16,28,12,0.65)] ${cursorItem.activity.status === "running" ? "motion-safe:animate-pulse" : ""}`} strokeWidth={1.8} />
          {cursorItem.activity.status !== "running" ? <span className={`absolute -right-3 -top-2 flex h-5 w-5 items-center justify-center rounded-full border text-white ${cursorItem.activity.status === "completed" ? "border-emerald-300 bg-emerald-600" : "border-rose-300 bg-rose-600"}`}>{cursorItem.activity.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function canvasStatusLabel(activity: AssistantCanvasActivity) {
  if (activity.toolName === "open_slidex_edit") return "Editing";
  if (activity.toolName === "open_slidex_validate") return "Validating";
  if (activity.toolName === "open_slidex_render") return "Rendering";
  if (activity.toolName === "open_slidex_inspect" || activity.toolName === "open_slidex_open") return "Reading";
  return activity.summary;
}

function targetsSlide(target: AssistantCanvasTarget, slideIndex: number) {
  return target.kind === "presentation" || target.slideIndex === slideIndex;
}

function targetFrame(target: AssistantCanvasTarget, scene: MotionDocScene | undefined) {
  if (target.kind !== "block") return { h: 100, w: 100, x: 0, y: 0 };
  const nodeBlockIndex = target.nodeId
    ? scene?.blocks.findIndex((block, index) => motionDocBlockKey(block, index) === target.nodeId) ?? -1
    : -1;
  const blockIndex = nodeBlockIndex >= 0 ? nodeBlockIndex : target.blockIndex ?? -1;
  const block = blockIndex >= 0 ? scene?.blocks[blockIndex] : undefined;
  return block ? blockFrame(block) : { h: 14, w: 20, x: 40, y: 43 };
}
