import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/**
 * SlideX dark theme for CodeMirror 6.
 * Matches the pitch's deep-black palette with JetBrains Mono typography.
 */

const editorColors = {
  background: "#050505",
  foreground: "#e0e0e0",
  cursor: "#ffffff",
  selection: "rgba(101, 88, 245, 0.72)",
  gutterBackground: "#080808",
  gutterForeground: "#4a4a4a",
  gutterActiveForeground: "#8ea5ff",
  lineHighlight: "rgba(56, 189, 248, 0.04)",
  panelBackground: "#0a0a0a",
  panelBorder: "#1e1e1e"
} as const;

export const slidexDarkTheme = EditorView.theme(
  {
    "&": {
      color: editorColors.foreground,
      backgroundColor: editorColors.background,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
      fontSize: "12px",
      lineHeight: "28px"
    },
    ".cm-content": {
      caretColor: editorColors.cursor,
      padding: "16px 0"
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: editorColors.cursor,
      borderLeftWidth: "1.5px"
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: editorColors.selection,
      color: "#ffffff"
    },
    ".cm-panels": {
      backgroundColor: editorColors.panelBackground,
      color: editorColors.foreground,
      borderColor: editorColors.panelBorder
    },
    ".cm-panels.cm-panels-top": {
      borderBottom: `1px solid ${editorColors.panelBorder}`
    },
    ".cm-panels.cm-panels-bottom": {
      borderTop: `1px solid ${editorColors.panelBorder}`
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(142, 165, 255, 0.18)",
      outline: "1px solid rgba(142, 165, 255, 0.35)"
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(142, 165, 255, 0.3)"
    },
    ".cm-activeLine": {
      backgroundColor: editorColors.lineHighlight
    },
    ".cm-selectionMatch": {
      backgroundColor: "rgba(142, 165, 255, 0.1)"
    },
    "&.cm-focused .cm-matchingBracket": {
      backgroundColor: "rgba(142, 165, 255, 0.2)",
      outline: "1px solid rgba(142, 165, 255, 0.4)"
    },
    "&.cm-focused .cm-nonmatchingBracket": {
      color: "#ff6b6b"
    },
    ".cm-gutters": {
      backgroundColor: editorColors.gutterBackground,
      color: editorColors.gutterForeground,
      border: "none",
      borderRight: "1px solid #1a1a1a",
      minWidth: "44px"
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: editorColors.gutterActiveForeground
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "rgba(142, 165, 255, 0.1)",
      border: "1px solid rgba(142, 165, 255, 0.2)",
      color: "#8ea5ff",
      borderRadius: "3px",
      padding: "0 4px",
      margin: "0 2px"
    },
    ".cm-tooltip": {
      backgroundColor: "#0f111a",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      borderRadius: "6px",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)"
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li[aria-selected]": {
        backgroundColor: "rgba(142, 165, 255, 0.12)"
      }
    },
    ".cm-scroller": {
      overflow: "auto",
      scrollbarWidth: "thin",
      scrollbarColor: "#333 transparent"
    },
    "&.cm-focused": {
      outline: "none"
    }
  },
  { dark: true }
);

const slidexHighlightStyle = HighlightStyle.define([
  // Headings
  { tag: tags.heading1, color: "#8ea5ff", fontWeight: "700" },
  { tag: tags.heading2, color: "#8ea5ff", fontWeight: "600" },
  { tag: tags.heading3, color: "#8ea5ff", fontWeight: "600" },
  { tag: tags.heading, color: "#8ea5ff", fontWeight: "600" },

  // Emphasis
  { tag: tags.emphasis, color: "#c3e88d", fontStyle: "italic" },
  { tag: tags.strong, color: "#f0f0f0", fontWeight: "700" },
  { tag: tags.strikethrough, color: "#666", textDecoration: "line-through" },

  // Code
  { tag: tags.monospace, color: "#89ddff" },

  // Links
  { tag: tags.link, color: "#82aaff", textDecoration: "underline" },
  { tag: tags.url, color: "#82aaff" },

  // Lists & quotes
  { tag: tags.quote, color: "#676e95", fontStyle: "italic" },
  { tag: tags.list, color: "#89ddff" },

  // HTML / JSX tags
  { tag: tags.tagName, color: "#c792ea" },
  { tag: tags.angleBracket, color: "#89ddff" },
  { tag: tags.attributeName, color: "#ffcb6b" },
  { tag: tags.attributeValue, color: "#c3e88d" },

  // Strings
  { tag: tags.string, color: "#c3e88d" },

  // Numbers
  { tag: tags.number, color: "#f78c6c" },

  // Boolean & null
  { tag: tags.bool, color: "#ff5370" },
  { tag: tags.null, color: "#ff5370" },

  // Keywords & operators
  { tag: tags.keyword, color: "#c792ea" },
  { tag: tags.operator, color: "#89ddff" },
  { tag: tags.punctuation, color: "#89ddff" },

  // Properties
  { tag: tags.propertyName, color: "#82aaff" },

  // Comments
  { tag: tags.comment, color: "#546e7a", fontStyle: "italic" },
  { tag: tags.blockComment, color: "#546e7a", fontStyle: "italic" },
  { tag: tags.lineComment, color: "#546e7a", fontStyle: "italic" },

  // Meta / frontmatter
  { tag: tags.meta, color: "#ffcb6b" },
  { tag: tags.processingInstruction, color: "#676e95" },

  // Content text (paragraphs)
  { tag: tags.content, color: "#e0e0e0" },

  // Separator (---)
  { tag: tags.separator, color: "#3a3a3a" }
]);

export const slidexHighlight = syntaxHighlighting(slidexHighlightStyle);
