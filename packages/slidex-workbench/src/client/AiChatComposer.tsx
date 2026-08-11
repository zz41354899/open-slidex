import { ComposerPrimitive, ThreadPrimitive, useAuiState } from "@assistant-ui/react";
import { ArrowUp, LocateFixed, Square, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import type { AiMode, AiProvider } from "./api";
import { aiSelectionLabel } from "./aiChatPresentation";
import type { SaveState, Selection } from "./domain";

type AiChatComposerProps = {
  aiMode: AiMode;
  onClearScope: () => void;
  provider: AiProvider;
  providerReady: boolean;
  saveState: SaveState;
  selection: Selection;
};

export function AiChatComposer({
  aiMode,
  onClearScope,
  provider,
  providerReady,
  saveState,
  selection
}: AiChatComposerProps) {
  const running = useAuiState((state) => state.thread.isRunning);
  const [snapshot, setSnapshot] = useState(selection);
  const wasRunning = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (running && !wasRunning.current) setSnapshot(selection);
    if (!running) setSnapshot(selection);
    wasRunning.current = running;
  }, [running, selection]);

  const visibleSelection = running ? snapshot : selection;
  const hasElementScope = visibleSelection.nodeId !== undefined || visibleSelection.blockIndex !== undefined;
  const disabled = saveState !== "saved";
  const disabledReason = saveState === "conflict"
    ? "Resolve the revision conflict before running AI"
    : saveState === "invalid"
      ? "Fix the invalid Canvas draft before running AI"
      : disabled
        ? "Waiting for Canvas changes to save"
        : "";

  function resizeInput() {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(Math.max(input.scrollHeight, 38), 96)}px`;
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !disabled && !running) {
      event.preventDefault();
      event.currentTarget.closest(".ai-composer")
        ?.querySelector<HTMLButtonElement>("[data-ai-composer-send]")
        ?.click();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "." && running) {
      event.preventDefault();
      event.currentTarget.closest(".ai-composer")
        ?.querySelector<HTMLButtonElement>("[data-ai-composer-stop]")
        ?.click();
      return;
    }
    if (event.key === "Escape") event.currentTarget.blur();
  }

  const providerLabel = provider === "codex"
    ? providerReady ? `Codex · ${modeLabel(aiMode)}` : "Codex setup required"
    : "Claude · Draft";

  return (
    <ThreadPrimitive.ViewportFooter className="ai-thread-footer">
      <div className="ai-quick-prompts" aria-label="Quick prompts">
        <ThreadPrimitive.Suggestion method="replace" prompt="Shorten the title and strengthen the opening">Shorten title</ThreadPrimitive.Suggestion>
        <ThreadPrimitive.Suggestion method="replace" prompt="Clarify the message and improve the content hierarchy">Clarify message</ThreadPrimitive.Suggestion>
        <ThreadPrimitive.Suggestion method="replace" prompt="Check this slide for overflow, spacing, and weak contrast">Run visual QA</ThreadPrimitive.Suggestion>
      </div>
      <ComposerPrimitive.Root className="ai-composer">
        {hasElementScope ? (
          <div className="ai-composer-context">
            <LocateFixed size={13} />
            <span>{aiSelectionLabel(visibleSelection)}</span>
            {!running ? (
              <button aria-label="Clear selected element scope" onClick={onClearScope} type="button">
                <X size={12} />
              </button>
            ) : null}
          </div>
        ) : null}
        <ComposerPrimitive.Input
          aria-label="Message SlideX AI"
          autoFocus
          data-ai-composer-input
          disabled={disabled}
          onInput={resizeInput}
          onKeyDown={onKeyDown}
          placeholder={disabled ? disabledReason : "Describe the next change…"}
          ref={inputRef}
          rows={1}
        />
        <div className="ai-composer-meta">
          <span><i className={providerReady ? "is-ready" : ""} />{providerLabel}</span>
          <span className="ai-composer-actions">
            <kbd>{running ? "⌘ ." : "⌘ ↵"}</kbd>
            <ComposerAction disabled={disabled} />
          </span>
        </div>
        {disabledReason ? <span className="ai-composer-disabled-reason" role="status">{disabledReason}</span> : null}
      </ComposerPrimitive.Root>
    </ThreadPrimitive.ViewportFooter>
  );
}

function ComposerAction({ disabled }: { disabled: boolean }) {
  const running = useAuiState((state) => state.thread.isRunning);
  return running ? (
    <ComposerPrimitive.Cancel aria-label="Stop generation" className="ai-send-button" data-ai-composer-stop>
      <Square size={12} />
    </ComposerPrimitive.Cancel>
  ) : (
    <ComposerPrimitive.Send aria-label="Send message" className="ai-send-button" data-ai-composer-send disabled={disabled}>
      <ArrowUp size={14} />
    </ComposerPrimitive.Send>
  );
}

function modeLabel(mode: AiMode) {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}
