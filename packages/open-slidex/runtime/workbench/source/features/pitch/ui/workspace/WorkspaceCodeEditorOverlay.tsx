
import { lazy, Suspense, useEffect, useState } from "react";
import { Code2, LoaderCircle, RefreshCw, X } from "lucide-react";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import type { PitchWorkspaceProps } from "@/features/pitch/ui/workspace/PitchWorkspaceTypes";

let mdxEditorPanePromise: Promise<typeof import("@/features/pitch/ui/MdxEditorPane")> | undefined;
const MDX_EDITOR_LOADING_MINIMUM_MS = 180;

export function preloadMdxEditorPane() {
  mdxEditorPanePromise ??= import("@/features/pitch/ui/MdxEditorPane").catch((error: unknown) => {
    // A transient chunk/network failure must not poison every future MDX open.
    mdxEditorPanePromise = undefined;
    throw error;
  });
  return mdxEditorPanePromise;
}

const MdxEditorPane = lazy(() => preloadMdxEditorPane().then(({ MdxEditorPane: component }) => ({ default: component })));

type WorkspaceCodeEditorOverlayProps = Pick<PitchWorkspaceProps, "commands" | "document" | "selection" | "view"> & {
  sceneCount: number;
};

export function WorkspaceCodeEditorOverlay({ commands, document, sceneCount, selection, view }: WorkspaceCodeEditorOverlayProps) {
  if (!view.isCodeEditorOpen) return null;
  return <MdxEditorSession commands={commands} document={document} sceneCount={sceneCount} selection={selection} view={view} />;
}

function MdxEditorSession({ commands, document, sceneCount, selection, view }: WorkspaceCodeEditorOverlayProps) {
  const { tx } = usePitchI18n();
  const [isMdxEditorReady, setIsMdxEditorReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timeout: number | undefined;
    const openedAt = performance.now();
    setIsMdxEditorReady(false);
    setLoadError("");
    void preloadMdxEditorPane().then(() => {
      const remainingDelay = Math.max(0, MDX_EDITOR_LOADING_MINIMUM_MS - (performance.now() - openedAt));
      timeout = window.setTimeout(() => {
        if (!cancelled) setIsMdxEditorReady(true);
      }, remainingDelay);
    }).catch(() => {
      if (!cancelled) setLoadError(tx("Could not open MDX editor."));
    });

    return () => {
      cancelled = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [loadAttempt, tx]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm transition-all" onMouseDown={() => view.setIsCodeEditorOpen(false)}>
      <div
        className="absolute inset-y-4 right-4 flex w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0814]/90 shadow-[-20px_0_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl md:max-w-[700px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Code2 className="text-[#a78bfa]" size={16} />
            <span className="text-sm font-semibold tracking-wide text-white">{tx("MDX Editor")}</span>
          </div>
          <button
            aria-label={tx("Close MDX editor")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-all hover:bg-white/10 hover:text-white"
            onClick={() => view.setIsCodeEditorOpen(false)}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
        {loadError ? <MdxEditorLoadError label={loadError} onRetry={() => setLoadAttempt((attempt) => attempt + 1)} retryLabel={tx("Try again")} /> : isMdxEditorReady ? (
          <Suspense fallback={<MdxEditorLoading label={tx("Opening MDX editor…")} />}>
            <MdxEditorPane
              copySource={commands.copySource}
              onSelectionSourceChange={commands.updateSelectionMdx}
              onSourceChange={(value) => {
                commands.pushUndoSnapshot();
                commands.commitMdxSource(value);
              }}
              sceneCount={sceneCount}
              selectionLabel={selection.selectionMdx.label}
              selectionSource={selection.selectionMdx.source}
              source={document.source}
            />
          </Suspense>
        ) : <MdxEditorLoading label={tx("Reading presentation.mdx…")} />}
      </div>
    </div>
  );
}

function MdxEditorLoading({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-sm text-neutral-400">
      <LoaderCircle aria-hidden="true" className="animate-spin text-[#a78bfa]" size={22} />
      <span>{label}</span>
    </div>
  );
}

function MdxEditorLoadError({ label, onRetry, retryLabel }: { label: string; onRetry: () => void; retryLabel: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-neutral-400">
      <span>{label}</span>
      <button className="flex items-center gap-2 rounded-lg border border-white/[0.12] px-3 py-2 text-sm text-neutral-200 transition hover:bg-white/[0.08]" onClick={onRetry} type="button">
        <RefreshCw size={14} /> {retryLabel}
      </button>
    </div>
  );
}
