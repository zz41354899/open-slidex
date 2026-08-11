import { createReadStream, watch } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { Readable } from "node:stream";

import { summarizeMotionDoc } from "@open-slidex/sdk";
import {
  SlideXImageAssetError,
  SlideXRevisionConflictError
} from "@open-slidex/sdk/node";

import { OpenSlideXLocalMediaError, SlideXProject } from "./project";
import { OpenSlideXAiBridge, openSlideXAiModes, openSlideXAiProviders } from "./aiBridge";
import { AiConversationStore } from "./aiConversations";
import type { AiRunEvent } from "../shared/aiEvents";
import {
  parseWorkbenchMcpClient,
  parseWorkbenchMcpPlatform,
  workbenchMcpConfig,
  workbenchMcpPrompt
} from "./mcpConfig";

type StartServerInput = {
  clientRoot: string;
  port: number;
  project: SlideXProject;
};

export async function startWorkbenchServer(input: StartServerInput) {
  const clients = new Set<ServerResponse>();
  const aiBridge = new OpenSlideXAiBridge(input.project);
  const aiConversations = new AiConversationStore(input.project.root, input.project.stateRoot);
  const notify = (event: "assets.changed" | "document.changed") => {
    for (const client of clients) client.write(`event: ${event}\ndata: {}\n\n`);
  };
  const server = createServer((request, response) => {
    void routeRequest(request, response, input, clients, aiBridge, aiConversations).catch((error) => {
      sendError(response, error);
    });
  });
  const documentWatcher = watch(
    path.join(input.project.root, "presentation.mdx"),
    { persistent: false },
    () => notify("document.changed")
  );
  const assetWatcher = watch(
    input.project.assetsRoot,
    { persistent: false },
    () => notify("assets.changed")
  );

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(input.port, "127.0.0.1", resolve);
  });

  return {
    close: async () => {
      aiBridge.close();
      documentWatcher.close();
      assetWatcher.close();
      for (const client of clients) client.end();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve())
      );
    },
    port: (server.address() as { port: number }).port
  };
}

