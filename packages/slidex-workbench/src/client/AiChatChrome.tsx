import { ChevronDown, CircleAlert, History, MoreHorizontal, Plus, Trash2, X } from "lucide-react";

import {
  selectOfficialTemplate,
  type AiConversationThread,
  type AiMode,
  type AiProvider,
  type AiProviderStatus,
  type OfficialTemplateCatalog
} from "./api";
import { aiWarmStateLabel } from "./aiChatPresentation";
import slidexXMark from "./assets/slidex-x-mark.png";

const slidexXMarkUrl = slidexXMark;

type AiChatChromeProps = {
  activeThreadId: string;
  aiMode: AiMode;
  historyOpen: boolean;
  menuOpen: boolean;
  onClose: () => void;
  onConnect: () => void;
  onCatalogChange: (catalog: OfficialTemplateCatalog) => void;
  onDeleteThread: (threadId: string) => Promise<void>;
  onModeChange: (mode: AiMode) => void;
  onNewThread: (provider?: AiProvider) => Promise<void>;
  onSelectThread: (threadId: string) => void;
  onToggleHistory: () => void;
  onToggleMenu: () => void;
  provider: AiProvider;
  providerReady: boolean;
  providerStatus?: AiProviderStatus;
  templateCatalog?: OfficialTemplateCatalog;
  threads: AiConversationThread[];
  warmState: "warming" | "ready" | "offline";
};

export function AiChatChrome(props: AiChatChromeProps) {
  return (
    <>
      <header className="ai-drawer-header">
        <div className="ai-title-lockup">
          <span className="ai-mark"><img alt="" src={slidexXMarkUrl} /></span>
          <div><strong>SlideX AI</strong><span>Local workspace assistant</span></div>
        </div>
        <div className="ai-header-actions">
          <button
            aria-expanded={props.menuOpen}
            aria-label="SlideX AI menu"
            className="icon-button"
            onClick={props.onToggleMenu}
            type="button"
          >
            <MoreHorizontal size={17} />
          </button>
          <button aria-label="Close AI chat" className="icon-button" onClick={props.onClose} type="button">
            <X size={17} />
          </button>
        </div>
      </header>
      {props.menuOpen ? <AiChatMenu {...props} /> : null}
      {props.historyOpen ? <AiChatHistory {...props} /> : null}
      {!props.providerReady && props.warmState !== "warming" ? (
        <button className="ai-setup-notice" onClick={props.onConnect} type="button">
          <CircleAlert size={14} />
          <span>
            <strong>{props.providerStatus?.available ? "Sign in required" : "Local CLI setup needed"}</strong>
            <small>{props.providerStatus?.detail ?? "Open AI setup to continue"}</small>
          </span>
          <span>Set up</span>
        </button>
      ) : null}
    </>
  );
}

function AiChatMenu(props: AiChatChromeProps) {
  async function selectTemplate(value: string) {
    const catalog = props.templateCatalog;
    const template = catalog?.templates.find((candidate) => `${candidate.id}@${candidate.version}` === value);
    if (!catalog || !template) return;
    const result = await selectOfficialTemplate({
      id: template.id,
      locale: template.locale,
      version: template.version
    });
    props.onCatalogChange({ ...catalog, current: result.template });
  }

  return (
    <div className="ai-header-menu" role="menu">
      <div className="ai-menu-status">
        <span className={`ai-readiness-dot is-${props.warmState}`} />
        <div>
          <strong>{aiWarmStateLabel(props.warmState, props.providerStatus)}</strong>
          <span>{props.provider === "codex" ? "Revision-safe local editing" : "Reviewable draft workflow"}</span>
        </div>
      </div>
      <label className="ai-menu-provider">
        <span>Provider</span>
        <span>
          <select
            onChange={(event) => {
              void props.onNewThread(event.target.value as AiProvider);
              props.onToggleMenu();
            }}
            value={props.provider}
          >
            <option value="codex">Codex</option>
            <option value="claude">Claude</option>
          </select>
          <ChevronDown aria-hidden="true" size={13} />
        </span>
      </label>
      {props.provider === "codex" ? (
        <label className="ai-menu-provider">
          <span>Model</span>
          <span>
            <select
              aria-label="AI model profile"
              onChange={(event) => props.onModeChange(event.target.value as AiMode)}
              value={props.aiMode}
            >
              <option value="fast">Fast</option>
              <option value="balanced">Balanced</option>
              <option value="quality">Quality</option>
            </select>
            <ChevronDown aria-hidden="true" size={13} />
          </span>
        </label>
      ) : null}
      {props.templateCatalog ? (
        <label className="ai-menu-provider">
          <span>Design system</span>
          <span>
            <select
              aria-label="Official template"
              disabled={!props.templateCatalog.canSelect}
              onChange={(event) => void selectTemplate(event.target.value)}
              value={props.templateCatalog.current
                ? `${props.templateCatalog.current.id}@${props.templateCatalog.current.version}`
                : ""}
            >
              <option value="">Choose…</option>
              {props.templateCatalog.templates.map((template) => (
                <option key={`${template.id}@${template.version}`} value={`${template.id}@${template.version}`}>
                  {template.name}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={13} />
          </span>
        </label>
      ) : null}
      <button onClick={() => { void props.onNewThread(); props.onToggleMenu(); }} role="menuitem" type="button">
        <Plus size={15} /><span>New conversation</span>
      </button>
      <button onClick={() => { props.onToggleHistory(); props.onToggleMenu(); }} role="menuitem" type="button">
        <History size={15} /><span>Conversation history</span>
      </button>
      {!props.providerReady && props.warmState !== "warming" ? (
        <button onClick={() => { props.onConnect(); props.onToggleMenu(); }} role="menuitem" type="button">
          <CircleAlert size={15} /><span>AI setup</span>
        </button>
      ) : null}
    </div>
  );
}

function AiChatHistory(props: AiChatChromeProps) {
  return (
    <nav aria-label="Saved AI conversations" className="ai-history-list">
      {props.threads.map((thread) => (
        <div className={thread.id === props.activeThreadId ? "is-active" : ""} key={thread.id}>
          <button onClick={() => props.onSelectThread(thread.id)} type="button">
            <strong>{thread.title}</strong>
            <span>{thread.provider} · {new Date(thread.updatedAt).toLocaleDateString()}</span>
          </button>
          <button aria-label={`Delete ${thread.title}`} onClick={() => void props.onDeleteThread(thread.id)} type="button">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </nav>
  );
}
