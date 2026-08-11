import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { textStyleSegments } from "@/core/motion-doc/domain/textStyleRanges";

export type TextSelectionRange = {
  end: number;
  start: number;
};

export function editorTextSelection(editor: HTMLDivElement | null): TextSelectionRange | null {
  const selection = window.getSelection();
  if (!editor || !selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return null;

  const beforeStart = range.cloneRange();
  beforeStart.selectNodeContents(editor);
  beforeStart.setEnd(range.startContainer, range.startOffset);

  const beforeEnd = range.cloneRange();
  beforeEnd.selectNodeContents(editor);
  beforeEnd.setEnd(range.endContainer, range.endOffset);

  const start = beforeStart.toString().length;
  const end = beforeEnd.toString().length;
  return { end: Math.max(start, end), start: Math.min(start, end) };
}

export function renderEditableText(editor: HTMLDivElement, text: string, props: MotionDocProps) {
  const fragment = document.createDocumentFragment();
  for (const segment of textStyleSegments(text, props)) {
    if (!segment.color && !segment.fontFamily && segment.fontWeight === undefined) {
      fragment.append(document.createTextNode(segment.text));
      continue;
    }

    const span = document.createElement("span");
    span.textContent = segment.text;
    if (segment.color) span.style.color = segment.color;
    if (segment.fontFamily) span.style.fontFamily = `"${segment.fontFamily}", sans-serif`;
    if (segment.fontWeight !== undefined) span.style.fontWeight = String(segment.fontWeight);
    fragment.append(span);
  }
  editor.replaceChildren(fragment);
}

export function restoreEditorTextSelection(editor: HTMLDivElement, selectionRange: TextSelectionRange | null) {
  if (!selectionRange || selectionRange.end <= selectionRange.start) return;
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

  return lastTextNode ? { node: lastTextNode, offset: lastTextNode.textContent?.length ?? 0 } : null;
}
