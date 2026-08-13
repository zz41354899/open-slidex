import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import type {
  Content,
  List,
  ListItem,
  PhrasingContent,
  Root,
  Table
} from "mdast";

import type {
  MotionDocBlock,
  MotionDocProps
} from "@/core/motion-doc/domain/motionDocTypes";
import type {
  MotionDocTextStyle,
  MotionDocTextStyleRange
} from "@/core/motion-doc/domain/textStyleRanges";

type TextResult = {
  ranges: MotionDocTextStyleRange[];
  text: string;
};

type MutableTextResult = {
  ranges: MotionDocTextStyleRange[];
  text: string;
};

const markdownIdPattern =
  /<!--\s*slidex-block-id\s*:\s*([A-Za-z0-9._:-]+)\s*-->/;
const trailingMarkdownIdPattern =
  /<!--\s*slidex-block-id\s*:\s*([A-Za-z0-9._:-]+)\s*-->\s*$/;
const slideXMarkerPattern =
  /^\s*<!--\s*slidex-(?:block|note)-id\s*:\s*[A-Za-z0-9._:-]+\s*-->\s*$/;

export function parseMotionDocMarkdown(source: string): MotionDocBlock[] {
  const parserSource = source.replace(
    /[ \t]+(<!--\s*slidex-block-id\s*:\s*[A-Za-z0-9._:-]+\s*-->)/g,
    "$1"
  );
  const tree = fromMarkdown(parserSource, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()]
  }) as Root;

  return tree.children.flatMap((node) =>
    motionDocBlocksFromMarkdownNode(node, parserSource)
  );
}

function motionDocBlocksFromMarkdownNode(
  node: Content,
  source: string
): MotionDocBlock[] {
  const id = markdownNodeId(node, source);

  if (node.type === "heading") {
    const content = phrasingText(node.children);
    const props = markdownProps(
      content,
      {
        markdownDepth: node.depth,
        markdownKind: "heading"
      },
      id
    );

    if (node.depth === 1) {
      return [{ props, text: content.text, type: "Title" }];
    }

    return [{
      props: {
        ...props,
        fontSize: markdownHeadingFontSize(node.depth),
        fontWeight: 700
      },
      text: content.text,
      type: "heading"
    }];
  }

  if (node.type === "paragraph") {
    const content = phrasingText(node.children);
    return [{
      props: markdownProps(
        content,
        { markdownKind: "paragraph" },
        id
      ),
      text: content.text,
      type: "Text"
    }];
  }

  if (node.type === "blockquote") {
    const content = blockText(node.children);
    const italicized = content.text
      ? mergeTextRanges([
          ...content.ranges,
          { end: content.text.length, italic: true, start: 0 }
        ])
      : content.ranges;
    return [{
      props: markdownProps(
        { ...content, ranges: italicized },
        { markdownKind: "blockquote" },
        id
      ),
      text: content.text,
      type: "Text"
    }];
  }

  if (node.type === "code") {
    const content = {
      ranges: node.value
        ? [{
            end: node.value.length,
            fontFamily: "ui-monospace",
            start: 0
          }]
        : [],
      text: node.value
    };
    return [{
      props: markdownProps(
        content,
        {
          fontFamily: "ui-monospace",
          markdownKind: "code"
        },
        id
      ),
      text: content.text,
      type: "Text"
    }];
  }

  if (node.type === "list") {
    const content = listText(node);
    return [{
      props: markdownProps(
        content,
        {
          listStart: node.start ?? 1,
          listType: node.ordered ? "ordered" : "bullet",
          markdownKind: "list"
        },
        id
      ),
      text: content.text,
      type: "Text"
    }];
  }

  if (node.type === "table") {
    return [markdownTableBlock(node, id)];
  }

  if (node.type === "html") {
    if (slideXMarkerPattern.test(node.value)) return [];
    return [{
      props: {
        markdownKind: "paragraph"
      },
      text: node.value,
      type: "Text"
    }];
  }

  return [];
}

function markdownTableBlock(table: Table, id?: string): MotionDocBlock {
  const rows = table.children.slice(0, 50).map((row) =>
    row.children.slice(0, 50).map((cell) => phrasingText(cell.children).text)
  );
  const columns = Math.max(1, ...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) =>
    Array.from({ length: columns }, (_, columnIndex) => row[columnIndex] ?? "")
  );
  const columnOverrides = Object.fromEntries(
    (table.align ?? []).slice(0, columns).flatMap((alignment, columnIndex) =>
      alignment ? [[columnIndex, { textAlign: alignment }]] : []
    )
  );

  return {
    props: {
      ...(id ? { id } : {}),
      background: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: 1,
      cellBackground: "#ffffff",
      cells: serializeMarkdownTableCells(normalizedRows),
      ...(Object.keys(columnOverrides).length > 0
        ? { colOverrides: JSON.stringify(columnOverrides) }
        : {}),
      columns,
      color: "#111827",
      fontSize: 12,
      h: Math.min(62, Math.max(24, 14 + normalizedRows.length * 5)),
      markdownKind: "table",
      rowOverrides: JSON.stringify({
        0: { background: "#f3f4f6", fontWeight: 700 }
      }),
      rows: Math.max(1, normalizedRows.length),
      stripeBackground: "#f8fafc",
      w: Math.min(86, Math.max(42, 24 + columns * 8)),
      x: 7,
      y: 30
    },
    type: "Table"
  };
}

function serializeMarkdownTableCells(cells: readonly (readonly string[])[]) {
  return cells
    .map((row) => row.map((cell) =>
      cell
        .replaceAll("\"", "'")
        .replaceAll("|", "/")
        .replaceAll(";", ",")
        .trim()
    ).join("|"))
    .join(";");
}

