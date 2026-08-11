import type { ThreadAssistantMessagePart } from "@assistant-ui/react";
import { Check, ChevronDown, CircleAlert, LocateFixed, ScanSearch } from "lucide-react";
import { useEffect, useState } from "react";

import type { AssistantCanvasTarget } from "@/core/motion-doc/domain/assistantCanvasActivity";
import type { AiProvider, OpenSlideXToolName, ToolPreviewRef } from "./api";
import {
  aiActivityHasUnresolvedFailure,
  aiActivityRecoveredFailureCount,
  aiActivitySummaryLabel,
  aiFinalSuccessfulPreview,
  aiFormatDuration,
  aiTargetLabel,
  aiToolDisplayName
} from "./aiChatPresentation";

export type AiRunPhase = {
  label: string;
  phase: "connecting" | "reading" | "working";
  runStartedAt: number;
  stepStartedAt: number;
} | null;

export type AiToolPayload = {
  details?: string[];
  message?: string;
  preview?: ToolPreviewRef;
  runDurationMs?: number;
  status?: "completed" | "failed";
  summary?: string;
  targets?: AssistantCanvasTarget[];
};

export type AiToolCallPart = Extract<ThreadAssistantMessagePart, { type: "tool-call" }>;

type AiRunStatusProps = {
  phase: AiRunPhase;
  provider: AiProvider;
  targetLabel: string;
};

type AiActivityGroupProps = {
  onFocusTarget: (target: AssistantCanvasTarget) => void;
  tools: AiToolCallPart[];
};

type AiActivityRecord = {
  failed: boolean;
  payload: AiToolPayload;
  preview?: ToolPreviewRef;
  result?: AiToolPayload;
  targets: AssistantCanvasTarget[];
  tool: OpenSlideXToolName;
};

export function AiRunStatus({ phase, provider, targetLabel }: AiRunStatusProps) {
  const fallback = provider === "codex" ? "Local Codex started" : "Preparing a reviewable draft";
  const phaseLabel = phase?.label ?? fallback;
  const isChecking = /validat|render|check|preview/i.test(phaseLabel);
  const activeStep = isChecking ? 2 : phase?.phase === "working" ? 1 : 0;
  const now = useElapsedClock(Boolean(phase));
  const elapsedMs = phase ? Math.max(0, now - phase.runStartedAt) : 0;
  const stepElapsedMs = phase ? Math.max(0, now - phase.stepStartedAt) : 0;
  const detail = phase?.phase === "working"
    ? provider === "codex"
      ? "Previewing each Canvas change before the atomic save"
      : "Editing the selected slide"
    : "Connecting to the local project and reading its presentation";
  const steps = [
    { detail: targetLabel, label: "Read presentation" },
    { detail: phase?.phase === "working" ? phaseLabel : "Current request", label: "Work on request" },
    { detail: isChecking ? phaseLabel : "Queued", label: "Check canvas" }
  ];

  return (
    <section className="ai-working" aria-label="AI run status" data-ai-runtime="vertical-steps">
      <span className="sr-only" aria-live="polite" role="status">{phaseLabel}</span>
      <div className="ai-working-heading">
        <strong className="ai-thinking-gradient">AI is working</strong>
        <span className="ai-loading-label" aria-hidden="true">{aiFormatDuration(elapsedMs)}</span>
      </div>
      <p className="ai-working-detail">
        {detail} <span aria-hidden="true">· step {aiFormatDuration(stepElapsedMs)}</span>
      </p>
      <ol className="ai-working-steps">
        {steps.map((step, index) => (
          <li className={index < activeStep ? "is-complete" : index === activeStep ? "is-active" : ""} key={step.label}>
            <span aria-hidden="true" className="ai-step-indicator">{index < activeStep ? <Check size={10} /> : <i />}</span>
            <span><strong>{step.label}</strong><small>{step.detail}</small></span>
            <em>{index < activeStep ? "Done" : index === activeStep ? "Active" : "Queued"}</em>
          </li>
        ))}
      </ol>
    </section>
  );
}

// assistant-ui may remount a message part as streamed tool results settle. Keep
// disclosure state outside the part so a user's click survives that remount.
const expandedActivityGroups = new Set<string>();

