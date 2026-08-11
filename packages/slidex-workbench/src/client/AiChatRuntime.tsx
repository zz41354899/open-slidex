import {
  AssistantRuntimeProvider,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  useLocalRuntime,
  type ThreadAssistantMessagePart
} from "@assistant-ui/react";
import { Check, CircleAlert, Sparkles } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";

import type { AssistantCanvasTarget } from "@/core/motion-doc/domain/assistantCanvasActivity";
import { applyAiDraft, type AiDraft } from "./api";
import { AiChatComposer } from "./AiChatComposer";
import type { AiConversationRuntimeProps } from "./AiChatTypes";
import { AiActivityGroup, AiRunStatus, type AiRunPhase, type AiToolCallPart } from "./AiChatView";
import { aiSelectionLabel } from "./aiChatPresentation";
import slidexXMark from "./assets/slidex-x-mark.png";
import { useAiChatAdapter } from "./useAiChatAdapter";

const slidexXMarkUrl = slidexXMark;
const ToolInteractionContext = createContext<(target: AssistantCanvasTarget) => void>(() => undefined);
const RunPresentationContext = createContext<{
  phase: AiRunPhase;
  provider: "claude" | "codex";
  targetLabel: string;
}>({ phase: null, provider: "codex", targetLabel: "Current Canvas" });

export function AiChatRuntime(props: AiConversationRuntimeProps) {
  const [draft, setDraft] = useState<AiDraft>();
  const [applyState, setApplyState] = useState<"idle" | "applying" | "applied" | "error">("idle");
  const [applyError, setApplyError] = useState("");
  const onDraftReady = useCallback((nextDraft: AiDraft) => {
    setDraft(nextDraft);
    setApplyState("idle");
    setApplyError("");
  }, []);
  const { adapter, initialMessages, runPhase } = useAiChatAdapter(props, onDraftReady);
  const runtime = useLocalRuntime(adapter, { initialMessages });

  async function applyDraft() {
    if (!draft) return;
    setApplyState("applying");
    setApplyError("");
    try {
      await applyAiDraft(draft.id, props.expectedRevision);
      setApplyState("applied");
      await props.onApplied();
    } catch (error) {
      setApplyState("error");
      setApplyError(error instanceof Error ? error.message : "The draft could not be applied.");
    }
  }

  return (
    <ToolInteractionContext.Provider value={props.onFocusTarget}>
      <RunPresentationContext.Provider value={{
        phase: runPhase,
        provider: props.provider,
        targetLabel: aiSelectionLabel(props.selection)
      }}>
        <AssistantRuntimeProvider runtime={runtime}>
          <ThreadPrimitive.Root className="ai-thread">
            <ThreadPrimitive.Viewport className="ai-thread-viewport">
              <ThreadPrimitive.Empty><AiChatEmptyState provider={props.provider} /></ThreadPrimitive.Empty>
              <ThreadPrimitive.Messages components={{ Message: AiMessage }} />
              {draft ? (
                <AiDraftCard applyError={applyError} applyState={applyState} draft={draft} onApply={applyDraft} />
              ) : null}
              <AiChatComposer
                aiMode={props.aiMode}
                onClearScope={props.onClearScope}
                provider={props.provider}
                providerReady={props.providerReady}
                saveState={props.saveState}
                selection={props.selection}
              />
            </ThreadPrimitive.Viewport>
          </ThreadPrimitive.Root>
        </AssistantRuntimeProvider>
      </RunPresentationContext.Provider>
    </ToolInteractionContext.Provider>
  );
}

