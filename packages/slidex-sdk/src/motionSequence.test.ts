import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMotionNumber,
  interpolateMotionNumber,
  interpolateMotionState,
  parseMotionSequence,
  scheduleMotionActions,
  serializeMotionSequence,
  summarizeMotionDoc,
  withMotionSequence,
  type MotionSequenceV1
} from "./index";

const state = { h: 20, opacity: 1, rotation: 0, w: 20, x: 10, y: 10 };

test("MotionSequenceV1 parses, serializes, and schedules click groups", () => {
  const sequence: MotionSequenceV1 = {
    actions: [
      { duration: 0.6, easing: "easeInOut", from: state, id: "one", order: 0, start: "onClick", to: { ...state, x: 30 }, type: "tween" },
      { duration: 0.4, easing: "linear", from: state, id: "two", order: 1, start: "withPrevious", to: { ...state, y: 40 }, type: "tween" },
      { duration: 0.3, easing: "easeOut", from: state, id: "three", order: 2, start: "afterPrevious", to: { ...state, opacity: 0.5 }, type: "tween" },
      { duration: 0.5, easing: "easeIn", from: state, id: "four", order: 3, start: "onClick", to: { ...state, rotation: 90 }, type: "tween" }
    ],
    version: 1
  };
  const parsed = parseMotionSequence(serializeMotionSequence(sequence));
  assert.deepEqual(parsed.issues, []);
  assert.ok(parsed.sequence);
  const scheduled = scheduleMotionActions(parsed.sequence.actions);
  assert.deepEqual(scheduled.map(({ endTime, startTime, trigger }) => ({ endTime, startTime, trigger })), [
    { endTime: 0.6, startTime: 0, trigger: 0 },
    { endTime: 0.4, startTime: 0, trigger: 0 },
    { endTime: 0.9, startTime: 0.6, trigger: 0 },
    { endTime: 0.5, startTime: 0, trigger: 1 }
  ]);
});

test("MotionSequenceV1 rejects duplicate order and first withPrevious", () => {
  const result = parseMotionSequence(JSON.stringify({
    actions: [
      { duration: 0.6, easing: "linear", from: state, id: "same", order: 0, start: "withPrevious", to: state, type: "tween" },
      { duration: 0.6, easing: "linear", from: state, id: "same", order: 0, start: "onClick", to: state, type: "tween" }
    ],
    version: 1
  }));
  assert.equal(result.sequence, null);
  assert.match(result.issues.join(" "), /unique/);
  assert.match(result.issues.join(" "), /first motion action/);
});

test("MotionSequenceV1 preserves curated action and exit presets", () => {
  const sequence: MotionSequenceV1 = {
    actions: [
      { duration: 0.6, easing: "easeInOut", from: state, id: "arc", order: 0, path: { controlX: 30, controlY: 4 }, preset: "arcUp", start: "onClick", to: { ...state, x: 30 }, type: "tween" },
      { duration: 0.5, easing: "easeOut", id: "leave", order: 1, preset: "fadeOut", start: "afterPrevious", type: "exit" }
    ],
    version: 1
  };
  const parsed = parseMotionSequence(serializeMotionSequence(sequence));
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.sequence?.actions[0]?.type, "tween");
  assert.equal(parsed.sequence?.actions[0]?.preset, "arcUp");
  assert.equal(parsed.sequence?.actions[1]?.type, "exit");
  assert.equal(parsed.sequence?.actions[1]?.preset, "fadeOut");
});

test("writing a MotionSequence removes conflicting legacy animation props", () => {
  const sequence: MotionSequenceV1 = {
    actions: [
      { duration: 0.6, easing: "easeInOut", from: state, id: "move", order: 0, start: "onClick", to: { ...state, x: 30 }, type: "tween" }
    ],
    version: 1
  };
  const props = withMotionSequence({ delay: 0.2, duration: 0.8, enter: "none", id: "shape-one" }, sequence);

  assert.equal(typeof props.motion, "string");
  assert.equal(props.enter, undefined);
  assert.equal(props.delay, undefined);
  assert.equal(props.duration, undefined);
});

test("quadratic tween interpolation reaches its control-influenced midpoint", () => {
  const midpoint = interpolateMotionState(state, { ...state, x: 30, y: 10 }, 0.5, "linear", { controlX: 30, controlY: 40 });
  assert.equal(midpoint.x, 20);
  assert.equal(midpoint.y, 20);
  assert.equal(midpoint.opacity, 1);
});

