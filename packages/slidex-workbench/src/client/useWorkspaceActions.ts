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
  const [importPending, setImportPending] = useState(false);
  const [importError, setImportError] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

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
    setImportError("");
    setImportOpen(true);
  }, []);

  const chooseImportFile = useCallback((file?: File) => {
    setImportError("");
    if (!file) return;
    const extension = file.name.toLowerCase().match(/\.(mdx|slidex|zip)$/)?.[1];
    if (!extension) {
      setImportFile(undefined);
      setImportError(zh ? "只支援 .mdx、.zip 或 .slidex。" : "Use an .mdx, .zip, or .slidex file.");
      return;
    }
    const maximumBytes = 50 * 1024 * 1024;
    if (!file.size || file.size > maximumBytes) {
      setImportFile(undefined);
      setImportError(zh ? "匯入檔案大小必須介於 1 byte 與 50 MB 之間。" : "The import file must be between 1 byte and 50 MB.");
      return;
    }
    setImportFile(file);
  }, [zh]);

  const importPresentation = useCallback(async () => {
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
  }, [importFile, importPending, zh]);

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
    createPresentation,
    deletePresentation,
    importError,
    importFile,
    importInputRef,
    importOpen,
    importPending,
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
