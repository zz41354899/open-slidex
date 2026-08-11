import { LocateFixed, X } from "lucide-react";

import type { AiProvider } from "./api";
import { aiSelectionLabel } from "./aiChatPresentation";
import type { Selection } from "./domain";

type AiChatContextProps = {
  onClearScope: () => void;
  onFocus: () => void;
  provider: AiProvider;
  providerReady: boolean;
  selection: Selection;
};

export function AiChatContext({
  onClearScope,
  onFocus,
  provider,
  providerReady,
  selection
}: AiChatContextProps) {
  const hasElementScope = selection.nodeId !== undefined || selection.blockIndex !== undefined;

  return (
    <div className="ai-context-stack">
      <section className="ai-canvas-context" aria-label="Canvas context">
        <div>
          <span><LocateFixed size={13} /></span>
          <div>
            <small>Canvas context</small>
            <strong>{aiSelectionLabel(selection)}</strong>
            <span>{provider === "codex" ? "Local Codex · revision-safe editing" : "Claude · reviewable draft"}</span>
          </div>
        </div>
        <div>
          <span aria-hidden="true" className={`ai-context-live ${providerReady ? "is-ready" : ""}`}><i /></span>
          <button aria-label="Focus Canvas" className="ai-focus-canvas" onClick={onFocus} type="button">
            Focus Canvas
          </button>
          {hasElementScope ? (
            <button aria-label="Clear selected element context" onClick={onClearScope} type="button">
              <X size={12} />
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
