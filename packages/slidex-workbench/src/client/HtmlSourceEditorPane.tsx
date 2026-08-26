import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { bracketMatching } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { FileCode2, RectangleHorizontal, RotateCcw, Save, WrapText } from "lucide-react";
import {
  htmlPageSourceSelection,
  replaceHtmlSourceRange,
  type HtmlPageSourceSelection
} from "@/core/motion-doc/domain/htmlPageSource";
import { slidexDarkTheme, slidexHighlight } from "@/features/pitch/ui/editor/codeMirrorTheme";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { htmlSourceEditorMetrics, htmlSourceSaveEnabled } from "./htmlSourceEditorState";

export function HtmlSourceEditorPane({ activePage, isSaving, onChange, onReset, onSave, pageCount, savedSource, source }: {
  activePage: number;
  isSaving: boolean;
  onChange: (source: string) => void;
  onReset: () => void;
  onSave: (source: string) => void;
  pageCount: number;
  savedSource: string;
  source: string;
}) {
  const { locale } = usePitchI18n();
  const [cursor, setCursor] = useState({ column: 1, line: 1 });
  const [editorGeneration, setEditorGeneration] = useState(0);
  const [editorScope, setEditorScope] = useState<"document" | "page">("page");
  const [pageDraft, setPageDraft] = useState("");
  const [pageSelection, setPageSelection] = useState<HtmlPageSourceSelection | null>(null);
  const [wrapLines, setWrapLines] = useState(true);
  const deferredSource = useDeferredValue(source);
  const authoredSourceRef = useRef<string | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const initializedPageKeyRef = useRef("");
  const pageSelectionRef = useRef<HtmlPageSourceSelection | null>(null);
  const sourceRef = useRef(source);
  const dirty = source !== savedSource;
  const metrics = useMemo(() => htmlSourceEditorMetrics(deferredSource), [deferredSource]);
  const pageMetrics = useMemo(() => htmlSourceEditorMetrics(pageDraft), [pageDraft]);
  const metricsAreCurrent = deferredSource === source;
  const saveEnabled = metricsAreCurrent && htmlSourceSaveEnabled({
    byteCount: metrics.byteCount,
    dirty,
    isSaving
  });
  const saveRef = useRef(() => undefined);
  saveRef.current = () => {
    if (saveEnabled) onSave(source);
  };
  const displayedStartLine = editorScope === "page" ? pageSelection?.line ?? 1 : 1;
  const extensions = useMemo(() => [
    html({ matchClosingTags: true, selfClosingTags: true }),
    lineNumbers({ formatNumber: (lineNumber) => String(lineNumber + displayedStartLine - 1) }),
    ...(wrapLines ? [EditorView.lineWrapping] : []),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    highlightSelectionMatches(),
    history(),
    keymap.of([
      {
        key: "Mod-s",
        preventDefault: true,
        run: () => {
          saveRef.current();
          return true;
        }
      },
      ...defaultKeymap,
      ...historyKeymap,
      ...closeBracketsKeymap,
      ...searchKeymap,
      indentWithTab
    ]),
    slidexDarkTheme,
    slidexHighlight
  ], [displayedStartLine, wrapLines]);

  const positionEditorForScope = useCallback(() => {
    const editorView = editorViewRef.current;
    if (!editorView) return false;
    const anchor = editorScope === "document"
      ? Math.min(pageSelection?.from ?? 0, editorView.state.doc.length)
      : 0;
    editorView.dispatch({
      effects: EditorView.scrollIntoView(anchor, { y: "start", yMargin: 48 }),
      selection: { anchor }
    });
    return true;
  }, [editorScope, pageSelection?.from]);

  const resetSource = useCallback(() => {
    const nextSelection = htmlPageSourceSelection(savedSource, activePage);
    const nextDisplayedSource = editorScope === "page" ? nextSelection?.source ?? "" : savedSource;
    sourceRef.current = savedSource;
    authoredSourceRef.current = null;
    pageSelectionRef.current = nextSelection;
    const editorView = editorViewRef.current;
    if (editorView && editorView.state.doc.toString() !== nextDisplayedSource) {
      editorView.dispatch({
        changes: { from: 0, insert: nextDisplayedSource, to: editorView.state.doc.length },
        selection: { anchor: 0 }
      });
    }
    setPageSelection(nextSelection);
    setPageDraft(nextSelection?.source ?? "");
    setCursor({ column: 1, line: 1 });
    onReset();
  }, [activePage, editorScope, onReset, savedSource]);

  useEffect(() => {
    // Content-addressed HTML asset paths change after every save. Keep the
    // editor identity tied to the selected page so autosave never steals the
    // cursor or scroll position when the same document receives its new hash.
    const pageKey = String(activePage);
    const pageChanged = initializedPageKeyRef.current !== pageKey;
    sourceRef.current = source;
    if (!pageChanged && authoredSourceRef.current === source) {
      authoredSourceRef.current = null;
      return;
    }

    authoredSourceRef.current = null;
    initializedPageKeyRef.current = pageKey;
    const nextSelection = htmlPageSourceSelection(source, activePage);
    pageSelectionRef.current = nextSelection;
    setPageSelection(nextSelection);
    setPageDraft(nextSelection?.source ?? "");
    setCursor({ column: 1, line: 1 });
  }, [activePage, source]);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => positionEditorForScope());
    return () => window.cancelAnimationFrame(animationFrame);
  }, [activePage, editorGeneration, editorScope, positionEditorForScope]);

  const changeDisplayedSource = useCallback((value: string) => {
    if (editorScope === "document") {
      const nextSelection = htmlPageSourceSelection(value, activePage);
      pageSelectionRef.current = nextSelection;
      sourceRef.current = value;
      authoredSourceRef.current = value;
      setPageSelection(nextSelection);
      setPageDraft(nextSelection?.source ?? "");
      onChange(value);
      return;
    }

    const currentSelection = pageSelectionRef.current;
    if (!currentSelection) return;
    const nextSource = replaceHtmlSourceRange(sourceRef.current, currentSelection, value);
    const nextSelection = {
      ...currentSelection,
      outerTo: currentSelection.from + value.length,
      source: value
    };
    pageSelectionRef.current = nextSelection;
    sourceRef.current = nextSource;
    authoredSourceRef.current = nextSource;
    setPageSelection(nextSelection);
    setPageDraft(value);
    onChange(nextSource);
  }, [activePage, editorScope, onChange]);
  const onUpdate = useCallback((update: { state: { selection: { main: { head: number } }; doc: { lineAt: (position: number) => { from: number; number: number } } } }) => {
    const position = update.state.selection.main.head;
    const line = update.state.doc.lineAt(position);
    const next = { column: position - line.from + 1, line: line.number };
    setCursor((current) => current.column === next.column && current.line === next.line ? current : next);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#090909]" data-html-editor-wrap={wrapLines ? "true" : "false"}>
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-white/[0.06] bg-[#0d0d0f] px-3">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-0.5 rounded-lg border border-white/[0.07] bg-black/25 p-0.5">
          <button
            aria-pressed={editorScope === "page"}
            className={`flex h-7 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[10px] font-medium transition ${editorScope === "page" ? "bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(196,181,253,0.1)]" : "text-neutral-500 hover:bg-white/[0.05] hover:text-neutral-200"}`}
            data-html-source-scope="page"
            onClick={() => setEditorScope("page")}
            title={locale === "zh-TW" ? "只編輯所選投影片的 HTML" : "Edit only the selected slide HTML"}
            type="button"
          >
            <RectangleHorizontal className="shrink-0" size={12} /> <span className="truncate">{locale === "zh-TW" ? `第 ${activePage} 頁` : `Page ${activePage}`}</span>
          </button>
          <button
            aria-pressed={editorScope === "document"}
            className={`flex h-7 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[10px] font-medium transition ${editorScope === "document" ? "bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(196,181,253,0.1)]" : "text-neutral-500 hover:bg-white/[0.05] hover:text-neutral-200"}`}
            data-html-source-scope="document"
            onClick={() => setEditorScope("document")}
            title={locale === "zh-TW" ? "編輯共用 CSS、JavaScript 與完整 HTML" : "Edit shared CSS, JavaScript, and the full HTML document"}
            type="button"
          >
            <FileCode2 className="shrink-0" size={12} /> <span className="truncate">{locale === "zh-TW" ? "完整原檔" : "Full source"}</span>
          </button>
        </div>
        <button
          aria-label={locale === "zh-TW" ? "長行換行" : "Wrap long lines"}
          aria-pressed={wrapLines}
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] text-neutral-500 transition hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-neutral-200 ${wrapLines ? "bg-white/[0.08] text-neutral-200" : "bg-black/25"}`}
          onClick={() => setWrapLines((current) => !current)}
          title={locale === "zh-TW" ? "切換長行自動換行" : "Toggle long-line wrapping"}
          type="button"
        >
          <WrapText size={13} />
        </button>
        <button
          aria-label={locale === "zh-TW" ? "還原未儲存變更" : "Reset unsaved changes"}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] text-neutral-500 transition hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          disabled={!dirty || isSaving}
          onClick={resetSource}
          title={locale === "zh-TW" ? "還原未儲存變更" : "Reset unsaved changes"}
          type="button"
        >
          <RotateCcw size={13} />
        </button>
        <button
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#9b8cff] px-2.5 text-[10px] font-semibold text-[#100d1d] shadow-[0_0_22px_rgba(155,140,255,0.14)] transition hover:bg-[#b0a5ff] disabled:cursor-not-allowed disabled:opacity-35"
          disabled={!saveEnabled}
          onClick={() => onSave(source)}
          title={locale === "zh-TW" ? "立即儲存；停止輸入後也會自動儲存" : "Save now; changes also auto-save after typing stops"}
          type="button"
        >
          <Save size={12} /> {isSaving
            ? (locale === "zh-TW" ? "儲存中" : "Saving")
            : (locale === "zh-TW" ? "立即儲存" : "Save now")}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden" data-html-source-editor-scope={editorScope}>
        <CodeMirror
          basicSetup={false}
          extensions={extensions}
          height="100%"
          onChange={changeDisplayedSource}
          onCreateEditor={(view) => {
            editorViewRef.current = view;
            setEditorGeneration((generation) => generation + 1);
          }}
          onUpdate={onUpdate}
          style={{ height: "100%", overflow: "auto" }}
          theme="none"
          value={editorScope === "page" ? pageDraft : source}
        />
      </div>
      <div className="flex h-8 shrink-0 items-center justify-between gap-3 border-t border-white/[0.06] bg-[#0c0c0d] px-3 font-mono text-[9px] text-neutral-600">
        <span className="min-w-0 truncate" data-html-source-line={pageSelection?.line ?? ""}>{locale === "zh-TW"
          ? `第 ${displayedStartLine + cursor.line - 1} 行 · ${editorScope === "page" && pageSelection && !pageSelection.fullDocument ? `原檔 ${pageSelection.line}–${pageSelection.line + pageMetrics.lineCount - 1}` : `完整原檔 ${metrics.lineCount} 行`}`
          : `Ln ${displayedStartLine + cursor.line - 1}, Col ${cursor.column} · ${editorScope === "page" && pageSelection && !pageSelection.fullDocument ? `source ${pageSelection.line}–${pageSelection.line + pageMetrics.lineCount - 1}` : `${metrics.lineCount} lines · ${pageCount} pages`}`}</span>
        <span
          className={`shrink-0 ${isSaving ? "text-violet-300/80" : dirty ? "text-amber-300/80" : "text-emerald-300/70"}`}
          data-html-autosave-status={isSaving ? "saving" : dirty ? "pending" : "saved"}
        >{isSaving
            ? (locale === "zh-TW" ? "正在自動儲存" : "Auto-saving")
            : dirty
              ? (locale === "zh-TW" ? "等待自動儲存" : "Waiting to auto-save")
              : (locale === "zh-TW" ? "HTML 已同步" : "HTML synced")}</span>
      </div>
    </div>
  );
}
