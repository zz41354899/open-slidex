import { summarizeMotionDoc } from "@open-slidex/sdk";

import { jsonBody, sendJson, type WorkbenchRouteContext } from "./httpRoute";

export async function documentRoutes(context: WorkbenchRouteContext) {
  const { outgoing, project, request, url } = context;

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
    const svg = project.templatePreview({ id: templateCoverMatch[1], locale, version });
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
