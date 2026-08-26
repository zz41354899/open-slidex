import assert from "node:assert/strict";
import test from "node:test";

import { Window } from "happy-dom";

import { appendTextBlockAtPosition } from "../../../../features/pitch/application/motionDocCommands";
import { createMotionDocBlock } from "../../../../core/motion-doc/application/motionDocBlockFactory";
import { generateBlockString } from "../../../../core/motion-doc/application/motionDocSerialize";
import {
  createMotionDocTextClipboardPacket,
  motionDocTextClipboardHtml,
  motionDocTextClipboardPacketFromHtml,
  pasteMotionDocTextClipboard
} from "../../../../core/motion-doc/application/motionDocTextClipboard";
import { autoSizeTextFrameProps } from "../../../../core/motion-doc/application/textFrameSizing";
import { parseMotionDoc } from "../../../../core/motion-doc/domain/motionDocParser";
import {
  applyBlockTextStyle,
  applyTextStyleSelection,
  textStyleRangesFromProps
} from "../../../../core/motion-doc/domain/textStyleRanges";
import type { MotionDocScene, MotionDocTextBlock } from "../../../../core/motion-doc/domain/motionDocTypes";
import { buildMotionDocHtml } from "../../../../core/motion-doc/infrastructure/export/motionDocExport";
import { addEditableSlides } from "../../../../features/pitch/infrastructure/editablePptxExport";
import {
  editorTextSelection,
  renderEditableText,
  restoreEditorTextSelection
} from "../../../../features/pitch/ui/preview/textEditorDom";
import { shouldFocusTextEditor } from "../../../../features/pitch/ui/preview/textEditorActivation";
import {
  loadRecentFonts,
  rememberRecentFont
} from "../../../../features/pitch/infrastructure/recentFontStorage";

test("MotionDoc text parsing preserves editable leading, trailing, repeated, and multiline whitespace", () => {
  const document = parseMotionDoc(`<Slide>
  <Text id="inline"> context  line </Text>
  <Text id="multiline">
    first line  
      second line

    fourth line
  </Text>
</Slide>`);

  assert.equal(document.scenes[0]?.blocks[0]?.type, "Text");
  assert.equal((document.scenes[0]?.blocks[0] as MotionDocTextBlock).text, " context  line ");
  assert.equal((document.scenes[0]?.blocks[1] as MotionDocTextBlock).text, "first line  \n  second line\n\nfourth line");
});

