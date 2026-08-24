import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("every published, workspace, starter, lockfile, and built runtime version stays aligned", async () => {
  const rootManifest = await readJson("package.json");
  const publishedManifest = await readJson("packages/open-slidex/package.json");
  const lockfile = await readJson("package-lock.json");
  const version = rootManifest.version;

  assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.deepEqual(rootManifest.workspaces, [
    "packages/editor-ui",
    "packages/open-slidex",
    "packages/open-slidex-mcp",
    "packages/slidex-sdk",
    "packages/slidex-workbench"
  ]);
  assert.equal(publishedManifest.scripts?.prepack, "npm run build");
  assert.equal(
    publishedManifest.scripts?.prepublishOnly,
    undefined,
    "npm publish already runs prepack; do not rebuild the complete runtime twice"
  );

  const manifestPaths = [
    ...rootManifest.workspaces.map((workspace) => `${workspace}/package.json`),
    "packages/open-slidex/template/package.json"
  ];
  for (const manifestPath of manifestPaths) {
    const manifest = await readJson(manifestPath);
    assert.equal(manifest.version, version, `${manifestPath} must match the release version`);
    assertInternalDependencies(manifest, version, manifestPath);
  }

  assert.equal(lockfile.version, version);
  assert.equal(lockfile.packages?.[""]?.version, version);
  for (const workspace of rootManifest.workspaces) {
    const locked = lockfile.packages?.[workspace];
    assert.ok(locked, `package-lock.json is missing ${workspace}`);
    assert.equal(locked.version, version, `package-lock.json ${workspace} must match the release version`);
    assertInternalDependencies(locked, version, `package-lock.json#${workspace}`);
  }

  const runtimeManifestPath = "packages/open-slidex/runtime/package.json";
  if (await exists(runtimeManifestPath)) {
    const runtimeManifest = await readJson(runtimeManifestPath);
    assert.equal(runtimeManifest.version, version, "the built runtime must match the package version");
  }
});

function assertInternalDependencies(manifest, version, source) {
  for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, range] of Object.entries(manifest[field] ?? {})) {
      if (name.startsWith("@open-slidex/")) {
        assert.equal(range, version, `${source} ${field}.${name} must use the exact release version`);
      }
    }
  }
}

async function exists(relativePath) {
  return access(path.join(repositoryRoot, relativePath)).then(
    () => true,
    () => false
  );
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repositoryRoot, relativePath), "utf8"));
}
