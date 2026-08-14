import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { Readable } from "node:stream";

import type { TemplatePackageLocale } from "@open-slidex/sdk";

import {
  createWorkbenchRouter,
  sendWorkbenchError,
  type WorkbenchRouter
} from "./http";
import {
  OpenSlideXWorkspace,
  type CreateWorkspacePresentationInput,
  type DeleteWorkspacePresentationInput,
  type RenameWorkspacePresentationInput
} from "./workspace";
import {
  parseWorkspaceMcpClient,
  parseWorkspaceMcpPlatform,
  presentationMcpConfig,
  presentationMcpPrompt,
  workspaceMcpConfig,
  workspaceMcpPrompt
} from "./mcpConfig";
import { MAX_WORKSPACE_IMPORT_FILE_BYTES } from "./workspaceImport";

type StartWorkspaceServerInput = {
  port: number;
  uiPort: number;
  workspace: OpenSlideXWorkspace;
};

export async function startWorkspaceServer(input: StartWorkspaceServerInput) {
  let listeningPort = input.port;
  const editorRouters = new Map<string, WorkbenchRouter>();
  const server = createServer((request, response) => {
    void routeWorkspaceRequest(request, response, { ...input, port: listeningPort }, editorRouters)
      .catch((error) => sendError(response, error));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(input.port, "127.0.0.1", resolve);
  });
  listeningPort = (server.address() as { port: number }).port;
  return {
    close: async () => {
      for (const router of editorRouters.values()) router.close();
      editorRouters.clear();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
    port: listeningPort
  };
}

async function routeWorkspaceRequest(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  input: StartWorkspaceServerInput,
  editorRouters: Map<string, WorkbenchRouter>
) {
  const incomingUrl = new URL(incoming.url ?? "/", `http://127.0.0.1:${input.port}`);
  const editorMatch = incomingUrl.pathname.match(/^\/api\/v1\/workspace\/presentations\/([A-Za-z0-9._-]+)\/editor(\/.*)$/);
  const request = await webRequest(incoming, input.port, editorMatch?.[2] ? `${editorMatch[2]}${incomingUrl.search}` : undefined);
  const url = new URL(request.url);
  assertLocalRequest(request, input.port, input.uiPort);

  if (editorMatch?.[1]) {
    try {
      const router = await editorRouter(editorMatch[1], input.workspace, editorRouters);
      if (await router.route({ incoming, outgoing, request, url })) return;
      sendJson(outgoing, { code: "not_found", message: "Not found." }, 404);
    } catch (error) {
      sendWorkbenchError(outgoing, error);
    }
    return;
  }

  if (url.pathname === "/api/v1/workspace" && request.method === "GET") {
    sendJson(outgoing, await input.workspace.snapshot(parseLocale(url.searchParams.get("locale"))));
    return;
  }

  if (url.pathname === "/api/v1/workspace/mcp/setup" && request.method === "GET") {
    const client = parseWorkspaceMcpClient(url.searchParams.get("client"));
    const platform = parseWorkspaceMcpPlatform(url.searchParams.get("platform"));
    const presentationRoot = input.workspace.mcpPresentationRoot;
    const root = presentationRoot ?? input.workspace.root;
    const configPath = client === "codex"
      ? platform === "windows" ? "%USERPROFILE%\\.codex\\config.toml" : "~/.codex/config.toml"
      : client === "claude-desktop"
        ? platform === "windows"
          ? "%APPDATA%\\Claude\\claude_desktop_config.json"
          : "~/Library/Application Support/Claude/claude_desktop_config.json"
        : "Claude Code user scope";
    sendJson(outgoing, {
      client,
      config: presentationRoot
        ? presentationMcpConfig(client, root, platform)
        : workspaceMcpConfig(client, root, platform),
      configPath,
      platform,
      presentationPath: presentationRoot ? path.join(presentationRoot, "presentation.mdx") : undefined,
      prompt: presentationRoot
        ? presentationMcpPrompt(client, root, platform)
        : workspaceMcpPrompt(client, root, platform),
      scope: "user",
      scopeRoot: root,
      scopeType: presentationRoot ? "presentation" : "workspace",
      workspaceRoot: input.workspace.root
    });
    return;
  }

  if (url.pathname === "/api/v1/workspace/presentations" && request.method === "POST") {
    const presentation = await input.workspace.create(await jsonBody<CreateWorkspacePresentationInput>(request));
    const editorUrl = await input.workspace.open(presentation.id);
    sendJson(outgoing, { editorUrl, presentation }, 201);
    return;
  }

  if (url.pathname === "/api/v1/workspace/presentations/import" && request.method === "POST") {
    const form = await multipartBody(request);
    const file = form.get("file");
    if (!isWorkspaceImportFile(file)) {
      throw Object.assign(new Error("Choose one .mdx file or .zip/.slidex OpenSlideX project bundle."), { status: 400 });
    }
    const presentation = await input.workspace.importMdx(file);
    const editorUrl = await input.workspace.open(presentation.id);
    sendJson(outgoing, { editorUrl, presentation }, 201);
    return;
  }

  const openMatch = url.pathname.match(/^\/api\/v1\/workspace\/presentations\/([A-Za-z0-9._-]+)\/open$/);
  if (openMatch?.[1] && request.method === "POST") {
    sendJson(outgoing, { editorUrl: await input.workspace.open(openMatch[1]) });
    return;
  }

  const presentationMatch = url.pathname.match(/^\/api\/v1\/workspace\/presentations\/([A-Za-z0-9._-]+)$/);
  if (presentationMatch?.[1] && request.method === "PATCH") {
    sendJson(outgoing, {
      presentation: await input.workspace.renamePresentation(
        presentationMatch[1],
        await jsonBody<RenameWorkspacePresentationInput>(request)
      )
    });
    return;
  }
  if (presentationMatch?.[1] && request.method === "DELETE") {
    const result = await input.workspace.deletePresentation(
      presentationMatch[1],
      await jsonBody<DeleteWorkspacePresentationInput>(request)
    );
    editorRouters.get(presentationMatch[1])?.close();
    editorRouters.delete(presentationMatch[1]);
    sendJson(outgoing, result);
    return;
  }

  const presentationCoverMatch = url.pathname.match(/^\/api\/v1\/workspace\/presentations\/([A-Za-z0-9._-]+)\/cover\.svg$/);
  if (presentationCoverMatch?.[1] && request.method === "GET") {
    sendSvg(outgoing, await input.workspace.presentationCover(presentationCoverMatch[1]), "no-store");
    return;
  }

  const templateCoverMatch = url.pathname.match(/^\/api\/v1\/workspace\/templates\/([a-z0-9]+(?:-[a-z0-9]+)*)\/cover\.svg$/);
  if (templateCoverMatch?.[1] && request.method === "GET") {
    const version = url.searchParams.get("version");
    if (!version) throw Object.assign(new Error("Template version is required."), { status: 400 });
    sendSvg(outgoing, input.workspace.templateCover({
      id: templateCoverMatch[1],
      locale: parseLocale(url.searchParams.get("locale")),
      slideIndex: parseSlideIndex(url.searchParams.get("slide")),
      version
    }), "no-store");
    return;
  }

  sendJson(outgoing, { code: "not_found", message: "Not found." }, 404);
}

function parseLocale(value: string | null): TemplatePackageLocale {
  return value === "zh-TW" ? "zh-TW" : "en";
}

function parseSlideIndex(value: string | null) {
  if (value === null || value === "") return 0;
  if (!/^\d+$/.test(value)) {
    throw Object.assign(new Error("Template slide must be a non-negative integer."), { status: 400 });
  }
  const slideIndex = Number(value);
  if (!Number.isSafeInteger(slideIndex)) {
    throw Object.assign(new Error("Template slide must be a non-negative integer."), { status: 400 });
  }
  return slideIndex;
}

async function editorRouter(id: string, workspace: OpenSlideXWorkspace, routers: Map<string, WorkbenchRouter>) {
  const existing = routers.get(id);
  if (existing) return existing;
  const router = createWorkbenchRouter(await workspace.project(id));
  routers.set(id, router);
  return router;
}

async function webRequest(incoming: IncomingMessage, port: number, requestPath?: string) {
  const method = incoming.method ?? "GET";
  return new Request(`http://127.0.0.1:${port}${requestPath ?? incoming.url ?? "/"}`, {
    body: method === "GET" || method === "HEAD" ? undefined : Readable.toWeb(incoming) as ReadableStream,
    duplex: "half",
    headers: incoming.headers as HeadersInit,
    method
  } as RequestInit);
}

function assertLocalRequest(request: Request, apiPort: number, uiPort: number) {
  const host = request.headers.get("host");
  const hostname = host?.replace(/^\[/, "").split(/[:\]]/, 1)[0]?.toLowerCase();
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw Object.assign(new Error("Invalid local workspace host."), { status: 403 });
  }
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  const allowed = new Set([
    `http://127.0.0.1:${apiPort}`,
    `http://localhost:${apiPort}`,
    `http://127.0.0.1:${uiPort}`,
    `http://localhost:${uiPort}`
  ]);
  if (origin && !allowed.has(origin)) throw Object.assign(new Error("Invalid local workspace origin."), { status: 403 });
}

