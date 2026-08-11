import { useMemo, useState } from "react";
import type {
  ChatModelAdapter,
  ThreadAssistantMessagePart,
  ThreadMessageLike
} from "@assistant-ui/react";

import type { AssistantCanvasActivity } from "@/core/motion-doc/domain/assistantCanvasActivity";
import {
  appendAiConversationMessage,
  runAiChat,
  runAiChatStream,
  type AiConversationActivity,
  type AiDraft
} from "./api";
import type { AiConversationRuntimeProps } from "./AiChatTypes";
import type { AiRunPhase, AiToolPayload } from "./AiChatView";
import {
  aiRunFailureMessage,
  aiSelectionCanvasTarget,
  aiSelectionLabel,
  aiTransportFailureMessage
} from "./aiChatPresentation";

export function useAiChatAdapter(
  props: AiConversationRuntimeProps,
  onDraftReady: (draft: AiDraft) => void
) {
  const [runPhase, setRunPhase] = useState<AiRunPhase>(null);
  const initialMessages = useMemo<ThreadMessageLike[]>(() => props.thread.messages.map((message) => ({
    content: [
      ...(message.content ? [{ text: message.content, type: "text" as const }] : []),
      ...((message.activities ?? []).map(storedActivityPart))
    ],
    role: message.role
  })), [props.thread.messages]);

  const adapter = useMemo<ChatModelAdapter>(() => ({
    async *run({ abortSignal, messages }) {
      if (props.saveState !== "saved") {
        throw new Error("Wait for the current Canvas changes to finish saving before starting AI.");
      }

      const transcript = messages
        .map((message) => ({
          content: messageText(message.content),
          role: message.role === "user" ? "user" as const : "assistant" as const
        }))
        .filter((message) => message.content);
      const latest = transcript.at(-1)?.content ?? "Improve this presentation.";
      const runSelection = { ...props.selection };
      const phaseActivityId = `assistant-phase-${globalThis.crypto.randomUUID()}`;
      const phaseCreatedAt = new Date().toISOString();
      const phaseTargets = [aiSelectionCanvasTarget(runSelection)];
      const updatePhaseActivity = (
        summary: string,
        status: AssistantCanvasActivity["status"],
        visible = true
      ) => {
        const now = new Date().toISOString();
        props.onActivityChange({
          activity: {
            clientName: props.provider === "codex" ? "Codex" : "Claude",
            createdAt: phaseCreatedAt,
            details: [aiSelectionLabel(runSelection)],
            id: phaseActivityId,
            status,
            summary,
            targets: visible ? phaseTargets : [],
            toolName: "assistant.phase",
            updatedAt: now
          }
        });
      };

      await appendAiConversationMessage(props.thread.id, { content: latest, role: "user" });
      const runStartedAt = monotonicNow();
      setRunPhase({
        label: props.provider === "codex" ? "Local Codex started" : "Preparing a reviewable draft",
        phase: "connecting",
        runStartedAt,
        stepStartedAt: runStartedAt
      });
      updatePhaseActivity(props.provider === "codex" ? "Starting Codex" : "Preparing draft", "running");

      const toolParts: ThreadAssistantMessagePart[] = [];
      const storedActivities = new Map<string, AiConversationActivity>();
      let assistantText = "";
      let runFailed = false;
      const visibleContent = (): ThreadAssistantMessagePart[] => [
        ...(assistantText ? [{ text: assistantText, type: "text" as const }] : []),
        ...toolParts
      ];

      try {
        if (props.provider === "claude") {
          const result = await runAiChat({
            abortSignal,
            expectedRevision: props.expectedRevision,
            messages: transcript.slice(0, -1),
            prompt: latest,
            provider: props.provider,
            selection: runSelection
          });
          if (result.draft) onDraftReady(result.draft);
          assistantText = result.message || "A reviewable draft is ready.";
          updatePhaseActivity("Draft ready for review", "completed");
          yield { content: [{ type: "text", text: assistantText }] };
          return;
        }

        for await (const event of runAiChatStream({
          abortSignal,
          aiMode: props.aiMode,
          expectedRevision: props.expectedRevision,
          messages: transcript.slice(0, -1),
          prompt: latest,
          provider: "codex",
          selection: runSelection
        })) {
          if (event.type === "phase") {
            const stepStartedAt = monotonicNow();
            setRunPhase((current) => ({
              label: event.label,
              phase: event.phase,
              runStartedAt: current?.runStartedAt ?? stepStartedAt,
              stepStartedAt
            }));
            updatePhaseActivity(event.label, "running", toolParts.length === 0);
            continue;
          }
          if (event.type === "text") {
            assistantText += event.delta;
            yield { content: visibleContent() };
            continue;
          }
          if (event.type === "tool.started") {
            updatePhaseActivity(event.summary, "completed", false);
            toolParts.push({
              args: { details: event.details, summary: event.summary, targets: event.targets },
              argsText: JSON.stringify({ summary: event.summary, targets: event.targets }),
              toolCallId: event.toolCallId,
              toolName: event.tool,
              type: "tool-call"
            });
            props.onActivityChange({
              activity: toCanvasActivity(event, "running"),
              ...(event.canvasPreview ? { canvasPreview: event.canvasPreview } : {})
            });
            yield { content: visibleContent() };
            continue;
          }
          if (event.type === "tool.completed" || event.type === "tool.failed") {
            const result: AiToolPayload = event.type === "tool.failed"
              ? { details: event.details, message: event.message, status: "failed", targets: event.targets }
              : {
                  details: event.details,
                  preview: event.preview,
                  status: "completed",
                  summary: event.summary,
                  targets: event.targets
                };
            const index = toolParts.findIndex((part) => (
              part.type === "tool-call" && part.toolCallId === event.toolCallId
            ));
            if (index >= 0 && toolParts[index]?.type === "tool-call") {
              toolParts[index] = {
                ...toolParts[index],
                ...(event.type === "tool.failed" ? { isError: true } : {}),
                result
              } as ThreadAssistantMessagePart;
            }
            storedActivities.set(event.toolCallId, {
              details: event.details,
              id: event.toolCallId,
              ...(event.type === "tool.failed" ? { message: event.message } : {}),
              status: event.type === "tool.failed" ? "failed" : "completed",
              summary: event.type === "tool.failed" ? "SlideX tool failed" : event.summary,
              targets: event.targets,
              tool: event.tool
            });
            props.onActivityChange({
              activity: toCanvasActivity(event, event.type === "tool.failed" ? "failed" : "completed")
            });
            yield { content: visibleContent() };
            continue;
          }
          if (event.type === "run.failed") {
            if (event.code === "cancelled" || abortSignal.aborted) return;
            runFailed = true;
            throw new Error(aiRunFailureMessage(event.code, event.message));
          }
        }

        if (attachRunDuration(toolParts, Math.max(1, monotonicNow() - runStartedAt))) {
          yield { content: visibleContent() };
        }
      } catch (error) {
        if (abortSignal.aborted) return;
        runFailed = true;
        props.onCanvasPreviewClear();
        assistantText = `SlideX could not complete this run: ${aiTransportFailureMessage(error)}`;
        updatePhaseActivity("AI run stopped", "failed");
        yield { content: visibleContent() };
      } finally {
        if (abortSignal.aborted) {
          props.onCanvasPreviewClear();
          updatePhaseActivity("AI run stopped", "failed");
        } else if (props.provider === "codex" && !runFailed) {
          updatePhaseActivity("AI run complete", "completed", false);
        }
        setRunPhase(null);
        if (assistantText || storedActivities.size) {
          await appendAiConversationMessage(props.thread.id, {
            activities: [...storedActivities.values()],
            content: assistantText,
            role: "assistant"
          }).catch(() => undefined);
          props.onConversationUpdated();
        }
      }
    }
  }), [onDraftReady, props]);

  return { adapter, initialMessages, runPhase };
}

