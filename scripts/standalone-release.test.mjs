import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  nodeDistribution,
  parseSha256List,
  sha256File,
  standaloneAssetName,
  standaloneTarget
} from "./standalone-release-lib.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("standalone release targets use stable cross-platform asset names", () => {
  assert.equal(standaloneTarget("darwin", "arm64"), "darwin-arm64");
  assert.equal(standaloneTarget("darwin", "x64"), "darwin-x64");
  assert.equal(standaloneTarget("win32", "x64"), "windows-x64");
  assert.equal(standaloneAssetName("darwin-arm64"), "open-slidex-darwin-arm64.tar.gz");
  assert.equal(standaloneAssetName("windows-x64"), "open-slidex-windows-x64.zip");
  assert.throws(() => standaloneTarget("linux", "x64"), /does not support/);
});

test("Node distributions are pinned and checksum lists are parsed strictly", () => {
  assert.deepEqual(nodeDistribution("darwin-arm64", "24.19.0"), {
    archive: "node-v24.19.0-darwin-arm64.tar.gz",
    executable: "bin/node",
    root: "node-v24.19.0-darwin-arm64"
  });
  assert.equal(nodeDistribution("windows-x64", "24.19.0").archive, "node-v24.19.0-win-x64.zip");
  assert.deepEqual(
    [...parseSha256List(`${"a".repeat(64)}  file.tar.gz\ninvalid\n${"B".repeat(64)} *file.zip`)],
    [["file.tar.gz", "a".repeat(64)], ["file.zip", "b".repeat(64)]]
  );
});

test("bootstrap scripts expose install, update, uninstall, and checksum contracts", async () => {
  const [shellInstaller, powershellInstaller, readme, manifest] = await Promise.all([
    readFile(path.join(repositoryRoot, "install.sh"), "utf8"),
    readFile(path.join(repositoryRoot, "install.ps1"), "utf8"),
    readFile(path.join(repositoryRoot, "README.md"), "utf8"),
    readFile(path.join(repositoryRoot, "package.json"), "utf8").then(JSON.parse)
  ]);
  assert.match(shellInstaller, /SHA256SUMS\.txt/);
  assert.match(shellInstaller, /update\)/);
  assert.match(shellInstaller, /uninstall\)/);
  assert.match(shellInstaller, /Your Workspace presentations were kept/);
  assert.match(powershellInstaller, /Get-FileHash -Algorithm SHA256/);
  assert.match(powershellInstaller, /\$Command -eq "update"/);
  assert.match(powershellInstaller, /\$Command -eq "uninstall"/);
  assert.match(readme, /slidex update/);
  assert.match(readme, /slidex uninstall/);
  assert.equal(manifest.scripts["build:standalone"], "node scripts/build-standalone-release.mjs");
  assert.match(await readFile(path.join(repositoryRoot, "scripts/build-standalone-release.mjs"), "utf8"), /Git tag must exactly match/);
  await execFileAsync("sh", ["-n", path.join(repositoryRoot, "install.sh")]);
});

test("macOS bootstrap installs, updates, launches, and uninstalls an isolated archive", { skip: process.platform !== "darwin" }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-bootstrap-test-"));
  const releaseRoot = path.join(root, "release");
  const payloadRoot = path.join(root, "payload", "open-slidex");
  const installRoot = path.join(root, "installed");
  const binRoot = path.join(root, "bin");
  try {
    const target = standaloneTarget();
    const asset = standaloneAssetName(target);
    const fakeCli = path.join(payloadRoot, "app/node_modules/open-slidex/dist/cli.mjs");
    await Promise.all([
      mkdir(path.dirname(fakeCli), { recursive: true }),
      mkdir(path.join(payloadRoot, "node/bin"), { recursive: true }),
      mkdir(path.join(payloadRoot, "browsers"), { recursive: true }),
      mkdir(releaseRoot, { recursive: true })
    ]);
    await Promise.all([
      writeFile(
        path.join(payloadRoot, "node/bin/node"),
        '#!/bin/sh\nshift\nprintf "%s" "$*"\n',
        "utf8"
      ),
      writeFile(fakeCli, 'process.stdout.write(process.argv.slice(2).join("|") || "empty");\n', "utf8"),
      writeFile(path.join(payloadRoot, "VERSION"), "9.9.9\n", "utf8"),
      writeFile(path.join(payloadRoot, "release.json"), '{"version":"9.9.9"}\n', "utf8")
    ]);
    await chmod(path.join(payloadRoot, "node/bin/node"), 0o755);
    const archivePath = path.join(releaseRoot, asset);
    await execFileAsync("tar", ["-czf", archivePath, "-C", path.join(root, "payload"), "open-slidex"]);
    const digest = await sha256File(archivePath);
    await writeFile(path.join(releaseRoot, "SHA256SUMS.txt"), `${digest}  ${asset}\n`, "utf8");

    const environment = {
      ...process.env,
      OPEN_SLIDEX_BIN_DIR: binRoot,
      OPEN_SLIDEX_INSTALLER_URL: path.join(repositoryRoot, "install.sh"),
      OPEN_SLIDEX_INSTALL_ROOT: installRoot,
      OPEN_SLIDEX_RELEASE_BASE_URL: releaseRoot,
      OPEN_SLIDEX_SKIP_PATH_UPDATE: "1",
      OPEN_SLIDEX_WORKSPACE: path.join(root, "workspace")
    };
    await execFileAsync("sh", [path.join(repositoryRoot, "install.sh")], { env: environment });
    const launch = await execFileAsync(path.join(binRoot, "slidex"), ["--version"], { env: environment });
    assert.equal(launch.stdout, "--version");

    await Promise.all([
      writeFile(path.join(payloadRoot, "VERSION"), "9.9.10\n", "utf8"),
      writeFile(path.join(payloadRoot, "release.json"), '{"version":"9.9.10"}\n', "utf8")
    ]);
    await execFileAsync("tar", ["-czf", archivePath, "-C", path.join(root, "payload"), "open-slidex"]);
    await writeFile(
      path.join(releaseRoot, "SHA256SUMS.txt"),
      `${await sha256File(archivePath)}  ${asset}\n`,
      "utf8"
    );
    const update = await execFileAsync(path.join(binRoot, "slidex"), ["update"], { env: environment });
    assert.match(update.stdout, /updated to 9\.9\.10/);
    assert.equal((await readFile(path.join(installRoot, "current"), "utf8")).trim(), "9.9.10");
    await assert.rejects(readFile(path.join(installRoot, "versions/9.9.9/VERSION"), "utf8"));
    assert.equal((await execFileAsync(path.join(binRoot, "slidex"), ["--version"], { env: environment })).stdout, "--version");
    const uninstall = await execFileAsync(path.join(binRoot, "slidex"), ["uninstall"], { env: environment });
    assert.match(uninstall.stdout, /Workspace presentations were kept/);
    await assert.rejects(readFile(path.join(installRoot, "current"), "utf8"));
    await assert.rejects(readFile(path.join(binRoot, "slidex"), "utf8"));
    assert.equal(await readFile(path.join(root, "workspace", ".keep"), "utf8").catch(() => "kept"), "kept");
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