test("serialized editor text round-trips leading and trailing newlines without becoming MDX indentation", () => {
  const source = generateBlockString({ props: {}, text: "\nfirst\nsecond\n", type: "Text" });
  const document = parseMotionDoc(`<Slide>${source}</Slide>`);
  assert.equal((document.scenes[0]?.blocks[0] as MotionDocTextBlock).text, "\nfirst\nsecond\n");
  assert.match(source, /&#10;/);
});

test("rich text ranges support mixed font size, italic, and letter spacing", () => {
  const text = "Mixed styles";
  const props = applyTextStyleSelection(
    { fontSize: 20 },
    { start: 0, end: 5 },
    { fontSize: 28, italic: true, letterSpacing: 1.5 },
    text.length
  );
  const ranges = textStyleRangesFromProps(props, text.length);

  assert.deepEqual(ranges, [{ end: 5, fontSize: 28, italic: true, letterSpacing: 1.5, start: 0 }]);
});

test("rich text clipboard preserves a 24pt selection when pasted into a 20pt text box", () => {
  const source: MotionDocTextBlock = {
    props: { fontFamily: "Inter", fontSize: 24, fontWeight: 500 },
    text: "Copied text",
    type: "Text"
  };
  const packet = createMotionDocTextClipboardPacket(source, { end: source.text.length, start: 0 });
  assert.ok(packet);

  const pasted = pasteMotionDocTextClipboard(
    { fontSize: 20 },
    "Target",
    { end: 6, start: 0 },
    packet
  );
  const ranges = textStyleRangesFromProps(pasted.props, pasted.text.length);

  assert.equal(pasted.text, "Copied text");
  assert.equal(ranges[0]?.fontSize, 24);
  assert.equal(ranges[0]?.fontFamily, "Inter");
  assert.deepEqual(motionDocTextClipboardPacketFromHtml(motionDocTextClipboardHtml(packet)), packet);
});

test("new blank text has no default font family and accepts an explicitly inherited font", () => {
  const blank = createMotionDocBlock("Text");
  assert.equal("props" in blank ? blank.props.fontFamily : undefined, undefined);

  const slide: MotionDocScene = { blocks: [], duration: 5, props: {} };
  const inserted = appendTextBlockAtPosition(slide, { x: 10, y: 20 }, { fontFamily: "Roboto" });
  assert.equal(inserted.slide.blocks[0]?.props.fontFamily, "Roboto");
});

test("changing font family preserves the text frame geometry", () => {
  const frame = { fontFamily: "Inter", h: 12, w: 48, x: 9, y: 21 };
  const changed = applyBlockTextStyle(frame, { fontFamily: "Roboto" }, 12);

  assert.deepEqual(
    { h: changed.h, w: changed.w, x: changed.x, y: changed.y },
    { h: 12, w: 48, x: 9, y: 21 }
  );
  assert.equal(changed.fontFamily, "Roboto");
});

test("mixed font sizes and letter spacing contribute to automatic text height", () => {
  const text = "Large text wraps across the frame";
  const base = { fontSize: 20, h: 6, w: 20, x: 5, y: 5 };
  const mixed = applyTextStyleSelection(base, { end: text.length, start: 6 }, { fontSize: 42, letterSpacing: 2 }, text.length);
  const baseSize = autoSizeTextFrameProps({ props: base, type: "Text" }, text, { mode: "height" });
  const mixedSize = autoSizeTextFrameProps({ props: mixed, type: "Text" }, text, { mode: "height" });

  assert.ok(Number(mixedSize.h) > Number(baseSize.h));
});

test("fixed point line height contributes directly to automatic text height", () => {
  const text = "First line\nSecond line";
  const compact = autoSizeTextFrameProps(
    { props: { fontSize: 20, h: 6, lineHeightPt: 20, w: 80, x: 5, y: 5 }, type: "Text" },
    text,
    { mode: "height" }
  );
  const spacious = autoSizeTextFrameProps(
    { props: { fontSize: 20, h: 6, lineHeightPt: 40, w: 80, x: 5, y: 5 }, type: "Text" },
    text,
    { mode: "height" }
  );

  assert.ok(Number(spacious.h) > Number(compact.h));
});

test("fit text box preserves its chosen width while fitting its height to wrapped words", () => {
  const props = { fontSize: 20, h: 90, w: 24, x: 5, y: 5 };
  const fitted = autoSizeTextFrameProps(
    { props, type: "Text" },
    "A western word should move as one unit when the text box fits its content.",
    { mode: "fit" }
  );

  assert.equal(fitted.w, 24);
  assert.ok(Number(fitted.h) < 90);
  assert.ok(Number(fitted.h) > 6);
});

test("HTML export emits block and inline rich text styles", () => {
  const textStyleRanges = JSON.stringify([{ end: 6, fontSize: 30, italic: false, letterSpacing: 1.2, start: 0 }]);
  const html = buildMotionDocHtml(`<Slide background="#ffffff">
  <Text fontFamily="Inter" fontSize={22} fontStyle="italic" letterSpacing={0.8} textStyleRanges="${textStyleRanges.replaceAll('"', '&quot;')}">Styled text</Text>
</Slide>`);

  assert.match(html, /font-family:&quot;Inter&quot;, sans-serif/);
  assert.match(html, /font-style:italic/);
  assert.match(html, /--motion-letter-spacing:/);
  assert.match(html, /font-size:/);
  assert.match(html, /font-style:normal/);
});

test("HTML export emits fixed point line height as a canvas pixel value", () => {
  const html = buildMotionDocHtml(`<Slide background="#ffffff">
  <Text fontSize={20} lineHeightPt={24}>Fixed spacing</Text>
</Slide>`);

  assert.match(html, /--motion-line-height:60px/);
});

test("editable PowerPoint export distinguishes exact points from line multiples", async () => {
  const textOptions: Array<Record<string, unknown>> = [];
  const pptx = {
    addSlide() {
      return {
        addNotes() {},
        addText(_text: unknown, options: Record<string, unknown>) {
          textOptions.push(options);
        },
        background: {}
      };
    }
  };
  const document = parseMotionDoc(`<Slide>
  <Text lineHeightPt={24}>Exact</Text>
  <Text lineHeight={1.5}>Multiple</Text>
</Slide>`);

  await addEditableSlides(pptx as never, document, []);

  assert.equal(textOptions[0]?.lineSpacing, 24);
  assert.equal(textOptions[0]?.lineSpacingMultiple, undefined);
  assert.equal(textOptions[1]?.lineSpacing, undefined);
  assert.equal(textOptions[1]?.lineSpacingMultiple, 1.5);
});

test("editable DOM restores collapsed carets and renders inline styles", () => {
  const window = new Window();
  const previous = {
    document: globalThis.document,
    Element: globalThis.Element,
    NodeFilter: globalThis.NodeFilter,
    window: globalThis.window
  };
  Object.assign(globalThis, {
    document: window.document,
    Element: window.Element,
    NodeFilter: window.NodeFilter,
    window
  });

  try {
    const editor = window.document.createElement("div") as unknown as HTMLDivElement;
    window.document.body.append(editor as never);
    const props = applyTextStyleSelection({}, { end: 4, start: 0 }, { fontSize: 28, italic: true }, 7);
    renderEditableText(editor, "context", props, 1);
    restoreEditorTextSelection(editor, { end: 7, start: 7 });

    assert.deepEqual(editorTextSelection(editor), { direction: "forward", end: 7, start: 7 });
    const span = editor.querySelector("span");
    assert.equal(span?.style.fontStyle, "italic");
    assert.notEqual(span?.style.fontSize, "");
  } finally {
    Object.assign(globalThis, previous);
  }
});

test("recent fonts are deduplicated and most-recent first", () => {
  const window = new Window({ url: "https://slidex.test" });
  const previousWindow = globalThis.window;
  Object.assign(globalThis, { window });

  try {
    rememberRecentFont("Inter");
    rememberRecentFont("Roboto");
    rememberRecentFont("Inter");
    assert.deepEqual(loadRecentFonts(), ["Inter", "Roboto"]);
  } finally {
    Object.assign(globalThis, { window: previousWindow });
  }
});

test("a Text editor focuses when it mounts already enabled and when editing is re-enabled", () => {
  assert.equal(shouldFocusTextEditor(undefined, true), true);
  assert.equal(shouldFocusTextEditor(true, true), false);
  assert.equal(shouldFocusTextEditor(true, false), false);
  assert.equal(shouldFocusTextEditor(false, true), true);
});
