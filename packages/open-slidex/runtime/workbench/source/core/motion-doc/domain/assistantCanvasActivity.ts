import type { MotionDocFrame } from "@/core/motion-doc/domain/frame";

export type AssistantCanvasTarget =
  | { kind: "presentation" }
  | { kind: "slide"; slideIndex: number }
  | {
      blockIndex?: number;
      kind: "block";
      nodeId?: string;
      slideIndex: number;
    };

export type AssistantCanvasActivityStatus = "completed" | "failed" | "running";

/**
 * Storage-neutral, public activity state for a presentation assistant.
 * It intentionally contains no provider transcript or model reasoning.
 */
export type AssistantCanvasActivity = {
  clientName: string;
  createdAt: string;
  details: readonly string[];
  errorCode?: string;
  id: string;
  status: AssistantCanvasActivityStatus;
  summary: string;
  targets: readonly AssistantCanvasTarget[];
  toolName: string;
  updatedAt: string;
};

/**
 * Ephemeral visual state for a local assistant preview. It is never persisted
 * with the presentation or conversation history.
 */
export type AssistantCanvasTrace = {
  frame?: MotionDocFrame;
  gesture?: "move" | "press" | "settle";
  id: string;
  label: string;
  status: AssistantCanvasActivityStatus;
  target: AssistantCanvasTarget;
};
