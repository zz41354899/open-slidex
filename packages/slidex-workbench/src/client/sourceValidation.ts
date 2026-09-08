import { summarizeMotionDoc } from "@open-slidex/sdk";
import type { ValidationResult } from "./domain";

export function createSourceValidator() {
  let worker: Worker | undefined;
  let started = false;
  let sequence = 0;
  const pending = new Map<number, { source: string; resolve: (value: { validation: ValidationResult; title: string }) => void }>();
  const fallback = (source: string) => {
    try { const summary = summarizeMotionDoc(source); return { validation: summary.validation, title: summary.document.title }; }
    catch (error) { return { validation: { isValid: false, issues: [{ severity: "error" as const, message: String(error) }] }, title: "" }; }
  };
  function initialize() {
    if (started) return;
    started = true;
    try {
      worker = new Worker(new URL("./sourceValidation.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event) => {
        pending.get(event.data.id)?.resolve(event.data);
        pending.delete(event.data.id);
      };
      worker.onerror = () => {
        worker?.terminate();
        worker = undefined;
        for (const item of pending.values()) item.resolve(fallback(item.source));
        pending.clear();
      };
    } catch { /* Environments without workers keep the same validation contract. */ }
  }
  return {
    validate(source: string) {
      initialize();
      if (!worker) return Promise.resolve(fallback(source));
      const id = ++sequence;
      return new Promise<{ validation: ValidationResult; title: string }>((resolve) => {
        pending.set(id, { source, resolve });
        worker!.postMessage({ id, source });
      });
    },
    dispose() {
      started = true;
      worker?.terminate(); worker = undefined;
      for (const item of pending.values()) item.resolve({ validation: { isValid: false, issues: [] }, title: "" });
      pending.clear();
    }
  };
}
