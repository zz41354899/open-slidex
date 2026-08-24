import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createSlideXWorkbenchViteConfig,
  slideXWorkbenchSourceRoot,
  workbenchEditorChunk,
  workbenchModulePreloadDependencies,
  workbenchVendorChunk
} from "../vite.config.mjs";

test("Workbench Tailwind scans only explicit editor source paths", async () => {
  const css = await readFile(new URL("../packages/editor-ui/src/editor.css", import.meta.url), "utf8");

  assert.match(css, /^@import "tailwindcss" source\(none\);/);
  assert.match(css, /@import "tw-animate-css";/);
  assert.match(css, /@source "\.\.\/\.\.\/\.\.\/packages\/slidex-workbench\/src\/client\/\*\*\/\*\.\{ts,tsx\}";/);
});

test("the checkout and published runtime own their Tailwind v4 PostCSS dependencies", async () => {
  const [rootManifest, workbenchManifest, publishedManifest, buildSource] = await Promise.all([
    readJson(new URL("../package.json", import.meta.url)),
    readJson(new URL("../packages/slidex-workbench/package.json", import.meta.url)),
    readJson(new URL("../packages/open-slidex/package.json", import.meta.url)),
    readFile(new URL("../scripts/build-slidex-workbench.mjs", import.meta.url), "utf8")
  ]);

  assert.equal(rootManifest.devDependencies.shadcn, "4.17.0");
  assert.equal(rootManifest.devDependencies.postcss, "^8.5.26");
  assert.equal(rootManifest.devDependencies["tw-animate-css"], "^1.4.0");
  for (const manifest of [workbenchManifest, publishedManifest]) {
    assert.equal(manifest.dependencies.tailwindcss, "4.3.0");
    assert.equal(manifest.dependencies["@tailwindcss/postcss"], "4.3.0");
    assert.equal(manifest.dependencies.postcss, "^8.5.26");
    assert.equal(manifest.dependencies["tw-animate-css"], "^1.4.0");
    assert.match(manifest.dependencies.vite, /^\^8\./);
  }
  assert.match(buildSource, /cp\(path\.join\(rootDir, "postcss\.config\.mjs"\), path\.join\(distDir, "postcss\.config\.mjs"\)\)/);
  assert.match(buildSource, /"packages\/editor-ui\/src"/);
});

test("Workbench production and HMR builds share the same Vite client configuration", () => {
  const production = createSlideXWorkbenchViteConfig();
  const development = createSlideXWorkbenchViteConfig({
    apiPort: 4318,
    cacheDir: "/tmp/open-slidex-vite-cache",
    port: 4317
  });

  assert.equal(production.root, development.root);
  assert.ok(production.plugins.some((plugin) => plugin.name === "vite:react-refresh"));
  assert.equal(production.root, `${slideXWorkbenchSourceRoot}/packages/slidex-workbench/src/client`);
  assert.deepEqual(
    production.resolve.alias.map(({ find, replacement }) => [String(find), replacement]),
    development.resolve.alias.map(({ find, replacement }) => [String(find), replacement])
  );
  assert.equal(production.css.postcss, path.join(process.cwd(), "postcss.config.mjs"));
  assert.equal(development.css.postcss, path.join(process.cwd(), "postcss.config.mjs"));
  assert.equal(production.server, undefined);
  assert.equal(development.server.port, 4317);
  assert.equal(development.server.strictPort, true);
  assert.equal(development.server.fs.allow[0], slideXWorkbenchSourceRoot);
  assert.match(development.server.fs.allow[1], /node_modules\/@fontsource\/roboto$/);
  assert.equal(development.cacheDir, "/tmp/open-slidex-vite-cache");
  assert.equal(development.optimizeDeps.noDiscovery, true);
  assert.ok(development.optimizeDeps.include.includes("react-dom"));
  assert.ok(development.optimizeDeps.include.includes("react-dom/client"));
  const reactAlias = development.resolve.alias.find(({ find }) => String(find) === "/^react$/");
  assert.match(reactAlias?.replacement ?? "", /node_modules\/react$/);
  const robotoAlias = development.resolve.alias.find(({ find }) => String(find) === "@fontsource/roboto/latin-400.css");
  assert.match(robotoAlias?.replacement ?? "", /node_modules\/@fontsource\/roboto\/latin-400\.css$/);
});

