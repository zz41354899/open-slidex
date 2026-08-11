import type { AssistantCanvasTarget } from "@/core/motion-doc/domain/assistantCanvasActivity";

export type CanvasEditPreviewPlan = {
  commands: Array<Record<string, unknown>>;
  expectedRevision: string;
  kind: "edit-commands";
};

export const openSlideXToolNames = [
  "open_slidex_open",
  "open_slidex_inspect",
  "open_slidex_catalog",
  "open_slidex_knowledge_search",
  "open_slidex_skill_read",
  "open_slidex_template_read",
  "open_slidex_image_search",
  "open_slidex_image_import",
  "open_slidex_validate",
  "open_slidex_render",
  "open_slidex_quality_check",
  "open_slidex_asset_import",
  "open_slidex_edit"
] as const;

export type OpenSlideXToolName = (typeof openSlideXToolNames)[number];

export type ToolPreviewRef = {
  kind: "image";
  runId: string;
  toolCallId: string;
};

export type AiRunEvent =
  | {
      label: string;
      phase: "connecting" | "reading" | "working";
      runId: string;
      type: "phase";
    }
  | { delta: string; runId: string; type: "text" }
  | {
      canvasPreview?: CanvasEditPreviewPlan;
      runId: string;
      summary: string;
      details: string[];
      targets: AssistantCanvasTarget[];
      tool: OpenSlideXToolName;
      toolCallId: string;
      type: "tool.started";
    }
  | {
      preview?: ToolPreviewRef;
      runId: string;
      summary: string;
      details: string[];
      targets: AssistantCanvasTarget[];
      tool: OpenSlideXToolName;
      toolCallId: string;
      type: "tool.completed";
    }
  | {
      message: string;
      runId: string;
      details: string[];
      targets: AssistantCanvasTarget[];
      tool: OpenSlideXToolName;
      toolCallId: string;
      type: "tool.failed";
    }
  | { runId: string; type: "run.completed" }
  | { code: string; message: string; runId: string; type: "run.failed" };

export function isOpenSlideXToolName(value: unknown): value is OpenSlideXToolName {
  return typeof value === "string" && openSlideXToolNames.includes(value as OpenSlideXToolName);
}

export function isAiRunEvent(value: unknown): value is AiRunEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  if (typeof event.runId !== "string" || typeof event.type !== "string") return false;
  if (event.type === "run.completed") return true;
  if (event.type === "run.failed") return typeof event.code === "string" && typeof event.message === "string";
  if (event.type === "text") return typeof event.delta === "string";
  if (event.type === "phase") {
    return ["connecting", "reading", "working"].includes(String(event.phase)) && typeof event.label === "string";
  }
  if (!["tool.started", "tool.completed", "tool.failed"].includes(event.type)) return false;
  if (!isOpenSlideXToolName(event.tool) || typeof event.toolCallId !== "string") return false;
  if (!Array.isArray(event.details) || !event.details.every((detail) => typeof detail === "string")) return false;
  if (!Array.isArray(event.targets) || !event.targets.every(isAssistantCanvasTarget)) return false;
  if (event.canvasPreview !== undefined && !isCanvasEditPreviewPlan(event.canvasPreview)) return false;
  return event.type === "tool.failed" ? typeof event.message === "string" : typeof event.summary === "string";
}

function isCanvasEditPreviewPlan(value: unknown): value is CanvasEditPreviewPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Record<string, unknown>;
  return plan.kind === "edit-commands" &&
    typeof plan.expectedRevision === "string" &&
    plan.expectedRevision.startsWith("sha256:") &&
    Array.isArray(plan.commands) &&
    plan.commands.length > 0 &&
    plan.commands.length <= 100 &&
    plan.commands.every((command) => Boolean(command) && typeof command === "object" && typeof (command as Record<string, unknown>).type === "string");
}

function isAssistantCanvasTarget(value: unknown): value is AssistantCanvasTarget {
  if (!value || typeof value !== "object") return false;
  const target = value as Record<string, unknown>;
  if (target.kind === "presentation") return true;
  if (target.kind === "slide") return Number.isInteger(target.slideIndex) && Number(target.slideIndex) >= 0;
  return target.kind === "block" &&
    Number.isInteger(target.slideIndex) && Number(target.slideIndex) >= 0 &&
    (target.nodeId === undefined || typeof target.nodeId === "string") &&
    (target.blockIndex === undefined || Number.isInteger(target.blockIndex));
}
