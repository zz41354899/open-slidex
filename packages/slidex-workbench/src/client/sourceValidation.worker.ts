import { summarizeMotionDoc } from "@open-slidex/sdk";

self.onmessage = (event: MessageEvent<{ id: number; source: string }>) => {
  const { id, source } = event.data;
  try {
    const summary = summarizeMotionDoc(source);
    self.postMessage({ id, validation: summary.validation, title: summary.document.title });
  } catch (error) {
    self.postMessage({ id, validation: { isValid: false, issues: [{ severity: "error", message: String(error) }] }, title: "" });
  }
};
