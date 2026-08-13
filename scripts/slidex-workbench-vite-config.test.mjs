import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createSlideXWorkbenchViteConfig,
  slideXWorkbenchSourceRoot
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
  assert.deepEqual(development.server.fs.allow, [slideXWorkbenchSourceRoot]);
  assert.equal(development.cacheDir, "/tmp/open-slidex-vite-cache");
  assert.equal(development.optimizeDeps.noDiscovery, true);
  assert.ok(development.optimizeDeps.include.includes("react-dom"));
  assert.ok(development.optimizeDeps.include.includes("react-dom/client"));
  const reactAlias = development.resolve.alias.find(({ find }) => String(find) === "/^react$/");
  assert.match(reactAlias?.replacement ?? "", /node_modules\/react$/);
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
