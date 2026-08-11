import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const prohibitedDirectories = ["app", "supabase"];
const prohibitedPatterns = [
  /@supabase\//i,
  /SUPABASE_/i,
  /NEXT_PUBLIC_SUPABASE/i,
  /service[_-]?role/i,
  /from\s+["']@\/app\//,
  /from\s+["']@\/features\/(auth|workspace)\//
];

for (const directory of prohibitedDirectories) {
  try {
    await readdir(path.join(root, directory));
    throw new Error(`Public repository must not contain ${directory}/.`);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
    throw error;
  }
}

for await (const file of walk(root)) {
  if (!/\.(?:[cm]?[jt]sx?|json|md)$/i.test(file)) continue;
  const relative = path.relative(root, file);
  if (relative.startsWith(".git/")) continue;
  if (relative === "scripts/check-open-source-boundary.mjs") continue;
  const content = await readFile(file, "utf8");
  const matched = prohibitedPatterns.find((pattern) => pattern.test(content));
  if (matched) throw new Error(`Public boundary violation in ${relative}: ${matched}`);
}

process.stdout.write("OpenSlideX public-source boundary check passed.\n");

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(absolute);
    else if (entry.isFile()) yield absolute;
  }
}
