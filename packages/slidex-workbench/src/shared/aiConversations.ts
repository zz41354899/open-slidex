import type { AssistantCanvasTarget } from "@/core/motion-doc/domain/assistantCanvasActivity";
import type { OpenSlideXToolName } from "./aiEvents";

export type AiConversationProvider = "claude" | "codex";
export type AiConversationActivity = {
  details: string[];
  id: string;
  message?: string;
  status: "completed" | "failed";
  summary: string;
  targets: AssistantCanvasTarget[];
  tool: OpenSlideXToolName;
};
export type AiConversationMessage = {
  activities?: AiConversationActivity[];
  content: string;
  createdAt: string;
  id: string;
  role: "assistant" | "user";
};
export type AiConversationThread = {
  createdAt: string;
  id: string;
  messages: AiConversationMessage[];
  provider: AiConversationProvider;
  title: string;
  updatedAt: string;
};
export type AiConversationDocument = {
  threads: AiConversationThread[];
  version: 1;
};
