import type { IncomingMessage, ServerResponse } from "node:http";

import type { SlideXProject } from "./project";

export type WorkbenchRouteContext = {
  eventClients: Set<ServerResponse>;
  incoming: IncomingMessage;
  outgoing: ServerResponse;
  project: SlideXProject;
  request: Request;
  url: URL;
};

export async function jsonBody<T>(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 10 * 1024 * 1024) {
    throw Object.assign(new Error("Request body is too large."), { status: 413 });
  }
  return (await request.json().catch(() => ({}))) as T;
}

export function sendJson(response: ServerResponse, value: unknown, status = 200) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(value));
  return true;
}
