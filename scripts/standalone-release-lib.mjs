import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export const standaloneNodeVersion = "24.19.0";

export function childProcessNeedsShell(platform, command) {
  return platform === "win32" && /\.(?:cmd|bat)$/i.test(command);
}

export function standaloneTarget(platform = process.platform, architecture = process.arch) {
  if (platform === "darwin" && architecture === "arm64") return "darwin-arm64";
  if (platform === "darwin" && architecture === "x64") return "darwin-x64";
  if (platform === "win32" && architecture === "x64") return "windows-x64";
  throw new Error(`Standalone OpenSlideX does not support ${platform}-${architecture}.`);
}

export function standaloneAssetName(target) {
  const extension = target.startsWith("windows-") ? "zip" : "tar.gz";
  return `open-slidex-${target}.${extension}`;
}

export function nodeDistribution(target, version = standaloneNodeVersion) {
  const normalizedVersion = version.startsWith("v") ? version : `v${version}`;
  if (target === "darwin-arm64") {
    return {
      archive: `node-${normalizedVersion}-darwin-arm64.tar.gz`,
      executable: "bin/node",
      root: `node-${normalizedVersion}-darwin-arm64`
    };
  }
  if (target === "darwin-x64") {
    return {
      archive: `node-${normalizedVersion}-darwin-x64.tar.gz`,
      executable: "bin/node",
      root: `node-${normalizedVersion}-darwin-x64`
    };
  }
  if (target === "windows-x64") {
    return {
      archive: `node-${normalizedVersion}-win-x64.zip`,
      executable: "node.exe",
      root: `node-${normalizedVersion}-win-x64`
    };
  }
  throw new Error(`Unknown standalone target: ${target}`);
}

export function parseSha256List(source) {
  const entries = new Map();
  for (const line of source.split(/\r?\n/)) {
    const match = line.trim().match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
    if (match) entries.set(match[2], match[1].toLowerCase());
  }
  return entries;
}

export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.once("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("end", () => resolve(hash.digest("hex")));
  });
}
