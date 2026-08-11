import type { AssistantCanvasTarget } from "@/core/motion-doc/domain/assistantCanvasActivity";

import type { AiCanvasActivityUpdate } from "./useAiCanvasPreview";
import type { AiConversationThread, AiMode, AiProvider } from "./api";
import type { SaveState, Selection } from "./domain";

export type AiChatPanelProps = {
  expectedRevision: string;
  onActivityChange: (update: AiCanvasActivityUpdate) => void;
  onApplied: () => Promise<unknown>;
  onCanvasPreviewClear: () => void;
  onClearScope: () => void;
  onClose: () => void;
  onConnect: () => void;
  onFocusTarget: (target: AssistantCanvasTarget) => void;
  projectName: string;
  saveState: SaveState;
  selection: Selection;
};

export type AiConversationRuntimeProps = AiChatPanelProps & {
  aiMode: AiMode;
  onConversationUpdated: () => void;
  provider: AiProvider;
  providerReady: boolean;
  thread: AiConversationThread;
};
