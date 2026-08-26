import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  createLocalWorkspacePresentation,
  deleteLocalWorkspacePresentation,
  importLocalWorkspacePresentation,
  openLocalWorkspacePresentation,
  renameLocalWorkspacePresentation,
  type LocalWorkspacePresentation,
  type LocalWorkspaceSnapshot,
  type LocalWorkspaceTemplate
} from "./api";
import { messageOf } from "./WorkspaceHomeViews";

export type CreationIntent = { kind: "blank" } | { kind: "template"; template: LocalWorkspaceTemplate };
export type ManageIntent = { kind: "delete" | "rename"; presentation: LocalWorkspacePresentation };
export type TemplatePreview = { slideIndex: number; template: LocalWorkspaceTemplate };

type UseWorkspaceActionsInput = {
  locale: "en" | "zh-TW";
  setLoadError: Dispatch<SetStateAction<string>>;
  setWorkspace: Dispatch<SetStateAction<LocalWorkspaceSnapshot | undefined>>;
  zh: boolean;
};

/** Owns local workspace mutations and their dialog state, separate from navigation UI. */
export function useWorkspaceActions({ locale, setLoadError, setWorkspace, zh }: UseWorkspaceActionsInput) {
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
  const [importSidecars, setImportSidecars] = useState<Array<{ file: File; path: string }>>([]);
  const [importPending, setImportPending] = useState(false);
  const [importError, setImportError] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const importFolderInputRef = useRef<HTMLInputElement>(null);

  const beginCreation = useCallback((next: CreationIntent) => {
    setPreview(undefined);
    setIntent(next);
    setTitle(next.kind === "template" ? next.template.name : zh ? "未命名簡報" : "Untitled presentation");
    setActionError("");
  }, [zh]);

  const openTemplatePreview = useCallback((template: LocalWorkspaceTemplate) => {
    setPreview({ slideIndex: 0, template });
  }, []);

  const createPresentation = useCallback(async () => {
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
  }, [intent, locale, pending, title, zh]);

  const beginImport = useCallback(() => {
    setImportFile(undefined);
    setImportSidecars([]);
    setImportError("");
    setImportOpen(true);
  }, []);

  const chooseImportFile = useCallback((file?: File) => {
    setImportError("");
    if (!file) return;
    const extension = file.name.toLowerCase().match(/\.(mdx|html)$/)?.[1];
    if (!extension) {
      setImportFile(undefined);
      setImportSidecars([]);
      setImportError(zh ? "只支援 .mdx 或 .html。" : "Use an .mdx or .html file.");
      return;
    }
    const maximumBytes = 50 * 1024 * 1024;
    if (!file.size || file.size > maximumBytes) {
      setImportFile(undefined);
      setImportError(zh ? "匯入檔案大小必須介於 1 byte 與 50 MB 之間。" : "The import file must be between 1 byte and 50 MB.");
      return;
    }
    setImportFile(file);
    setImportSidecars([]);
  }, [zh]);

  const chooseImportFolder = useCallback((files?: FileList | null) => {
    setImportError("");
    const candidates = [...(files ?? [])];
    const sources = candidates.filter((file) => /\.(?:mdx|html)$/i.test(file.name));
    if (sources.length !== 1) {
      setImportFile(undefined);
      setImportSidecars([]);
      setImportError(zh ? "請選擇只包含一份 .html 或 .mdx 的簡報資料夾。" : "Choose a presentation folder containing exactly one .html or .mdx file.");
      return;
    }
    const source = sources[0]!;
    if (!source.size || source.size > 50 * 1024 * 1024) {
      setImportFile(undefined);
      setImportSidecars([]);
      setImportError(zh ? "匯入檔案大小必須介於 1 byte 與 50 MB 之間。" : "The import file must be between 1 byte and 50 MB.");
      return;
    }
    const sidecars = /\.html$/i.test(source.name)
      ? candidates
          .filter((file) => file !== source && /\.(?:avif|gif|jpe?g|png|webp|svg)$/i.test(file.name))
          .map((file) => ({ file, path: importFolderPath(file) }))
      : [];
    setImportFile(source);
    setImportSidecars(sidecars);
  }, [zh]);

  const importPresentation = useCallback(async () => {
    if (!importFile || importPending) return;
    setImportPending(true);
    setImportError("");
    try {
      const result = await importLocalWorkspacePresentation(importFile, importSidecars);
      window.location.assign(result.editorUrl);
    } catch (error) {
      setImportError(messageOf(error, zh ? "無法匯入這份 OpenSlideX 簡報。" : "Could not import this OpenSlideX presentation."));
      setImportPending(false);
    }
  }, [importFile, importPending, importSidecars, zh]);

  const openPresentation = useCallback(async (id: string) => {
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
  }, [openingId, setLoadError, zh]);

  const beginManagement = useCallback((kind: ManageIntent["kind"], presentation: LocalWorkspacePresentation) => {
    setManageIntent({ kind, presentation });
    setManageValue(kind === "rename" ? presentation.title : "");
    setManageError("");
  }, []);

  const renamePresentation = useCallback(async () => {
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
  }, [manageIntent, managePending, manageValue, setWorkspace, zh]);

  const deletePresentation = useCallback(async () => {
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
  }, [manageIntent, managePending, manageValue, setWorkspace, zh]);

  return {
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
  };
}

function importFolderPath(file: File) {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const parts = relative.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join("/") : file.name;
}
