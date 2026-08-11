"use client";

import { Bot, CheckCircle2, CircleAlert } from "lucide-react";

import { remoteMcpOperationAction } from "@/features/pitch/application/remoteMcpOperation";
import type { RemoteMcpOperation } from "@/features/pitch/domain/remoteMcpOperation";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

export function RemoteMcpActivityRail({ activities }: { activities: readonly RemoteMcpOperation[] }) {
  const { locale } = usePitchI18n();
  if (activities.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 z-[60] flex w-[min(360px,calc(100vw-3rem))] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
      data-mcp-activity-rail
    >
      {activities.slice(0, 3).map((activity) => (
        <div className={`flex max-w-full items-center justify-center gap-2 rounded-[7px] border border-[#8b5cf6]/55 bg-[#1f123d]/92 px-2.5 py-1.5 text-[11px] text-[#ede9fe] shadow-[0_10px_35px_rgba(46,16,101,0.28)] backdrop-blur-md ${activity.status === "running" ? "" : "motion-safe:animate-[mcp-activity-settle_6s_ease-out_forwards]"} ${activity.status === "failed" ? "border-dashed" : ""}`} key={activity.id}>
          {activity.status === "running" ? <Bot className="h-3.5 w-3.5 shrink-0 motion-safe:animate-pulse" /> : activity.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <CircleAlert className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate font-semibold">AI · {activity.clientName}</span>
          <span className="truncate text-[#ddd6fe]/68">{remoteMcpOperationAction(activity, locale)}</span>
        </div>
      ))}
    </div>
  );
}