function attachRunDuration(parts: ThreadAssistantMessagePart[], runDurationMs: number) {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (!part || part.type !== "tool-call") continue;
    const result = part.result as AiToolPayload | undefined;
    if (result?.status !== "completed") continue;
    parts[index] = { ...part, result: { ...result, runDurationMs } } as ThreadAssistantMessagePart;
    return true;
  }
  return false;
}

function storedActivityPart(activity: AiConversationActivity): ThreadAssistantMessagePart {
  return {
    args: { details: activity.details, summary: activity.summary, targets: activity.targets },
    argsText: JSON.stringify({ summary: activity.summary, targets: activity.targets }),
    ...(activity.status === "failed" ? { isError: true } : {}),
    result: {
      details: activity.details,
      message: activity.message,
      status: activity.status,
      summary: activity.summary,
      targets: activity.targets
    },
    toolCallId: activity.id,
    toolName: activity.tool,
    type: "tool-call"
  };
}

function toCanvasActivity(
  event: Extract<import("../shared/aiEvents").AiRunEvent, { type: "tool.started" | "tool.completed" | "tool.failed" }>,
  status: AssistantCanvasActivity["status"]
): AssistantCanvasActivity {
  const now = new Date().toISOString();
  return {
    clientName: "Codex",
    createdAt: now,
    details: event.details,
    id: event.toolCallId,
    status,
    summary: event.type === "tool.failed" ? event.message : event.summary,
    targets: event.targets,
    toolName: event.tool,
    updatedAt: now
  };
}

function messageText(content: readonly unknown[]) {
  return content.map((part) => {
    if (!part || typeof part !== "object") return "";
    const candidate = part as { text?: unknown; type?: unknown };
    return candidate.type === "text" && typeof candidate.text === "string" ? candidate.text : "";
  }).join("\n").trim();
}

function monotonicNow() {
  return globalThis.performance?.now() ?? Date.now();
}
