import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  childProcessNeedsShell,
  lockedStandaloneDependencies,
  nodeDistribution,
  parseSha256List,
  sha256File,
  standaloneAssetName,
  standaloneNodeVersion,
  standaloneTarget
} from "./standalone-release-lib.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.resolve(
  repositoryRoot,
  process.env.OPEN_SLIDEX_STANDALONE_OUTPUT ?? "dist/standalone"
);
const packageRoot = path.join(repositoryRoot, "packages/open-slidex");
const repositoryManifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
const repositoryLockPath = path.join(repositoryRoot, "package-lock.json");
const repositoryLock = JSON.parse(await readFile(repositoryLockPath, "utf8"));
const target = standaloneTarget();
const nodeVersion = process.env.OPEN_SLIDEX_NODE_VERSION ?? standaloneNodeVersion;
const manifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "open-slidex-standalone-"));
const npmEnvironment = {
  ...process.env,
  npm_config_cache: path.join(tempRoot, "npm-cache")
};

if (process.env.GITHUB_REF_TYPE === "tag") {
  assert.equal(
    process.env.GITHUB_REF_NAME,
    `v${manifest.version}`,
    "The Git tag must exactly match the OpenSlideX package version."
  );
}

try {
  process.stdout.write(`Building OpenSlideX ${manifest.version} runtime for ${target}...\n`);
  await run(npmCommand(), ["run", "build:runtime"], { cwd: repositoryRoot, env: npmEnvironment });

  const packRoot = path.join(tempRoot, "pack");
  const installRoot = path.join(tempRoot, "install");
  const appRoot = path.join(tempRoot, "app");
  const releaseRoot = path.join(tempRoot, "stage", "open-slidex");
  await Promise.all([
    mkdir(packRoot, { recursive: true }),
    mkdir(installRoot, { recursive: true }),
    mkdir(appRoot, { recursive: true }),
    mkdir(releaseRoot, { recursive: true }),
    mkdir(outputRoot, { recursive: true })
  ]);

  const packOutput = await run(
    npmCommand(),
    ["pack", packageRoot, "--ignore-scripts", "--json", "--pack-destination", packRoot],
    { cwd: repositoryRoot, env: npmEnvironment }
  );
  const packed = JSON.parse(packOutput.stdout)[0];
  assert.equal(packed.version, manifest.version);
  const archivePath = path.join(packRoot, packed.filename);
  await prepareLockedInstallRoot(installRoot);
  process.stdout.write("Installing the reviewed production dependency tree from package-lock.json...\n");
  await run(
    npmCommand(),
    ["ci", "--omit=dev", "--workspace", "packages/open-slidex", "--include-workspace-root=false", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: installRoot, env: npmEnvironment }
  );
  process.stdout.write("Auditing the exact lockfile-derived production dependency tree...\n");
  await run(npmCommand(), ["audit", "--omit=dev", "--workspace", "packages/open-slidex", "--audit-level=moderate"], {
    cwd: installRoot,
    env: npmEnvironment
  });
  await run(npmCommand(), ["ls", "--omit=dev", "--all", "--workspace", "packages/open-slidex"], { cwd: installRoot, env: npmEnvironment });
  await rename(path.join(installRoot, "node_modules"), path.join(appRoot, "node_modules"));
  const applicationNodeModules = path.join(installRoot, "packages/open-slidex/node_modules");
  await rm(path.join(appRoot, "node_modules/open-slidex"), { force: true, recursive: true });
  const unpackRoot = path.join(tempRoot, "package-unpack");
  await mkdir(unpackRoot, { recursive: true });
  await run("tar", ["-xf", archivePath, "-C", unpackRoot], { cwd: repositoryRoot });
  await rename(path.join(unpackRoot, "package"), path.join(appRoot, "node_modules/open-slidex"));
  await rename(applicationNodeModules, path.join(appRoot, "node_modules/open-slidex/node_modules")).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
  const installedPackages = await collectInstalledPackages(path.join(appRoot, "node_modules"));
  const lockedDependencies = lockedStandaloneDependencies(repositoryLock, installedPackages, new Set(["open-slidex"]));
  assert.equal(
    lockedDependencies.length + 1,
    installedPackages.length,
    "Every staged npm package must be bound to the reviewed package-lock.json or the freshly packed open-slidex archive."
  );
  await Promise.all([
    writeFile(path.join(appRoot, "package.json"), `${JSON.stringify({
      dependencies: { "open-slidex": manifest.version },
      name: "open-slidex-standalone",
      private: true,
      version: manifest.version
    }, null, 2)}\n`, "utf8"),
    writeFile(path.join(appRoot, "DEPENDENCY-LOCK.json"), `${JSON.stringify({
      dependencies: lockedDependencies,
      package: {
        integrity: packed.integrity,
        name: "open-slidex",
        version: manifest.version
      },
      repositoryLockSha256: await sha256File(repositoryLockPath),
      schemaVersion: 1
    }, null, 2)}\n`, "utf8")
  ]);
  await rename(appRoot, path.join(releaseRoot, "app"));

  process.stdout.write(`Embedding Node.js ${nodeVersion}...\n`);
  await installNodeRuntime(releaseRoot, target, nodeVersion);
  process.stdout.write("Embedding Playwright Chromium headless shell...\n");
  await installChromium(releaseRoot);

  const asset = standaloneAssetName(target);
  const release = {
    architecture: process.arch,
    asset,
    browser: "playwright-chromium-headless-shell",
    installer: target.startsWith("windows-") ? "install.ps1" : "install.sh",
    nodeVersion,
    platform: process.platform,
    schemaVersion: 1,
    target,
    version: manifest.version
  };
  await Promise.all([
    cp(path.join(repositoryRoot, "install.sh"), path.join(releaseRoot, "install.sh")),
    cp(path.join(repositoryRoot, "install.ps1"), path.join(releaseRoot, "install.ps1")),
    writeFile(path.join(releaseRoot, "VERSION"), `${manifest.version}\n`, "utf8"),
    writeFile(path.join(releaseRoot, "release.json"), `${JSON.stringify(release, null, 2)}\n`, "utf8")
  ]);
  await chmod(path.join(releaseRoot, "install.sh"), 0o755);

  const outputPath = path.join(outputRoot, asset);
  process.stdout.write(`Compressing ${path.basename(outputPath)}...\n`);
  await rm(outputPath, { force: true });
  const tarArgs = target.startsWith("windows-")
    ? ["-a", "-cf", outputPath, "-C", path.dirname(releaseRoot), path.basename(releaseRoot)]
    : ["-czf", outputPath, "-C", path.dirname(releaseRoot), path.basename(releaseRoot)];
  await run("tar", tarArgs, { cwd: repositoryRoot });
  const digest = await sha256File(outputPath);
  const sbomPath = `${outputPath}.spdx.json`;
  await writeFile(
    sbomPath,
    `${JSON.stringify(await createSpdxSbom(releaseRoot, release, path.basename(outputPath), digest), null, 2)}\n`,
    "utf8"
  );
  await writeFile(`${outputPath}.sha256`, `${digest}  ${path.basename(outputPath)}\n`, "utf8");
  process.stdout.write(`Built ${outputPath}\nSBOM ${sbomPath}\nSHA-256 ${digest}\n`);
} finally {
  await rm(tempRoot, { force: true, recursive: true });
}

