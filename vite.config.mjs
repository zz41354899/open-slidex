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

const workbenchVendorChunks = [
  ["vendor-shaders", ["/@paper-design/", "/three/"]],
  ["vendor-motion", ["/framer-motion/", "/motion-dom/", "/motion-utils/"]],
  ["vendor-ui", ["/@radix-ui/", "/radix-ui/", "/lucide-react/"]],
  // Let Rolldown own the React and MDX dependency graphs. Their packages have
  // internal cycles; forcing them into manual groups produced duplicate chunks.
];
const workbenchEditorChunks = [
  ["editor-preview", ["/features/pitch/ui/preview/", "/features/pitch/ui/PreviewCanvas.tsx"]],
  ["editor-inspector", ["/features/pitch/ui/inspector/", "/features/pitch/ui/PitchInspector.tsx", "/packages/slidex-workbench/src/client/ChartInspector.tsx"]],
  ["editor-templates", ["/core/motion-doc/presets/"]],
  ["editor-export", ["/core/motion-doc/infrastructure/export/", "/features/pitch/infrastructure/"]]
];
const workbenchInitialPreloadPrefixes = [
  "I18nProvider-",
  "rolldown-runtime-",
  "vendor-ui-"
];

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
    build: {
      // The CodeMirror overlay is intentionally one lazy chunk. It is not part
      // of the Workspace or canvas startup path.
      chunkSizeWarningLimit: 700,
      modulePreload: {
        resolveDependencies: workbenchModulePreloadDependencies
      },
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              ...workbenchVendorChunks.map(([name], index) => ({
                includeDependenciesRecursively: false,
                name,
                priority: 100 + workbenchVendorChunks.length - index,
                test: (id) => workbenchVendorChunk(id) === name
              })),
              ...workbenchEditorChunks.map(([name], index) => ({
                includeDependenciesRecursively: false,
                name,
                priority: workbenchEditorChunks.length - index,
                test: (id) => workbenchEditorChunk(id) === name
              }))
            ],
            includeDependenciesRecursively: false,
            maxSize: 450_000,
            minSize: 20_000
          }
        }
      }
    },
    optimizeDeps: {
      include: workbenchBrowserDependencies,
      noDiscovery: true
    },
    plugins: [...react()],
    resolve: {
      alias: [
        ...["latin-400.css", "latin-500.css", "latin-700.css"].map((fileName) => ({
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
            // Non-loopback hosts (e.g. 0.0.0.0 for container port publishing) are an
            // explicit opt-in, so Vite's DNS-rebinding host check is disabled to match.
            ...(options.host && options.host !== "127.0.0.1" && options.host !== "localhost"
              ? { allowedHosts: true }
              : {}),
            fs: { allow: [sourceRoot, robotoPackageRoot] },
            host: options.host ?? "127.0.0.1",
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

export function workbenchVendorChunk(id) {
  const normalized = id.replaceAll("\\", "/");
  if (!normalized.includes("/node_modules/")) return undefined;
  return workbenchVendorChunks.find(([, fragments]) => fragments.some((fragment) => normalized.includes(fragment)))?.[0];
}

export function workbenchEditorChunk(id) {
  const normalized = id.replaceAll("\\", "/");
  if (normalized.includes("/node_modules/")) return undefined;
  return workbenchEditorChunks.find(([, fragments]) => fragments.some((fragment) => normalized.includes(fragment)))?.[0];
}

export function workbenchModulePreloadDependencies(_filename, dependencies, context) {
  if (context.hostType !== "html") return dependencies;
  return dependencies.filter((dependency) => {
    const fileName = dependency.split("/").at(-1) ?? dependency;
    return workbenchInitialPreloadPrefixes.some((prefix) => fileName.startsWith(prefix));
  });
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
