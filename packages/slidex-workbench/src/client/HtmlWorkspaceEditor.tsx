import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Check, CodeXml, LoaderCircle, PanelRightClose, PanelRightOpen, RefreshCw, ShieldCheck, X } from "lucide-react";

import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { localWorkbenchAssetUrl } from "./api";
import {
  htmlSourceEditorMetrics,
  htmlSourceSaveEnabled,
  scheduleHtmlSourceAutosave
} from "./htmlSourceEditorState";

const HtmlSourceEditorPane = lazy(() => import("./HtmlSourceEditorPane").then(({ HtmlSourceEditorPane: component }) => ({ default: component })));

export type HtmlWorkspaceSaveResult = {
  source: string;
};
export type HtmlWorkspaceSaveReason = "auto" | "manual";

export function HtmlWorkspaceEditor({ activePage, onCloseMobile, onSave, pageCount, sourcePath }: {
  activePage: number;
  onCloseMobile: () => void;
  onSave: (sourcePath: string, html: string, reason: HtmlWorkspaceSaveReason) => Promise<HtmlWorkspaceSaveResult>;
  pageCount: number;
  sourcePath: string;
}) {
  const { locale } = usePitchI18n();
  const [source, setSource] = useState("");
  const [savedSource, setSavedSource] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const loadedPathRef = useRef("");
  const dirtyRef = useRef(false);
  const failedSourceRef = useRef("");
  const savedSourceRef = useRef("");
  const savingRef = useRef(false);
  const sourcePathRef = useRef(sourcePath);
  const sourceRef = useRef("");
  dirtyRef.current = source !== savedSource;

  useEffect(() => {
    if (loadedPathRef.current === sourcePath) return;
    if (dirtyRef.current && loadedPathRef.current) {
      setError(locale === "zh-TW"
        ? "HTML 已在外部更新。請先保留目前草稿，或按重新載入改用磁碟版本。"
        : "HTML changed externally. Keep your draft or reload the version on disk.");
      return;
    }

    let cancelled = false;
    setError("");
    setIsLoading(true);
    void fetch(localWorkbenchAssetUrl(sourcePath), { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTML request failed (${response.status})`);
        const html = await response.text();
        if (cancelled) return;
        loadedPathRef.current = sourcePath;
        sourcePathRef.current = sourcePath;
        sourceRef.current = html;
        savedSourceRef.current = html;
        failedSourceRef.current = "";
        setSource(html);
        setSavedSource(html);
        setSavedAt(null);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not read HTML source.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt, locale, sourcePath]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [source, savedSource]);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const expandOnMobile = () => {
      if (mobileQuery.matches) setCollapsed(false);
    };
    expandOnMobile();
    mobileQuery.addEventListener("change", expandOnMobile);
    return () => mobileQuery.removeEventListener("change", expandOnMobile);
  }, []);

  const reload = useCallback(() => {
    if (dirtyRef.current && !window.confirm(locale === "zh-TW" ? "放棄尚未儲存的 HTML 變更？" : "Discard unsaved HTML changes?")) return;
    loadedPathRef.current = "";
    sourceRef.current = "";
    savedSourceRef.current = "";
    failedSourceRef.current = "";
    setSource("");
    setSavedSource("");
    setLoadAttempt((value) => value + 1);
  }, [locale]);

  const changeSource = useCallback((nextSource: string) => {
    sourceRef.current = nextSource;
    if (failedSourceRef.current && failedSourceRef.current !== nextSource) {
      failedSourceRef.current = "";
      setError("");
    }
    setSource(nextSource);
  }, []);

  const resetSource = useCallback(() => {
    const nextSource = savedSourceRef.current;
    const clearSaveError = Boolean(failedSourceRef.current);
    failedSourceRef.current = "";
    sourceRef.current = nextSource;
    if (clearSaveError) setError("");
    setSource(nextSource);
  }, []);

  const save = useCallback(async (nextHtml: string, reason: HtmlWorkspaceSaveReason) => {
    if (
      savingRef.current
      || nextHtml === savedSourceRef.current
      || (reason === "auto" && failedSourceRef.current === nextHtml)
    ) return;
    const metrics = htmlSourceEditorMetrics(nextHtml);
    if (!htmlSourceSaveEnabled({ byteCount: metrics.byteCount, dirty: true, isSaving: false })) return;

    savingRef.current = true;
    setIsSaving(true);
    setError("");
    try {
      const result = await onSave(sourcePathRef.current, nextHtml, reason);
      loadedPathRef.current = result.source;
      sourcePathRef.current = result.source;
      savedSourceRef.current = nextHtml;
      failedSourceRef.current = "";
      setSavedSource(nextHtml);
      setSavedAt(new Date());
    } catch (error) {
      failedSourceRef.current = nextHtml;
      setError(error instanceof Error ? error.message : (locale === "zh-TW" ? "無法儲存 HTML 原檔。" : "Could not save the HTML source."));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [locale, onSave]);

  useEffect(() => {
    if (isLoading || isSaving || source === savedSource || failedSourceRef.current === source) return;
    const metrics = htmlSourceEditorMetrics(source);
    if (!htmlSourceSaveEnabled({ byteCount: metrics.byteCount, dirty: true, isSaving: false })) return;
    return scheduleHtmlSourceAutosave(() => void save(source, "auto"));
  }, [isLoading, isSaving, save, savedSource, source]);

  const currentPage = Math.min(Math.max(activePage, 1), Math.max(pageCount, 1));
  const dirty = source !== savedSource;
  const saveState = isSaving ? "saving" : dirty ? "pending" : savedAt ? "saved" : "idle";
  const savedLabel = isSaving
    ? (locale === "zh-TW" ? "正在自動儲存…" : "Auto-saving…")
    : dirty
      ? (locale === "zh-TW" ? "等待自動儲存" : "Waiting to auto-save")
      : savedAt
        ? (locale === "zh-TW"
            ? `已自動儲存 ${savedAt.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`
            : `Auto-saved ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`)
        : (locale === "zh-TW" ? "隔離預覽 · 自動儲存" : "Sandboxed preview · Auto-save");

  return (
    <aside
      className={`flex h-full shrink-0 flex-col overflow-hidden border-l border-white/[0.08] bg-[#0f0f10] font-sans antialiased shadow-[-18px_0_46px_rgba(0,0,0,0.16)] transition-[width] duration-200 ease-out ${collapsed ? "w-14" : "w-[min(94vw,430px)] md:w-[clamp(380px,34vw,470px)]"}`}
      data-html-autosave-state={saveState}
      data-html-source-collapsed={collapsed ? "true" : "false"}
      data-html-source-workspace
    >
      {collapsed ? (
        <div className="hidden h-full w-14 flex-col items-center bg-[#121214] py-3 md:flex">
          <button
            aria-label={locale === "zh-TW" ? "展開 HTML 編輯器" : "Expand HTML editor"}
            className="flex size-9 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-white/[0.06] hover:text-white"
            onClick={() => setCollapsed(false)}
            title={locale === "zh-TW" ? "展開 HTML 編輯器" : "Expand HTML editor"}
            type="button"
          >
            <PanelRightOpen size={16} />
          </button>
          <span className="my-3 h-px w-6 bg-white/[0.07]" />
          <span className="flex size-8 items-center justify-center rounded-xl bg-violet-400/[0.1] text-[#aa9cff]">
            <CodeXml size={15} />
          </span>
          <span className="mt-4 font-mono text-[11px] font-semibold text-neutral-300">{padPage(currentPage)}</span>
          <span className="mt-2 text-[8px] font-semibold tracking-[0.16em] text-neutral-600 [writing-mode:vertical-rl]">HTML</span>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex min-h-[62px] shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-[#141416] px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-400/[0.09] text-[#aa9cff]">
                <CodeXml size={15} />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-[12px] font-semibold text-white">{locale === "zh-TW" ? "HTML 原檔" : "HTML source"}</h2>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[9px] text-neutral-500">
                  {isSaving
                    ? <LoaderCircle aria-hidden="true" className="shrink-0 animate-spin text-violet-300/75" size={10} />
                    : savedAt && !dirty
                      ? <Check aria-hidden="true" className="shrink-0 text-emerald-400/75" size={10} />
                      : <ShieldCheck aria-hidden="true" className={`shrink-0 ${dirty ? "text-amber-300/75" : "text-emerald-400/65"}`} size={10} />}
                  <span aria-live="polite" className={`shrink-0 ${dirty ? "text-amber-200/65" : "text-emerald-200/60"}`}>{savedLabel}</span>
                  <span aria-hidden="true" className="text-neutral-700">·</span>
                  <span className="truncate font-mono" title={sourcePath}>{fileName(sourcePath)}</span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="flex h-8 items-baseline gap-1 rounded-lg border border-white/[0.07] bg-black/20 px-2 font-mono">
                <strong className="text-[12px] font-semibold leading-8 text-white">{padPage(currentPage)}</strong>
                <span className="text-[9px] text-neutral-600">/ {padPage(pageCount)}</span>
              </span>
              <button
                aria-label={locale === "zh-TW" ? "收合 HTML 編輯器" : "Collapse HTML editor"}
                className="hidden size-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/[0.06] hover:text-white md:flex"
                onClick={() => setCollapsed(true)}
                title={locale === "zh-TW" ? "收合 HTML 編輯器" : "Collapse HTML editor"}
                type="button"
              >
                <PanelRightClose size={15} />
              </button>
              <button aria-label={locale === "zh-TW" ? "關閉 HTML 編輯器" : "Close HTML editor"} className="flex size-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/[0.06] hover:text-white md:hidden" onClick={onCloseMobile} type="button">
                <X size={16} />
              </button>
            </div>
          </header>

          {error ? (
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-rose-300/10 bg-rose-400/[0.055] px-3.5 py-2.5 text-[10px] leading-relaxed text-rose-200/80" role="alert">
              <span>{error}</span>
              <button className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 font-semibold text-rose-100 transition hover:bg-white/[0.07]" onClick={reload} type="button">
                <RefreshCw size={11} /> {locale === "zh-TW" ? "重新載入" : "Reload"}
              </button>
            </div>
          ) : null}

          {isLoading ? <Loading label={locale === "zh-TW" ? "正在讀取 HTML 原檔…" : "Reading HTML source…"} /> : source ? (
            <Suspense fallback={<Loading label={locale === "zh-TW" ? "正在載入程式碼編輯器…" : "Loading code editor…"} />}>
              <HtmlSourceEditorPane
                activePage={currentPage}
                isSaving={isSaving}
                onChange={changeSource}
                onReset={resetSource}
                onSave={(value) => void save(value, "manual")}
                pageCount={pageCount}
                savedSource={savedSource}
                source={source}
              />
            </Suspense>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-xs text-neutral-500">
              <p>{error || (locale === "zh-TW" ? "HTML 原檔沒有內容。" : "The HTML source is empty.")}</p>
              <button className="flex items-center gap-2 rounded-lg border border-white/[0.1] px-3 py-2 text-neutral-300 transition hover:bg-white/[0.05]" onClick={reload} type="button"><RefreshCw size={13} />{locale === "zh-TW" ? "再試一次" : "Try again"}</button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function Loading({ label }: { label: string }) {
  return <div aria-busy="true" className="flex min-h-0 flex-1 items-center justify-center gap-2.5 text-xs text-neutral-500"><LoaderCircle className="animate-spin text-[#aa9cff]" size={18} />{label}</div>;
}

function padPage(value: number) {
  return String(Math.max(1, value)).padStart(2, "0");
}

function fileName(sourcePath: string) {
  return sourcePath.split("/").pop() || sourcePath;
}
