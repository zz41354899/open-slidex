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
    ["Slide", '\n\n<Slide duration={5} theme="light" background="#ffffff">\n\n## New slide\n\nAdd your story.\n\n</Slide>'],
    ["Text", '\n\n<Text fontSize={24} enter="fadeUp">Editable text</Text>'],
    ["Image", '\n\n<ImageBlock src="assets/image.webp" alt="Describe the image" fit="cover" />'],
    ["List", "\n\n- First point\n- Second point"],
    ["Group", '\n\n<Group id="group" name="Group">\n  <Text>Grouped layer</Text>\n</Group>'],
    ["Notes", "\n\n<Notes>\nPresenter-only notes.\n</Notes>"]
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
