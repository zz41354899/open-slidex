import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = path.join(rootDir, "packages/open-slidex-mcp");
const outfile = path.join(packageDir, "dist/server.mjs");
await mkdir(path.dirname(outfile), { recursive: true });

await build({
  absWorkingDir: rootDir,
  banner: { js: "#!/usr/bin/env node" },
  bundle: true,
  entryPoints: [path.join(packageDir, "src/server.ts")],
  external: ["pdf-parse", "playwright-core", "sharp"],
  format: "esm",
  logLevel: "info",
  minify: true,
  outfile,
  platform: "node",
  target: "node22",
  plugins: [sourceAliases()]
});

await normalizeGeneratedText(outfile);
await chmod(outfile, 0o755);

async function normalizeGeneratedText(filePath) {
  const source = await readFile(filePath, "utf8");
  const normalized = source.replace(/[ \t]+$/gm, "");
  if (normalized !== source) await writeFile(filePath, normalized, "utf8");
}

function sourceAliases() {
  return {
    name: "open-slidex-source-aliases",
    setup(context) {
      context.onResolve({ filter: /^@open-slidex\/sdk\/node$/ }, () => ({
        path: path.join(rootDir, "packages/slidex-sdk/src/node.ts")
      }));
      context.onResolve({ filter: /^@open-slidex\/sdk$/ }, () => ({
        path: path.join(rootDir, "packages/slidex-sdk/src/index.ts")
      }));
      context.onResolve({ filter: /^@\// }, (args) => {
        const base = path.join(rootDir, args.path.slice(2));
        const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
        const resolved = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
        return resolved ? { path: resolved } : { errors: [{ text: `Could not resolve ${args.path}` }] };
      });
    }
  };
}
