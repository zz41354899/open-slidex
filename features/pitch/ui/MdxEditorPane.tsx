"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { bracketMatching } from "@codemirror/language";
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { slidexDarkTheme, slidexHighlight } from "@/features/pitch/ui/editor/codeMirrorTheme";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

export function MdxEditorPane({
  source,
  onSourceChange,
  selectionSource,
  onSelectionSourceChange,
  sceneCount,
  selectionLabel,
  copySource
}: {
  source: string;
  onSourceChange: (value: string) => void;
  selectionSource: string;
  onSelectionSourceChange: (value: string) => void;
  sceneCount: number;
  selectionLabel: string;
  copySource: () => Promise<void>;
}) {
  const { locale, tx } = usePitchI18n();
  const [editorScope, setEditorScope] = useState<"selection" | "deck">("selection");
  const [localSource, setLocalSource] = useState("");
  const [cursorInfo, setCursorInfo] = useState({ line: 1, column: 1 });
  const editorViewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    const next = editorScope === "selection" ? selectionSource : source;
    setLocalSource(next);
    setCursorInfo({ line: 1, column: 1 });
  }, [editorScope, selectionLabel, source, selectionSource]);

  const lineCount = useMemo(() => localSource.split("\n").length, [localSource]);

  const extensions = useMemo(
    () => [
      markdown({
        base: markdownLanguage,
        codeLanguages: [],
        extensions: []
      }),
      javascript({ jsx: true }),
      html(),
      EditorView.lineWrapping,
      bracketMatching(),
      closeBrackets(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      highlightSelectionMatches(),
      history(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...closeBracketsKeymap,
        ...searchKeymap,
        indentWithTab
      ]),
      slidexDarkTheme,
      slidexHighlight
    ],
    []
  );

  const handleChange = useCallback(
    (value: string) => {
      setLocalSource(value);
      if (editorScope === "selection") {
        onSelectionSourceChange(value);
      } else {
        onSourceChange(value);
      }
    },
    [editorScope, onSourceChange, onSelectionSourceChange]
  );

  const handleEditorUpdate = useCallback((viewUpdate: { state: { selection: { main: { head: number } }; doc: { lineAt: (pos: number) => { number: number; from: number } } } }) => {
    const pos = viewUpdate.state.selection.main.head;
    const line = viewUpdate.state.doc.lineAt(pos);
    setCursorInfo({
      line: line.number,
      column: pos - line.from + 1
    });
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0A0A0A] font-sans antialiased">
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="rounded bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] font-medium text-neutral-400">
            {editorScope === "selection" ? selectionLabel : "deck.mdx"}
          </span>
          <span className="text-[12px] font-medium text-neutral-500">{locale === "zh-TW" ? `${lineCount} 行` : `${lineCount} lines`}</span>
          <span className="text-[12px] text-neutral-700">/</span>
          <span className="text-[12px] font-medium text-neutral-500">{locale === "zh-TW" ? `${sceneCount} 個場景` : `${sceneCount} scenes`}</span>
        </div>
        <button
          className="flex h-7 items-center justify-center gap-1.5 rounded-md bg-white/[0.03] px-3 text-[12px] font-medium text-neutral-300 transition-colors hover:bg-white/[0.05] hover:text-white"
          onClick={copySource}
          type="button"
        >
          <Copy size={12} />
          {tx("Copy MDX")}
        </button>
      </div>
      {/* Mode Tabs */}
      <div className="flex items-center border-b border-white/[0.04] px-5 py-3">
        <div className="flex gap-4">
          {(["selection", "deck"] as const).map((scope) => (
            <button
              className={`text-[13px] font-medium transition-colors ${
                editorScope === scope
                  ? "text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
              key={scope}
              onClick={() => setEditorScope(scope)}
              type="button"
            >
              {tx(scope === "selection" ? "Selection" : "Full Deck")}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-transparent">
        <CodeMirror
          basicSetup={false}
          extensions={extensions}
          height="100%"
          onChange={handleChange}
          onCreateEditor={(view) => {
            editorViewRef.current = view;
          }}
          onUpdate={handleEditorUpdate}
          style={{ height: "100%", overflow: "auto" }}
          theme="none"
          value={localSource}
        />
      </div>
      <div className="flex items-center justify-between border-t border-white/[0.04] px-5 py-3 font-mono text-[11px] text-neutral-500">
        <span>{locale === "zh-TW" ? `第 ${cursorInfo.line} 行，第 ${cursorInfo.column} 欄` : `Ln ${cursorInfo.line}, Col ${cursorInfo.column}`}</span>
        <span className="font-medium">{tx(editorScope === "selection" ? "Selection MDX" : "Full MDX")}</span>
      </div>
    </div>
  );
}