function AiChatEmptyState({ provider }: { provider: "claude" | "codex" }) {
  return (
    <section className="ai-welcome">
      <div className="ai-welcome-eyebrow">
        <span className="ai-welcome-mark"><img alt="" src={slidexXMarkUrl} /></span>
        <span>Canvas-aware assistant</span>
      </div>
      <div className="ai-welcome-copy">
        <h2>What should we improve?</h2>
        <p>
          {provider === "codex"
            ? "Describe the outcome. SlideX reads the current Canvas, shows every real step, and keeps you in control."
            : "Describe the outcome. Claude prepares a validated draft for review before anything is applied."}
        </p>
      </div>
      <div className="ai-suggestions">
        <ThreadPrimitive.Suggestion method="replace" prompt="Refine this slide's hierarchy and spacing">
          <span><Sparkles size={14} /><strong>Refine this slide</strong></span><small>Hierarchy, rhythm, and spacing</small>
        </ThreadPrimitive.Suggestion>
        <ThreadPrimitive.Suggestion method="replace" prompt="Create a concise story for this presentation">
          <span><Sparkles size={14} /><strong>Improve the narrative</strong></span><small>Sharper flow across the deck</small>
        </ThreadPrimitive.Suggestion>
        <ThreadPrimitive.Suggestion method="replace" prompt="Check the whole deck for overflow and weak contrast">
          <span><Sparkles size={14} /><strong>Inspect presentation</strong></span><small>Overflow, contrast, and consistency</small>
        </ThreadPrimitive.Suggestion>
      </div>
    </section>
  );
}

function AiMessage() {
  const focus = useContext(ToolInteractionContext);
  const runPresentation = useContext(RunPresentationContext);
  const role = useAuiState((state) => state.message.role);
  const isLast = useAuiState((state) => state.message.isLast);
  const running = useAuiState((state) => state.thread.isRunning);
  const content = useAuiState((state) => state.message.content) as ThreadAssistantMessagePart[];
  const tools = content.filter(isToolCallPart);

  return (
    <MessagePrimitive.Root className={`ai-message ai-message-${role}`}>
      <span className="ai-message-author">
        {role === "user" ? "You" : "SlideX AI"}
      </span>
      <div className="ai-message-content">
        <MessagePrimitive.Parts components={{ Text: AiTextPart, tools: { Fallback: HiddenToolPart } }} />
        {role === "assistant" && isLast && running ? (
          <AiRunStatus
            phase={runPresentation.phase}
            provider={runPresentation.provider}
            targetLabel={runPresentation.targetLabel}
          />
        ) : null}
        {tools.length ? <AiActivityGroup onFocusTarget={focus} tools={tools} /> : null}
      </div>
    </MessagePrimitive.Root>
  );
}

function AiDraftCard({
  applyError,
  applyState,
  draft,
  onApply
}: {
  applyError: string;
  applyState: "idle" | "applying" | "applied" | "error";
  draft: AiDraft;
  onApply: () => Promise<void>;
}) {
  return (
    <section className="ai-draft-card">
      <div className="ai-draft-heading">
        <span className={draft.validation.isValid ? "draft-valid" : "draft-invalid"}>
          {draft.validation.isValid ? <Check size={13} /> : <CircleAlert size={13} />}
        </span>
        <div>
          <strong>{draft.validation.isValid ? "Draft passed validation" : "Draft needs revision"}</strong>
          <span>{draft.validation.issues.length} validation issues · presentation unchanged</span>
        </div>
      </div>
      {draft.montage ? (
        <img alt="AI draft slide montage" src={`/api/v1/ai/draft-image?id=${encodeURIComponent(draft.id)}`} />
      ) : null}
      <div className="ai-draft-actions">
        <button
          className="apply-draft"
          disabled={!draft.validation.isValid || applyState === "applying" || applyState === "applied"}
          onClick={() => void onApply()}
          type="button"
        >
          {applyState === "applying" ? null : <Check size={13} />}
          {applyState === "applied" ? "Confirmed and applied" : applyState === "applying" ? "Confirming…" : "Confirm & apply"}
        </button>
      </div>
      {applyError ? <p className="ai-inline-error">{applyError}</p> : null}
    </section>
  );
}

function AiTextPart() {
  return <MessagePartPrimitive.Text />;
}

function HiddenToolPart() {
  return null;
}

function isToolCallPart(part: ThreadAssistantMessagePart): part is AiToolCallPart {
  return part.type === "tool-call";
}
