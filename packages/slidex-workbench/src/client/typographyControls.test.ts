import assert from "node:assert/strict";
import test from "node:test";

import {
  matchingOfficeSpacingPreset,
  motionDocLineHeightCanvasPixels,
  motionDocLineHeightCanvasValue,
  OFFICE_CHARACTER_SPACING_PRESETS,
  OFFICE_LINE_HEIGHT_PRESETS
} from "../../../../core/motion-doc/domain/typography";
import { applyTextListStyle } from "../../../../core/motion-doc/application/textListStyle";
import { textFramePropsWithLineHeight } from "../../../../core/motion-doc/application/textFrameSizing";

test("Office-style spacing presets use line multiples and character points", () => {
  assert.deepEqual(OFFICE_LINE_HEIGHT_PRESETS, [1, 1.2, 1.5, 2]);
  assert.deepEqual(OFFICE_CHARACTER_SPACING_PRESETS, [-0.5, 0, 0.5]);
});

test("Office-style dropdown distinguishes presets from custom values", () => {
  assert.equal(matchingOfficeSpacingPreset(1.2004, OFFICE_LINE_HEIGHT_PRESETS), 1.2);
  assert.equal(matchingOfficeSpacingPreset(1.45, OFFICE_LINE_HEIGHT_PRESETS), undefined);
  assert.equal(matchingOfficeSpacingPreset(-0.5, OFFICE_CHARACTER_SPACING_PRESETS), -0.5);
});

test("custom line height uses exact points while presets remain multiples", () => {
  assert.equal(motionDocLineHeightCanvasValue(1.5, undefined, 1.45), 1.5);
  assert.equal(motionDocLineHeightCanvasValue(1.5, 24, 1.45), "60px");
  assert.equal(motionDocLineHeightCanvasPixels(20, 1.5, undefined, 1.45), 75);
  assert.equal(motionDocLineHeightCanvasPixels(20, 1.5, 24, 1.45), 60);
});

test("changing line height preserves the text frame geometry", () => {
  const frame = { h: 9, lineHeight: 1.45, w: 42, x: 8, y: 38 };
  const exact = textFramePropsWithLineHeight(frame, 24, "points");
  assert.deepEqual(
    { h: exact.h, w: exact.w, x: exact.x, y: exact.y },
    { h: 9, w: 42, x: 8, y: 38 }
  );
  assert.equal(exact.lineHeight, undefined);
  assert.equal(exact.lineHeightPt, 24);

  const multiple = textFramePropsWithLineHeight(exact, 1.5, "multiple");
  assert.deepEqual(
    { h: multiple.h, w: multiple.w, x: multiple.x, y: multiple.y },
    { h: 9, w: 42, x: 8, y: 38 }
  );
  assert.equal(multiple.lineHeight, 1.5);
  assert.equal(multiple.lineHeightPt, undefined);
});

test("list style switches between bullets, numbers, and plain text without persisting display markers", () => {
  const bullet = applyTextListStyle({}, "First\nSecond", "bullet");
  assert.equal(bullet.props.listType, "bullet");
  assert.equal(bullet.text, "First\nSecond");

  const ordered = applyTextListStyle({ listType: "bullet" }, "• First\n• Second", "ordered");
  assert.equal(ordered.props.listType, "ordered");
  assert.equal(ordered.text, "First\nSecond");

  const plain = applyTextListStyle({ listStart: 3, listType: "ordered" }, "3. First\n4. Second", "");
  assert.equal(plain.props.listType, undefined);
  assert.equal(plain.props.listStart, undefined);
  assert.equal(plain.text, "First\nSecond");
});
