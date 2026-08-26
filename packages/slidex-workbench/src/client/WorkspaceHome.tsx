import { lazy, Suspense, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  CheckCircle2,
  Cable,
  ChevronRight,
  Clock3,
  FileCheck2,
  FilePlus2,
  Files,
  FolderOpen,
  Home,
  LayoutGrid,
  LoaderCircle,
  Monitor,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X
} from "lucide-react";

import { useI18n } from "@/common/lib/I18nProvider";
import {
  readLocalWorkspace,
  type LocalWorkspaceSnapshot
} from "./api";
import slidexWordmark from "./assets/slidex-wordmark.png";
import { WorkspaceSettingsView } from "./WorkspaceSettingsView";
import { WorkspaceDialogs } from "./WorkspaceDialogs";
import {
  EmptyDecks,
  formatBytes,
  HomeView,
  messageOf,
  PresentationsView,
  RecentView,
  SearchField,
  templateSlideCover,
  TemplatesView,
  viewTitle,
  WorkspaceSkeleton
} from "./WorkspaceHomeViews";
import { useWorkspaceActions } from "./useWorkspaceActions";

const WorkspaceOnboarding = lazy(() => import("./WorkspaceOnboarding").then(({ WorkspaceOnboarding: component }) => ({ default: component })));
const WorkspaceMcpDialog = lazy(() => import("./WorkspaceMcpDialog").then(({ WorkspaceMcpDialog: component }) => ({ default: component })));

type View = "home" | "templates" | "presentations" | "recent" | "settings";
const wordmark = slidexWordmark;
const ONBOARDING_STORAGE_KEY = "open-slidex.workspace.onboarding.v1";

const copy = {
  en: {
    blankBody: "Start from a clean canvas and build your story slide by slide.",
    blankTitle: "Blank presentation",
    create: "Create",
    createAndOpen: "Create and open",
    createDeck: "Create presentation",
    edited: "Edited",
    featured: "Featured templates",
    home: "Home",
    localOnly: "Local files only",
    noDecks: "No presentations yet",
    noDecksBody: "Create a blank presentation or begin with an official template.",
    presentations: "Presentations",
    recent: "Recents",
    recentWork: "Recent work",
    search: "Search presentations and templates",
    settings: "Settings",
    templates: "Template Library",
    useTemplate: "Use template",
    viewAll: "View all"
  },
  "zh-TW": {
    blankBody: "從乾淨畫布開始，一頁一頁建立你的簡報故事。",
    blankTitle: "空白簡報",
    create: "建立",
    createAndOpen: "建立並開啟",
    createDeck: "建立簡報",
    edited: "已編輯",
    featured: "精選模板",
    home: "首頁",
    localOnly: "僅使用本機檔案",
    noDecks: "還沒有簡報",
    noDecksBody: "建立空白簡報，或使用官方模板開始。",
    presentations: "簡報",
    recent: "最近使用",
    recentWork: "最近的作品",
    search: "搜尋簡報與模板",
    settings: "設定",
    templates: "模板庫",
    useTemplate: "使用模板",
    viewAll: "查看全部"
  }
} as const;

