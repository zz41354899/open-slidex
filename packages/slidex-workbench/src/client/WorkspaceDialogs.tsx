import type { DragEvent, RefObject } from "react";
import { CheckCircle2, ChevronRight, FileCheck2, FilePlus2, LayoutGrid, LoaderCircle, Pencil, Plus, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import type { CreationIntent, ManageIntent, TemplatePreview } from "./useWorkspaceActions";
import { formatBytes, templateSlideCover } from "./WorkspaceHomeViews";

type WorkspaceDialogsProps = {
  actionError: string;
  chooseImportFile: (file?: File) => void;
  createPresentation: () => Promise<void>;
  deletePresentation: () => Promise<void>;
  importError: string;
  importFile?: File;
  importInputRef: RefObject<HTMLInputElement | null>;
  importOpen: boolean;
  importPending: boolean;
  importPresentation: () => Promise<void>;
  intent?: CreationIntent;
  locale: "en" | "zh-TW";
  manageError: string;
  manageIntent?: ManageIntent;
  managePending: boolean;
  manageValue: string;
  pending: boolean;
  preview?: TemplatePreview;
  renamePresentation: () => Promise<void>;
  setImportOpen: (open: boolean) => void;
  setIntent: (intent: CreationIntent | undefined) => void;
  setManageIntent: (intent: ManageIntent | undefined) => void;
  setManageValue: (value: string) => void;
  setPreview: (preview: TemplatePreview | undefined | ((current: TemplatePreview | undefined) => TemplatePreview | undefined)) => void;
  setTitle: (value: string) => void;
  startTemplate: (intent: CreationIntent) => void;
  title: string;
  t: { blankTitle: string; createAndOpen: string; createDeck: string; useTemplate: string };
};

/** Modal presentation is deliberately separate from Workspace navigation and mutation state. */
export function WorkspaceDialogs({
  actionError,
  chooseImportFile,
  createPresentation,
  deletePresentation,
  importError,
  importFile,
  importInputRef,
  importOpen,
  importPending,
  importPresentation,
  intent,
  locale,
  manageError,
  manageIntent,
  managePending,
  manageValue,
  pending,
  preview,
  renamePresentation,
  setImportOpen,
  setIntent,
  setManageIntent,
  setManageValue,
  setPreview,
  setTitle,
  startTemplate,
  title,
  t
}: WorkspaceDialogsProps) {
  const zh = locale === "zh-TW";

  return (
    <>
      {preview ? (
        <div className="osx-workspace-overlay" onMouseDown={() => setPreview(undefined)} role="presentation">
          <section aria-modal="true" className="osx-template-preview-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <button aria-label={zh ? "關閉" : "Close"} className="osx-dialog-close" onClick={() => setPreview(undefined)} type="button"><X size={17} /></button>
            <div className="osx-template-preview-stage">
              <div className="osx-template-preview-image"><img alt={`${preview.template.name} — ${preview.slideIndex === 0 ? (zh ? "封面" : "cover") : `${zh ? "第" : "Slide "}${preview.slideIndex + 1}${zh ? "頁" : ""}`}`} src={templateSlideCover(preview.template.cover, preview.slideIndex)} /></div>
              <div aria-label={zh ? "模板投影片預覽" : "Template slide previews"} className="osx-template-preview-thumbnails" role="tablist">
                {Array.from({ length: preview.template.slideCount }, (_, slideIndex) => <button aria-label={slideIndex === 0 ? (zh ? "封面" : "Cover") : (zh ? `第 ${slideIndex + 1} 頁` : `Slide ${slideIndex + 1}`)} aria-selected={preview.slideIndex === slideIndex} className={preview.slideIndex === slideIndex ? "is-active" : ""} key={slideIndex} onClick={() => setPreview((current) => current ? { ...current, slideIndex } : current)} role="tab" type="button"><img alt="" src={templateSlideCover(preview.template.cover, slideIndex)} /><span>{slideIndex === 0 ? (zh ? "封面" : "Cover") : slideIndex + 1}</span></button>)}
              </div>
            </div>
            <div className="osx-template-preview-copy">
              <span>{preview.template.category.replaceAll("-", " ")}</span><h2>{preview.template.name}</h2><p>{preview.template.description}</p>
              <small><CheckCircle2 size={14} />{preview.template.author} · {preview.template.slideCount} {zh ? "頁" : "slides"}</small>
              <button onClick={() => startTemplate({ kind: "template", template: preview.template })} type="button">{t.useTemplate}<ChevronRight size={15} /></button>
            </div>
          </section>
        </div>
      ) : null}

      {intent ? (
        <div className="osx-workspace-overlay" onMouseDown={() => !pending && setIntent(undefined)} role="presentation">
          <section aria-modal="true" className="osx-create-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <button aria-label={zh ? "關閉" : "Close"} className="osx-dialog-close" disabled={pending} onClick={() => setIntent(undefined)} type="button"><X size={17} /></button>
            <span className="osx-create-dialog-icon">{intent.kind === "template" ? <LayoutGrid size={19} /> : <FilePlus2 size={19} />}</span><small>{intent.kind === "template" ? t.useTemplate : t.blankTitle}</small><h2>{intent.kind === "template" ? intent.template.name : t.createDeck}</h2>
            <p>{zh ? "會在此工作區建立新的本機資料夾，不會改寫現有簡報。" : "A new local folder will be created in this workspace. Existing decks stay untouched."}</p>
            <label><span>{zh ? "簡報名稱" : "Presentation name"}<small>{title.length}/80</small></span><input autoFocus maxLength={80} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createPresentation(); }} value={title} /></label>
            {actionError ? <div className="osx-workspace-error">{actionError}</div> : null}
            <footer><button disabled={pending} onClick={() => setIntent(undefined)} type="button">{zh ? "取消" : "Cancel"}</button><button className="is-primary" disabled={pending || !title.trim()} onClick={() => void createPresentation()} type="button">{pending ? <LoaderCircle className="spin" size={14} /> : <Plus size={14} />}{pending ? (zh ? "正在建立…" : "Creating…") : t.createAndOpen}</button></footer>
          </section>
        </div>
      ) : null}

      {importOpen ? (
        <div className="osx-workspace-overlay" onMouseDown={() => !importPending && setImportOpen(false)} role="presentation">
          <section aria-modal="true" className="osx-import-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <button aria-label={zh ? "關閉" : "Close"} className="osx-dialog-close" disabled={importPending} onClick={() => setImportOpen(false)} type="button"><X size={17} /></button>
            <span className="osx-import-dialog-icon"><Upload size={20} /></span><small>{zh ? "本機簡報匯入" : "Local presentation import"}</small><h2>{zh ? "匯入 OpenSlideX 簡報" : "Import an OpenSlideX presentation"}</h2>
            <p>{zh ? "MDX 保留原生可編輯圖層；HTML 會原樣保留，並可在無同源權限的隔離播放器中載入 HTTP(S) 圖庫、函式庫與影音。" : "MDX keeps native editable layers. HTML stays byte-exact and can load HTTP(S) libraries, images, and media in an isolated player without same-origin access."}</p>
            <input accept=".mdx,.html,text/mdx,text/markdown,text/html" className="sr-only" onChange={(event) => chooseImportFile(event.currentTarget.files?.[0])} ref={importInputRef} type="file" />
            <button className={`osx-mdx-dropzone${importFile ? " has-file" : ""}`} onClick={() => importInputRef.current?.click()} onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()} onDrop={(event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); chooseImportFile(event.dataTransfer.files[0]); }} type="button">
              {importFile ? <FileCheck2 size={28} /> : <Upload size={28} />}<span><strong>{importFile?.name ?? (zh ? "拖放 MDX 或 HTML" : "Drop MDX or HTML")}</strong><small>{importFile ? formatBytes(importFile.size) : (zh ? ".mdx/.html · 上限 50 MB" : ".mdx/.html · 50 MB maximum")}</small></span>
            </button>
            <div className="osx-import-policy"><ShieldCheck size={15} /><span>{zh ? "原始檔保留在本機；HTML 內的 HTTP(S) 素材會直接連線到其提供者。" : "The original stays local; HTTP(S) resources inside HTML connect directly to their providers."}</span></div>
            {importError ? <div className="osx-workspace-error">{importError}</div> : null}
            <footer><button disabled={importPending} onClick={() => setImportOpen(false)} type="button">{zh ? "取消" : "Cancel"}</button><button className="is-primary" disabled={!importFile || importPending} onClick={() => void importPresentation()} type="button">{importPending ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />}{importPending ? (zh ? "正在匯入…" : "Importing…") : (zh ? "匯入並開啟" : "Import and open")}</button></footer>
          </section>
        </div>
      ) : null}

      {manageIntent ? (
        <div className="osx-workspace-overlay" onMouseDown={() => !managePending && setManageIntent(undefined)} role="presentation">
          <section aria-modal="true" className={`osx-manage-dialog${manageIntent.kind === "delete" ? " is-danger" : ""}`} onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <button aria-label={zh ? "關閉" : "Close"} className="osx-dialog-close" disabled={managePending} onClick={() => setManageIntent(undefined)} type="button"><X size={17} /></button>
            <span className="osx-create-dialog-icon">{manageIntent.kind === "rename" ? <Pencil size={18} /> : <Trash2 size={18} />}</span><small>{manageIntent.kind === "rename" ? (zh ? "重新命名" : "Rename") : (zh ? "刪除本機簡報" : "Delete local presentation")}</small><h2>{manageIntent.kind === "rename" ? (zh ? "修改簡報名稱" : "Rename presentation") : manageIntent.presentation.title}</h2>
            <p>{manageIntent.kind === "rename" ? (zh ? "名稱會同步更新至編輯器與 Workspace，底層資料夾保持不變。" : "The editor and Workspace will use the new title. The underlying folder stays unchanged.") : (zh ? `輸入「${manageIntent.presentation.title}」確認刪除。簡報會移至本機回收區。` : `Enter “${manageIntent.presentation.title}” to confirm. The presentation will move to the local recovery area.`)}</p>
            <label><span>{manageIntent.kind === "rename" ? (zh ? "簡報名稱" : "Presentation name") : (zh ? "確認名稱" : "Confirm title")}</span><input autoFocus maxLength={80} onChange={(event) => setManageValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void (manageIntent.kind === "rename" ? renamePresentation() : deletePresentation()); }} value={manageValue} /></label>
            {manageError ? <div className="osx-workspace-error">{manageError}</div> : null}
            <footer><button disabled={managePending} onClick={() => setManageIntent(undefined)} type="button">{zh ? "取消" : "Cancel"}</button><button className={manageIntent.kind === "delete" ? "is-danger" : "is-primary"} disabled={managePending || !manageValue.trim() || (manageIntent.kind === "delete" && manageValue !== manageIntent.presentation.title)} onClick={() => void (manageIntent.kind === "rename" ? renamePresentation() : deletePresentation())} type="button">{managePending ? <LoaderCircle className="spin" size={14} /> : manageIntent.kind === "rename" ? <Pencil size={14} /> : <Trash2 size={14} />}{managePending ? (zh ? "處理中…" : "Working…") : manageIntent.kind === "rename" ? (zh ? "儲存名稱" : "Save name") : (zh ? "刪除簡報" : "Delete presentation")}</button></footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
