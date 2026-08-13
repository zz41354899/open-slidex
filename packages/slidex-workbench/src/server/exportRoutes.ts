import path from "node:path";

import { jsonBody, sendJson, type WorkbenchRouteContext } from "./httpRoute";

export async function exportRoutes(context: WorkbenchRouteContext) {
  const { outgoing, project, request, url } = context;

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
    const result = await project.export({
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
