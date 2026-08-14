import { existsSync, statSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = path.join(rootDir, "packages/slidex-sdk");
const outdir = path.join(packageDir, "dist");

await mkdir(outdir, { recursive: true });

await build({
  absWorkingDir: rootDir,
  bundle: true,
  entryPoints: [path.join(packageDir, "src/index.ts")],
  format: "esm",
  logLevel: "info",
  minify: true,
  outfile: path.join(outdir, "index.js"),
  platform: "browser",
  target: "es2020",
  treeShaking: true,
  plugins: [rootAliasPlugin()]
});

await build({
  absWorkingDir: rootDir,
  bundle: true,
  entryPoints: [path.join(packageDir, "src/pptxBrowserEntry.ts")],
  format: "iife",
  logLevel: "info",
  minify: true,
  outfile: path.join(outdir, "pptx-browser.js"),
  platform: "browser",
  target: "es2020",
  treeShaking: true,
  plugins: [rootAliasPlugin()]
});

await build({
  absWorkingDir: rootDir,
  bundle: true,
  entryPoints: [path.join(packageDir, "src/node.ts")],
  external: ["playwright-core", "sharp"],
  format: "esm",
  logLevel: "info",
  minify: true,
  outfile: path.join(outdir, "node.js"),
  platform: "node",
  target: "node18",
  treeShaking: true,
  plugins: [rootAliasPlugin()]
});

await build({
  absWorkingDir: rootDir,
  banner: { js: "#!/usr/bin/env node" },
  bundle: true,
  entryPoints: [path.join(packageDir, "src/cli.ts")],
  external: ["playwright-core", "sharp"],
  format: "esm",
  logLevel: "info",
  minify: true,
  outfile: path.join(outdir, "cli.js"),
  platform: "node",
  target: "node18",
  treeShaking: true,
  plugins: [sharedSdkCliRuntimePlugin(), rootAliasPlugin()]
});

await Promise.all(
  ["index.js", "pptx-browser.js", "node.js", "cli.js"]
    .map((fileName) => normalizeGeneratedText(path.join(outdir, fileName)))
);
await chmod(path.join(outdir, "node.js"), 0o644);
await chmod(path.join(outdir, "cli.js"), 0o755);

async function normalizeGeneratedText(filePath) {
  const source = await readFile(filePath, "utf8");
  const normalized = source.replace(/[ \t]+$/gm, "");
  if (normalized !== source) await writeFile(filePath, normalized, "utf8");
}

function sharedSdkCliRuntimePlugin() {
  return {
    name: "shared-sdk-cli-runtime",
    setup(buildContext) {
      buildContext.onResolve({ filter: /^\.\/(?:index|node)$/ }, (args) => ({
        external: true,
        path: `${args.path}.js`
      }));
    }
  };
}

function rootAliasPlugin() {
  return {
    name: "root-alias",
    setup(buildContext) {
      buildContext.onResolve(
        { filter: /^decode-named-character-reference$/ },
        () => ({
          path: path.join(
            rootDir,
            "node_modules/decode-named-character-reference/index.js"
          )
        })
      );
      buildContext.onResolve({ filter: /^@\// }, (args) => {
        const basePath = path.join(rootDir, args.path.slice(2));
        const resolvedPath = resolveSourcePath(basePath);
        return resolvedPath
          ? { path: resolvedPath }
          : { errors: [{ text: `Could not resolve ${args.path} from ${args.importer}` }] };
      });
    }
  };
}

function resolveSourcePath(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx")
  ];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}
