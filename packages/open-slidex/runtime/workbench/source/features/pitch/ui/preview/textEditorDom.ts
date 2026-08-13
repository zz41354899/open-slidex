import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { textStyleSegments } from "@/core/motion-doc/domain/textStyleRanges";
import { motionDocFontPointsToCanvasPixels } from "@/core/motion-doc/domain/typography";

export type TextSelectionRange = {
  direction?: "backward" | "forward";
  end: number;
  start: number;
};

export function editorTextSelection(editor: HTMLDivElement | null): TextSelectionRange | null {
  const selection = window.getSelection();
  if (!editor || !selection || selection.rangeCount === 0) return null;

  if (
    !selection.anchorNode ||
    !selection.focusNode ||
    !editor.contains(selection.anchorNode) ||
    !editor.contains(selection.focusNode)
  ) return null;

  const anchor = editorPointOffset(editor, selection.anchorNode, selection.anchorOffset);
  const focus = editorPointOffset(editor, selection.focusNode, selection.focusOffset);
  return {
    direction: anchor > focus ? "backward" : "forward",
    end: Math.max(anchor, focus),
    start: Math.min(anchor, focus)
  };
}

export function renderEditableText(editor: HTMLDivElement, text: string, props: MotionDocProps, canvasScale = 1) {
  const fragment = document.createDocumentFragment();
  for (const segment of textStyleSegments(text, props)) {
    if (
      !segment.color &&
      !segment.fontFamily &&
      segment.fontSize === undefined &&
      segment.fontWeight === undefined &&
      segment.italic === undefined &&
      segment.letterSpacing === undefined &&
      segment.underline === undefined
    ) {
      fragment.append(document.createTextNode(segment.text));
      continue;
    }

    const span = document.createElement("span");
    span.textContent = segment.text;
    if (segment.color) span.style.color = segment.color;
    if (segment.fontFamily) span.style.fontFamily = `"${segment.fontFamily}", sans-serif`;
    if (segment.fontSize !== undefined) {
      span.style.fontSize = `${motionDocFontPointsToCanvasPixels(segment.fontSize) * canvasScale}px`;
    }
    if (segment.fontWeight !== undefined) span.style.fontWeight = String(segment.fontWeight);
    if (segment.italic !== undefined) span.style.fontStyle = segment.italic ? "italic" : "normal";
    if (segment.letterSpacing !== undefined) {
      span.style.letterSpacing = `${motionDocFontPointsToCanvasPixels(segment.letterSpacing) * canvasScale}px`;
    }
    if (segment.underline !== undefined) span.style.textDecoration = segment.underline ? "underline" : "none";
    fragment.append(span);
  }
  editor.replaceChildren(fragment);
}

export function restoreEditorTextSelection(editor: HTMLDivElement, selectionRange: TextSelectionRange | null) {
  if (!selectionRange) return;
  const selection = window.getSelection();
  if (!selection) return;

  const start = editorTextPoint(editor, selectionRange.start);
  const end = editorTextPoint(editor, selectionRange.end);
  if (!start || !end) return;

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  selection.removeAllRanges();
  selection.addRange(range);
  if (selectionRange.direction === "backward" && "setBaseAndExtent" in selection) {
    selection.setBaseAndExtent(end.node, end.offset, start.node, start.offset);
  }
}

function editorTextPoint(editor: HTMLDivElement, targetOffset: number) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let node = walker.nextNode();
  let lastTextNode: Node | null = null;

  while (node) {
    lastTextNode = node;
    const length = node.textContent?.length ?? 0;
    if (consumed + length >= targetOffset) {
      return { node, offset: Math.max(0, targetOffset - consumed) };
    }
    consumed += length;
    node = walker.nextNode();
  }

  return lastTextNode
    ? { node: lastTextNode, offset: lastTextNode.textContent?.length ?? 0 }
    : { node: editor, offset: 0 };
}

function editorPointOffset(editor: HTMLDivElement, node: Node, offset: number) {
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.setEnd(node, offset);
  return range.toString().length;
}
