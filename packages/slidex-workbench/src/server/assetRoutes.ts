import { jsonBody, sendJson, type WorkbenchRouteContext } from "./httpRoute";
import { streamAsset } from "./streamAsset";
import { createHash } from "node:crypto";
import {
  HTML_PLAYBACK_CONTENT_SECURITY_POLICY
} from "./htmlImportPolicy";

export async function assetRoutes(context: WorkbenchRouteContext) {
  const { outgoing, project, request, url } = context;

  if (url.pathname === "/api/v1/assets/html" && request.method === "PUT") {
    const source = url.searchParams.get("source");
    const expectedRevision = url.searchParams.get("expectedRevision");
    const length = Number(request.headers.get("content-length") ?? 0);
    if (!source || !expectedRevision) {
      return sendJson(outgoing, { code: "invalid_request", message: "source and expectedRevision are required." }, 400);
    }
    if (length > 50 * 1024 * 1024) {
      return sendJson(outgoing, { code: "asset_too_large", message: "The HTML source must not exceed 50 MB." }, 413);
    }
    return sendJson(outgoing, await project.replaceHtmlAsset({ expectedRevision, html: await request.text(), source }));
  }

  if (url.pathname === "/api/v1/assets/html-thumbnail" && request.method === "GET") {
    const source = url.searchParams.get("source");
    const page = Number(url.searchParams.get("page"));
    if (!source || !Number.isInteger(page)) {
      return sendJson(outgoing, { code: "invalid_request", message: "source and a valid page are required." }, 400);
    }
    const bytes = await project.renderHtmlThumbnail(source, page);
    const etag = `"${createHash("sha256").update(bytes).digest("hex")}"`;
    if (request.headers.get("if-none-match") === etag) {
      outgoing.writeHead(304, { etag, "cache-control": "private, max-age=0, must-revalidate" }); outgoing.end(); return true;
    }
    outgoing.writeHead(200, {
      "cache-control": "private, max-age=0, must-revalidate",
      etag,
      "content-type": "image/png",
      "x-content-type-options": "nosniff"
    });
    outgoing.end(bytes);
    return true;
  }

  if (url.pathname === "/api/v1/assets") {
    if (request.method === "GET") return sendJson(outgoing, { assets: await project.listAssets() });
    if (request.method === "POST") {
      const length = Number(request.headers.get("content-length") ?? 0);
      if (length > 80 * 1024 * 1024) {
        return sendJson(outgoing, { code: "asset_too_large", message: "MP4 videos must not exceed 80 MB." }, 413);
      }
      const form = await request.formData();
      const file = form.get("file");
      const expectedRevision = form.get("expectedRevision");
      if (!(file instanceof File) || typeof expectedRevision !== "string") {
        return sendJson(outgoing, { code: "missing_file", message: "Choose one image or MP4 file and provide expectedRevision." }, 400);
      }
      return sendJson(outgoing, { asset: await project.importAsset(file, expectedRevision) });
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
      return sendJson(outgoing, { document: await project.renameAsset(body) });
    }
    if (request.method === "DELETE") {
      const source = url.searchParams.get("source");
      const expectedRevision = url.searchParams.get("expectedRevision");
      if (!source || !expectedRevision) {
        return sendJson(outgoing, { code: "invalid_request", message: "source and expectedRevision are required." }, 400);
      }
      await project.deleteAsset(source, expectedRevision);
      return sendJson(outgoing, { ok: true });
    }
  }

  if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/assets/")) {
    const name = decodeURIComponent(url.pathname.slice("/assets/".length));
    const mimeType = project.assetMimeType(name);
    if (!mimeType.startsWith("text/html")) {
      await streamAsset(await project.openAsset(name), mimeType, request, outgoing);
      return true;
    }
    const storedBytes = await project.readAsset(name);
    const bytes = storedBytes;
    outgoing.writeHead(200, {
      "cache-control": mimeType.startsWith("text/html") ? "no-store" : "public, max-age=31536000, immutable",
      ...(mimeType.startsWith("text/html") ? {
        "content-disposition": `attachment; filename="${name}"`,
        "content-security-policy": HTML_PLAYBACK_CONTENT_SECURITY_POLICY
      } : mimeType === "image/svg+xml" ? {
        "content-security-policy": "default-src 'none'; object-src 'none'; script-src 'none'; style-src 'unsafe-inline'"
      } : {}),
      "content-type": mimeType,
      "x-content-type-options": "nosniff"
    });
    outgoing.end(bytes);
    return true;
  }

  return false;
}
