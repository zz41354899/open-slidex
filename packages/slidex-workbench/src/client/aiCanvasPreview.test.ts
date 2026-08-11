import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAiCanvasPreviewSequence,
  compactAiCanvasPreviewForReducedMotion,
  maxAiCanvasPreviewDurationMs,
  maxAiCanvasPreviewSteps,
  minAiCanvasPreviewDurationMs
} from "./aiCanvasPreview";

const source = `# Preview fixture

<Slide duration={5} width={1920} height={1080} background="#ffffff">
  <Text id="title" x={10} y={20} w={50} h={12}>Before</Text>
</Slide>`;

test("AI Canvas preview derives progressive in-memory sources without changing the base source", () => {
  const sequence = buildAiCanvasPreviewSequence(source, "sha256:base", {
    commands: [
      { nodeId: "title", slideIndex: 0, text: "First", type: "block.update" },
      { nodeId: "title", props: { x: 20 }, slideIndex: 0, type: "block.update" }
    ],
    expectedRevision: "sha256:base",
    kind: "edit-commands"
  }, "tool-1");

  assert.equal(sequence?.steps.length, 4);
  assert.equal(sequence?.steps[0]?.trace.gesture, "move");
  assert.equal(sequence?.steps[1]?.trace.gesture, "press");
  assert.match(sequence?.steps[1]?.source ?? "", />First</);
  assert.match(sequence?.steps[3]?.source ?? "", /x=\{20\}/);
  assert.match(source, />Before</);
  assert.deepEqual(sequence?.steps[3]?.trace.target, { blockIndex: 0, kind: "block", nodeId: "title", slideIndex: 0 });
  assert.deepEqual(sequence?.steps[3]?.trace.frame, { h: 12, w: 50, x: 20, y: 20 });
  assert.ok((sequence?.intervalMs ?? 0) * 3 >= minAiCanvasPreviewDurationMs);
});

test("AI Canvas preview rejects stale revisions and invalid commands", () => {
  assert.equal(buildAiCanvasPreviewSequence(source, "sha256:current", {
    commands: [{ nodeId: "title", slideIndex: 0, text: "Stale", type: "block.update" }],
    expectedRevision: "sha256:stale",
    kind: "edit-commands"
  }, "tool-1"), undefined);
  assert.equal(buildAiCanvasPreviewSequence(source, "sha256:base", {
    commands: [{ type: "unknown.command" }],
    expectedRevision: "sha256:base",
    kind: "edit-commands"
  }, "tool-1"), undefined);
});

test("AI Canvas preview samples large batches within the visual budget", () => {
  const sequence = buildAiCanvasPreviewSequence(source, "sha256:base", {
    commands: Array.from({ length: 20 }, (_, index) => ({
      nodeId: "title",
      props: { x: index + 1 },
      slideIndex: 0,
      type: "block.update"
    })),
    expectedRevision: "sha256:base",
    kind: "edit-commands"
  }, "tool-1");

  assert.equal(sequence?.steps.length, maxAiCanvasPreviewSteps);
  assert.ok((sequence?.intervalMs ?? Infinity) * Math.max((sequence?.steps.length ?? Infinity) - 1, 1) <= maxAiCanvasPreviewDurationMs);
  assert.match(sequence?.steps.at(-1)?.source ?? "", /x=\{20\}/);
});

test("AI Canvas preview preserves a deleted block frame for its final highlight", () => {
  const sequence = buildAiCanvasPreviewSequence(source, "sha256:base", {
    commands: [{ nodeId: "title", slideIndex: 0, type: "block.delete" }],
    expectedRevision: "sha256:base",
    kind: "edit-commands"
  }, "tool-delete");

  assert.deepEqual(sequence?.steps[1]?.trace.frame, { h: 12, w: 50, x: 10, y: 20 });
  assert.equal(sequence?.steps[1]?.trace.label, "Removing element");
});

test("AI Canvas preview decomposes slide replacement into visible block construction", () => {
  const sequence = buildAiCanvasPreviewSequence(source, "sha256:base", {
    commands: [{
      slideIndex: 0,
      slideSource: `<Slide duration={5} width={1920} height={1080} background="#101426">
  <Title id="hero" x={8} y={12} w={70} h={12}>Operator</Title>
  <Text id="copy" x={8} y={30} w={52} h={10}>Visible progress</Text>
</Slide>`,
      type: "slide.replace"
    }],
    expectedRevision: "sha256:base",
    kind: "edit-commands"
  }, "tool-replace");

  assert.equal(sequence?.steps.length, 10);
  assert.doesNotMatch(sequence?.steps[1]?.source ?? "", /Operator/);
  assert.match(sequence?.steps[3]?.source ?? "", /Oper…/);
  assert.match(sequence?.steps[5]?.source ?? "", /Operator/);
  assert.doesNotMatch(sequence?.steps[5]?.source ?? "", /Visible progress/);
  assert.match(sequence?.steps[9]?.source ?? "", /Visible progress/);
  assert.equal(sequence?.steps[3]?.trace.label, "Typing title");
  assert.equal(sequence?.steps[7]?.trace.label, "Typing text");
  assert.deepEqual(sequence?.steps[9]?.trace.target, { blockIndex: 1, kind: "block", nodeId: "copy", slideIndex: 0 });
});

test("AI Canvas preview follows a newly added slide and supports reduced motion", () => {
  const sequence = buildAiCanvasPreviewSequence(source, "sha256:base", {
    commands: [{
      afterSlideIndex: 0,
      slideSource: `<Slide duration={5} width={1920} height={1080} background="#ffffff">
  <Title id="next" x={10} y={12} w={60} h={12}>Second slide</Title>
</Slide>`,
      type: "slide.add"
    }],
    expectedRevision: "sha256:base",
    kind: "edit-commands"
  }, "tool-add");

  const finalTarget = sequence?.steps.at(-1)?.trace.target;
  assert.equal(finalTarget?.kind, "block");
  assert.equal(finalTarget?.kind === "block" ? finalTarget.slideIndex : -1, 1);
  const reduced = sequence ? compactAiCanvasPreviewForReducedMotion(sequence) : undefined;
  assert.equal(reduced?.steps.length, 1);
  assert.equal(reduced?.steps[0]?.trace.gesture, "settle");
  assert.match(reduced?.steps[0]?.source ?? "", /Second slide/);
});