async function jsonBody<T>(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 1024 * 1024) throw Object.assign(new Error("Request body is too large."), { status: 413 });
  return (await request.json().catch(() => ({}))) as T;
}

async function multipartBody(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  // The client accepts a 50 MB file. Reserve a small amount for multipart boundaries
  // so a file at that limit reaches the import validator instead of failing early.
  if (length > MAX_WORKSPACE_IMPORT_FILE_BYTES + 64 * 1024) {
    throw Object.assign(new Error("The OpenSlideX import upload is too large."), { status: 413 });
  }
  return request.formData().catch(() => {
    throw Object.assign(new Error("The OpenSlideX import upload could not be read."), { status: 400 });
  });
}

/** Node's multipart parser can return a File from a different runtime realm. */
function isWorkspaceImportFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value) &&
    typeof value === "object" &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).name === "string" &&
    typeof (value as File).size === "number" &&
    typeof (value as File).text === "function";
}

function sendJson(response: ServerResponse, value: unknown, status = 200) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(value));
}

function sendSvg(response: ServerResponse, value: string, cacheControl: string) {
  response.writeHead(200, {
    "cache-control": cacheControl,
    "content-security-policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
    "content-type": "image/svg+xml; charset=utf-8",
    "x-content-type-options": "nosniff"
  });
  response.end(value);
}

function sendError(response: ServerResponse, error: unknown) {
  if (response.headersSent) return response.end();
  const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 500;
  sendJson(response, {
    code: status >= 500 ? "workspace_error" : "invalid_request",
    message: error instanceof Error ? error.message : "The local workspace request failed."
  }, status);
}
