import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AssistantCanvasTarget } from "@/core/motion-doc/domain/assistantCanvasActivity";

import { isOpenSlideXToolName } from "../shared/aiEvents";
import type {
  AiConversationActivity,
  AiConversationDocument,
  AiConversationMessage,
  AiConversationProvider,
  AiConversationThread
} from "../shared/aiConversations";
import { redactLocalDetails } from "./codexAppServer";

const emptyDocument = (): AiConversationDocument => ({ threads: [], version: 1 });

export class AiConversationStore {
  readonly filePath: string;
  private writeQueue = Promise.resolve();

  constructor(private readonly projectRoot: string, stateRoot: string) {
    this.filePath = path.join(stateRoot, "ai-conversations.json");
  }

  list() {
    return this.read();
  }

  async create(provider: AiConversationProvider, title?: string) {
    return this.mutate((document) => {
      const now = new Date().toISOString();
      const thread: AiConversationThread = {
        createdAt: now,
        id: randomUUID(),
        messages: [],
        provider,
        title: sanitizeText(title || "New conversation", this.projectRoot, 100),
        updatedAt: now
      };
      document.threads.unshift(thread);
      return thread;
    });
  }

  async delete(threadId: string) {
    return this.mutate((document) => {
      const before = document.threads.length;
      document.threads = document.threads.filter((thread) => thread.id !== threadId);
      return before !== document.threads.length;
    });
  }

  async append(threadId: string, input: Pick<AiConversationMessage, "activities" | "content" | "role">) {
    return this.mutate((document) => {
      const thread = document.threads.find((candidate) => candidate.id === threadId);
      if (!thread) throw Object.assign(new Error("AI conversation was not found."), { status: 404 });
      const now = new Date().toISOString();
      const message: AiConversationMessage = {
        ...(input.activities?.length ? { activities: sanitizeActivities(input.activities, this.projectRoot) } : {}),
        content: sanitizeText(input.content, this.projectRoot, 12_000),
        createdAt: now,
        id: randomUUID(),
        role: input.role
      };
      thread.messages.push(message);
      thread.updatedAt = now;
      if (thread.messages.length === 1 && input.role === "user") {
        thread.title = sanitizeText(input.content, this.projectRoot, 72) || thread.title;
      }
      document.threads.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      return message;
    });
  }

  private mutate<T>(change: (document: AiConversationDocument) => T) {
    let result: T;
    this.writeQueue = this.writeQueue.then(async () => {
      const document = await this.read();
      result = change(document);
      await this.write(document);
    });
    return this.writeQueue.then(() => result!);
  }

  private async read(): Promise<AiConversationDocument> {
    try {
      const value = JSON.parse(await readFile(this.filePath, "utf8")) as unknown;
      return parseDocument(value, this.projectRoot);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return emptyDocument();
      throw error;
    }
  }

  private async write(document: AiConversationDocument) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(document, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(tempPath, this.filePath);
  }
}

function parseDocument(value: unknown, projectRoot: string): AiConversationDocument {
  if (!value || typeof value !== "object") return emptyDocument();
  const document = value as Record<string, unknown>;
  if (document.version !== 1 || !Array.isArray(document.threads)) return emptyDocument();
  return {
    threads: document.threads.map((value) => parseThread(value, projectRoot)).filter(Boolean) as AiConversationThread[],
    version: 1
  };
}

function parseThread(value: unknown, projectRoot: string): AiConversationThread | undefined {
  if (!value || typeof value !== "object") return undefined;
  const thread = value as Record<string, unknown>;
  if (typeof thread.id !== "string" || (thread.provider !== "codex" && thread.provider !== "claude")) return undefined;
  const createdAt = validDate(thread.createdAt);
  const updatedAt = validDate(thread.updatedAt);
  return {
    createdAt,
    id: thread.id,
    messages: Array.isArray(thread.messages)
      ? thread.messages.map((message) => parseMessage(message, projectRoot)).filter(Boolean) as AiConversationMessage[]
      : [],
    provider: thread.provider,
    title: sanitizeText(String(thread.title ?? "Conversation"), projectRoot, 100),
    updatedAt
  };
}

function parseMessage(value: unknown, projectRoot: string): AiConversationMessage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const message = value as Record<string, unknown>;
  if (typeof message.id !== "string" || (message.role !== "assistant" && message.role !== "user")) return undefined;
  const activities = Array.isArray(message.activities) ? sanitizeActivities(message.activities, projectRoot) : [];
  return {
    ...(activities.length ? { activities } : {}),
    content: sanitizeText(String(message.content ?? ""), projectRoot, 12_000),
    createdAt: validDate(message.createdAt),
    id: message.id,
    role: message.role
  };
}

function sanitizeActivities(values: unknown[], projectRoot: string) {
  return values.flatMap((value): AiConversationActivity[] => {
    if (!value || typeof value !== "object") return [];
    const activity = value as Record<string, unknown>;
    if (!isOpenSlideXToolName(activity.tool) || (activity.status !== "completed" && activity.status !== "failed")) return [];
    return [{
      details: Array.isArray(activity.details)
        ? activity.details.filter((detail): detail is string => typeof detail === "string").slice(0, 12).map((detail) => sanitizeText(detail, projectRoot, 240))
        : [],
      id: sanitizeText(String(activity.id ?? randomUUID()), projectRoot, 160),
      ...(typeof activity.message === "string" ? { message: sanitizeText(activity.message, projectRoot, 1_000) } : {}),
      status: activity.status,
      summary: sanitizeText(String(activity.summary ?? "OpenSlideX tool"), projectRoot, 240),
      targets: Array.isArray(activity.targets) ? activity.targets.flatMap(sanitizeTarget) : [],
      tool: activity.tool
    }];
  });
}

function sanitizeTarget(value: unknown): AssistantCanvasTarget[] {
  if (!value || typeof value !== "object") return [];
  const target = value as Record<string, unknown>;
  if (target.kind === "presentation") return [{ kind: "presentation" } as const];
  if (!Number.isInteger(target.slideIndex) || Number(target.slideIndex) < 0) return [];
  if (target.kind === "slide") return [{ kind: "slide", slideIndex: Number(target.slideIndex) } as const];
  if (target.kind !== "block") return [];
  return [{
    ...(Number.isInteger(target.blockIndex) && Number(target.blockIndex) >= 0 ? { blockIndex: Number(target.blockIndex) } : {}),
    kind: "block" as const,
    ...(typeof target.nodeId === "string" ? { nodeId: target.nodeId.replace(/[^A-Za-z0-9._:-]/g, "").slice(0, 120) } : {}),
    slideIndex: Number(target.slideIndex)
  }];
}

function sanitizeText(value: string, projectRoot: string, maxLength: number) {
  return redactLocalDetails(value
    .replace(/<OPENSLIDEX_MDX>[\s\S]*?<\/OPENSLIDEX_MDX>/gi, "[presentation source omitted]")
    .replace(/data:[^\s]+/gi, "[binary preview omitted]"), projectRoot).slice(0, maxLength).trim();
}

function validDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : new Date(0).toISOString();
}