async function routeRequest(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  input: StartServerInput,
  clients: Set<ServerResponse>,
  aiBridge: OpenSlideXAiBridge,
  aiConversations: AiConversationStore
) {
  const request = await webRequest(incoming, input.port);
  const url = new URL(request.url);
  assertLocalRequest(request, input.port);

  if (request.method === "GET" && url.pathname === "/api/v1/events") {
    outgoing.writeHead(200, {
      "cache-control": "no-cache",
      "connection": "keep-alive",
      "content-type": "text/event-stream",
      "x-content-type-options": "nosniff"
    });
    const stopHeartbeat = startSseHeartbeat(incoming, outgoing);
    outgoing.write("event: connected\ndata: {}\n\n");
    clients.add(outgoing);
    outgoing.once("close", () => {
      stopHeartbeat();
      clients.delete(outgoing);
    });
    return;
  }

  if (url.pathname === "/api/v1/document") {
    if (request.method === "GET") return sendJson(outgoing, await input.project.open());
    if (request.method === "PUT") {
      const body = await jsonBody<{
        expectedRevision?: unknown;
        source?: unknown;
        title?: unknown;
      }>(request);
      if (
        typeof body.expectedRevision !== "string" ||
        typeof body.source !== "string" ||
        typeof body.title !== "string"
      ) {
        return sendJson(outgoing, { code: "invalid_request", message: "source, title, and expectedRevision are required." }, 400);
      }
      const validation = summarizeMotionDoc(body.source).validation;
      if (!validation.isValid) {
        return sendJson(outgoing, { code: "invalid_source", issues: validation.issues, message: "The draft is invalid and was not written." }, 422);
      }
      return sendJson(outgoing, await input.project.save({
        expectedRevision: body.expectedRevision,
        source: body.source,
        title: body.title
      }));
    }
  }

  if (url.pathname === "/api/v1/context" && request.method === "POST") {
    const body = await jsonBody<{
      blockIndex?: number;
      nodeId?: string;
      revision: string;
      slideIndex: number;
    }>(request);
    if (
      typeof body.revision !== "string" ||
      !Number.isInteger(body.slideIndex) ||
      body.slideIndex < 0
    ) {
      return sendJson(outgoing, { code: "invalid_request", message: "A valid revision and slideIndex are required." }, 400);
    }
    await input.project.writeCurrent(body);
    return sendJson(outgoing, { ok: true });
  }

  if (url.pathname === "/api/v1/templates" && request.method === "GET") {
    const locale = url.searchParams.get("locale") === "zh-TW" ? "zh-TW" : "en";
    return sendJson(outgoing, await input.project.templateCatalog(locale));
  }

  const templateCoverMatch = url.pathname.match(/^\/api\/v1\/templates\/([a-z0-9]+(?:-[a-z0-9]+)*)\/cover\.svg$/);
  if (templateCoverMatch && request.method === "GET") {
    const locale = url.searchParams.get("locale") === "zh-TW" ? "zh-TW" : "en";
    const version = url.searchParams.get("version");
    if (!version) return sendJson(outgoing, { code: "invalid_request", message: "Template version is required." }, 400);
    const svg = input.project.templatePreview({ id: templateCoverMatch[1], locale, version });
    outgoing.writeHead(200, {
      "cache-control": "public, max-age=31536000, immutable",
      "content-security-policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      "content-type": "image/svg+xml; charset=utf-8",
      "x-content-type-options": "nosniff"
    });
    outgoing.end(svg);
    return;
  }

  if (url.pathname === "/api/v1/templates/select" && request.method === "POST") {
    return sendJson(outgoing, { template: await input.project.selectTemplate(await jsonBody<unknown>(request)) });
  }

  if (url.pathname === "/api/v1/ai/status" && request.method === "GET") {
    return sendJson(outgoing, { providers: await aiBridge.status() });
  }

  if (url.pathname === "/api/v1/ai/warm" && request.method === "POST") {
    return sendJson(outgoing, await aiBridge.warm());
  }

  if (url.pathname === "/api/v1/ai/conversations" && request.method === "GET") {
    return sendJson(outgoing, await aiConversations.list());
  }

  if (url.pathname === "/api/v1/ai/conversations" && request.method === "POST") {
    const body = await jsonBody<{ provider?: unknown; title?: unknown }>(request);
    if (body.provider !== "codex" && body.provider !== "claude") {
      return sendJson(outgoing, { code: "invalid_request", message: "A valid provider is required." }, 400);
    }
    return sendJson(outgoing, await aiConversations.create(
      body.provider,
      typeof body.title === "string" ? body.title : undefined
    ));
  }

  const conversationMatch = url.pathname.match(/^\/api\/v1\/ai\/conversations\/([0-9a-f-]{36})(?:\/messages)?$/i);
  if (conversationMatch) {
    const threadId = conversationMatch[1] ?? "";
    if (request.method === "DELETE" && !url.pathname.endsWith("/messages")) {
      return sendJson(outgoing, { deleted: await aiConversations.delete(threadId) });
    }
    if (request.method === "POST" && url.pathname.endsWith("/messages")) {
      const body = await jsonBody<{ activities?: unknown; content?: unknown; role?: unknown }>(request);
      if ((body.role !== "user" && body.role !== "assistant") || typeof body.content !== "string") {
        return sendJson(outgoing, { code: "invalid_request", message: "A visible message role and content are required." }, 400);
      }
      return sendJson(outgoing, await aiConversations.append(threadId, {
        ...(Array.isArray(body.activities) ? { activities: body.activities as never[] } : {}),
        content: body.content,
        role: body.role
      }));
    }
  }

  if (url.pathname === "/api/v1/ai/chat" && request.method === "POST") {
    const body = await jsonBody<{
      aiMode?: unknown;
      blockIndex?: unknown;
      expectedRevision?: unknown;
      messages?: unknown;
      nodeId?: unknown;
      prompt?: unknown;
      provider?: unknown;
      slideIndex?: unknown;
    }>(request);
    if (
      typeof body.expectedRevision !== "string" ||
      typeof body.prompt !== "string" ||
      !openSlideXAiProviders.includes(body.provider as (typeof openSlideXAiProviders)[number]) ||
      !Number.isInteger(body.slideIndex) ||
      Number(body.slideIndex) < 0
    ) {
      return sendJson(outgoing, { code: "invalid_request", message: "provider, prompt, slideIndex, and expectedRevision are required." }, 400);
    }
    const messages = Array.isArray(body.messages)
      ? body.messages.filter(isAiMessage).slice(-8)
      : undefined;
    return sendJson(outgoing, await aiBridge.run({
      ...(typeof body.blockIndex === "number" ? { blockIndex: body.blockIndex } : {}),
      expectedRevision: body.expectedRevision,
      ...(messages ? { messages } : {}),
      ...(typeof body.nodeId === "string" ? { nodeId: body.nodeId } : {}),
      prompt: body.prompt,
      provider: body.provider as (typeof openSlideXAiProviders)[number],
      slideIndex: Number(body.slideIndex)
    }));
  }

  if (url.pathname === "/api/v1/ai/chat/stream" && request.method === "POST") {
    const body = await jsonBody<{
      aiMode?: unknown;
      blockIndex?: unknown;
      expectedRevision?: unknown;
      messages?: unknown;
      nodeId?: unknown;
      prompt?: unknown;
      provider?: unknown;
      slideIndex?: unknown;
    }>(request);
    if (
      body.provider !== "codex" ||
      (body.aiMode !== undefined && !openSlideXAiModes.includes(body.aiMode as (typeof openSlideXAiModes)[number])) ||
      typeof body.expectedRevision !== "string" ||
      typeof body.prompt !== "string" ||
      !Number.isInteger(body.slideIndex) ||
      Number(body.slideIndex) < 0
    ) {
      return sendJson(outgoing, { code: "invalid_request", message: "Codex, prompt, slideIndex, and expectedRevision are required." }, 400);
    }
    const messages = Array.isArray(body.messages)
      ? body.messages.filter(isAiMessage).slice(-8)
      : undefined;
    const controller = new AbortController();
    const abort = () => controller.abort();
    outgoing.once("close", abort);
    outgoing.once("error", abort);
    outgoing.writeHead(200, {
      "cache-control": "no-cache, no-store",
      "connection": "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
      "x-content-type-options": "nosniff"
    });
    const stopHeartbeat = startSseHeartbeat(incoming, outgoing);
    outgoing.write(": open-slidex-ai\n\n");
    try {
      for await (const event of aiBridge.stream({
        ...(body.aiMode ? { aiMode: body.aiMode as (typeof openSlideXAiModes)[number] } : {}),
        ...(typeof body.blockIndex === "number" ? { blockIndex: body.blockIndex } : {}),
        expectedRevision: body.expectedRevision,
        ...(messages ? { messages } : {}),
        ...(typeof body.nodeId === "string" ? { nodeId: body.nodeId } : {}),
        prompt: body.prompt,
        provider: "codex",
        slideIndex: Number(body.slideIndex)
      }, controller.signal)) {
        if (outgoing.destroyed) break;
        outgoing.write(encodeAiSseEvent(event));
      }
    } catch (error) {
      if (!outgoing.destroyed) outgoing.write(encodeAiSseEvent(aiStreamError(error)));
    } finally {
      stopHeartbeat();
      outgoing.off("close", abort);
      outgoing.off("error", abort);
      if (!outgoing.destroyed) outgoing.end();
    }
    return;
  }

  if (url.pathname === "/api/v1/ai/apply" && request.method === "POST") {
    const body = await jsonBody<{ draftId?: unknown; expectedRevision?: unknown }>(request);
    if (typeof body.draftId !== "string" || typeof body.expectedRevision !== "string") {
      return sendJson(outgoing, { code: "invalid_request", message: "draftId and expectedRevision are required." }, 400);
    }
    return sendJson(outgoing, await aiBridge.apply(body.draftId, body.expectedRevision));
  }

  if (url.pathname === "/api/v1/ai/cancel" && request.method === "POST") {
    const body = await jsonBody<{ sessionId?: unknown }>(request);
    if (typeof body.sessionId !== "string") {
      return sendJson(outgoing, { code: "invalid_request", message: "sessionId is required." }, 400);
    }
    return sendJson(outgoing, { cancelled: aiBridge.cancel(body.sessionId) });
  }

  if (url.pathname === "/api/v1/ai/draft-image" && request.method === "GET") {
    const draftId = url.searchParams.get("id");
    if (!draftId || !/^[0-9a-f-]{36}$/i.test(draftId)) {
      return sendJson(outgoing, { code: "invalid_request", message: "A valid draft id is required." }, 400);
    }
    const bytes = await readFile(path.join(input.project.distRoot, `agent-draft-${draftId}.png`));
    outgoing.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "image/png",
      "x-content-type-options": "nosniff"
    });
    outgoing.end(bytes);
    return;
  }

  if (url.pathname === "/api/v1/ai/tool-preview" && request.method === "GET") {
    const runId = url.searchParams.get("runId");
    const toolCallId = url.searchParams.get("toolCallId");
    if (
      !runId ||
      !/^[0-9a-f-]{36}$/i.test(runId) ||
      !toolCallId ||
      !/^[A-Za-z0-9._:-]{1,160}$/.test(toolCallId)
    ) {
      return sendJson(outgoing, { code: "invalid_request", message: "A valid runId and toolCallId are required." }, 400);
    }
    const bytes = await aiBridge.readToolPreview(runId, toolCallId);
    outgoing.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "image/png",
      "x-content-type-options": "nosniff"
    });
    outgoing.end(bytes);
    return;
  }

  if (url.pathname === "/api/v1/mcp/setup" && request.method === "GET") {
    const client = parseWorkbenchMcpClient(url.searchParams.get("client"));
    const platform = parseWorkbenchMcpPlatform(url.searchParams.get("platform"));
    return sendJson(outgoing, {
      client,
      config: workbenchMcpConfig(client, input.project.root, platform),
      configPath: client === "claude-desktop"
        ? platform === "windows"
          ? "%APPDATA%\\Claude\\claude_desktop_config.json"
          : "~/Library/Application Support/Claude/claude_desktop_config.json"
        : client === "codex"
          ? ".codex/config.toml"
          : ".mcp.json / claude mcp add",
      platform,
      prompt: workbenchMcpPrompt(client, input.project.root, platform),
      projectRoot: input.project.root
    });
  }

  if (url.pathname === "/api/v1/assets") {
    if (request.method === "GET") return sendJson(outgoing, { assets: await input.project.listAssets() });
    if (request.method === "POST") {
      const form = await request.formData();
      const file = form.get("file");
      const expectedRevision = form.get("expectedRevision");
      if (!(file instanceof File) || typeof expectedRevision !== "string") {
        return sendJson(outgoing, { code: "missing_file", message: "Choose one image file and provide expectedRevision." }, 400);
      }
      return sendJson(outgoing, { asset: await input.project.importAsset(file, expectedRevision) });
    }
    if (request.method === "PATCH") {
      const body = await jsonBody<{ expectedRevision: string; from: string; to: string }>(request);
      if (
        typeof body.expectedRevision !== "string" ||
        typeof body.from !== "string" ||
        typeof body.to !== "string"
      ) {
        return sendJson(outgoing, { code: "invalid_request", message: "from, to, and expectedRevision are required." }, 400);
      }
      return sendJson(outgoing, {
        document: await input.project.renameAsset(body)
      });
    }
    if (request.method === "DELETE") {
      const source = url.searchParams.get("source");
      const expectedRevision = url.searchParams.get("expectedRevision");
      if (!source || !expectedRevision) return sendJson(outgoing, { code: "invalid_request", message: "source and expectedRevision are required." }, 400);
      await input.project.deleteAsset(source, expectedRevision);
      return sendJson(outgoing, { ok: true });
    }
  }

  if (url.pathname === "/api/v1/export" && request.method === "POST") {
    const body = await jsonBody<{
      fileName: string;
      format: "html" | "mdx" | "pptx";
      overwrite?: boolean;
      source: string;
      target: "download" | "dist";
    }>(request);
    if (
      typeof body.source !== "string" ||
      !["html", "mdx", "pptx"].includes(body.format) ||
      !["download", "dist"].includes(body.target)
    ) {
      return sendJson(outgoing, { code: "invalid_request", message: "Choose a valid format and target." }, 400);
    }
    const result = await input.project.export({
      fileName: body.fileName,
      format: body.format,
      overwrite: body.overwrite === true,
      source: body.source,
      target: body.target
    });
    if ("bytes" in result) {
      outgoing.writeHead(200, {
        "content-disposition": `attachment; filename="${result.output}"`,
        "content-type": mimeType(result.output),
        "x-content-type-options": "nosniff"
      });
      outgoing.end(result.bytes);
      return;
    }
    return sendJson(outgoing, result);
  }

  if (url.pathname === "/api/v1/render" && request.method === "POST") {
    const body = await jsonBody<{ overwrite?: boolean }>(request);
    return sendJson(outgoing, {
      output: await input.project.renderMontage(body.overwrite === true)
    });
  }

  if (request.method === "GET" && url.pathname.startsWith("/assets/")) {
    const name = decodeURIComponent(url.pathname.slice("/assets/".length));
    const bytes = await input.project.readAsset(name);
    outgoing.writeHead(200, {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": "image/webp",
      "x-content-type-options": "nosniff"
    });
    outgoing.end(bytes);
    return;
  }

  if (request.method === "GET") {
    const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const filePath = path.resolve(input.clientRoot, requested);
    if (!filePath.startsWith(`${path.resolve(input.clientRoot)}${path.sep}`) && filePath !== path.join(input.clientRoot, "index.html")) {
      return sendJson(outgoing, { code: "not_found", message: "Not found." }, 404);
    }
    const fileStats = await stat(filePath).catch(() => null);
    if (fileStats?.isFile()) {
      outgoing.writeHead(200, {
        "cache-control": requested === "index.html" ? "no-cache" : "public, max-age=31536000, immutable",
        "content-security-policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-slidex-workbench-preview'; frame-src 'self' blob:; connect-src 'self'; font-src 'self' data:",
        "content-type": mimeType(filePath),
        "x-content-type-options": "nosniff"
      });
      createReadStream(filePath).pipe(outgoing);
      return;
    }
  }

  return sendJson(outgoing, { code: "not_found", message: "Not found." }, 404);
}

