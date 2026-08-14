import { existsSync, statSync } from "node:fs";
import { chmod, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";

import { createSlideXWorkbenchViteConfig } from "../vite.config.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = path.join(rootDir, "packages/slidex-workbench");
const packageJson = JSON.parse(
  await readFile(path.join(packageDir, "package.json"), "utf8")
);
const distDir = path.join(packageDir, "dist");

await mkdir(distDir, { recursive: true });

await viteBuild({
  ...createSlideXWorkbenchViteConfig(),
  build: {
    assetsDir: "_workbench",
    emptyOutDir: true,
    outDir: path.join(distDir, "client"),
    sourcemap: false
  },
  logLevel: "info"
});
await normalizeGeneratedText(path.join(distDir, "client"));
await cp(path.join(rootDir, "vite.config.mjs"), path.join(distDir, "vite.config.mjs"));
await cp(path.join(rootDir, "postcss.config.mjs"), path.join(distDir, "postcss.config.mjs"));
await copyWorkbenchSources(path.join(distDir, "source"));

await esbuild({
  absWorkingDir: rootDir,
  banner: { js: "#!/usr/bin/env node" },
  bundle: true,
  entryPoints: [path.join(packageDir, "src/cli.ts")],
  external: [
    ...Object.keys(packageJson.dependencies ?? {}).filter((name) => name !== "@open-slidex/sdk"),
    ...Object.keys(packageJson.devDependencies ?? {})
  ],
  format: "esm",
  logLevel: "info",
  outfile: path.join(distDir, "cli.mjs"),
  platform: "node",
  target: "node22",
  plugins: [sourceAliases()]
});

await chmod(path.join(distDir, "cli.mjs"), 0o755);

async function copyWorkbenchSources(sourceRoot) {
  await rm(sourceRoot, { force: true, recursive: true });
  await mkdir(sourceRoot, { recursive: true });
  const sourceDirectories = [
    "common",
    "core",
    "features",
    "packages/editor-ui/src",
    "packages/slidex-sdk/src",
    "packages/slidex-workbench/src/client",
    "packages/slidex-workbench/src/shared"
  ];
  for (const sourceDirectory of sourceDirectories) {
    const sourcePath = path.join(rootDir, sourceDirectory);
    if (!existsSync(sourcePath)) continue;
    await cp(
      sourcePath,
      path.join(sourceRoot, sourceDirectory),
      {
        filter: (candidate) => !/\.test\.[cm]?[jt]sx?$/.test(candidate),
        recursive: true
      }
    );
  }
}

async function normalizeGeneratedText(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await normalizeGeneratedText(target);
      continue;
    }
    if (!/\.(?:css|html|js)$/.test(entry.name)) continue;
    const source = await readFile(target, "utf8");
    const normalized = source.replace(/[ \t]+$/gm, "");
    if (normalized !== source) await writeFile(target, normalized, "utf8");
  }
}

function sourceAliases() {
  return {
    name: "open-slidex-source-aliases",
    setup(context) {
      context.onResolve({ filter: /^@open-slidex\/sdk\/node$/ }, () => ({
        external: true,
        path: "../sdk/node.js"
      }));
      context.onResolve({ filter: /^@open-slidex\/sdk$/ }, () => ({
        external: true,
        path: "../sdk/index.js"
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