async function prepareLockedInstallRoot(installRoot) {
  await Promise.all([
    cp(path.join(repositoryRoot, "package.json"), path.join(installRoot, "package.json")),
    cp(repositoryLockPath, path.join(installRoot, "package-lock.json")),
    ...repositoryManifest.workspaces.map(async (workspace) => {
      const target = path.join(installRoot, workspace, "package.json");
      await mkdir(path.dirname(target), { recursive: true });
      await cp(path.join(repositoryRoot, workspace, "package.json"), target);
    }),
    (async () => {
      const target = path.join(installRoot, "tools/image-size-safe");
      await mkdir(path.dirname(target), { recursive: true });
      await cp(path.join(repositoryRoot, "tools/image-size-safe"), target, { recursive: true });
    })()
  ]);
}

async function createSpdxSbom(releaseRoot, release, archiveName, archiveDigest) {
  const packages = [];
  const addPackage = (name, version, packagePath, purpose = "LIBRARY") => {
    const spdxId = `SPDXRef-Package-${packages.length + 1}`;
    packages.push({
      SPDXID: spdxId,
      copyrightText: "NOASSERTION",
      downloadLocation: "NOASSERTION",
      filesAnalyzed: false,
      name,
      packageFileName: packagePath,
      primaryPackagePurpose: purpose,
      versionInfo: version || "NOASSERTION"
    });
    return spdxId;
  };

  const rootId = addPackage("open-slidex-standalone", release.version, archiveName, "APPLICATION");
  const nodeId = addPackage("node", release.nodeVersion, "node", "APPLICATION");
  const packageRecords = await collectInstalledPackages(path.join(releaseRoot, "app/node_modules"));
  const dependencyIds = packageRecords.map((record) =>
    addPackage(record.name, record.version, `app/node_modules/${record.relativePath}`)
  );
  const browserRoot = path.join(releaseRoot, "browsers");
  const browserEntries = await readdir(browserRoot, { withFileTypes: true }).catch(() => []);
  const browserIds = browserEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => addPackage("playwright-browser", entry.name, `browsers/${entry.name}`, "APPLICATION"));

  return {
    SPDXID: "SPDXRef-DOCUMENT",
    creationInfo: {
      created: new Date().toISOString(),
      creators: ["Tool: open-slidex-standalone-builder"]
    },
    dataLicense: "CC0-1.0",
    documentDescribes: [rootId],
    documentNamespace: `https://github.com/${repositoryForSbom()}/releases/${release.version}/${release.target}/${archiveDigest}`,
    name: `${archiveName} SBOM`,
    packages,
    relationships: [nodeId, ...dependencyIds, ...browserIds].map((relatedId) => ({
      relatedSpdxElement: relatedId,
      relationshipType: "CONTAINS",
      spdxElementId: rootId
    })),
    spdxVersion: "SPDX-2.3"
  };
}