async function webRequest(incoming: IncomingMessage, port: number) {
  const method = incoming.method ?? "GET";
  return new Request(`http://127.0.0.1:${port}${incoming.url ?? "/"}`, {
    body: method === "GET" || method === "HEAD"
      ? undefined
      : Readable.toWeb(incoming) as ReadableStream,
    duplex: "half",
    headers: incoming.headers as HeadersInit,
    method
  } as RequestInit);
}

function assertLocalRequest(request: Request, port: number) {
  const host = request.headers.get("host");
  if (host && host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
    throw Object.assign(new Error("Invalid Host header."), { status: 403 });
  }
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) {
      throw Object.assign(new Error("Cross-origin mutation rejected."), { status: 403 });
    }
  }
}

function isAiMessage(value: unknown): value is { content: string; role: "assistant" | "user" } {
  if (!value || typeof value !== "object") return false;
  const message = value as { content?: unknown; role?: unknown };
  return typeof message.content === "string" && (message.role === "assistant" || message.role === "user");
}

async function jsonBody<T>(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 10 * 1024 * 1024) {
    throw Object.assign(new Error("Request body is too large."), { status: 413 });
  }
  return (await request.json().catch(() => ({}))) as T;
}

function sendJson(response: ServerResponse, value: unknown, status = 200) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(value));
}

