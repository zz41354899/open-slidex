import type { AssetItem, DocumentSnapshot, Selection } from "./domain";
import {
  localExportMediaSourcesToMaterialize,
  replaceLocalExportMediaSources
} from "./localExport";
export type OfficialTemplateSummary = {
  blueprintSummary: string;
  cover: string;
  description: string;
  id: string;
  locale: "en" | "zh-TW";
  name: string;
  slideCount: number;
  useCase: string;
  version: string;
};
export type OfficialTemplateCatalog = {
  canSelect: boolean;
  current?: { id: string; locale: "en" | "zh-TW"; version: string };
  templates: OfficialTemplateSummary[];
};
export type LocalWorkspacePresentation = {
  cover: string;
  id: string;
  slideCount: number;
  title: string;
  updatedAt: string;
};
export type LocalWorkspaceTemplate = {
  author: string;
  category: string;
  cover: string;
  description: string;
  featured: boolean;
  id: string;
  name: string;
  slideCount: number;
  tags: string[];
  useCase: string;
  version: string;
};
export type LocalWorkspaceSnapshot = {
  locale: "en" | "zh-TW";
  name: string;
  presentations: LocalWorkspacePresentation[];
  root: string;
  templates: LocalWorkspaceTemplate[];
};
export type WorkspaceMcpClient = "codex" | "claude-code" | "claude-desktop";
export type WorkspaceMcpPlatform = "macos" | "windows";
export type WorkspaceMcpSetup = {
  clientAvailable: boolean;
  client: WorkspaceMcpClient;
  config: string;
  configPath: string;
  hostPlatform: WorkspaceMcpPlatform;
  platform: WorkspaceMcpPlatform;
  presentationPath?: string;
  prompt: string;
  scope: "user";
  scopeRoot: string;
  scopeType: "presentation" | "workspace";
  workspaceRoot: string;
};

export type WorkspaceMcpInstallResult = {
  action: "added" | "updated";
  configPath: string;
  restartRequired: true;
};

/** Keeps a deck opened from Workspace on the Workspace origin and API router. */
export function localWorkbenchApiPath(path: string) {
  if (!path.startsWith("/") || typeof window === "undefined") return path;
  const editorMatch = window.location.pathname.match(/^\/workspace\/([A-Za-z0-9._-]+)\/?$/);
  if (!editorMatch?.[1]) return path;
  return `/api/v1/workspace/presentations/${encodeURIComponent(editorMatch[1])}/editor${path}`;
}

export function localWorkbenchAssetUrl(source: string) {
  return localWorkbenchApiPath(`/${source.replace(/^\/+/, "")}`);
}

export function readDocument() {
  return requestJson<DocumentSnapshot>("/api/v1/document");
}

export function readLocalWorkspace(locale: "en" | "zh-TW") {
  return requestJson<LocalWorkspaceSnapshot>(`/api/v1/workspace?locale=${encodeURIComponent(locale)}`);
}

export function readWorkspaceMcpSetup(client: WorkspaceMcpClient, options?: {
  platform?: WorkspaceMcpPlatform;
  scopeRoot?: string;
}) {
  const query = new URLSearchParams({ client });
  if (options?.platform) query.set("platform", options.platform);
  if (options?.scopeRoot) query.set("scopeRoot", options.scopeRoot);
  return requestJson<WorkspaceMcpSetup>(`/api/v1/workspace/mcp/setup?${query}`);
}

