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