export function encodeAiSseEvent(event: AiRunEvent) {
  return `event: ai\ndata: ${JSON.stringify(event)}\n\n`;
}

function startSseHeartbeat(incoming: IncomingMessage, outgoing: ServerResponse) {
  const heartbeatMs = 5_000;
  incoming.socket.setKeepAlive(true, heartbeatMs);
  incoming.socket.setNoDelay(true);
  outgoing.flushHeaders();
  const heartbeat = setInterval(() => {
    if (!outgoing.destroyed && !outgoing.writableEnded) outgoing.write(": keep-alive\n\n");
  }, heartbeatMs);
  heartbeat.unref();
  return () => clearInterval(heartbeat);
}

function aiStreamError(error: unknown): AiRunEvent {
  if (error instanceof SlideXRevisionConflictError) {
    return {
      code: "revision_conflict",
      message: "presentation.mdx changed. Reload the Canvas, then retry.",
      runId: "unavailable",
      type: "run.failed"
    };
  }
  return {
    code: "stream_error",
    message: error instanceof Error ? error.message : "The local AI stream failed.",
    runId: "unavailable",
    type: "run.failed"
  };
}

function sendError(response: ServerResponse, error: unknown) {
  if (response.headersSent) {
    response.end();
    return;
  }
  if (error instanceof SlideXRevisionConflictError) {
    sendJson(response, {
      code: "revision_conflict",
      currentRevision: error.currentRevision,
      message: "presentation.mdx changed outside the workbench."
    }, 409);
    return;
  }
  if (error instanceof SlideXImageAssetError) {
    sendJson(response, { code: error.code, message: error.message }, 422);
    return;
  }
  if (error instanceof OpenSlideXLocalMediaError) {
    sendJson(response, {
      code: "local_media_not_allowed",
      issues: error.issues,
      message: error.message
    }, 422);
    return;
  }
  const message = error instanceof Error ? error.message : "Unexpected workbench error.";
  const status = typeof (error as { status?: unknown })?.status === "number"
    ? (error as { status: number }).status
    : /already exists/i.test(message)
      ? 409
      : /referenced|invalid|must|required/i.test(message)
        ? 422
        : 500;
  sendJson(response, {
    code: status === 409 ? "file_exists" : status === 422 ? "invalid_request" : "internal_error",
    message
  }, status);
}

function mimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mdx": "text/mdx; charset=utf-8",
    ".png": "image/png",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
  } as Record<string, string>)[extension] ?? "application/octet-stream";
}