export function WorkspaceHome() {
  const { locale, setLocale } = useI18n();
  const t = copy[locale];
  const zh = locale === "zh-TW";
  const [activeView, setActiveView] = useState<View>("home");
  const [workspace, setWorkspace] = useState<LocalWorkspaceSnapshot>();
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState("all");
  const workspaceScrollRef = useRef<HTMLElement>(null);
  const onboardingCheckedRef = useRef(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [mcpNotice, setMcpNotice] = useState("");
  const workspaceActions = useWorkspaceActions({ locale, setLoadError, setWorkspace, zh });
  const {
    actionError,
    beginCreation,
    beginImport,
    beginManagement,
    chooseImportFile,
    chooseImportFolder,
    createPresentation,
    deletePresentation,
    importError,
    importFile,
    importFolderInputRef,
    importInputRef,
    importOpen,
    importPending,
    importSidecars,
    importPresentation,
    intent,
    manageError,
    manageIntent,
    managePending,
    manageValue,
    openPresentation,
    openTemplatePreview,
    openingId,
    pending,
    preview,
    renamePresentation,
    setImportOpen,
    setIntent,
    setManageIntent,
    setManageValue,
    setPreview,
    setTitle,
    title
  } = workspaceActions;

  useLayoutEffect(() => {
    const resetScroll = () => {
      workspaceScrollRef.current?.scrollTo({ left: 0, top: 0 });
      window.scrollTo({ left: 0, top: 0 });
    };
    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    window.addEventListener("pageshow", resetScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pageshow", resetScroll);
    };
  }, []);

  useEffect(() => {
    document.title = zh ? "工作區 — OpenSlideX" : "Workspace — OpenSlideX";
    setLoadError("");
    void readLocalWorkspace(locale)
      .then(setWorkspace)
      .catch((error) => setLoadError(messageOf(error, zh ? "無法讀取本機工作區。" : "Could not read the local workspace.")));
  }, [locale, zh]);

  useEffect(() => {
    if (!workspace || onboardingCheckedRef.current) return;
    onboardingCheckedRef.current = true;
    try {
      setOnboardingOpen(window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "complete");
    } catch {
      setOnboardingOpen(true);
    }
  }, [workspace]);

  useEffect(() => {
    if (!mcpNotice) return;
    const timeout = window.setTimeout(() => setMcpNotice(""), 5600);
    return () => window.clearTimeout(timeout);
  }, [mcpNotice]);

  const filteredPresentations = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase();
    return (workspace?.presentations ?? []).filter((item) => !needle || item.title.toLocaleLowerCase().includes(needle));
  }, [deferredQuery, workspace]);

  const categories = useMemo(() => ["all", ...new Set((workspace?.templates ?? []).map((item) => item.category))], [workspace]);
  const filteredTemplates = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase();
    return (workspace?.templates ?? []).filter((item) => {
      const matchesCategory = category === "all" || item.category === category;
      const haystack = [item.name, item.description, item.useCase, ...item.tags].join(" ").toLocaleLowerCase();
      return matchesCategory && (!needle || haystack.includes(needle));
    });
  }, [category, deferredQuery, workspace]);
  const homeTemplates = useMemo(() => {
    const featured = filteredTemplates.filter((item) => item.featured);
    return (featured.length ? featured : filteredTemplates).slice(0, 5);
  }, [filteredTemplates]);

  function navigate(view: View) {
    setActiveView(view);
    setQuery("");
    workspaceScrollRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  }

  function completeOnboarding() {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "complete");
    } catch {
      // The tour can still be dismissed when browser storage is unavailable.
    }
    setOnboardingOpen(false);
  }

  function reopenOnboarding() {
    setOnboardingStep(0);
    setOnboardingOpen(true);
  }

  function startBlankFromOnboarding() {
    completeOnboarding();
    beginCreation({ kind: "blank" });
  }

  function showTemplatesFromOnboarding() {
    completeOnboarding();
    navigate("templates");
  }

  const navItems: Array<{ icon: typeof Home; id: View; label: string }> = [
    { icon: Home, id: "home", label: t.home },
    { icon: LayoutGrid, id: "templates", label: t.templates },
    { icon: Files, id: "presentations", label: t.presentations },
    { icon: Clock3, id: "recent", label: t.recent },
    { icon: Settings, id: "settings", label: t.settings }
  ];

  return (
    <main className="osx-workspace" ref={workspaceScrollRef}>
      <aside className="osx-workspace-sidebar">
        <button className="osx-workspace-logo" onClick={() => navigate("home")} type="button">
          <img alt="OpenSlideX" src={wordmark} />
        </button>
        <nav aria-label={zh ? "工作區導覽" : "Workspace navigation"}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button className={activeView === item.id ? "is-active" : ""} key={item.id} onClick={() => navigate(item.id)} type="button">
                <Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="osx-workspace-sidebar-footer">
          <button aria-label={zh ? "重新查看導覽" : "Reopen tour"} className="osx-workspace-tour" onClick={reopenOnboarding} type="button">
            <Sparkles size={16} />
            <span><strong>{zh ? "快速導覽" : "Quick tour"}</strong><small>{zh ? "重新了解 OpenSlideX" : "See how OpenSlideX works"}</small></span>
          </button>
          <div className="osx-workspace-local-card">
            <span><FolderOpen size={16} /></span>
            <div><strong>{workspace?.name ?? "OpenSlideX"}</strong><small>{t.localOnly}</small></div>
          </div>
        </div>
      </aside>

      <div className="osx-workspace-mobile-header">
        <img alt="OpenSlideX" src={wordmark} />
        <span>{workspace?.name ?? "Workspace"}</span>
      </div>
      <nav aria-label={zh ? "行動版工作區導覽" : "Mobile workspace navigation"} className="osx-workspace-mobile-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return <button aria-label={item.label} className={activeView === item.id ? "is-active" : ""} key={item.id} onClick={() => navigate(item.id)} type="button"><Icon size={18} /></button>;
        })}
      </nav>

      <section className="osx-workspace-main">
        <header className={`osx-workspace-page-header${activeView === "home" ? " is-home" : ""}`}>
          <div className="osx-workspace-title-group">
            <h1>{viewTitle(activeView, t)}</h1>
            {activeView === "home" ? <p>{zh ? "歡迎回來！在本機離線創作，所有檔案只存在於你的裝置上。" : "Welcome back. Create offline — every file stays on your device."}</p> : null}
          </div>
          {activeView === "home" ? (
            <div className="osx-home-header-tools">
              <SearchField locale={locale} onChange={setQuery} value={query} />
              <button className="osx-local-status" onClick={() => navigate("settings")} type="button">
                <Monitor size={15} /><span>{zh ? "本機 Workspace" : "Local Workspace"}</span><i />
              </button>
            </div>
          ) : null}
          {activeView === "presentations" || activeView === "recent" ? (
            <div className="osx-workspace-header-actions">
              <button className="osx-workspace-header-action is-secondary" onClick={beginImport} type="button"><Upload size={15} />{zh ? "匯入簡報" : "Import presentation"}</button>
              <button className="osx-workspace-header-action" onClick={() => beginCreation({ kind: "blank" })} type="button"><Plus size={15} />{t.createDeck}</button>
            </div>
          ) : null}
        </header>

        {loadError ? <div className="osx-workspace-error">{loadError}</div> : null}
        {!workspace && !loadError ? <WorkspaceSkeleton /> : null}
        {workspace && activeView === "home" ? (
          <HomeView
            locale={locale}
            onBlank={() => beginCreation({ kind: "blank" })}
            onOpen={openPresentation}
            onPresentations={() => navigate("presentations")}
            onPreview={openTemplatePreview}
            onDelete={(presentation) => beginManagement("delete", presentation)}
            onImport={beginImport}
            onRename={(presentation) => beginManagement("rename", presentation)}
            onTemplates={() => navigate("templates")}
            openingId={openingId}
            presentations={filteredPresentations.slice(0, 3)}
            templates={homeTemplates}
          />
        ) : null}
        {workspace && activeView === "templates" ? (
          <TemplatesView
            categories={categories}
            category={category}
            locale={locale}
            onCategory={setCategory}
            onPreview={openTemplatePreview}
            onQuery={setQuery}
            query={query}
            templates={filteredTemplates}
          />
        ) : null}
        {workspace && activeView === "presentations" ? (
          <PresentationsView
            locale={locale}
            onBlank={() => beginCreation({ kind: "blank" })}
            onDelete={(presentation) => beginManagement("delete", presentation)}
            onOpen={openPresentation}
            onQuery={setQuery}
            onRename={(presentation) => beginManagement("rename", presentation)}
            openingId={openingId}
            presentations={filteredPresentations}
            query={query}
          />
        ) : null}
        {workspace && activeView === "recent" ? (
          <RecentView
            locale={locale}
            onBlank={() => beginCreation({ kind: "blank" })}
            onDelete={(presentation) => beginManagement("delete", presentation)}
            onOpen={openPresentation}
            onRename={(presentation) => beginManagement("rename", presentation)}
            openingId={openingId}
            presentations={workspace.presentations}
          />
        ) : null}
        {workspace && activeView === "settings" ? (
          <WorkspaceSettingsView locale={locale} onImport={beginImport} onLocale={setLocale} workspace={workspace} />
        ) : null}
      </section>

      <WorkspaceDialogs
        actionError={actionError}
        chooseImportFile={chooseImportFile}
        chooseImportFolder={chooseImportFolder}
        createPresentation={createPresentation}
        deletePresentation={deletePresentation}
        importError={importError}
        importFile={importFile}
        importFolderInputRef={importFolderInputRef}
        importInputRef={importInputRef}
        importOpen={importOpen}
        importPending={importPending}
        importSidecars={importSidecars}
        importPresentation={importPresentation}
        intent={intent}
        locale={locale}
        manageError={manageError}
        manageIntent={manageIntent}
        managePending={managePending}
        manageValue={manageValue}
        pending={pending}
        preview={preview}
        renamePresentation={renamePresentation}
        setImportOpen={setImportOpen}
        setIntent={setIntent}
        setManageIntent={setManageIntent}
        setManageValue={setManageValue}
        setPreview={setPreview}
        setTitle={setTitle}
        startTemplate={beginCreation}
        t={t}
        title={title}
      />

      <button aria-label={zh ? "連接 OpenSlideX MCP" : "Connect OpenSlideX MCP"} className="osx-mcp-fab" onClick={() => setMcpOpen(true)} type="button">
        <Cable size={18} /><span>{zh ? "連接 MCP" : "Connect MCP"}</span>
      </button>

      {mcpOpen ? (
        <Suspense fallback={null}>
          <WorkspaceMcpDialog locale={locale} onClose={() => setMcpOpen(false)} onNotice={setMcpNotice} />
        </Suspense>
      ) : null}
      {mcpNotice ? <div aria-live="polite" className="osx-workspace-toast" role="status"><CheckCircle2 size={17} />{mcpNotice}</div> : null}

      {onboardingOpen ? (
        <Suspense fallback={null}>
          <WorkspaceOnboarding
            locale={locale}
            onComplete={completeOnboarding}
            onCreateBlank={startBlankFromOnboarding}
            onShowTemplates={showTemplatesFromOnboarding}
            onStep={setOnboardingStep}
            step={onboardingStep}
          />
        </Suspense>
      ) : null}
    </main>
  );
}
