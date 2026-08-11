import assert from "node:assert/strict";
import test from "node:test";

import { parseAiSseFrame } from "../client/api";
import type { AiRunEvent } from "../shared/aiEvents";
import { encodeAiSseEvent } from "./http";

test("AI SSE encoding round-trips a typed event", () => {
  const event: AiRunEvent = {
    canvasPreview: {
      commands: [{ nodeId: "hero", slideIndex: 1, text: "Updated", type: "block.update" }],
      expectedRevision: "sha256:fixture",
      kind: "edit-commands"
    },
    details: ["block.update · slide 2 · node hero"],
    runId: "00000000-0000-4000-8000-000000000001",
    summary: "Applying one revision-safe edit",
    targets: [{ kind: "block", nodeId: "hero", slideIndex: 1 }],
    tool: "open_slidex_edit",
    toolCallId: "tool-1",
    type: "tool.started"
  };

  assert.deepEqual(parseAiSseFrame(encodeAiSseEvent(event).trim()), event);
});

test("AI SSE parsing rejects malformed tool events", () => {
  assert.throws(
    () => parseAiSseFrame('event: ai\ndata: {"type":"tool.completed","runId":"run"}'),
    /invalid event/
  );
});