async function collectInstalledPackages(nodeModulesRoot) {
  const records = [];
  const visitNodeModules = async (root, relativePrefix = "") => {
    const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === ".bin") continue;
      if (entry.name.startsWith("@")) {
        await visitScope(path.join(root, entry.name), path.join(relativePrefix, entry.name));
        continue;
      }
      await visitPackage(path.join(root, entry.name), path.join(relativePrefix, entry.name));
    }
  };
  const visitScope = async (scopeRoot, relativeScope) => {
    const entries = await readdir(scopeRoot, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await visitPackage(path.join(scopeRoot, entry.name), path.join(relativeScope, entry.name));
      }
    }
  };
  const visitPackage = async (packagePath, relativePath) => {
    try {
      const packageManifest = JSON.parse(await readFile(path.join(packagePath, "package.json"), "utf8"));
      records.push({
        name: typeof packageManifest.name === "string" ? packageManifest.name : path.basename(packagePath),
        relativePath,
        version: typeof packageManifest.version === "string" ? packageManifest.version : "NOASSERTION"
      });
    } catch {
      // An installed directory without package metadata is not represented as an npm component.
    }
    await visitNodeModules(path.join(packagePath, "node_modules"), path.join(relativePath, "node_modules"));
  };
  await visitNodeModules(nodeModulesRoot);
  return records.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function repositoryForSbom() {
  return process.env.GITHUB_REPOSITORY || "zz41354899/open-slidex";
}

async function installNodeRuntime(releaseRoot, releaseTarget, version) {
  const distribution = nodeDistribution(releaseTarget, version);
  const baseUrl = `https://nodejs.org/dist/v${version}`;
  const archivePath = path.join(tempRoot, distribution.archive);
  const checksums = parseSha256List(await downloadText(`${baseUrl}/SHASUMS256.txt`));
  const expected = checksums.get(distribution.archive);
  assert.ok(expected, `Node checksum is missing for ${distribution.archive}`);
  await downloadFile(`${baseUrl}/${distribution.archive}`, archivePath);
  assert.equal(await sha256File(archivePath), expected, `Node checksum mismatch for ${distribution.archive}`);

  const extractRoot = path.join(tempRoot, "node-extract");
  await mkdir(extractRoot, { recursive: true });
  await run("tar", ["-xf", archivePath, "-C", extractRoot]);
  const sourceRoot = path.join(extractRoot, distribution.root);
  const runtimeRoot = path.join(releaseRoot, "node");
  const executableTarget = releaseTarget.startsWith("windows-")
    ? path.join(runtimeRoot, "node.exe")
    : path.join(runtimeRoot, "bin/node");
  await mkdir(path.dirname(executableTarget), { recursive: true });
  await Promise.all([
    cp(path.join(sourceRoot, distribution.executable), executableTarget),
    cp(path.join(sourceRoot, "LICENSE"), path.join(runtimeRoot, "LICENSE"))
  ]);
  if (!releaseTarget.startsWith("windows-")) await chmod(executableTarget, 0o755);
}

async function installChromium(releaseRoot) {
  if (process.env.OPEN_SLIDEX_STANDALONE_SKIP_BROWSER === "1") return;
  const nodeExecutable = target.startsWith("windows-")
    ? path.join(releaseRoot, "node/node.exe")
    : path.join(releaseRoot, "node/bin/node");
  const playwrightCli = path.join(releaseRoot, "app/node_modules/playwright-core/cli.js");
  await run(nodeExecutable, [playwrightCli, "install", "chromium", "--only-shell", "--no-progress"], {
    cwd: releaseRoot,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(releaseRoot, "browsers") }
  });
}

async function downloadText(url) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return response.text();
}

async function downloadFile(url, destination) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}): ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, bytes);
}

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    env: options.env ?? process.env,
    maxBuffer: 40 * 1024 * 1024,
    shell: childProcessNeedsShell(process.platform, command),
    timeout: 10 * 60 * 1000,
    ...options
  });
  return result;
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}
