import { summarizeMotionDoc } from "@open-slidex/sdk";

import { jsonBody, sendJson, type WorkbenchRouteContext } from "./httpRoute";

export async function documentRoutes(context: WorkbenchRouteContext) {
  const { outgoing, presenterRemote, project, request, url } = context;

  if (url.pathname === "/api/v1/presenter/sessions" && request.method === "POST") {
    const body = await jsonBody<{ currentSlideIndex?: unknown; slideCount?: unknown; locale?: unknown }>(request);
    if (!Number.isInteger(body.currentSlideIndex) || !Number.isInteger(body.slideCount)) {
      return sendJson(outgoing, { code: "invalid_request", message: "currentSlideIndex and slideCount are required." }, 400);
    }
    return sendJson(outgoing, await presenterRemote.create({
      currentSlideIndex: Number(body.currentSlideIndex),
      locale: body.locale === "en" ? "en" : "zh-TW",
      slideCount: Number(body.slideCount)
    }), 201);
  }

  const presenterSession = url.pathname.match(/^\/api\/v1\/presenter\/sessions\/([A-Za-z0-9_-]+)$/);
  const presenterSessionEvents = url.pathname.match(/^\/api\/v1\/presenter\/sessions\/([A-Za-z0-9_-]+)\/events$/);
  if (presenterSessionEvents?.[1] && request.method === "GET") {
    presenterRemote.read(presenterSessionEvents[1]);
    outgoing.writeHead(200, {
      "cache-control": "no-store",
      connection: "keep-alive",
      "content-type": "text/event-stream",
      "x-content-type-options": "nosniff"
    });
    outgoing.flushHeaders();
    const unsubscribe = presenterRemote.subscribe(presenterSessionEvents[1], (state) => {
      outgoing.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);
    });
    const heartbeat = setInterval(() => {
      try { presenterRemote.read(presenterSessionEvents[1]); outgoing.write(": heartbeat\n\n"); }
      catch { outgoing.end(); }
    }, 15000);
    outgoing.once("close", () => { clearInterval(heartbeat); unsubscribe(); });
    return true;
  }
  if (presenterSession?.[1]) {
    if (request.method === "GET") return sendJson(outgoing, presenterRemote.read(presenterSession[1]));
    if (request.method === "PATCH") {
      const body = await jsonBody<{ currentSlideIndex?: unknown; slideCount?: unknown; timer?: unknown; clientId?: string; sequence?: number }>(request);
      if ((body.currentSlideIndex !== undefined && !Number.isInteger(body.currentSlideIndex)) || (body.slideCount !== undefined && !Number.isInteger(body.slideCount))) {
        return sendJson(outgoing, { code: "invalid_request", message: "currentSlideIndex and slideCount are required." }, 400);
      }
      return sendJson(outgoing, presenterRemote.update(presenterSession[1], {
        currentSlideIndex: body.currentSlideIndex === undefined ? undefined : Number(body.currentSlideIndex),
        slideCount: body.slideCount === undefined ? undefined : Number(body.slideCount),
        clientId: body.clientId,
        sequence: body.sequence,
        timer: body.timer
      }));
    }
    if (request.method === "DELETE") {
      presenterRemote.closeSession(presenterSession[1]);
      outgoing.writeHead(204, { "cache-control": "no-store", "x-content-type-options": "nosniff" });
      outgoing.end();
      return true;
    }
  }

  if (url.pathname === "/api/v1/document") {
    if (request.method === "GET") return sendJson(outgoing, await project.open());
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
      return sendJson(outgoing, await project.save({
        expectedRevision: body.expectedRevision,
        source: body.source,
        title: body.title
      }));
    }
  }

  if (url.pathname === "/api/v1/document/migrate" && request.method === "POST") {
    const body = await jsonBody<{ expectedRevision?: unknown }>(request);
    if (typeof body.expectedRevision !== "string") {
      return sendJson(outgoing, { code: "invalid_request", message: "expectedRevision is required." }, 400);
    }
    return sendJson(outgoing, await project.migrateLegacyMdx(body.expectedRevision, { renderedComparison: true }));
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
    await project.writeCurrent(body);
    return sendJson(outgoing, { ok: true });
  }

  if (url.pathname === "/api/v1/templates" && request.method === "GET") {
    const locale = url.searchParams.get("locale") === "zh-TW" ? "zh-TW" : "en";
    return sendJson(outgoing, await project.templateCatalog(locale));
  }

  const templateCoverMatch = url.pathname.match(/^\/api\/v1\/templates\/([a-z0-9]+(?:-[a-z0-9]+)*)\/cover\.svg$/);
  if (templateCoverMatch && request.method === "GET") {
    const locale = url.searchParams.get("locale") === "zh-TW" ? "zh-TW" : "en";
    const version = url.searchParams.get("version");
    if (!version) return sendJson(outgoing, { code: "invalid_request", message: "Template version is required." }, 400);
    const svg = await project.templatePreview({ id: templateCoverMatch[1], locale, version });
    outgoing.writeHead(200, {
      "cache-control": "public, max-age=31536000, immutable",
      "content-security-policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      "content-type": "image/svg+xml; charset=utf-8",
      "x-content-type-options": "nosniff"
    });
    outgoing.end(svg);
    return true;
  }

  if (url.pathname === "/api/v1/templates/select" && request.method === "POST") {
    return sendJson(outgoing, { template: await project.selectTemplate(await jsonBody<unknown>(request)) });
  }

  return false;
}
