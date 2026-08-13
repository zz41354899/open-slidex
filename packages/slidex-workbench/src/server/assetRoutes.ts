import { jsonBody, sendJson, type WorkbenchRouteContext } from "./httpRoute";

export async function assetRoutes(context: WorkbenchRouteContext) {
  const { outgoing, project, request, url } = context;

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

  if (request.method === "GET" && url.pathname.startsWith("/assets/")) {
    const name = decodeURIComponent(url.pathname.slice("/assets/".length));
    const bytes = await project.readAsset(name);
    outgoing.writeHead(200, {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": project.assetMimeType(name),
      "x-content-type-options": "nosniff"
    });
    outgoing.end(bytes);
    return true;
  }

  return false;
}
