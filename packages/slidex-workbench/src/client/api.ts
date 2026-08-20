import type { AssetItem, DocumentSnapshot, Selection } from "./domain";
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
  client: WorkspaceMcpClient;
  config: string;
  configPath: string;
  platform: WorkspaceMcpPlatform;
  presentationPath?: string;
  prompt: string;
  scope: "user";
  scopeRoot: string;
  scopeType: "presentation" | "workspace";
  workspaceRoot: string;
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

export function readWorkspaceMcpSetup(client: WorkspaceMcpClient, platform: WorkspaceMcpPlatform) {
  return requestJson<WorkspaceMcpSetup>(`/api/v1/workspace/mcp/setup?client=${encodeURIComponent(client)}&platform=${encodeURIComponent(platform)}`);
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

export function importLocalWorkspacePresentation(file: File) {
  const form = new FormData();
  form.set("file", file);
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

export async function prepareExportDestination(
  fileName: string,
  format: ExportFormat
): Promise<PreparedExportDestination | null> {
  const output = `${fileName}.${format}`;
  if (format !== "pptx" || typeof window === "undefined" || !window.isSecureContext) {
    return { output };
  }

  const picker = (window as Window & {
    showSaveFilePicker?: (options: {
      excludeAcceptAllOption?: boolean;
      suggestedName?: string;
      types?: Array<{ accept: Record<string, string[]>; description: string }>;
    }) => Promise<LocalSaveFileHandle>;
  }).showSaveFilePicker;
  if (!picker) return { output };

  try {
    const handle = await picker.call(window, {
      excludeAcceptAllOption: true,
      suggestedName: output,
      types: [{
        accept: {
          "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"]
        },
        description: "PowerPoint presentation"
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
  overwrite: boolean;
  source: string;
  target: "download" | "dist";
}, destination?: PreparedExportDestination) {
  const response = await fetch(localWorkbenchApiPath("/api/v1/export"), {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  if (!response.ok) throw await apiError(response);
  if (input.target === "dist") return requestResponseJson<{ output: string }>(response);

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const downloadName =
    disposition.match(/filename="([^"]+)"/)?.[1] ??
    `${input.fileName}.${input.format}`;
  if (destination?.handle) {
    const writable = await destination.handle.createWritable();
    try {
      await writable.write(blob);
      await writable.close();
    } catch (error) {
      await writable.abort?.().catch(() => undefined);
      throw error;
    }
    return { output: destination.output };
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = downloadName;
  anchor.click();
  URL.revokeObjectURL(url);
  return { output: downloadName };
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
    | { code?: string; currentRevision?: string; message?: string }
    | null;
  const error = new Error(payload?.message ?? `Request failed (${response.status}).`) as Error & {
    code?: string;
    currentRevision?: string;
  };
  error.code = payload?.code;
  error.currentRevision = payload?.currentRevision;
  return error;
}
