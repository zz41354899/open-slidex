import { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";

import type { ValidationIssue } from "./domain";

type CodeEditorProps = {
  issues: ValidationIssue[];
  onChange: (source: string) => void;
  source: string;
};

export function CodeEditor({ issues, onChange, source }: CodeEditorProps) {
  const [cursor, setCursor] = useState({ column: 1, line: 1 });
  const errorCount = issues.filter((issue) => issue.severity === "error").length;

  return (
    <section className="source-panel" aria-label="MDX source editor">
      <div className="panel-header">
        <div>
          <strong>presentation.mdx</strong>
          <span>MDX + CommonMark</span>
        </div>
        <span className="mono-meta">Ln {cursor.line}, Col {cursor.column}</span>
      </div>
      <SnippetBar onInsert={(snippet) => onChange(insertSnippet(source, snippet))} />
      <div className="code-editor-shell">
        <CodeMirror
          aria-label="presentation.mdx editor"
          basicSetup={{
            bracketMatching: true,
            closeBrackets: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            lineNumbers: true
          }}
          extensions={[
            markdown({ base: markdownLanguage, codeLanguages: [], extensions: [] }),
            javascript({ jsx: true, typescript: true }),
            html()
          ]}
          height="100%"
          onChange={onChange}
          onUpdate={(update) => {
            const position = update.state.selection.main.head;
            const line = update.state.doc.lineAt(position);
            setCursor({ column: position - line.from + 1, line: line.number });
          }}
          theme="dark"
          value={source}
        />
      </div>
      <div className={`diagnostics ${errorCount ? "has-error" : ""}`}>
        <strong>{errorCount ? `${errorCount} errors` : "Syntax valid"}</strong>
        <span>{issues[0]?.message ?? "Ready to render"}</span>
      </div>
    </section>
  );
}

function SnippetBar({ onInsert }: { onInsert: (snippet: string) => void }) {
  const snippets = [
    ["Slide", '\n\n<Slide duration={5} canvasWidth={1920} canvasHeight={1080} fontSizeUnit="pt" theme="light" background="#FFFFFF">\n  <Text id="slide-title" role="title" x={8} y={10} w={84} h={14} fontSize={40} fontWeight={700}>New slide</Text>\n</Slide>'],
    ["Text", '\n\n<Text id="text-layer" x={8} y={30} w={54} h={16} fontSize={24} lineHeight={1.25} enter="fadeUp">Editable text</Text>'],
    ["Image", '\n\n<ImageBlock id="image-layer" src="assets/image.webp" alt="Describe the image" x={54} y={18} w={38} h={64} fit="cover" />'],
    ["Shape", '\n\n<Shape id="shape-layer" shape="rectangle" x={8} y={70} w={20} h={8} fill="#111111" stroke="transparent" />']
  ] as const;

  return (
    <div className="snippet-bar" aria-label="Insert snippet">
      {snippets.map(([label, snippet]) => (
        <button key={label} onClick={() => onInsert(snippet)} type="button">
          + {label}
        </button>
      ))}
    </div>
  );
}

function insertSnippet(source: string, snippet: string) {
  return `${source.trimEnd()}${snippet}\n`;
}
