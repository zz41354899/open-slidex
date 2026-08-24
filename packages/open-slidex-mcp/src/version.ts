import { readFileSync } from "node:fs";

type PackageManifest = { version?: unknown };

export function openSlideXMcpVersion() {
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8")
  ) as PackageManifest;
  if (typeof manifest.version !== "string") {
    throw new Error("The OpenSlideX MCP package version is unavailable.");
  }
  return manifest.version;
}
