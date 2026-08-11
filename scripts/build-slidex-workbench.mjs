import { existsSync, statSync } from "node:fs";
import { chmod, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import tailwindcss from "@tailwindcss/postcss";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = path.join(rootDir, "packages/slidex-workbench");
const packageJson = JSON.parse(
  await readFile(path.join(packageDir, "package.json"), "utf8")
);
const distDir = path.join(packageDir, "dist");

await mkdir(distDir, { recursive: true });

await viteBuild({
  base: "/",
  build: {
    assetsDir: "_workbench",
    emptyOutDir: true,
    outDir: path.join(distDir, "client"),
    sourcemap: false
  },
  configFile: false,
  esbuild: { jsx: "automatic" },
  logLevel: "info",
  css: {
    postcss: {
      plugins: [tailwindcss()]
    }
  },
  resolve: {
    alias: [
      {
        find: "@open-slidex/editor-ui/styles.css",
        replacement: path.join(rootDir, "packages/editor-ui/src/editor.css")
      },
      {
        find: "@open-slidex/editor-ui",
        replacement: path.join(rootDir, "packages/editor-ui/src/index.ts")
      },
      {
        find: "@open-slidex/sdk",
        replacement: path.join(rootDir, "packages/slidex-sdk/src/index.ts")
      },
      {
        find: /^@\//,
        replacement: `${rootDir}/`
      }
    ]
  },
  root: path.join(packageDir, "src/client")
});

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
