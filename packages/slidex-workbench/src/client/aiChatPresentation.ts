import type { AssistantCanvasActivity, AssistantCanvasTarget } from "@/core/motion-doc/domain/assistantCanvasActivity";
import type { AiProviderStatus, OpenSlideXToolName, ToolPreviewRef } from "./api";
import type { Selection } from "./domain";

export function aiSelectionLabel(selection: Selection) {
  const selected = selection.nodeId || selection.blockIndex !== undefined;
  return `Slide ${selection.slideIndex + 1}${selected ? ` · ${selection.blockLabel ?? "selected element"}` : ""}`;
}

export function aiTargetLabel(targets: readonly AssistantCanvasTarget[]) {
  const target = targets[0];
  if (!target) return "SlideX tool";
  if (target.kind === "presentation") return "Whole presentation";
  return `Slide ${target.slideIndex + 1}${target.kind === "block" ? " · selected element" : ""}${targets.length > 1 ? ` · +${targets.length - 1} targets` : ""}`;
}

export function aiToolDisplayName(tool: OpenSlideXToolName) {
  return ({
    open_slidex_asset_import: "Import image asset",
    open_slidex_catalog: "Read component catalog",
    open_slidex_image_import: "Import trusted image",
    open_slidex_image_search: "Search trusted images",
    open_slidex_edit: "Update presentation",
    open_slidex_inspect: "Inspect slide",
    open_slidex_knowledge_search: "Search local knowledge",
    open_slidex_open: "Read presentation",
    open_slidex_quality_check: "Check visual quality",
    open_slidex_render: "Render preview",
    open_slidex_skill_read: "Load project guidance",
    open_slidex_template_read: "Read template MDX",
    open_slidex_validate: "Validate document"
  } satisfies Record<OpenSlideXToolName, string>)[tool] ?? "SlideX tool";
}

export function aiActivitySummaryLabel(
  tools: readonly OpenSlideXToolName[],
  state: "complete" | "failed" | "running"
) {
  const count = tools.length;
  if (state === "running") return `${count} ${count === 1 ? "step" : "steps"} in progress`;
  if (state === "failed") return `${count} ${count === 1 ? "step needs" : "steps need"} attention`;
  const changes = tools.filter((tool) => tool === "open_slidex_edit" || tool === "open_slidex_asset_import" || tool === "open_slidex_image_import").length;
  return changes
    ? `${changes} ${changes === 1 ? "change" : "changes"} applied`
    : `${count} ${count === 1 ? "check" : "checks"} completed`;
}

export function aiActivityHasUnresolvedFailure(
  records: readonly { failed: boolean; tool: OpenSlideXToolName }[]
) {
  return records.some((record, index) => {
    if (!record.failed) return false;
    return !records.slice(index + 1).some((candidate) => (
      candidate.tool === record.tool && !candidate.failed
    ));
  });
}

export function aiActivityRecoveredFailureCount(
  records: readonly { failed: boolean; tool: OpenSlideXToolName }[]
) {
  return records.filter((record, index) => (
    record.failed && records.slice(index + 1).some((candidate) => (
      candidate.tool === record.tool && !candidate.failed
    ))
  )).length;
}

export function aiCompletedEditFocusTarget(activity: AssistantCanvasActivity) {
  if (activity.status !== "completed" || activity.toolName !== "open_slidex_edit") return undefined;
  return activity.targets.find((target) => target.kind !== "presentation");
}

export function aiRunningFocusTarget(activity: AssistantCanvasActivity) {
  if (activity.status !== "running" || !["open_slidex_edit", "open_slidex_inspect", "open_slidex_render", "open_slidex_quality_check"].includes(activity.toolName)) {
    return undefined;
  }
  return activity.targets.find((target) => target.kind !== "presentation");
}

export function activeAssistantActivities(
  current: readonly AssistantCanvasActivity[],
  activity: AssistantCanvasActivity,
  limit = 16
) {
  const withoutCurrent = current.filter((candidate) => candidate.id !== activity.id);
  if (activity.status !== "running") return withoutCurrent;
  return [...withoutCurrent, activity].slice(-limit);
}

export function aiSelectionCanvasTarget(selection: Selection): AssistantCanvasTarget {
  if (selection.nodeId !== undefined || selection.blockIndex !== undefined) {
    return {
      ...(selection.blockIndex === undefined ? {} : { blockIndex: selection.blockIndex }),
      kind: "block",
      ...(selection.nodeId ? { nodeId: selection.nodeId } : {}),
      slideIndex: selection.slideIndex
    };
  }
  return { kind: "slide", slideIndex: selection.slideIndex };
}

export function aiWarmStateLabel(
  state: "warming" | "ready" | "offline",
  status: AiProviderStatus | undefined
) {
  if (state === "warming") return "Starting local AI";
  if (state === "ready") return status?.detail ?? "Local AI ready";
  return status?.detail ?? "Local AI setup required";
}

export function aiRunFailureMessage(code: string, fallback: string) {
  void fallback;
  if (code === "revision_conflict") return "The presentation changed. Reload the Canvas, then try again.";
  if (code === "timeout") return "Codex took too long and was stopped.";
  if (code === "tool_not_allowed") return "SlideX stopped a tool outside this project's allowlist.";
  if (code === "app_server_error") return "Local Codex could not start. Check SlideX AI setup and try again.";
  if (code === "codex_failed") return "Codex could not complete this run. Try again or start a new conversation.";
  return "The local AI run could not be completed.";
}

export function aiTransportFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "The local AI run failed.";
  if (/network error|failed to fetch|load failed|networkerror/i.test(message)) {
    return "The local Workbench connection was interrupted. The run was stopped to avoid duplicate edits; reload OpenSlideX and try again.";
  }
  return message;
}

export function aiFormatDuration(value: number) {
  return `${(Math.max(0, value) / 1_000).toFixed(1)} s`;
}

export function aiFinalSuccessfulPreview<T extends {
  failed: boolean;
  preview?: ToolPreviewRef;
}>(records: readonly T[]): (T & { preview: ToolPreviewRef }) | undefined {
  return [...records].reverse().find((record) => !record.failed && record.preview) as (T & { preview: ToolPreviewRef }) | undefined;
}
