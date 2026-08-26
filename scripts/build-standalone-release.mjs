import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  childProcessNeedsShell,
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
  const releaseRoot = path.join(tempRoot, "stage", "open-slidex");
  await Promise.all([
    mkdir(packRoot, { recursive: true }),
    mkdir(installRoot, { recursive: true }),
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
  await writeFile(
    path.join(installRoot, "package.json"),
    `${JSON.stringify({ name: "open-slidex-standalone", private: true, version: manifest.version }, null, 2)}\n`,
    "utf8"
  );
  process.stdout.write("Installing production dependencies into the standalone image...\n");
  await run(
    npmCommand(),
    ["install", "--omit=dev", "--no-audit", "--no-fund", "--package-lock=false", archivePath],
    { cwd: installRoot, env: npmEnvironment }
  );
  await rename(installRoot, path.join(releaseRoot, "app"));

  process.stdout.write(`Embedding Node.js ${nodeVersion}...\n`);
  await installNodeRuntime(releaseRoot, target, nodeVersion);
  process.stdout.write("Embedding Playwright Chromium headless shell...\n");
  await installChromium(releaseRoot);

  const release = {
    architecture: process.arch,
    browser: "playwright-chromium-headless-shell",
    nodeVersion,
    platform: process.platform,
    target,
    version: manifest.version
  };
  await Promise.all([
    writeFile(path.join(releaseRoot, "VERSION"), `${manifest.version}\n`, "utf8"),
    writeFile(path.join(releaseRoot, "release.json"), `${JSON.stringify(release, null, 2)}\n`, "utf8")
  ]);

  const outputPath = path.join(outputRoot, standaloneAssetName(target));
  process.stdout.write(`Compressing ${path.basename(outputPath)}...\n`);
  await rm(outputPath, { force: true });
  const tarArgs = target.startsWith("windows-")
    ? ["-a", "-cf", outputPath, "-C", path.dirname(releaseRoot), path.basename(releaseRoot)]
    : ["-czf", outputPath, "-C", path.dirname(releaseRoot), path.basename(releaseRoot)];
  await run("tar", tarArgs, { cwd: repositoryRoot });
  const digest = await sha256File(outputPath);
  await writeFile(`${outputPath}.sha256`, `${digest}  ${path.basename(outputPath)}\n`, "utf8");
  process.stdout.write(`Built ${outputPath}\nSHA-256 ${digest}\n`);
} finally {
  await rm(tempRoot, { force: true, recursive: true });
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
