import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  CheckCircle2,
  Check,
  Cable,
  ChevronRight,
  ClipboardCopy,
  Clock3,
  FileCheck2,
  FilePlus2,
  Files,
  FolderOpen,
  HardDrive,
  Home,
  Languages,
  LayoutGrid,
  LoaderCircle,
  Monitor,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  X
} from "lucide-react";

import { useI18n } from "@/common/lib/I18nProvider";
import {
  createLocalWorkspacePresentation,
  deleteLocalWorkspacePresentation,
  importLocalWorkspacePresentation,
  openLocalWorkspacePresentation,
  readLocalWorkspace,
  readWorkspaceMcpSetup,
  renameLocalWorkspacePresentation,
  type LocalWorkspacePresentation,
  type LocalWorkspaceSnapshot,
  type LocalWorkspaceTemplate,
  type WorkspaceMcpClient,
  type WorkspaceMcpPlatform,
  type WorkspaceMcpSetup
} from "./api";
import slidexWordmark from "./assets/slidex-wordmark.png";

type View = "home" | "templates" | "presentations" | "recent" | "settings";
type CreationIntent = { kind: "blank" } | { kind: "template"; template: LocalWorkspaceTemplate };
type ManageIntent = { kind: "delete" | "rename"; presentation: LocalWorkspacePresentation };
type TemplatePreview = { slideIndex: number; template: LocalWorkspaceTemplate };
const wordmark = slidexWordmark;

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
  const [category, setCategory] = useState("all");
  const [intent, setIntent] = useState<CreationIntent>();
  const [preview, setPreview] = useState<TemplatePreview>();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [openingId, setOpeningId] = useState<string>();
  const [manageIntent, setManageIntent] = useState<ManageIntent>();
  const [manageValue, setManageValue] = useState("");
  const [managePending, setManagePending] = useState(false);
  const [manageError, setManageError] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File>();
  const [importPending, setImportPending] = useState(false);
  const [importError, setImportError] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const workspaceScrollRef = useRef<HTMLElement>(null);

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

  const filteredPresentations = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (workspace?.presentations ?? []).filter((item) => !needle || item.title.toLocaleLowerCase().includes(needle));
  }, [query, workspace]);

  const categories = useMemo(() => ["all", ...new Set((workspace?.templates ?? []).map((item) => item.category))], [workspace]);
  const filteredTemplates = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (workspace?.templates ?? []).filter((item) => {
      const matchesCategory = category === "all" || item.category === category;
      const haystack = [item.name, item.description, item.useCase, ...item.tags].join(" ").toLocaleLowerCase();
      return matchesCategory && (!needle || haystack.includes(needle));
    });
  }, [category, query, workspace]);

  function navigate(view: View) {
    setActiveView(view);
    setQuery("");
    workspaceScrollRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  }

  function beginCreation(next: CreationIntent) {
    setPreview(undefined);
    setIntent(next);
    setTitle(next.kind === "template" ? next.template.name : zh ? "未命名簡報" : "Untitled presentation");
    setActionError("");
  }

  function openTemplatePreview(template: LocalWorkspaceTemplate) {
    setPreview({ slideIndex: 0, template });
  }

  async function createPresentation() {
    if (!intent || pending || !title.trim()) return;
    setPending(true);
    setActionError("");
    try {
      const result = await createLocalWorkspacePresentation({
        locale,
        ...(intent.kind === "template" ? {
          templateId: intent.template.id,
          templateVersion: intent.template.version
        } : {}),
        title
      });
      window.location.assign(result.editorUrl);
    } catch (error) {
      setActionError(messageOf(error, zh ? "無法建立簡報。" : "Could not create the presentation."));
      setPending(false);
    }
  }

  function beginImport() {
    setImportFile(undefined);
    setImportError("");
    setImportOpen(true);
  }

  function chooseImportFile(file?: File) {
    setImportError("");
    if (!file) return;
    const extension = file.name.toLowerCase().match(/\.(mdx|slidex|zip)$/)?.[1];
    if (!extension) {
      setImportFile(undefined);
      setImportError(zh ? "只支援 .mdx、.zip 或 .slidex；含圖片的簡報請匯入包含 assets 資料夾的封裝。" : "Use .mdx, .zip, or .slidex. Presentations with images need a bundle containing the assets folder.");
      return;
    }
    const maximumBytes = 50 * 1024 * 1024;
    if (!file.size || file.size > maximumBytes) {
      setImportFile(undefined);
      setImportError(zh ? "匯入檔案大小必須介於 1 byte 與 50 MB 之間。" : "The import file must be between 1 byte and 50 MB.");
      return;
    }
    setImportFile(file);
  }

  async function importPresentation() {
    if (!importFile || importPending) return;
    setImportPending(true);
    setImportError("");
    try {
      const result = await importLocalWorkspacePresentation(importFile);
      window.location.assign(result.editorUrl);
    } catch (error) {
      setImportError(messageOf(error, zh ? "無法匯入這份 OpenSlideX 簡報。" : "Could not import this OpenSlideX presentation."));
      setImportPending(false);
    }
  }

  async function openPresentation(id: string) {
    if (openingId) return;
    setOpeningId(id);
    setLoadError("");
    try {
      const result = await openLocalWorkspacePresentation(id);
      window.location.assign(result.editorUrl);
    } catch (error) {
      setLoadError(messageOf(error, zh ? "無法開啟簡報。" : "Could not open the presentation."));
      setOpeningId(undefined);
    }
  }

  function beginManagement(kind: ManageIntent["kind"], presentation: LocalWorkspacePresentation) {
    setManageIntent({ kind, presentation });
    setManageValue(kind === "rename" ? presentation.title : "");
    setManageError("");
  }

  async function renamePresentation() {
    if (!manageIntent || manageIntent.kind !== "rename" || managePending || !manageValue.trim()) return;
    setManagePending(true);
    setManageError("");
    try {
      const { presentation } = await renameLocalWorkspacePresentation(manageIntent.presentation.id, manageValue);
      setWorkspace((current) => current ? {
        ...current,
        presentations: current.presentations
          .map((item) => item.id === presentation.id ? presentation : item)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      } : current);
      setManageIntent(undefined);
    } catch (error) {
      setManageError(messageOf(error, zh ? "無法重新命名簡報。" : "Could not rename the presentation."));
    } finally {
      setManagePending(false);
    }
  }

  async function deletePresentation() {
    if (!manageIntent || manageIntent.kind !== "delete" || managePending || manageValue !== manageIntent.presentation.title) return;
    setManagePending(true);
    setManageError("");
    try {
      await deleteLocalWorkspacePresentation(manageIntent.presentation.id, manageValue);
      setWorkspace((current) => current ? {
        ...current,
        presentations: current.presentations.filter((item) => item.id !== manageIntent.presentation.id)
      } : current);
      setManageIntent(undefined);
    } catch (error) {
      setManageError(messageOf(error, zh ? "無法刪除簡報。" : "Could not delete the presentation."));
    } finally {
      setManagePending(false);
    }
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
        <div className="osx-workspace-local-card">
          <span><FolderOpen size={16} /></span>
          <div><strong>{workspace?.name ?? "OpenSlideX"}</strong><small>{t.localOnly}</small></div>
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
            templates={(filteredTemplates.filter((item) => item.featured).length ? filteredTemplates.filter((item) => item.featured) : filteredTemplates).slice(0, 5)}
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
          <SettingsView locale={locale} onImport={beginImport} onLocale={setLocale} workspace={workspace} />
        ) : null}
      </section>

      {preview ? (
        <div className="osx-workspace-overlay" onMouseDown={() => setPreview(undefined)} role="presentation">
          <section aria-modal="true" className="osx-template-preview-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <button aria-label={zh ? "關閉" : "Close"} className="osx-dialog-close" onClick={() => setPreview(undefined)} type="button"><X size={17} /></button>
            <div className="osx-template-preview-stage">
              <div className="osx-template-preview-image">
                <img alt={`${preview.template.name} — ${preview.slideIndex === 0 ? (zh ? "封面" : "cover") : `${zh ? "第" : "Slide "}${preview.slideIndex + 1}${zh ? "頁" : ""}`}`} src={templateSlideCover(preview.template.cover, preview.slideIndex)} />
              </div>
              <div aria-label={zh ? "模板投影片預覽" : "Template slide previews"} className="osx-template-preview-thumbnails" role="tablist">
                {Array.from({ length: preview.template.slideCount }, (_, slideIndex) => (
                  <button
                    aria-label={slideIndex === 0 ? (zh ? "封面" : "Cover") : (zh ? `第 ${slideIndex + 1} 頁` : `Slide ${slideIndex + 1}`)}
                    aria-selected={preview.slideIndex === slideIndex}
                    className={preview.slideIndex === slideIndex ? "is-active" : ""}
                    key={slideIndex}
                    onClick={() => setPreview((current) => current ? { ...current, slideIndex } : current)}
                    role="tab"
                    type="button"
                  >
                    <img alt="" src={templateSlideCover(preview.template.cover, slideIndex)} />
                    <span>{slideIndex === 0 ? (zh ? "封面" : "Cover") : slideIndex + 1}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="osx-template-preview-copy">
              <span>{preview.template.category.replaceAll("-", " ")}</span>
              <h2>{preview.template.name}</h2>
              <p>{preview.template.description}</p>
              <small><CheckCircle2 size={14} />{preview.template.author} · {preview.template.slideCount} {zh ? "頁" : "slides"}</small>
              <button onClick={() => beginCreation({ kind: "template", template: preview.template })} type="button">{t.useTemplate}<ChevronRight size={15} /></button>
            </div>
          </section>
        </div>
      ) : null}

      {intent ? (
        <div className="osx-workspace-overlay" onMouseDown={() => !pending && setIntent(undefined)} role="presentation">
          <section aria-modal="true" className="osx-create-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <button aria-label={zh ? "關閉" : "Close"} className="osx-dialog-close" disabled={pending} onClick={() => setIntent(undefined)} type="button"><X size={17} /></button>
            <span className="osx-create-dialog-icon">{intent.kind === "template" ? <LayoutGrid size={19} /> : <FilePlus2 size={19} />}</span>
            <small>{intent.kind === "template" ? t.useTemplate : t.blankTitle}</small>
            <h2>{intent.kind === "template" ? intent.template.name : t.createDeck}</h2>
            <p>{zh ? "會在此工作區建立新的本機資料夾，不會改寫現有簡報。" : "A new local folder will be created in this workspace. Existing decks stay untouched."}</p>
            <label>
              <span>{zh ? "簡報名稱" : "Presentation name"}<small>{title.length}/80</small></span>
              <input autoFocus maxLength={80} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createPresentation(); }} value={title} />
            </label>
            {actionError ? <div className="osx-workspace-error">{actionError}</div> : null}
            <footer>
              <button disabled={pending} onClick={() => setIntent(undefined)} type="button">{zh ? "取消" : "Cancel"}</button>
              <button className="is-primary" disabled={pending || !title.trim()} onClick={() => void createPresentation()} type="button">
                {pending ? <LoaderCircle className="spin" size={14} /> : <Plus size={14} />}{pending ? (zh ? "正在建立…" : "Creating…") : t.createAndOpen}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {importOpen ? (
        <div className="osx-workspace-overlay" onMouseDown={() => !importPending && setImportOpen(false)} role="presentation">
          <section aria-modal="true" className="osx-import-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <button aria-label={zh ? "關閉" : "Close"} className="osx-dialog-close" disabled={importPending} onClick={() => setImportOpen(false)} type="button"><X size={17} /></button>
            <span className="osx-import-dialog-icon"><Upload size={20} /></span>
            <small>{zh ? "本機簡報匯入" : "Local presentation import"}</small>
            <h2>{zh ? "匯入 OpenSlideX 簡報" : "Import an OpenSlideX presentation"}</h2>
            <p>{zh ? "可直接匯入含 Base64 圖片的 MDX，系統會自動轉存至 assets/；外部圖片檔則使用 ZIP 或 .slidex 封裝。" : "MDX with Base64 images is converted into local assets automatically. Use ZIP/.slidex when images are separate files."}</p>
            <input
              accept=".mdx,.slidex,.zip,text/mdx,text/markdown,application/zip"
              className="sr-only"
              onChange={(event) => chooseImportFile(event.currentTarget.files?.[0])}
              ref={importInputRef}
              type="file"
            />
            <button
              className={`osx-mdx-dropzone${importFile ? " has-file" : ""}`}
              onClick={() => importInputRef.current?.click()}
              onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()}
              onDrop={(event: DragEvent<HTMLButtonElement>) => {
                event.preventDefault();
                chooseImportFile(event.dataTransfer.files[0]);
              }}
              type="button"
            >
              {importFile ? <FileCheck2 size={28} /> : <Upload size={28} />}
              <span>
                <strong>{importFile?.name ?? (zh ? "拖放 MDX 或專案封裝" : "Drop MDX or a project bundle")}</strong>
                <small>{importFile ? formatBytes(importFile.size) : (zh ? ".mdx/.zip/.slidex · 上限 50 MB" : ".mdx/.zip/.slidex · 50 MB maximum")}</small>
              </span>
            </button>
            <div className="osx-import-policy"><ShieldCheck size={15} /><span>{zh ? "檔案會在本機驗證，且不會上傳至雲端或 Supabase。" : "The file is validated locally and is never uploaded to cloud storage or Supabase."}</span></div>
            {importError ? <div className="osx-workspace-error">{importError}</div> : null}
            <footer>
              <button disabled={importPending} onClick={() => setImportOpen(false)} type="button">{zh ? "取消" : "Cancel"}</button>
              <button className="is-primary" disabled={!importFile || importPending} onClick={() => void importPresentation()} type="button">
                {importPending ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />}{importPending ? (zh ? "正在匯入…" : "Importing…") : (zh ? "匯入並開啟" : "Import and open")}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {manageIntent ? (
        <div className="osx-workspace-overlay" onMouseDown={() => !managePending && setManageIntent(undefined)} role="presentation">
          <section aria-modal="true" className={`osx-manage-dialog${manageIntent.kind === "delete" ? " is-danger" : ""}`} onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <button aria-label={zh ? "關閉" : "Close"} className="osx-dialog-close" disabled={managePending} onClick={() => setManageIntent(undefined)} type="button"><X size={17} /></button>
            <span className="osx-create-dialog-icon">{manageIntent.kind === "rename" ? <Pencil size={18} /> : <Trash2 size={18} />}</span>
            <small>{manageIntent.kind === "rename" ? (zh ? "重新命名" : "Rename") : (zh ? "刪除本機簡報" : "Delete local presentation")}</small>
            <h2>{manageIntent.kind === "rename" ? (zh ? "修改簡報名稱" : "Rename presentation") : manageIntent.presentation.title}</h2>
            <p>{manageIntent.kind === "rename"
              ? (zh ? "名稱會同步更新至編輯器與 Workspace，底層資料夾保持不變。" : "The editor and Workspace will use the new title. The underlying folder stays unchanged.")
              : (zh ? `輸入「${manageIntent.presentation.title}」確認刪除。簡報會移至本機回收區。` : `Enter “${manageIntent.presentation.title}” to confirm. The presentation will move to the local recovery area.`)}</p>
            <label>
              <span>{manageIntent.kind === "rename" ? (zh ? "簡報名稱" : "Presentation name") : (zh ? "確認名稱" : "Confirm title")}</span>
              <input
                autoFocus
                maxLength={80}
                onChange={(event) => setManageValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void (manageIntent.kind === "rename" ? renamePresentation() : deletePresentation());
                }}
                value={manageValue}
              />
            </label>
            {manageError ? <div className="osx-workspace-error">{manageError}</div> : null}
            <footer>
              <button disabled={managePending} onClick={() => setManageIntent(undefined)} type="button">{zh ? "取消" : "Cancel"}</button>
              <button
                className={manageIntent.kind === "delete" ? "is-danger" : "is-primary"}
                disabled={managePending || !manageValue.trim() || (manageIntent.kind === "delete" && manageValue !== manageIntent.presentation.title)}
                onClick={() => void (manageIntent.kind === "rename" ? renamePresentation() : deletePresentation())}
                type="button"
              >
                {managePending ? <LoaderCircle className="spin" size={14} /> : manageIntent.kind === "rename" ? <Pencil size={14} /> : <Trash2 size={14} />}
                {managePending ? (zh ? "處理中…" : "Working…") : manageIntent.kind === "rename" ? (zh ? "儲存名稱" : "Save name") : (zh ? "刪除簡報" : "Delete presentation")}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function HomeView(props: {
  locale: "en" | "zh-TW";
  onBlank(): void;
  onDelete(presentation: LocalWorkspacePresentation): void;
  onImport(): void;
  onOpen(id: string): void;
  onPresentations(): void;
  onPreview(template: LocalWorkspaceTemplate): void;
  onRename(presentation: LocalWorkspacePresentation): void;
  onTemplates(): void;
  openingId?: string;
  presentations: LocalWorkspacePresentation[];
  templates: LocalWorkspaceTemplate[];
}) {
  const t = copy[props.locale];
  const zh = props.locale === "zh-TW";
  const quickActions = [
    {
      body: zh ? "從頭開始，建立你的簡報。" : "Start fresh and build your presentation.",
      icon: FilePlus2,
      label: zh ? "建立空白簡報" : "Create blank presentation",
      onClick: props.onBlank
    },
    {
      body: zh ? "從精選模板快速開始。" : "Start quickly with a curated template.",
      icon: LayoutGrid,
      label: zh ? "套用模板" : "Use a template",
      onClick: props.onTemplates
    },
    {
      body: zh ? "支援 Base64 圖片 MDX 與完整專案封裝。" : "Import MDX with Base64 images or a complete project bundle.",
      icon: Upload,
      label: zh ? "匯入 OpenSlideX 簡報" : "Import OpenSlideX presentation",
      onClick: props.onImport
    }
  ];
  return (
    <div className="osx-workspace-home-view">
      <div className="osx-home-quick-grid">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button className="osx-home-quick-card" key={action.label} onClick={action.onClick} type="button">
              <span className="osx-home-quick-icon"><Icon size={28} strokeWidth={1.65} /></span>
              <span className="osx-home-quick-copy"><strong>{action.label}</strong><small>{action.body}</small></span>
              <span className="osx-home-quick-arrow"><ChevronRight size={17} /></span>
            </button>
          );
        })}
      </div>
      <section className="osx-home-template-shelf">
        <header><h2>{t.featured}</h2><button onClick={props.onTemplates} type="button">{t.viewAll}<ChevronRight size={14} /></button></header>
        {props.templates.length ? (
          <div className="osx-home-template-track">
            {props.templates.map((template) => <HomeTemplateCard key={template.id} locale={props.locale} onPreview={() => props.onPreview(template)} template={template} />)}
          </div>
        ) : <p className="osx-no-results">{zh ? "找不到符合搜尋條件的模板。" : "No templates match this search."}</p>}
      </section>
      <section className="osx-recent-section">
        <header><h2>{t.recentWork}</h2><button onClick={props.onPresentations} type="button">{t.viewAll}<ChevronRight size={14} /></button></header>
        {props.presentations.length ? (
          <div className="osx-presentation-grid">{props.presentations.map((item) => <PresentationCard key={item.id} locale={props.locale} onDelete={() => props.onDelete(item)} onOpen={() => props.onOpen(item.id)} onRename={() => props.onRename(item)} opening={props.openingId === item.id} presentation={item} />)}</div>
        ) : <EmptyDecks home locale={props.locale} onBlank={props.onBlank} />}
      </section>
    </div>
  );
}

function HomeTemplateCard(props: { locale: "en" | "zh-TW"; onPreview(): void; template: LocalWorkspaceTemplate }) {
  const zh = props.locale === "zh-TW";
  return (
    <button className="osx-home-template-card" onClick={props.onPreview} type="button">
      <span className="osx-home-template-cover"><img alt={props.template.name} src={props.template.cover} /><small>{props.template.slideCount} {zh ? "頁" : "slides"}</small></span>
      <span className="osx-home-template-meta"><strong>{props.template.name}</strong><em>{props.template.useCase}</em></span>
    </button>
  );
}

function TemplatesView(props: {
  categories: string[];
  category: string;
  locale: "en" | "zh-TW";
  onCategory(value: string): void;
  onPreview(template: LocalWorkspaceTemplate): void;
  onQuery(value: string): void;
  query: string;
  templates: LocalWorkspaceTemplate[];
}) {
  const zh = props.locale === "zh-TW";
  return (
    <div className="osx-library-view">
      <SearchField locale={props.locale} onChange={props.onQuery} value={props.query} />
      <div className="osx-library-layout">
        <aside className="osx-template-categories">
          <small>{zh ? "分類" : "Categories"}</small>
          {props.categories.map((item) => <button className={props.category === item ? "is-active" : ""} key={item} onClick={() => props.onCategory(item)} type="button">{item === "all" ? (zh ? "全部模板" : "All templates") : item.replaceAll("-", " ")}</button>)}
        </aside>
        <div className="osx-template-library-grid">
          {props.templates.map((template) => <TemplateCard key={template.id} locale={props.locale} onPreview={() => props.onPreview(template)} template={template} />)}
          {!props.templates.length ? <p className="osx-no-results">{zh ? "找不到符合條件的模板。" : "No templates match this search."}</p> : null}
        </div>
      </div>
    </div>
  );
}

function PresentationsView(props: {
  locale: "en" | "zh-TW";
  onBlank(): void;
  onDelete(presentation: LocalWorkspacePresentation): void;
  onOpen(id: string): void;
  onQuery(value: string): void;
  onRename(presentation: LocalWorkspacePresentation): void;
  openingId?: string;
  presentations: LocalWorkspacePresentation[];
  query: string;
}) {
  return (
    <div className="osx-presentations-view">
      <SearchField locale={props.locale} onChange={props.onQuery} value={props.query} />
      {props.presentations.length ? <div className="osx-presentation-grid">{props.presentations.map((item) => <PresentationCard key={item.id} locale={props.locale} onDelete={() => props.onDelete(item)} onOpen={() => props.onOpen(item.id)} onRename={() => props.onRename(item)} opening={props.openingId === item.id} presentation={item} />)}</div> : <EmptyDecks locale={props.locale} onBlank={props.onBlank} />}
    </div>
  );
}

function RecentView(props: {
  locale: "en" | "zh-TW";
  onBlank(): void;
  onDelete(presentation: LocalWorkspacePresentation): void;
  onOpen(id: string): void;
  onRename(presentation: LocalWorkspacePresentation): void;
  openingId?: string;
  presentations: LocalWorkspacePresentation[];
}) {
  const groups = groupPresentations(props.presentations, props.locale);
  if (!props.presentations.length) return <div className="osx-presentations-view"><EmptyDecks locale={props.locale} onBlank={props.onBlank} /></div>;
  return <div className="osx-recent-groups">{groups.map((group) => <section key={group.label}><h2>{group.label}</h2><div className="osx-presentation-grid">{group.items.map((item) => <PresentationCard key={item.id} locale={props.locale} onDelete={() => props.onDelete(item)} onOpen={() => props.onOpen(item.id)} onRename={() => props.onRename(item)} opening={props.openingId === item.id} presentation={item} />)}</div></section>)}</div>;
}

function SettingsView(props: { locale: "en" | "zh-TW"; onImport(): void; onLocale(value: "en" | "zh-TW"): void; workspace: LocalWorkspaceSnapshot }) {
  const zh = props.locale === "zh-TW";
  const [mcpClient, setMcpClient] = useState<WorkspaceMcpClient>("codex");
  const [mcpPlatform, setMcpPlatform] = useState<WorkspaceMcpPlatform>(() => navigator.platform.toLowerCase().includes("win") ? "windows" : "macos");
  const [mcpSetup, setMcpSetup] = useState<WorkspaceMcpSetup>();
  const [mcpError, setMcpError] = useState("");
  const [copied, setCopied] = useState<"config" | "prompt">();

  useEffect(() => {
    let active = true;
    setMcpError("");
    void readWorkspaceMcpSetup(mcpClient, mcpPlatform)
      .then((setup) => { if (active) setMcpSetup(setup); })
      .catch((error) => { if (active) setMcpError(messageOf(error, zh ? "無法產生 MCP 設定。" : "Could not generate the MCP setup.")); });
    return () => { active = false; };
  }, [mcpClient, mcpPlatform, zh]);

  async function copyMcp(value: string, target: "config" | "prompt") {
    await navigator.clipboard.writeText(value);
    setCopied(target);
    window.setTimeout(() => setCopied((current) => current === target ? undefined : current), 1600);
  }

  return (
    <div className="osx-settings-view">
      <section className="osx-settings-card is-overview">
        <span className="osx-settings-icon"><HardDrive size={20} /></span>
        <div className="osx-settings-copy"><small>{zh ? "本機工作區" : "Local workspace"}</small><strong>{props.workspace.name}</strong><p>{zh ? "所有簡報都以獨立資料夾儲存在這個位置。" : "Every presentation is stored here in its own folder."}</p><code>{props.workspace.root}</code></div>
        <em className="osx-settings-status"><i />{zh ? "本機可用" : "Available locally"}</em>
      </section>
      <section className="osx-settings-card">
        <header><span className="osx-settings-icon"><Languages size={19} /></span><div><small>{zh ? "介面" : "Interface"}</small><strong>{zh ? "顯示語言" : "Display language"}</strong></div></header>
        <p>{zh ? "切換 Workspace 的選單、提示與日期格式。" : "Change Workspace menus, prompts, and date formatting."}</p>
        <div aria-label={zh ? "介面語言" : "Interface language"} className="osx-settings-segmented" role="group">
          <button className={props.locale === "zh-TW" ? "is-active" : ""} onClick={() => props.onLocale("zh-TW")} type="button">繁體中文</button>
          <button className={props.locale === "en" ? "is-active" : ""} onClick={() => props.onLocale("en")} type="button">English</button>
        </div>
      </section>
      <section className="osx-settings-card">
        <header><span className="osx-settings-icon"><ShieldCheck size={19} /></span><div><small>{zh ? "資料與隱私" : "Data and privacy"}</small><strong>{zh ? "完全本機" : "Fully local"}</strong></div></header>
        <p>{zh ? "不需要登入，不使用 Supabase，也沒有背景同步。" : "No login, Supabase, or background sync is used."}</p>
        <ul><li><CheckCircle2 size={14} />{zh ? "簡報來源固定為 presentation.mdx" : "presentation.mdx remains the only source"}</li><li><CheckCircle2 size={14} />{zh ? "檔案只存在於你的裝置" : "Files stay on this device"}</li></ul>
      </section>
      <section className="osx-settings-card is-mcp">
        <header><span className="osx-settings-icon"><Cable size={19} /></span><div><small>{zh ? "全域整合" : "Global integration"}</small><strong>{zh ? "Workspace MCP Server" : "Workspace MCP Server"}</strong></div></header>
        <p>{zh ? "不啟動或偵測任何 CLI。這裡只產生一份使用者層級設定，讓 Desktop Agent 直接列出工作區簡報並讀寫各自的 presentation.mdx。" : "No CLI is launched or detected. This generates one user-level configuration so desktop agents can list workspace presentations and work directly with each presentation.mdx."}</p>
        <div className="osx-mcp-controls">
          <div aria-label={zh ? "MCP 用戶端" : "MCP client"} className="osx-settings-segmented is-three" role="group">
            {(["codex", "claude-code", "claude-desktop"] as const).map((client) => <button className={mcpClient === client ? "is-active" : ""} key={client} onClick={() => setMcpClient(client)} type="button">{client === "codex" ? "Codex" : client === "claude-code" ? "Claude Code" : "Claude Desktop"}</button>)}
          </div>
          <div aria-label={zh ? "作業系統" : "Operating system"} className="osx-settings-segmented" role="group">
            <button className={mcpPlatform === "macos" ? "is-active" : ""} onClick={() => setMcpPlatform("macos")} type="button">macOS</button>
            <button className={mcpPlatform === "windows" ? "is-active" : ""} onClick={() => setMcpPlatform("windows")} type="button">Windows</button>
          </div>
        </div>
        {mcpError ? <p className="osx-mcp-error">{mcpError}</p> : mcpSetup ? <>
          <div className="osx-mcp-meta"><span>{zh ? "全域設定位置" : "Global config location"}<code>{mcpSetup.configPath}</code></span><span>{zh ? "工作區範圍" : "Workspace scope"}<code>{mcpSetup.workspaceRoot}</code></span></div>
          <pre className="osx-mcp-config"><code>{mcpSetup.config}</code></pre>
          <div className="osx-mcp-actions">
            <button onClick={() => void copyMcp(mcpSetup.config, "config")} type="button">{copied === "config" ? <Check size={14} /> : <ClipboardCopy size={14} />}{copied === "config" ? (zh ? "已複製" : "Copied") : (zh ? "複製設定" : "Copy config")}</button>
            <button onClick={() => void copyMcp(mcpSetup.prompt, "prompt")} type="button">{copied === "prompt" ? <Check size={14} /> : <ClipboardCopy size={14} />}{copied === "prompt" ? (zh ? "已複製" : "Copied") : (zh ? "複製設定提示" : "Copy setup prompt")}</button>
          </div>
        </> : <p>{zh ? "正在產生設定…" : "Generating configuration…"}</p>}
      </section>
      <section className="osx-settings-card is-import">
        <span className="osx-settings-icon"><Upload size={20} /></span>
        <div className="osx-settings-copy"><small>{zh ? "簡報匯入" : "Presentation import"}</small><strong>{zh ? "MotionDoc MDX 或專案封裝" : "MotionDoc MDX or project bundle"}</strong><p>{zh ? "MDX 內嵌的 Base64 圖片會自動轉成 assets/*.webp；分離圖片請使用 .zip 或 .slidex。" : "Base64 images embedded in MDX become assets/*.webp automatically; use .zip or .slidex for separate image files."}</p></div>
        <button onClick={props.onImport} type="button"><Upload size={15} />{zh ? "選擇匯入檔" : "Choose import file"}</button>
      </section>
    </div>
  );
}

function TemplateCard(props: { locale: "en" | "zh-TW"; onPreview(): void; template: LocalWorkspaceTemplate }) {
  const zh = props.locale === "zh-TW";
  return (
    <article className="osx-template-card">
      <button className="osx-template-cover" onClick={props.onPreview} type="button"><img alt={props.template.name} src={props.template.cover} /><span>{props.template.slideCount} {zh ? "頁" : "slides"}</span></button>
      <div className="osx-template-card-copy"><strong>{props.template.name}</strong><p>{props.template.description}</p><small><CheckCircle2 size={13} />{props.template.author}</small></div>
      <button className="osx-template-use" onClick={props.onPreview} type="button">{copy[props.locale].useTemplate}<ChevronRight size={14} /></button>
    </article>
  );
}

function templateSlideCover(cover: string, slideIndex: number) {
  const separator = cover.includes("?") ? "&" : "?";
  return `${cover}${separator}slide=${slideIndex}`;
}

function PresentationCard(props: { locale: "en" | "zh-TW"; onDelete(): void; onOpen(): void; onRename(): void; opening: boolean; presentation: LocalWorkspacePresentation }) {
  const zh = props.locale === "zh-TW";
  return (
    <article className="osx-presentation-card">
      <button className="osx-presentation-open" onClick={props.onOpen} type="button">
        <span className="osx-presentation-cover"><img alt="" src={props.presentation.cover} />{props.opening ? <i><LoaderCircle className="spin" size={20} /></i> : null}</span>
        <span className="osx-presentation-copy"><span><strong>{props.presentation.title}</strong><small>{copy[props.locale].edited} · {relativeTime(props.presentation.updatedAt, props.locale)}</small></span></span>
      </button>
      <details className="osx-presentation-menu">
        <summary aria-label={zh ? `${props.presentation.title} 選項` : `${props.presentation.title} actions`}><MoreHorizontal size={17} /></summary>
        <div>
          <button onClick={props.onRename} type="button"><Pencil size={14} />{zh ? "重新命名" : "Rename"}</button>
          <button className="is-danger" onClick={props.onDelete} type="button"><Trash2 size={14} />{zh ? "刪除" : "Delete"}</button>
        </div>
      </details>
    </article>
  );
}

function SearchField(props: { locale: "en" | "zh-TW"; onChange(value: string): void; value: string }) {
  return <label className="osx-workspace-search"><Search size={17} /><input onChange={(event) => props.onChange(event.target.value)} placeholder={copy[props.locale].search} value={props.value} /></label>;
}

function EmptyDecks(props: { home?: boolean; locale: "en" | "zh-TW"; onBlank(): void }) {
  const t = copy[props.locale];
  return <button className={`osx-empty-decks${props.home ? " is-home" : ""}`} onClick={props.onBlank} type="button"><FilePlus2 size={22} /><span><strong>{t.noDecks}</strong><small>{t.noDecksBody}</small></span><Plus size={16} /></button>;
}

function WorkspaceSkeleton() {
  return <div className="osx-workspace-skeleton"><div /><div /><section><i /><i /><i /></section></div>;
}

function viewTitle(view: View, t: typeof copy.en | typeof copy["zh-TW"]) {
  if (view === "home") return "Workspace";
  if (view === "templates") return t.templates;
  if (view === "presentations") return t.presentations;
  if (view === "recent") return t.recent;
  return t.settings;
}

function relativeTime(value: string, locale: "en" | "zh-TW") {
  const difference = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(difference)) return locale === "zh-TW" ? "本機檔案" : "Local file";
  const absolute = Math.abs(difference);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (absolute < 60 * 60_000) return formatter.format(Math.round(difference / 60_000), "minute");
  if (absolute < 24 * 60 * 60_000) return formatter.format(Math.round(difference / (60 * 60_000)), "hour");
  return formatter.format(Math.round(difference / (24 * 60 * 60_000)), "day");
}

function groupPresentations(items: LocalWorkspacePresentation[], locale: "en" | "zh-TW") {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const labels = locale === "zh-TW" ? ["今天", "昨天", "過去 7 天", "更早"] : ["Today", "Yesterday", "Previous 7 days", "Older"];
  const groups = labels.map((label) => ({ label, items: [] as LocalWorkspacePresentation[] }));
  for (const item of items) {
    const age = start - new Date(item.updatedAt).getTime();
    const index = age < 24 * 60 * 60_000 ? 0 : age < 2 * 24 * 60 * 60_000 ? 1 : age < 7 * 24 * 60 * 60_000 ? 2 : 3;
    groups[index].items.push(item);
  }
  return groups.filter((group) => group.items.length);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
