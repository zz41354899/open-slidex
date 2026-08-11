import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AssistantCanvasActivity, AssistantCanvasTrace } from "@/core/motion-doc/domain/assistantCanvasActivity";
import type { CanvasEditPreviewPlan } from "../shared/aiEvents";
import {
  buildAiCanvasPreviewSequence,
  compactAiCanvasPreviewForReducedMotion,
  type AiCanvasPreviewSequence
} from "./aiCanvasPreview";

export type AiCanvasActivityUpdate = {
  activity: AssistantCanvasActivity;
  canvasPreview?: CanvasEditPreviewPlan;
};

type ActivePreview = {
  index: number;
  sequence: AiCanvasPreviewSequence;
  status: AssistantCanvasActivity["status"];
  toolCallId: string;
};

export function useAiCanvasPreview(source: string, revision: string) {
  const [active, setActive] = useState<ActivePreview | null>(null);
  const activeRef = useRef<ActivePreview | null>(null);
  const timersRef = useRef<number[]>([]);
  const terminalStatusRef = useRef<"completed" | null>(null);

  const replaceActive = useCallback((next: ActivePreview | null) => {
    activeRef.current = next;
    setActive(next);
  }, []);

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
  }, []);

  const clear = useCallback(() => {
    clearTimers();
    terminalStatusRef.current = null;
    replaceActive(null);
  }, [clearTimers, replaceActive]);

  const scheduleClear = useCallback((delay: number) => {
    timersRef.current.push(window.setTimeout(clear, delay));
  }, [clear]);

  const settleCompleted = useCallback((current: ActivePreview) => {
    const next = { ...current, status: "completed" as const };
    replaceActive(next);
    scheduleClear(720);
  }, [replaceActive, scheduleClear]);

  const start = useCallback((activity: AssistantCanvasActivity, plan: CanvasEditPreviewPlan) => {
    const builtSequence = buildAiCanvasPreviewSequence(source, revision, plan, activity.id);
    if (!builtSequence) return false;
    const sequence = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? compactAiCanvasPreviewForReducedMotion(builtSequence)
      : builtSequence;
    clearTimers();
    terminalStatusRef.current = null;
    const initial: ActivePreview = {
      index: 0,
      sequence,
      status: "running",
      toolCallId: activity.id
    };
    replaceActive(initial);
    for (let index = 1; index < sequence.steps.length; index += 1) {
      timersRef.current.push(window.setTimeout(() => {
        const current = activeRef.current;
        if (!current || current.toolCallId !== activity.id || current.status !== "running") return;
        const next = { ...current, index };
        if (index === sequence.steps.length - 1 && terminalStatusRef.current === "completed") {
          settleCompleted(next);
          return;
        }
        replaceActive(next);
      }, index * sequence.intervalMs));
    }
    return true;
  }, [clearTimers, replaceActive, revision, settleCompleted, source]);

  const finish = useCallback((toolCallId: string, status: "completed" | "failed") => {
    const current = activeRef.current;
    if (!current || current.toolCallId !== toolCallId) return;
    if (status === "failed") {
      clearTimers();
      terminalStatusRef.current = null;
      replaceActive({ ...current, status: "failed" });
      scheduleClear(900);
      return;
    }
    terminalStatusRef.current = "completed";
    if (current.index === current.sequence.steps.length - 1) settleCompleted(current);
  }, [clearTimers, replaceActive, scheduleClear, settleCompleted]);

  useEffect(() => clear, [clear]);

  const step = active?.sequence.steps[active.index];
  const trace = useMemo<AssistantCanvasTrace | undefined>(() => step ? {
    ...step.trace,
    status: active?.status ?? "running"
  } : undefined, [active?.status, step]);

  return {
    clear,
    displaySource: active?.status === "failed" ? source : step?.source ?? source,
    finish,
    isActive: active !== null,
    start,
    trace
  };
}