test("number range tween parses and interpolates count up and countdown steps", () => {
  const sequence: MotionSequenceV1 = {
    actions: [{
      duration: 1,
      easing: "linear",
      from: state,
      id: "count",
      numberRange: { from: 100, step: 10, to: 0 },
      order: 0,
      preset: "numberRange",
      start: "onClick",
      to: state,
      type: "tween"
    }],
    version: 1
  };
  const parsed = parseMotionSequence(serializeMotionSequence(sequence));
  assert.deepEqual(parsed.issues, []);
  assert.deepEqual(parsed.sequence?.actions[0]?.type === "tween" ? parsed.sequence.actions[0].numberRange : null, { from: 100, step: 10, to: 0 });
  assert.equal(interpolateMotionNumber({ from: 100, step: 10, to: 0 }, 0.5, "linear"), 50);
  assert.equal(interpolateMotionNumber({ from: 0, step: 7, to: 100 }, 0.5, "linear"), 49);
  assert.equal(interpolateMotionNumber({ from: 0, step: 7, to: 100 }, 1, "linear"), 100);
  assert.equal(formatMotionNumber(12.5, { from: 0, step: 0.5, to: 12.5 }), "12.5");
});

test("number range tween requires valid range data and a matching Text final value", () => {
  const missingRange = parseMotionSequence(JSON.stringify({
    actions: [{ duration: 1, easing: "linear", from: state, id: "count", order: 0, preset: "numberRange", start: "onClick", to: state, type: "tween" }],
    version: 1
  }));
  assert.equal(missingRange.sequence, null);
  assert.match(missingRange.issues.join(" "), /numberRange is required/);

  const motion = serializeMotionSequence({
    actions: [{ duration: 1, easing: "linear", from: state, id: "count", numberRange: { from: 100, step: 1, to: 0 }, order: 0, preset: "numberRange", start: "onClick", to: state, type: "tween" }],
    version: 1
  });
  const valid = summarizeMotionDoc(`# Count\n\n<Slide><Text id="count" x={10} y={10} w={20} h={20} rotation={0} opacity={1} motion='${motion}'>0</Text></Slide>`);
  assert.equal(valid.validation.isValid, true, JSON.stringify(valid.validation.issues));
  const wrongType = summarizeMotionDoc(`# Count\n\n<Slide><Shape id="count" x={10} y={10} w={20} h={20} rotation={0} opacity={1} motion='${motion}' /></Slide>`);
  assert.equal(wrongType.validation.isValid, false);
  assert.match(wrongType.validation.issues.map((issue) => issue.message).join(" "), /only supported on Text/);
});

test("MotionDoc validates Action Tween final state and legacy conflicts", () => {
  const motion = JSON.stringify({
    actions: [{ duration: 0.6, easing: "easeInOut", from: state, id: "action-one", order: 0, start: "onClick", to: { ...state, x: 30 }, type: "tween" }],
    version: 1
  });
  const valid = summarizeMotionDoc(`# Motion\n\n<Slide slideTransition="morph" transitionDuration={0.72} morphEasing="easeInOut" morphFadeUnmatched="true"><Shape id="shape-one" sharedId="hero" x={30} y={10} w={20} h={20} rotation={0} opacity={1} motion='${motion}' /></Slide><Slide><Shape id="shape-two" sharedId="hero" x={40} y={10} w={20} h={20} rotation={0} opacity={1} /></Slide>`);
  assert.equal(valid.validation.isValid, true, JSON.stringify(valid.validation.issues));

  const conflict = summarizeMotionDoc(`# Conflict\n\n<Slide><Shape id="shape-one" x={30} y={10} w={20} h={20} rotation={0} opacity={1} enter="fadeIn" motion='${motion}' /></Slide>`);
  assert.equal(conflict.validation.isValid, false);
  assert.match(conflict.validation.issues.map((issue) => issue.message).join(" "), /cannot be combined with legacy/);

  const mismatchedFinal = summarizeMotionDoc(`# Mismatch\n\n<Slide><Shape id="shape-one" x={31} y={10} w={20} h={20} rotation={0} opacity={1} motion='${motion}' /></Slide>`);
  assert.equal(mismatchedFinal.validation.isValid, false);
  assert.match(mismatchedFinal.validation.issues.map((issue) => issue.message).join(" "), /last tween destination/);
});

test("MotionDoc rejects duplicate slide action orders and shared morph ids", () => {
  const first = serializeMotionSequence({ actions: [{ duration: 0.6, easing: "linear", from: state, id: "first", order: 0, start: "onClick", to: state, type: "tween" }], version: 1 });
  const second = serializeMotionSequence({ actions: [{ duration: 0.6, easing: "linear", from: state, id: "second", order: 0, start: "afterPrevious", to: state, type: "tween" }], version: 1 });
  const summary = summarizeMotionDoc(`# Duplicate\n\n<Slide><Shape id="one" sharedId="same" x={10} y={10} w={20} h={20} rotation={0} opacity={1} motion='${first}' /><Shape id="two" sharedId="same" x={10} y={10} w={20} h={20} rotation={0} opacity={1} motion='${second}' /></Slide>`);
  assert.equal(summary.validation.isValid, false);
  const messages = summary.validation.issues.map((issue) => issue.message).join(" ");
  assert.match(messages, /sharedId must be unique/);
  assert.match(messages, /order must be unique within a slide/);
});
