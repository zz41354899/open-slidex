import { useEffect, useState } from "react";

import {
  createAiConversation,
  deleteAiConversation,
  readAiConversations,
  readAiStatus,
  readOfficialTemplates,
  warmAi,
  type AiConversationThread,
  type AiMode,
  type AiProvider,
  type AiProviderStatus,
  type OfficialTemplateCatalog
} from "./api";
import { AiChatContext } from "./AiChatContext";
import { AiChatChrome } from "./AiChatChrome";
import { AiChatRuntime } from "./AiChatRuntime";
import type { AiChatPanelProps } from "./AiChatTypes";
import { aiSelectionCanvasTarget } from "./aiChatPresentation";

export function AiChatPanel(props: AiChatPanelProps) {
  const [providers, setProviders] = useState<AiProviderStatus[]>([]);
  const [threads, setThreads] = useState<AiConversationThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode>("fast");
  const [warmState, setWarmState] = useState<"warming" | "ready" | "offline">("warming");
  const [templateCatalog, setTemplateCatalog] = useState<OfficialTemplateCatalog>();

  async function reloadConversations(preferredId?: string) {
    const document = await readAiConversations();
    setThreads(document.threads);
    setActiveThreadId((current) => (
      preferredId
      ?? (document.threads.some((thread) => thread.id === current) ? current : document.threads[0]?.id ?? "")
    ));
    return document.threads;
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([readAiStatus(), readAiConversations(), warmAi()])
      .then(async ([status, document, warm]) => {
        if (cancelled) return;
        setProviders(status.providers);
        setWarmState(warm.ready ? "ready" : "offline");
        if (document.threads.length) {
          setThreads(document.threads);
          setActiveThreadId(document.threads[0]?.id ?? "");
          return;
        }
        const thread = await createAiConversation("codex");
        if (!cancelled) {
          setThreads([thread]);
          setActiveThreadId(thread.id);
        }
      })
      .catch(() => {
        if (!cancelled) setWarmState("offline");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const locale = globalThis.navigator?.language?.toLowerCase().startsWith("zh") ? "zh-TW" : "en";
    void readOfficialTemplates(locale).then(setTemplateCatalog).catch(() => undefined);
  }, []);

  const activeThread = threads.find((thread) => thread.id === activeThreadId);
  const provider = activeThread?.provider ?? "codex";
  const providerStatus = providers.find((candidate) => candidate.provider === provider);
  const providerReady = Boolean(providerStatus?.available && providerStatus.authenticated);

  async function newThread(nextProvider: AiProvider = provider) {
    const thread = await createAiConversation(nextProvider);
    setThreads((current) => [thread, ...current]);
    setActiveThreadId(thread.id);
    setHistoryOpen(false);
  }

  async function removeThread(threadId: string) {
    await deleteAiConversation(threadId);
    const remaining = await reloadConversations();
    if (!remaining.length) await newThread(provider);
  }

  if (!activeThread) {
    return (
      <aside aria-label="SlideX AI" className="ai-drawer" data-ai-ui="reference-v3">
        <div className="ai-panel-boot" role="status">
          <span>Loading SlideX AI…</span>
          <LoadingBar />
        </div>
      </aside>
    );
  }

  return (
    <aside aria-label="SlideX AI" className="ai-drawer" data-ai-ui="reference-v3">
      <AiChatChrome
        activeThreadId={activeThread.id}
        aiMode={aiMode}
        historyOpen={historyOpen}
        menuOpen={menuOpen}
        onClose={props.onClose}
        onConnect={props.onConnect}
        onCatalogChange={setTemplateCatalog}
        onDeleteThread={removeThread}
        onModeChange={setAiMode}
        onNewThread={newThread}
        onSelectThread={(threadId) => { setActiveThreadId(threadId); setHistoryOpen(false); }}
        onToggleHistory={() => setHistoryOpen((value) => !value)}
        onToggleMenu={() => setMenuOpen((value) => !value)}
        provider={provider}
        providerReady={providerReady}
        providerStatus={providerStatus}
        templateCatalog={templateCatalog}
        threads={threads}
        warmState={warmState}
      />
      <AiChatContext
        onClearScope={props.onClearScope}
        onFocus={() => props.onFocusTarget(aiSelectionCanvasTarget(props.selection))}
        provider={provider}
        providerReady={providerReady}
        selection={props.selection}
      />
      <AiChatRuntime
        {...props}
        aiMode={aiMode}
        key={activeThread.id}
        onConversationUpdated={() => void reloadConversations(activeThread.id)}
        provider={provider}
        providerReady={providerReady}
        thread={activeThread}
      />
    </aside>
  );
}

function LoadingBar() {
  return <span aria-hidden="true" className="ai-loading-bar"><i /></span>;
}
