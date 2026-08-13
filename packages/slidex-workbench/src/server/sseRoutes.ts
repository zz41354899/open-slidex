import type { IncomingMessage, ServerResponse } from "node:http";

import type { WorkbenchRouteContext } from "./httpRoute";

export async function sseRoutes(context: WorkbenchRouteContext) {
  const { eventClients, incoming, outgoing, request, url } = context;
  if (request.method !== "GET" || url.pathname !== "/api/v1/events") return false;

  outgoing.writeHead(200, {
    "cache-control": "no-cache",
    "connection": "keep-alive",
    "content-type": "text/event-stream",
    "x-content-type-options": "nosniff"
  });
  const stopHeartbeat = startSseHeartbeat(incoming, outgoing);
  outgoing.write("event: connected\ndata: {}\n\n");
  eventClients.add(outgoing);
  outgoing.once("close", () => {
    stopHeartbeat();
    eventClients.delete(outgoing);
  });
  return true;
}

export function startSseHeartbeat(incoming: IncomingMessage, outgoing: ServerResponse) {
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