function listText(list: List): TextResult {
  const result: MutableTextResult = { ranges: [], text: "" };

  list.children.forEach((item, index) => {
    if (index > 0) appendText(result, "\n");
    appendTextResult(result, listItemText(item));
  });

  return result;
}

function listItemText(item: ListItem): TextResult {
  const result: MutableTextResult = { ranges: [], text: "" };

  item.children.forEach((child, index) => {
    if (index > 0) appendText(result, "\n");
    if (child.type === "list") {
      appendTextResult(result, listText(child));
      return;
    }
    appendTextResult(result, blockNodeText(child));
  });

  return result;
}

function blockText(nodes: readonly Content[]): TextResult {
  const result: MutableTextResult = { ranges: [], text: "" };

  nodes.forEach((node, index) => {
    if (index > 0) appendText(result, "\n");
    appendTextResult(result, blockNodeText(node));
  });

  return result;
}

function blockNodeText(node: Content): TextResult {
  if (node.type === "paragraph" || node.type === "heading") {
    return phrasingText(node.children);
  }
  if (node.type === "code") {
    return {
      ranges: node.value
        ? [{
            end: node.value.length,
            fontFamily: "ui-monospace",
            start: 0
          }]
        : [],
      text: node.value
    };
  }
  if (node.type === "list") return listText(node);
  if (node.type === "blockquote") return blockText(node.children);

  return { ranges: [], text: "" };
}

function phrasingText(nodes: readonly PhrasingContent[]): TextResult {
  const result: MutableTextResult = { ranges: [], text: "" };

  nodes.forEach((node) => appendPhrasingNode(result, node, {}));

  return {
    ranges: mergeTextRanges(result.ranges),
    text: result.text
  };
}

function appendPhrasingNode(
  result: MutableTextResult,
  node: PhrasingContent,
  inheritedStyle: MotionDocTextStyle
) {
  if (node.type === "text") {
    appendText(result, node.value, inheritedStyle);
    return;
  }

  if (node.type === "inlineCode") {
    appendText(result, node.value, {
      ...inheritedStyle,
      fontFamily: "ui-monospace"
    });
    return;
  }

  if (node.type === "break") {
    appendText(result, "\n", inheritedStyle);
    return;
  }

  if (node.type === "image") {
    appendText(result, node.alt ?? node.url, inheritedStyle);
    return;
  }

  if (node.type === "html") return;

  const nextStyle =
    node.type === "strong"
      ? { ...inheritedStyle, fontWeight: 700 }
      : node.type === "emphasis"
        ? { ...inheritedStyle, italic: true }
        : node.type === "link"
          ? {
              ...inheritedStyle,
              href: safeMarkdownHref(node.url),
              underline: true
            }
          : inheritedStyle;

  if ("children" in node) {
    node.children.forEach((child) =>
      appendPhrasingNode(result, child as PhrasingContent, nextStyle)
    );
  }
}

function appendText(
  result: MutableTextResult,
  value: string,
  style: MotionDocTextStyle = {}
) {
  const start = result.text.length;
  result.text += value;
  const end = result.text.length;
  if (end > start && hasInlineStyle(style)) {
    result.ranges.push({ ...style, end, start });
  }
}

function appendTextResult(result: MutableTextResult, value: TextResult) {
  const offset = result.text.length;
  result.text += value.text;
  result.ranges.push(
    ...value.ranges.map((range) => ({
      ...range,
      end: range.end + offset,
      start: range.start + offset
    }))
  );
}

function markdownProps(
  content: TextResult,
  baseProps: MotionDocProps,
  id?: string
): MotionDocProps {
  return {
    ...baseProps,
    ...(id ? { id } : {}),
    ...(content.ranges.length > 0
      ? { textStyleRanges: JSON.stringify(content.ranges) }
      : {})
  };
}

function markdownNodeId(node: Content, source: string) {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return undefined;

  return source.slice(0, start).match(trailingMarkdownIdPattern)?.[1]
    ?? source.slice(start, end).match(markdownIdPattern)?.[1];
}

function mergeTextRanges(
  ranges: readonly MotionDocTextStyleRange[]
): MotionDocTextStyleRange[] {
  const boundaries = new Set<number>();
  ranges.forEach(({ end, start }) => {
    boundaries.add(start);
    boundaries.add(end);
  });
  const offsets = [...boundaries].sort((left, right) => left - right);

  return offsets.slice(0, -1).flatMap((start, index) => {
    const end = offsets[index + 1];
    const active = ranges.filter(
      (range) => range.start <= start && range.end >= end
    );
    if (active.length === 0) return [];
    const style = active.reduce<MotionDocTextStyle>(
      (combined, range) => ({
        ...combined,
        ...(range.color ? { color: range.color } : {}),
        ...(range.fontFamily ? { fontFamily: range.fontFamily } : {}),
        ...(range.fontWeight === undefined
          ? {}
          : { fontWeight: range.fontWeight }),
        ...(range.href ? { href: range.href } : {}),
        ...(range.italic ? { italic: true } : {}),
        ...(range.underline ? { underline: true } : {})
      }),
      {}
    );
    return [{ ...style, end, start }];
  });
}

function hasInlineStyle(style: MotionDocTextStyle) {
  return Boolean(
    style.color ||
      style.fontFamily ||
      style.fontWeight !== undefined ||
      style.href ||
      style.italic ||
      style.underline
  );
}

function safeMarkdownHref(value: string) {
  const trimmed = value.trim();
  if (/^(?:https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (/^(?:\/|#|\.\.?\/)/.test(trimmed)) return trimmed;
  return "";
}

function markdownHeadingFontSize(depth: number) {
  if (depth === 2) return 30;
  if (depth === 3) return 24;
  if (depth === 4) return 20;
  return 17;
}