export function installWorkspaceMcp(client: WorkspaceMcpClient, platform: WorkspaceMcpPlatform) {
  return requestJson<WorkspaceMcpInstallResult>("/api/v1/workspace/mcp/install", {
    body: JSON.stringify({ client, platform }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
}

export function createLocalWorkspacePresentation(input: {
  locale: "en" | "zh-TW";
  templateId?: string;
  templateVersion?: string;
  title: string;
}) {
  return requestJson<{ editorUrl: string; presentation: LocalWorkspacePresentation }>("/api/v1/workspace/presentations", {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
}

export type WorkspaceHtmlSidecarFile = { file: File; path: string };

export function importLocalWorkspacePresentation(file: File, sidecars: WorkspaceHtmlSidecarFile[] = []) {
  const form = new FormData();
  form.set("file", file);
  for (const sidecar of sidecars) {
    form.append("asset", sidecar.file);
    form.append("assetPath", sidecar.path);
  }
  return requestJson<{ editorUrl: string; presentation: LocalWorkspacePresentation }>("/api/v1/workspace/presentations/import", {
    body: form,
    method: "POST"
  });
}

export function openLocalWorkspacePresentation(id: string) {
  return requestJson<{ editorUrl: string }>(`/api/v1/workspace/presentations/${encodeURIComponent(id)}/open`, { method: "POST" });
}

export function renameLocalWorkspacePresentation(id: string, title: string) {
  return requestJson<{ presentation: LocalWorkspacePresentation }>(`/api/v1/workspace/presentations/${encodeURIComponent(id)}`, {
    body: JSON.stringify({ title }),
    headers: { "content-type": "application/json" },
    method: "PATCH"
  });
}

export function deleteLocalWorkspacePresentation(id: string, confirmationTitle: string) {
  return requestJson<{ deleted: true; recoverableFrom: string }>(`/api/v1/workspace/presentations/${encodeURIComponent(id)}`, {
    body: JSON.stringify({ confirmationTitle }),
    headers: { "content-type": "application/json" },
    method: "DELETE"
  });
}

export function saveDocument(input: {
  expectedRevision: string;
  source: string;
  title: string;
}) {
  return requestJson<DocumentSnapshot>("/api/v1/document", {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "PUT"
  });
}

export function updateContext(input: Selection & { revision: string }) {
  return requestJson<{ ok: true }>("/api/v1/context", {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
}

export function readOfficialTemplates(locale: "en" | "zh-TW") {
  return requestJson<OfficialTemplateCatalog>(`/api/v1/templates?locale=${encodeURIComponent(locale)}`);
}

export function selectOfficialTemplate(template: { id: string; locale: "en" | "zh-TW"; version: string }) {
  return requestJson<{ template: OfficialTemplateCatalog["current"] }>("/api/v1/templates/select", {
    body: JSON.stringify(template),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
}

export async function uploadAsset(file: File, expectedRevision: string) {
  try {
    return await uploadAssetAtRevision(file, expectedRevision);
  } catch (error) {
    const conflict = error as Error & { code?: string; currentRevision?: string };
    // Asset imports create a content-addressed file but do not alter
    // presentation.mdx. A save can finish between the last React render and
    // the file-picker change event, leaving that event with the previous
    // revision. Retrying once with the server-provided revision preserves the
    // user's upload without weakening conflicts for document writes.
    if (conflict.code === "revision_conflict" && conflict.currentRevision) {
      return uploadAssetAtRevision(file, conflict.currentRevision);
    }
    throw error;
  }
}

async function uploadAssetAtRevision(file: File, expectedRevision: string) {
  const form = new FormData();
  form.set("file", file);
  form.set("expectedRevision", expectedRevision);
  return requestJson<{ asset: AssetItem }>("/api/v1/assets", {
    body: form,
    method: "POST"
  });
}

export function deleteAsset(source: string, expectedRevision: string) {
  return requestJson<{ ok: true }>(`/api/v1/assets?source=${encodeURIComponent(source)}&expectedRevision=${encodeURIComponent(expectedRevision)}`, {
    method: "DELETE"
  });
}

export async function updateHtmlAsset(source: string, html: string, expectedRevision: string) {
  const query = new URLSearchParams({ expectedRevision, source });
  try {
    return await requestJson<{ document: DocumentSnapshot; source: string }>(`/api/v1/assets/html?${query}`, {
      body: html,
      headers: { "content-type": "text/html; charset=utf-8" },
      method: "PUT"
    });
  } catch (error) {
    if ((error as { status?: number })?.status === 404) {
      throw Object.assign(
        new Error("The running Workspace server does not include HTML editing yet. Restart OpenSlideX after rebuilding the runtime."),
        { code: "html_editor_unavailable", status: 404 }
      );
    }
    throw error;
  }
}

export type ExportFormat = "html" | "mdx" | "pptx";

type LocalWritableFile = {
  abort?: () => Promise<void>;
  close: () => Promise<void>;
  write: (data: Blob) => Promise<void>;
};

type LocalSaveFileHandle = {
  createWritable: () => Promise<LocalWritableFile>;
  name: string;
};

export type PreparedExportDestination = {
  handle?: LocalSaveFileHandle;
  output: string;
};

const exportFileTypes: Record<ExportFormat, {
  description: string;
  mimeType: string;
}> = {
  html: { description: "HTML presentation", mimeType: "text/html" },
  mdx: { description: "OpenSlideX MDX source", mimeType: "text/mdx" },
  pptx: {
    description: "PowerPoint presentation",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  }
};

/**
 * Ask for the final file location while the export-menu click still has a
 * browser user gesture. This avoids Chromium silently blocking the synthetic
 * download after a slower asynchronous export has finished.
 */
export async function prepareExportDestination(
  fileName: string,
  format: ExportFormat
): Promise<PreparedExportDestination | null> {
  const output = `${fileName}.${format}`;
  if (typeof window === "undefined" || !window.isSecureContext) return { output };

  const picker = (window as Window & {
    showSaveFilePicker?: (options: {
      excludeAcceptAllOption?: boolean;
      suggestedName?: string;
      types?: Array<{ accept: Record<string, string[]>; description: string }>;
    }) => Promise<LocalSaveFileHandle>;
  }).showSaveFilePicker;
  if (!picker) return { output };

  const fileType = exportFileTypes[format];
  try {
    const handle = await picker.call(window, {
      excludeAcceptAllOption: true,
      suggestedName: output,
      types: [{
        accept: { [fileType.mimeType]: [`.${format}`] },
        description: fileType.description
      }]
    });
    return { handle, output: handle.name || output };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }
}

export async function exportDocument(input: {
  fileName: string;
  format: ExportFormat;
  htmlMode?: "original" | "player";
  overwrite: boolean;
  source: string;
  target: "download" | "dist";
}, destination?: PreparedExportDestination) {
  const response = await fetch(localWorkbenchApiPath("/api/v1/export"), {
    body: JSON.stringify(input.target === "download" ? { ...input, delivery: "browser" } : input),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  if (!response.ok) throw await apiError(response);
  if (input.target === "dist") return requestResponseJson<{ output: string }>(response);

  if ((response.headers.get("content-type") ?? "").includes("application/json")) {
    const prepared = await requestResponseJson<{ downloadUrl?: string; output?: string }>(response);
    if (!prepared.downloadUrl || !prepared.output) {
      throw new Error("The export server did not provide a browser download.");
    }
    if (destination?.handle) {
      const downloadResponse = await fetch(localWorkbenchApiPath(prepared.downloadUrl));
      if (!downloadResponse.ok) throw await apiError(downloadResponse);
      const blob = await downloadResponse.blob();
      assertExportBlob(blob);
      await writeExportDestination(destination.handle, blob);
      return { output: destination.output };
    }
    const anchor = document.createElement("a");
    anchor.href = localWorkbenchApiPath(prepared.downloadUrl);
    anchor.download = prepared.output;
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
    // Keep the real download link attached until Chromium has started the GET.
    // Removing it in the click task can cancel every format before the one-time
    // server URL is consumed.
    window.setTimeout(() => anchor.remove(), 1_000);
    return { output: prepared.output };
  }

  const blob = await response.blob();
  assertExportBlob(blob);
  const disposition = response.headers.get("content-disposition") ?? "";
  const downloadName =
    disposition.match(/filename="([^"]+)"/)?.[1] ??
    `${input.fileName}.${input.format}`;
  if (destination?.handle) {
    await writeExportDestination(destination.handle, blob);
    return { output: destination.output };
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = downloadName;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoking in the same task can cancel the navigation before Chromium has
  // handed the Blob to its download manager. Keep the URL alive briefly for
  // browsers that do not expose showSaveFilePicker.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return { output: downloadName };
}

function assertExportBlob(blob: Blob) {
  if (blob.size === 0) throw new Error("The export server returned an empty file.");
}

async function writeExportDestination(handle: LocalSaveFileHandle, blob: Blob) {
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    await writable.abort?.().catch(() => undefined);
    throw error;
  }
}

/**
 * Makes browser-local shape/image sources portable without ever persisting a
 * Base64 URL in MotionDoc. The imported Workspace asset is then used both for
 * this export and for the Canvas source that follows it.
 */
export async function materializeLocalExportMedia(input: {
  expectedRevision: string;
  source: string;
}) {
  const candidates = localExportMediaSourcesToMaterialize(input.source);
  if (candidates.length === 0) return { imported: 0, source: input.source };

  const replacements = new Map<string, string>();
  for (const candidate of candidates) {
    const resource = candidate.source.startsWith("assets/")
      ? localWorkbenchAssetUrl(candidate.source)
      : candidate.source.startsWith("/assets/")
        ? localWorkbenchAssetUrl(candidate.source.slice(1))
      : candidate.source;
    const response = await fetch(resource);
    if (!response.ok) {
      throw new Error(`Could not prepare the shape image for export (${response.status}). Replace the image and try again.`);
    }
    const blob = await response.blob();
    if (!blob.type.startsWith("image/") && candidate.prop !== "src") {
      throw new Error("Shape images must be raster images before export.");
    }
    const file = new File(
      [blob],
      exportMediaFileName(candidate.source, blob.type),
      { type: blob.type || "image/png" }
    );
    const { asset } = await uploadAsset(file, input.expectedRevision);
    replacements.set(`${candidate.prop}:${candidate.source}`, asset.source);
  }
  return {
    imported: replacements.size,
    source: replaceLocalExportMediaSources(input.source, replacements)
  };
}

export function renderMontage(overwrite = false) {
  return requestJson<{ output: string }>("/api/v1/render", {
    body: JSON.stringify({ overwrite }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(typeof input === "string" ? localWorkbenchApiPath(input) : input, init);
  if (!response.ok) throw await apiError(response);
  return requestResponseJson<T>(response);
}

async function requestResponseJson<T>(response: Response) {
  return (await response.json()) as T;
}

async function apiError(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { code?: string; currentRevision?: string; issues?: Array<{ message?: string; path?: string; severity?: string }>; message?: string }
    | null;
  const firstIssue = payload?.issues?.find((issue) => issue.severity === "error") ?? payload?.issues?.[0];
  const issueDetail = firstIssue?.message ? `${firstIssue.path ? `${firstIssue.path}: ` : ""}${firstIssue.message}` : "";
  const error = new Error(issueDetail ? `${payload?.message ?? `Request failed (${response.status}).`} ${issueDetail}` : payload?.message ?? `Request failed (${response.status}).`) as Error & {
    code?: string;
    currentRevision?: string;
    status?: number;
  };
  error.code = payload?.code;
  error.currentRevision = payload?.currentRevision;
  error.status = response.status;
  return error;
}

function exportMediaFileName(source: string, mimeType: string) {
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1] || "png";
  const base = source
    .replace(/^blob:[^/]*\/\//, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/\.[A-Za-z0-9]+$/, "")
    .slice(-56) || "shape-image";
  return `${base}.${extension}`;
}
