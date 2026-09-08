import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, stat } from "node:fs/promises";
import path from "node:path";

export function resolveInsideRoot(root: string, requestedPath: string) {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, requestedPath);
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes the configured root: ${requestedPath}`);
  }
  return resolvedPath;
}

export type SlideXExistingPathKind = "directory" | "file" | "any";

/** Resolves an existing path only after proving that symlinks cannot leave root. */
export async function resolveExistingInsideRoot(
  root: string,
  requestedPath: string,
  kind: SlideXExistingPathKind = "any"
) {
  const requestedRoot = path.resolve(root);
  const canonicalRoot = await realpath(requestedRoot).catch(() => {
    throw new Error(`The configured root does not exist: ${requestedRoot}`);
  });
  const requested = path.isAbsolute(requestedPath)
    ? path.resolve(requestedPath)
    : resolveInsideRoot(requestedRoot, requestedPath);
  const stats = await lstat(requested);
  if (stats.isSymbolicLink()) {
    throw new Error(`Symbolic links are not allowed inside the configured root: ${requestedPath}`);
  }
  const canonical = await realpath(requested);
  resolveInsideRoot(canonicalRoot, canonical);
  if (kind === "file" && !stats.isFile()) {
    throw new Error(`The requested path is not a regular file: ${requestedPath}`);
  }
  if (kind === "directory" && !stats.isDirectory()) {
    throw new Error(`The requested path is not a directory: ${requestedPath}`);
  }
  return canonical;
}

/** Opens a stable file handle and verifies its device/inode after the open. */
export async function openExistingFileInsideRoot(root: string, requestedPath: string) {
  const initiallyResolved = await resolveExistingInsideRoot(root, requestedPath, "file");
  const handle = await open(initiallyResolved, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const openedStats = await handle.stat({ bigint: true });
    const currentlyResolved = await resolveExistingInsideRoot(root, requestedPath, "file");
    const currentStats = await stat(currentlyResolved, { bigint: true });
    if (openedStats.dev !== currentStats.dev || openedStats.ino !== currentStats.ino) {
      throw new Error(`The requested file changed while it was being opened: ${requestedPath}`);
    }
    return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
}

/** Creates a directory tree without following a symlinked path segment. */
export async function ensureDirectoryInsideRoot(root: string, requestedPath: string) {
  const requestedRoot = path.resolve(root);
  const canonicalRoot = await realpath(requestedRoot).catch(() => {
    throw new Error(`The configured root does not exist: ${requestedRoot}`);
  });
  const target = resolveInsideRoot(requestedRoot, requestedPath);
  const relative = path.relative(requestedRoot, target);
  let current = canonicalRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    const next = path.join(current, segment);
    const existing = await lstat(next).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!existing) await mkdir(next);
    const stats = existing ?? await lstat(next);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error(`A directory path inside the configured root is unsafe: ${requestedPath}`);
    }
    current = await realpath(next);
    resolveInsideRoot(canonicalRoot, current);
  }
  return current;
}
