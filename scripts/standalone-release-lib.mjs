import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export const standaloneNodeVersion = "24.19.0";

export function standaloneTarget(platform = process.platform, architecture = process.arch) {
  if (platform === "darwin" && architecture === "arm64") return "darwin-arm64";
  if (platform === "darwin" && architecture === "x64") return "darwin-x64";
  throw new Error(`Standalone OpenSlideX is available only on macOS (received ${platform}-${architecture}). Use npx open-slidex@latest on other platforms.`);
}

export function standaloneAssetName(target) {
  if (target !== "darwin-arm64" && target !== "darwin-x64") throw new Error(`Unknown macOS standalone target: ${target}`);
  return `open-slidex-${target}.tar.gz`;
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
  throw new Error(`Unknown macOS standalone target: ${target}`);
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

export function lockedStandaloneDependencies(
  lockfile,
  installedPackages,
  excludedNames = new Set(),
  packagedApplication = { name: "open-slidex", workspacePath: "packages/open-slidex" }
) {
  const packages = lockfile?.packages;
  if (!packages || typeof packages !== "object") {
    throw new Error("The repository package-lock.json does not contain a packages map.");
  }
  return installedPackages
    .filter((record) => !excludedNames.has(record.name))
    .map((record) => {
      const relativePath = record.relativePath.replaceAll("\\", "/");
      const applicationPrefix = `${packagedApplication.name}/node_modules/`;
      const lockPath = relativePath.startsWith(applicationPrefix)
        ? `${packagedApplication.workspacePath}/node_modules/${relativePath.slice(applicationPrefix.length)}`
        : `node_modules/${relativePath}`;
      const locked = packages[lockPath];
      if (
        !locked
        || locked.version !== record.version
        || typeof locked.integrity !== "string"
        || !locked.integrity
        || typeof locked.resolved !== "string"
        || !locked.resolved.startsWith("https://registry.npmjs.org/")
      ) {
        throw new Error(`The staged dependency is not exactly bound to package-lock.json: ${record.name}@${record.version} (${lockPath}).`);
      }
      return {
        integrity: locked.integrity,
        name: record.name,
        relativePath,
        resolved: locked.resolved,
        version: record.version
      };
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}
