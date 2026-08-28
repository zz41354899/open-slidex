import { randomUUID } from "node:crypto";
import path from "node:path";

import { jsonBody, sendJson, type WorkbenchRouteContext } from "./httpRoute";

const browserExportTtlMs = 5 * 60 * 1_000;
const maxPreparedBrowserExports = 32;
const preparedBrowserExports = new Map<string, {
  bytes: Uint8Array;
  expiresAt: number;
  output: string;
}>();

export async function exportRoutes(context: WorkbenchRouteContext) {
  const { outgoing, project, request, url } = context;

  if (url.pathname === "/api/v1/export/download" && request.method === "GET") {
    prunePreparedBrowserExports();
    const token = url.searchParams.get("token") ?? "";
    const prepared = preparedBrowserExports.get(token);
    if (!prepared) {
      return sendJson(outgoing, { code: "export_expired", message: "This browser download has expired. Export again." }, 404);
    }
    preparedBrowserExports.delete(token);
    outgoing.writeHead(200, {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${prepared.output}"`,
      "content-length": prepared.bytes.byteLength,
      "content-type": mimeType(prepared.output),
      "x-content-type-options": "nosniff"
    });
    outgoing.end(prepared.bytes);
    return true;
  }

  if (url.pathname === "/api/v1/export" && request.method === "POST") {
    const body = await jsonBody<{
      fileName: string;
      format: "html" | "mdx" | "pptx";
      htmlMode?: "original" | "player";
      delivery?: "browser";
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
    const result = await project.export({
      fileName: body.fileName,
      format: body.format,
      htmlMode: body.htmlMode,
      overwrite: body.overwrite === true,
      source: body.source,
      target: body.target
    });
    if ("bytes" in result) {
      if (!result.bytes || result.bytes.byteLength === 0) {
        throw Object.assign(new Error("The export generated an empty file."), { status: 500 });
      }
      if (body.delivery === "browser") {
        prunePreparedBrowserExports();
        while (preparedBrowserExports.size >= maxPreparedBrowserExports) {
          const oldestToken = preparedBrowserExports.keys().next().value;
          if (!oldestToken) break;
          preparedBrowserExports.delete(oldestToken);
        }
        const token = randomUUID();
        preparedBrowserExports.set(token, {
          bytes: result.bytes,
          expiresAt: Date.now() + browserExportTtlMs,
          output: result.output
        });
        return sendJson(outgoing, {
          downloadUrl: `/api/v1/export/download?token=${encodeURIComponent(token)}`,
          output: result.output
        });
      }
      outgoing.writeHead(200, {
        "content-disposition": `attachment; filename="${result.output}"`,
        "content-type": mimeType(result.output),
        "x-content-type-options": "nosniff"
      });
      outgoing.end(result.bytes);
      return true;
    }
    return sendJson(outgoing, result);
  }

  if (url.pathname === "/api/v1/render" && request.method === "POST") {
    const body = await jsonBody<{ overwrite?: boolean }>(request);
    return sendJson(outgoing, {
      output: await project.renderMontage(body.overwrite === true)
    });
  }

  return false;
}

function mimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".mdx": "text/mdx; charset=utf-8",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  } as Record<string, string>)[extension] ?? "application/octet-stream";
}

function prunePreparedBrowserExports() {
  const now = Date.now();
  for (const [token, prepared] of preparedBrowserExports) {
    if (prepared.expiresAt <= now) preparedBrowserExports.delete(token);
  }
}
