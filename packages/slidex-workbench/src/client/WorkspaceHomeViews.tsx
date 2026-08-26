import { CheckCircle2, ChevronRight, FilePlus2, LayoutGrid, LoaderCircle, MoreHorizontal, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import type { LocalWorkspacePresentation, LocalWorkspaceTemplate } from "./api";

type View = "home" | "templates" | "presentations" | "recent" | "settings";
const copy = { en: { blankBody: "Start from a clean canvas and build your story slide by slide.", blankTitle: "Blank presentation", createDeck: "Create presentation", edited: "Edited", featured: "Featured templates", home: "Home", noDecks: "No presentations yet", noDecksBody: "Create a blank presentation or begin with an official template.", presentations: "Presentations", recent: "Recents", recentWork: "Recent work", search: "Search presentations and templates", settings: "Settings", templates: "Template Library", useTemplate: "Use template", viewAll: "View all" }, "zh-TW": { blankBody: "從乾淨畫布開始，一頁一頁建立你的簡報故事。", blankTitle: "空白簡報", createDeck: "建立簡報", edited: "已編輯", featured: "精選模板", home: "首頁", noDecks: "還沒有簡報", noDecksBody: "建立空白簡報，或使用官方模板開始。", presentations: "簡報", recent: "最近使用", recentWork: "最近的作品", search: "搜尋簡報與模板", settings: "設定", templates: "模板庫", useTemplate: "使用模板", viewAll: "查看全部" } } as const;

export function HomeView(props: {
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
      body: zh ? "匯入可編輯 MDX，或隔離播放含線上素材的 HTML。" : "Import editable MDX or play HTML with online resources in isolation.",
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

export function TemplatesView(props: {
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

export function PresentationsView(props: {
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

export function RecentView(props: {
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

// Settings UI lives in WorkspaceSettingsView.tsx so workspace navigation remains separate from MCP configuration state.
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

export function templateSlideCover(cover: string, slideIndex: number) {
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

export function SearchField(props: { locale: "en" | "zh-TW"; onChange(value: string): void; value: string }) {
  return <label className="osx-workspace-search"><Search size={17} /><input onChange={(event) => props.onChange(event.target.value)} placeholder={copy[props.locale].search} value={props.value} /></label>;
}

export function EmptyDecks(props: { home?: boolean; locale: "en" | "zh-TW"; onBlank(): void }) {
  const t = copy[props.locale];
  return <button className={`osx-empty-decks${props.home ? " is-home" : ""}`} onClick={props.onBlank} type="button"><FilePlus2 size={22} /><span><strong>{t.noDecks}</strong><small>{t.noDecksBody}</small></span><Plus size={16} /></button>;
}

export function WorkspaceSkeleton() {
  return <div className="osx-workspace-skeleton"><div /><div /><section><i /><i /><i /></section></div>;
}

export function viewTitle(view: View, t: typeof copy.en | typeof copy["zh-TW"]) {
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

export function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function messageOf(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
