import { createReadStream, watch } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import path from "node:path";
import { Readable } from "node:stream";

import {
  SlideXImageAssetError,
  SlideXRevisionConflictError
} from "@open-slidex/sdk/node";

import { assetRoutes } from "./assetRoutes";
import { documentRoutes } from "./documentRoutes";
import { exportRoutes } from "./exportRoutes";
import { sendJson, type WorkbenchRouteContext } from "./httpRoute";
import { OpenSlideXLocalMediaError, SlideXProject } from "./project";
import { sseRoutes } from "./sseRoutes";

type StartServerInput = {
  clientRoot: string;
  port: number;
  project: SlideXProject;
};

export type WorkbenchRouter = {
  close(): void;
  route(input: {
    incoming: import("node:http").IncomingMessage;
    outgoing: ServerResponse;
    request: Request;
    url: URL;
  }): Promise<boolean>;
};

export async function startWorkbenchServer(input: StartServerInput) {
  let listeningPort = input.port;
  const router = createWorkbenchRouter(input.project);
  const server = createServer((request, response) => {
    void routeRequest(request, response, { ...input, port: listeningPort }, router)
      .catch((error) => sendWorkbenchError(response, error));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(input.port, "127.0.0.1", resolve);
  });
  listeningPort = (server.address() as { port: number }).port;

  return {
    close: async () => {
      router.close();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve())
      );
    },
    port: listeningPort
  };
}

export function createWorkbenchRouter(project: SlideXProject): WorkbenchRouter {
  const eventClients = new Set<ServerResponse>();
  const notify = (event: "assets.changed" | "document.changed") => {
    for (const client of eventClients) client.write(`event: ${event}\ndata: {}\n\n`);
  };
  const documentWatcher = watch(
    path.join(project.root, "presentation.mdx"),
    { persistent: false },
    () => notify("document.changed")
  );
  const assetWatcher = watch(
    project.assetsRoot,
    { persistent: false },
    () => notify("assets.changed")
  );

  return {
    close() {
      documentWatcher.close();
      assetWatcher.close();
      for (const client of eventClients) client.end();
      eventClients.clear();
    },
    async route({ incoming, outgoing, request, url }) {
      const context: WorkbenchRouteContext = {
        eventClients,
        incoming,
        outgoing,
        project,
        request,
        url
      };

      if (await sseRoutes(context)) return true;
      if (await documentRoutes(context)) return true;
      if (await assetRoutes(context)) return true;
      if (await exportRoutes(context)) return true;
      return false;
    }
  };
}

async function routeRequest(
  incoming: Parameters<typeof webRequest>[0],
  outgoing: ServerResponse,
  input: StartServerInput,
  router: WorkbenchRouter
) {
  const request = await webRequest(incoming, input.port);
  const url = new URL(request.url);
  assertLocalRequest(request, input.port);
  if (await router.route({ incoming, outgoing, request, url })) return;

  if (request.method === "GET") {
    const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const filePath = path.resolve(input.clientRoot, requested);
    if (!filePath.startsWith(`${path.resolve(input.clientRoot)}${path.sep}`) && filePath !== path.join(input.clientRoot, "index.html")) {
      sendJson(outgoing, { code: "not_found", message: "Not found." }, 404);
      return;
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

  sendJson(outgoing, { code: "not_found", message: "Not found." }, 404);
}

async function webRequest(incoming: import("node:http").IncomingMessage, port: number) {
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

export function sendWorkbenchError(response: ServerResponse, error: unknown) {
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