export function AiActivityGroup({ onFocusTarget, tools }: AiActivityGroupProps) {
  const records: AiActivityRecord[] = tools.map((tool) => {
    const args = tool.args as AiToolPayload;
    const result = tool.result as AiToolPayload | undefined;
    const payload = result ?? args;
    return {
      failed: Boolean(tool.isError || result?.status === "failed"),
      payload,
      preview: result?.preview,
      result,
      targets: payload.targets ?? [],
      tool: tool.toolName as OpenSlideXToolName
    };
  });
  const failed = aiActivityHasUnresolvedFailure(records);
  const recoveredFailures = aiActivityRecoveredFailureCount(records);
  const running = records.some((record) => !record.result);
  const countedRecords = running || failed ? records : records.filter((record) => !record.failed);
  const summary = aiActivitySummaryLabel(countedRecords.map((record) => record.tool), running ? "running" : failed ? "failed" : "complete");
  const runDurationMs = [...records].reverse().find((record) => record.result?.runDurationMs !== undefined)?.result?.runDurationMs;
  const label = [
    !running && !failed && recoveredFailures > 0
      ? `${summary} · ${recoveredFailures} ${recoveredFailures === 1 ? "retry" : "retries"}`
      : summary,
    !running && runDurationMs !== undefined ? aiFormatDuration(runDurationMs) : undefined
  ].filter(Boolean).join(" · ");
  const finalPreview = !running && !failed ? aiFinalSuccessfulPreview(records) : undefined;
  const disclosureId = tools.map((tool) => `${tool.toolName}:${tool.toolCallId}`).join("|");
  const [expanded, setExpanded] = useState(() => expandedActivityGroups.has(disclosureId));

  function toggleExpanded() {
    setExpanded((current) => {
      const next = !current;
      if (next) expandedActivityGroups.add(disclosureId);
      else expandedActivityGroups.delete(disclosureId);
      return next;
    });
  }

  return (
    <section className={`ai-activity-group ${failed ? "is-failed" : running ? "is-running" : "is-complete"}`}>
      <div className={`ai-activity-disclosure ${expanded ? "is-expanded" : ""}`}>
        <button aria-expanded={expanded} className="ai-activity-summary" onClick={toggleExpanded} type="button">
          <span>{failed ? <CircleAlert size={15} /> : running ? <i className="ai-loading-dot" aria-hidden="true" /> : <Check size={15} />}</span>
          <span><strong>Tool output &amp; details</strong><small>{label}</small></span>
          <ChevronDown size={14} />
        </button>
        {expanded ? (
          <div className="ai-activity-details">
            {records.map((record, index) => (
              <article key={`${record.tool}-${index}`}>
                <button disabled={!record.targets[0]} onClick={() => { if (record.targets[0]) onFocusTarget(record.targets[0]); }} type="button">
                  <span><strong>{aiToolDisplayName(record.tool)}</strong><small>{aiTargetLabel(record.targets)}</small></span>
                  {record.targets[0] ? <LocateFixed size={13} /> : null}
                </button>
                <p>{record.failed ? record.result?.message : record.result?.summary ?? record.payload.summary ?? "Waiting for the local tool"}</p>
                {record.payload.details?.length ? <ul>{record.payload.details.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}
              </article>
            ))}
            {finalPreview ? (
              <figure className="ai-final-preview">
                <img
                  alt={`${aiToolDisplayName(finalPreview.tool)} final preview`}
                  src={`/api/v1/ai/tool-preview?runId=${encodeURIComponent(finalPreview.preview.runId)}&toolCallId=${encodeURIComponent(finalPreview.preview.toolCallId)}`}
                />
                <figcaption>
                  <span><ScanSearch size={12} /> Final result · {aiTargetLabel(finalPreview.targets)}</span>
                  {finalPreview.targets[0] ? <button onClick={() => onFocusTarget(finalPreview.targets[0])} type="button">Focus on Canvas</button> : null}
                </figcaption>
              </figure>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function useElapsedClock(active: boolean) {
  const [now, setNow] = useState(monotonicNow);
  useEffect(() => {
    if (!active) return;
    setNow(monotonicNow());
    const timer = globalThis.setInterval(() => setNow(monotonicNow()), 100);
    return () => globalThis.clearInterval(timer);
  }, [active]);
  return now;
}

function monotonicNow() {
  return globalThis.performance?.now() ?? Date.now();
}
