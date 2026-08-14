import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";

const configRoot = path.dirname(fileURLToPath(import.meta.url));
const packagedSourceRoot = path.join(configRoot, "source");
const workbenchRequire = createRequire(import.meta.url);
const robotoPackageRoot = resolvePackageRoot("@fontsource/roboto");

export const slideXWorkbenchSourceRoot = existsSync(
  path.join(packagedSourceRoot, "packages/slidex-workbench/src/client/index.html")
)
  ? packagedSourceRoot
  : configRoot;

const workbenchBrandAssets = new Set([
  "/assets/slidex-wordmark.png",
  "/assets/slidex-x-mark.png"
]);
const workbenchBrowserDependencies = [
  "@codemirror/autocomplete",
  "@codemirror/commands",
  "@codemirror/lang-html",
  "@codemirror/lang-javascript",
  "@codemirror/lang-markdown",
  "@codemirror/language",
  "@codemirror/search",
  "@codemirror/view",
  "@lezer/highlight",
  "@paper-design/shaders",
  "@paper-design/shaders-react",
  "@radix-ui/react-popover",
  "@radix-ui/react-toolbar",
  "@uiw/react-codemirror",
  "class-variance-authority",
  "clsx",
  "framer-motion",
  "html2canvas-pro",
  "lucide-react",
  "mdast-util-from-markdown",
  "mdast-util-gfm",
  "micromark-extension-gfm",
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-dev-runtime",
  "react/jsx-runtime",
  "radix-ui",
  "tailwind-merge",
  "zod"
];
const workbenchBrowserDependencyAliases = workbenchBrowserDependencies
  .map((specifier) => ({
    find: new RegExp(`^${escapeRegExp(specifier)}$`),
    replacement: path.join(resolvePackageRoot(specifier), specifier.slice(packageName(specifier).length))
  }));

export function createSlideXWorkbenchViteConfig(options = {}) {
  const sourceRoot = options.sourceRoot ?? slideXWorkbenchSourceRoot;
  const clientRoot = path.join(sourceRoot, "packages/slidex-workbench/src/client");
  const apiTarget = options.apiPort
    ? `http://127.0.0.1:${options.apiPort}`
    : undefined;

  return {
    base: "/",
    ...(options.cacheDir ? { cacheDir: options.cacheDir } : {}),
    configFile: false,
    define: {
      __OPEN_SLIDEX_WORKSPACE_URL__: JSON.stringify(options.workspaceUrl ?? "")
    },
    css: {
      postcss: path.join(configRoot, "postcss.config.mjs")
    },
    optimizeDeps: {
      include: workbenchBrowserDependencies,
      noDiscovery: true
    },
    plugins: [...react()],
    resolve: {
      alias: [
        ...["400.css", "500.css", "700.css"].map((fileName) => ({
          find: `@fontsource/roboto/${fileName}`,
          replacement: path.join(robotoPackageRoot, fileName)
        })),
        {
          find: "@open-slidex/editor-ui/styles.css",
          replacement: path.join(sourceRoot, "packages/editor-ui/src/editor.css")
        },
        {
          find: "@open-slidex/editor-ui",
          replacement: path.join(sourceRoot, "packages/editor-ui/src/index.ts")
        },
        {
          find: "@open-slidex/sdk",
          replacement: path.join(sourceRoot, "packages/slidex-sdk/src/index.ts")
        },
        {
          find: /^@\//,
          replacement: `${sourceRoot}/`
        },
        ...workbenchBrowserDependencyAliases
      ]
    },
    root: clientRoot,
    ...(apiTarget
      ? {
          server: {
            fs: { allow: [sourceRoot, robotoPackageRoot] },
            host: "127.0.0.1",
            port: options.port ?? 4173,
            proxy: {
              "/api/v1": localWorkbenchProxy(apiTarget),
              "/assets": localWorkbenchProxy(apiTarget, {
                bypass(request) {
                  const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
                  return workbenchBrandAssets.has(pathname) ? request.url : undefined;
                }
              })
            },
            strictPort: true
          }
        }
      : {})
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function packageName(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function resolvePackageRoot(specifier) {
  const name = packageName(specifier);
  let current = path.dirname(workbenchRequire.resolve(name));
  while (true) {
    const manifestPath = path.join(current, "package.json");
    if (existsSync(manifestPath)) {
      try {
        if (JSON.parse(readFileSync(manifestPath, "utf8")).name === name) return current;
      } catch {
        // Keep walking until the owning dependency package is found.
      }
    }
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`Could not resolve the Workbench dependency root for ${name}.`);
    current = parent;
  }
}

function localWorkbenchProxy(target, extra = {}) {
  return {
    changeOrigin: true,
    headers: { origin: target },
    target,
    ...extra
  };
}

export default createSlideXWorkbenchViteConfig();