test("Workbench defers editor routes and leaves cyclic dependency graphs to Rolldown", async () => {
  const [workbenchSource, workspaceSource, mainSource, overlaySource, buildSource, cliSource] = await Promise.all([
    readFile(new URL("../packages/slidex-workbench/src/client/Workbench.tsx", import.meta.url), "utf8"),
    readFile(new URL("../packages/slidex-workbench/src/client/WorkspaceHome.tsx", import.meta.url), "utf8"),
    readFile(new URL("../packages/slidex-workbench/src/client/main.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/pitch/ui/workspace/WorkspaceCodeEditorOverlay.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-slidex-workbench.mjs", import.meta.url), "utf8"),
    readFile(new URL("../packages/slidex-workbench/src/cli.ts", import.meta.url), "utf8")
  ]);

  assert.match(workbenchSource, /lazy\(\(\) => import\("\.\/EditorWorkbench"\)\)/);
  assert.match(workbenchSource, /lazy\(\(\) => import\("\.\/WorkspaceHome"\)/);
  assert.match(workspaceSource, /lazy\(\(\) => import\("\.\/WorkspaceOnboarding"\)/);
  assert.doesNotMatch(mainSource, /from "@open-slidex\/editor-ui"/);
  assert.match(overlaySource, /preloadMdxEditorPane/);
  assert.match(overlaySource, /import\("@\/features\/pitch\/ui\/MdxEditorPane"\)/);
  assert.match(buildSource, /\.\.\.workbenchViteConfig\.build/);
  assert.match(buildSource, /packages\/slidex-sdk\/dist/);
  assert.match(buildSource, /path: "\.\/sdk\/node\.js"/);
  assert.match(cliSource, /resolveWorkbenchViteConfigPath/);
  assert.match(cliSource, /new URL\("\.\.\/\.\.\/\.\.\/vite\.config\.mjs", import\.meta\.url\)/);

  assert.equal(workbenchVendorChunk("/repo/node_modules/@codemirror/view/dist/index.js"), undefined);
  assert.equal(workbenchVendorChunk("/repo/node_modules/@paper-design/shaders/dist/index.js"), "vendor-shaders");
  assert.equal(workbenchEditorChunk("/repo/features/pitch/ui/preview/PreviewBlock.tsx"), "editor-preview");
  assert.equal(workbenchEditorChunk("/repo/features/pitch/ui/inspector/ImageFields.tsx"), "editor-inspector");

  const dependencies = [
    "_workbench/EditorWorkbench-abc.js",
    "_workbench/I18nProvider-abc.js",
    "_workbench/vendor-ui-abc.js",
    "_workbench/vendor-shaders-abc.js"
  ];
  assert.deepEqual(
    workbenchModulePreloadDependencies("index.js", dependencies, { hostId: "index.html", hostType: "html" }),
    ["_workbench/I18nProvider-abc.js", "_workbench/vendor-ui-abc.js"]
  );
  assert.deepEqual(
    workbenchModulePreloadDependencies("EditorWorkbench.js", dependencies, { hostId: "index.js", hostType: "js" }),
    dependencies
  );
});

test("Workbench does not retain unreachable legacy panels in its source runtime", async () => {
  await Promise.all([
    assert.rejects(access(new URL("../packages/slidex-workbench/src/client/AssetsPanel.tsx", import.meta.url))),
    assert.rejects(access(new URL("../packages/slidex-workbench/src/client/Presenter.tsx", import.meta.url))),
    assert.rejects(access(new URL("../packages/slidex-workbench/src/client/assets/onboarding/onboarding-export.mp4", import.meta.url))),
    assert.rejects(access(new URL("../core/motion-doc/application/deckPlanMaterializer.ts", import.meta.url))),
    assert.rejects(access(new URL("../core/motion-doc/domain/deckPlanTemplate.ts", import.meta.url))),
    assert.rejects(access(new URL("../core/motion-doc/domain/deckPlanV1.ts", import.meta.url)))
  ]);
});

test("Workbench HMR proxy preserves the local origin boundary and brand assets", () => {
  const config = createSlideXWorkbenchViteConfig({
    apiPort: 4318,
    port: 4317,
    workspaceUrl: "http://127.0.0.1:4317/workspace"
  });
  const apiProxy = config.server.proxy["/api/v1"];
  const assetProxy = config.server.proxy["/assets"];

  assert.equal(config.server.proxy["/api"], undefined);
  assert.equal(
    config.define.__OPEN_SLIDEX_WORKSPACE_URL__,
    JSON.stringify("http://127.0.0.1:4317/workspace")
  );
  assert.equal(apiProxy.target, "http://127.0.0.1:4318");
  assert.equal(apiProxy.changeOrigin, true);
  assert.equal(apiProxy.headers.origin, "http://127.0.0.1:4318");
  assert.equal(
    assetProxy.bypass({ url: "/assets/slidex-x-mark.png?import" }),
    "/assets/slidex-x-mark.png?import"
  );
  assert.equal(assetProxy.bypass({ url: "/assets/project-image.webp" }), undefined);
});

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}
