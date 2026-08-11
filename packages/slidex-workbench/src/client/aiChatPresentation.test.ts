import assert from "node:assert/strict";
import test from "node:test";

import { activeAssistantActivities, aiActivityHasUnresolvedFailure, aiActivityRecoveredFailureCount, aiActivitySummaryLabel, aiCompletedEditFocusTarget, aiFinalSuccessfulPreview, aiFormatDuration, aiRunFailureMessage, aiRunningFocusTarget, aiSelectionCanvasTarget, aiSelectionLabel, aiTargetLabel, aiToolDisplayName, aiTransportFailureMessage, aiWarmStateLabel } from "./aiChatPresentation";

test("AI chat presentation labels keep Canvas context readable", () => {
  assert.equal(aiSelectionLabel({ slideIndex: 0 }), "Slide 1");
  assert.equal(aiSelectionLabel({ blockIndex: 2, blockLabel: "Title selected", nodeId: "hero-title", slideIndex: 1 }), "Slide 2 · Title selected");
  assert.equal(aiSelectionLabel({ blockIndex: 2, nodeId: "hero-title", slideIndex: 1 }), "Slide 2 · selected element");
  assert.equal(aiTargetLabel([{ kind: "block", nodeId: "hero-title", slideIndex: 0 }]), "Slide 1 · selected element");
  assert.equal(aiTargetLabel([{ kind: "slide", slideIndex: 2 }, { kind: "block", slideIndex: 2 }]), "Slide 3 · +1 targets");
});

test("AI chat presentation labels expose public status without provider internals", () => {
  assert.equal(aiToolDisplayName("open_slidex_validate"), "Validate document");
  assert.equal(aiToolDisplayName("open_slidex_quality_check"), "Check visual quality");
  assert.equal(aiWarmStateLabel("warming", undefined), "Starting local AI");
  assert.equal(aiWarmStateLabel("ready", { authenticated: true, available: true, detail: "App Server ready", label: "Codex", provider: "codex" }), "App Server ready");
  assert.equal(aiWarmStateLabel("offline", undefined), "Local AI setup required");
  assert.equal(aiRunFailureMessage("app_server_error", "Fatal internal transport details"), "Local Codex could not start. Check SlideX AI setup and try again.");
  assert.equal(aiRunFailureMessage("revision_conflict", "raw conflict"), "The presentation changed. Reload the Canvas, then try again.");
  assert.equal(aiRunFailureMessage("stream_error", "Short internal transport detail"), "The local AI run could not be completed.");
});

test("AI transport failures explain interrupted local streams without an unsafe automatic retry", () => {
  assert.equal(
    aiTransportFailureMessage(new TypeError("network error")),
    "The local Workbench connection was interrupted. The run was stopped to avoid duplicate edits; reload OpenSlideX and try again."
  );
  assert.equal(aiTransportFailureMessage(new Error("Custom failure")), "Custom failure");
});

test("AI run presentation formats duration and selects only the last successful preview", () => {
  const first = { failed: false, preview: { kind: "image" as const, runId: "run-1", toolCallId: "tool-1" } };
  const failed = { failed: true, preview: { kind: "image" as const, runId: "run-1", toolCallId: "tool-2" } };
  const last = { failed: false, preview: { kind: "image" as const, runId: "run-1", toolCallId: "tool-3" } };
  assert.equal(aiFormatDuration(12_345), "12.3 s");
  assert.equal(aiFinalSuccessfulPreview([first, failed, last]), last);
  assert.equal(aiFinalSuccessfulPreview([{ failed: false }, failed]), undefined);
});

test("AI activity summaries distinguish edits from read-only checks", () => {
  assert.equal(aiActivitySummaryLabel(["open_slidex_inspect"], "complete"), "1 check completed");
  assert.equal(aiActivitySummaryLabel(["open_slidex_open", "open_slidex_inspect"], "complete"), "2 checks completed");
  assert.equal(aiActivitySummaryLabel(["open_slidex_open", "open_slidex_edit", "open_slidex_validate"], "complete"), "1 change applied");
  assert.equal(aiActivitySummaryLabel(["open_slidex_edit"], "running"), "1 step in progress");
  assert.equal(aiActivitySummaryLabel(["open_slidex_edit"], "failed"), "1 step needs attention");
});

test("AI activity failures clear when the same tool succeeds on retry", () => {
  assert.equal(aiActivityHasUnresolvedFailure([
    { failed: true, tool: "open_slidex_edit" },
    { failed: false, tool: "open_slidex_edit" },
    { failed: false, tool: "open_slidex_render" }
  ]), false);
  assert.equal(aiActivityHasUnresolvedFailure([
    { failed: true, tool: "open_slidex_render" },
    { failed: false, tool: "open_slidex_quality_check" }
  ]), true);
  assert.equal(aiActivityRecoveredFailureCount([
    { failed: true, tool: "open_slidex_edit" },
    { failed: false, tool: "open_slidex_edit" },
    { failed: false, tool: "open_slidex_render" }
  ]), 1);
});

test("a completed edit focuses its first concrete Canvas target", () => {
  assert.deepEqual(aiCompletedEditFocusTarget({
    clientName: "Codex",
    createdAt: "2026-08-09T00:00:00.000Z",
    details: [],
    id: "edit-1",
    status: "completed",
    summary: "Updated slide",
    targets: [{ kind: "presentation" }, { kind: "slide", slideIndex: 2 }],
    toolName: "open_slidex_edit",
    updatedAt: "2026-08-09T00:00:01.000Z"
  }), { kind: "slide", slideIndex: 2 });
});

test("running inspect, edit, and render activities focus a concrete target", () => {
  const base = {
    clientName: "Codex",
    createdAt: "2026-08-09T00:00:00.000Z",
    details: [],
    id: "run-1",
    status: "running" as const,
    summary: "Inspecting slide",
    targets: [{ kind: "block" as const, nodeId: "hero-title", slideIndex: 1 }],
    updatedAt: "2026-08-09T00:00:01.000Z"
  };
  assert.deepEqual(aiRunningFocusTarget({ ...base, toolName: "open_slidex_inspect" }), base.targets[0]);
  assert.equal(aiRunningFocusTarget({ ...base, toolName: "open_slidex_validate" }), undefined);
});

test("a frozen selection becomes a storage-neutral Canvas target", () => {
  assert.deepEqual(aiSelectionCanvasTarget({ slideIndex: 2 }), { kind: "slide", slideIndex: 2 });
  assert.deepEqual(aiSelectionCanvasTarget({ blockIndex: 1, nodeId: "title", slideIndex: 0 }), {
    blockIndex: 1,
    kind: "block",
    nodeId: "title",
    slideIndex: 0
  });
});

test("Local Canvas keeps only running AI activities", () => {
  const running = {
    clientName: "Codex",
    createdAt: "2026-08-09T00:00:00.000Z",
    details: [],
    id: "activity-1",
    status: "running" as const,
    summary: "Editing",
    targets: [{ kind: "slide" as const, slideIndex: 0 }],
    toolName: "open_slidex_edit",
    updatedAt: "2026-08-09T00:00:01.000Z"
  };

  assert.deepEqual(activeAssistantActivities([], running), [running]);
  assert.deepEqual(activeAssistantActivities([running], { ...running, status: "completed" }), []);
  assert.deepEqual(activeAssistantActivities([running], { ...running, status: "failed" }), []);
});
