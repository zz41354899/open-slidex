import type { AssetItem, DocumentSnapshot, Selection } from "./domain";
import { isAiRunEvent, type AiRunEvent } from "../shared/aiEvents";
import type {
  AiConversationDocument,
  AiConversationMessage,
  AiConversationProvider,
  AiConversationThread
} from "../shared/aiConversations";

export type { AiRunEvent, OpenSlideXToolName, ToolPreviewRef } from "../shared/aiEvents";
export type { AiConversationActivity, AiConversationMessage, AiConversationThread } from "../shared/aiConversations";

export type AiProvider = "claude" | "codex";
export type AiMode = "balanced" | "fast" | "quality";
export type AiProviderStatus = {
  authenticated: boolean;
  available: boolean;
  detail: string;
  label: string;
  provider: AiProvider;
  version?: string;
};
export type AiDraft = {
  id: string;
  montage?: string;
  revision: string;
  source: string;
  validation: DocumentSnapshot["validation"];
};
export type AiRunResult = {
  draft?: AiDraft;
  message: string;
  provider: AiProvider;
  sessionId: string;
};
export type McpClient = "claude-code" | "claude-desktop" | "codex";
export type McpPlatform = "macos" | "windows";
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

export function readDocument() {
  return requestJson<DocumentSnapshot>("/api/v1/document");
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

export function readAiStatus() {
  return requestJson<{ providers: AiProviderStatus[] }>("/api/v1/ai/status");
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

export function warmAi() {
  return requestJson<{ ready: boolean; status?: AiProviderStatus }>("/api/v1/ai/warm", { method: "POST" });
}

export function readAiConversations() {
  return requestJson<AiConversationDocument>("/api/v1/ai/conversations");
}

export function createAiConversation(provider: AiConversationProvider, title?: string) {
  return requestJson<AiConversationThread>("/api/v1/ai/conversations", {
    body: JSON.stringify({ provider, title }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
}

export function deleteAiConversation(threadId: string) {
  return requestJson<{ deleted: boolean }>(`/api/v1/ai/conversations/${encodeURIComponent(threadId)}`, { method: "DELETE" });
}

export function appendAiConversationMessage(
  threadId: string,
  message: Pick<AiConversationMessage, "activities" | "content" | "role">
) {
  return requestJson<AiConversationMessage>(`/api/v1/ai/conversations/${encodeURIComponent(threadId)}/messages`, {
    body: JSON.stringify(message),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
}

export function runAiChat(input: {
  abortSignal?: AbortSignal;
  expectedRevision: string;
  messages: Array<{ content: string; role: "assistant" | "user" }>;
  prompt: string;
  provider: AiProvider;
  selection: Selection;
}) {
  return requestJson<AiRunResult>("/api/v1/ai/chat", {
    body: JSON.stringify({
      ...input.selection,
      expectedRevision: input.expectedRevision,
      messages: input.messages,
      prompt: input.prompt,
      provider: input.provider
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
    signal: input.abortSignal
  });
}

export async function* runAiChatStream(input: {
  abortSignal?: AbortSignal;
  aiMode: AiMode;
  expectedRevision: string;
  messages: Array<{ content: string; role: "assistant" | "user" }>;
  prompt: string;
  provider: "codex";
  selection: Selection;
}): AsyncGenerator<AiRunEvent> {
  const response = await fetch("/api/v1/ai/chat/stream", {
    body: JSON.stringify({
      ...input.selection,
      aiMode: input.aiMode,
      expectedRevision: input.expectedRevision,
      messages: input.messages,
      prompt: input.prompt,
      provider: input.provider
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
    signal: input.abortSignal
  });
  if (!response.ok) throw await apiError(response);
  if (!response.body) throw new Error("The local AI stream did not return a response body.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const event = parseAiSseFrame(frame);
        if (!event) continue;
        terminal ||= event.type === "run.completed" || event.type === "run.failed";
        yield event;
      }
      if (done) break;
    }
    const finalEvent = parseAiSseFrame(buffer);
    if (finalEvent) {
      terminal ||= finalEvent.type === "run.completed" || finalEvent.type === "run.failed";
      yield finalEvent;
    }
    if (!terminal && !input.abortSignal?.aborted) {
      throw new Error("The local AI stream ended before Codex reported a final state.");
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

export function applyAiDraft(draftId: string, expectedRevision: string) {
  return requestJson<DocumentSnapshot>("/api/v1/ai/apply", {
    body: JSON.stringify({ draftId, expectedRevision }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
}

export function cancelAiRun(sessionId: string) {
  return requestJson<{ cancelled: boolean }>("/api/v1/ai/cancel", {
    body: JSON.stringify({ sessionId }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
}

export function readMcpSetup(client: McpClient, platform: McpPlatform) {
  return requestJson<{
    client: McpClient;
    config: string;
    configPath: string;
    platform: McpPlatform;
    projectRoot: string;
    prompt: string;
  }>(`/api/v1/mcp/setup?client=${encodeURIComponent(client)}&platform=${encodeURIComponent(platform)}`);
}

export function listAssets() {
  return requestJson<{ assets: AssetItem[] }>("/api/v1/assets");
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

export function renameAsset(input: {
  expectedRevision: string;
  from: string;
  to: string;
}) {
  return requestJson<{ document: DocumentSnapshot }>("/api/v1/assets", {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "PATCH"
  });
}

export function deleteAsset(source: string, expectedRevision: string) {
  return requestJson<{ ok: true }>(`/api/v1/assets?source=${encodeURIComponent(source)}&expectedRevision=${encodeURIComponent(expectedRevision)}`, {
    method: "DELETE"
  });
}

export type ExportFormat = "html" | "mdx" | "pptx";

export async function exportDocument(input: {
  fileName: string;
  format: ExportFormat;
  overwrite: boolean;
  source: string;
  target: "download" | "dist";
}) {
  const response = await fetch("/api/v1/export", {
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
  const response = await fetch(input, init);
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

export function parseAiSseFrame(frame: string) {
  const lines = frame.split(/\r?\n/);
  if (lines.some((line) => line.startsWith("event:") && line.slice(6).trim() !== "ai")) return undefined;
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return undefined;
  const value = JSON.parse(data) as unknown;
  if (!isAiRunEvent(value)) throw new Error("The local AI stream returned an invalid event.");
  return value;
}
