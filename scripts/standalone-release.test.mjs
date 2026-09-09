import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";

import {
  childProcessNeedsShell,
  lockedStandaloneDependencies,
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

test("Windows batch commands use a shell while native executables stay direct", () => {
  assert.equal(childProcessNeedsShell("win32", "npm.cmd"), true);
  assert.equal(childProcessNeedsShell("win32", "setup.BAT"), true);
  assert.equal(childProcessNeedsShell("win32", "node.exe"), false);
  assert.equal(childProcessNeedsShell("darwin", "npm.cmd"), false);
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

test("standalone dependency records must match the reviewed lock path, version, and integrity", () => {
  const lockfile = {
    packages: {
      "node_modules/example": {
        integrity: "sha512-reviewed",
        resolved: "https://registry.npmjs.org/example/-/example-1.2.3.tgz",
        version: "1.2.3"
      },
      "packages/open-slidex/node_modules/nested": {
        integrity: "sha512-nested",
        resolved: "https://registry.npmjs.org/nested/-/nested-2.0.0.tgz",
        version: "2.0.0"
      }
    }
  };
  assert.deepEqual(lockedStandaloneDependencies(lockfile, [{
    name: "example",
    relativePath: "example",
    version: "1.2.3"
  }, {
    name: "nested",
    relativePath: "open-slidex/node_modules/nested",
    version: "2.0.0"
  }]), [{
    integrity: "sha512-reviewed",
    name: "example",
    relativePath: "example",
    resolved: "https://registry.npmjs.org/example/-/example-1.2.3.tgz",
    version: "1.2.3"
  }, {
    integrity: "sha512-nested",
    name: "nested",
    relativePath: "open-slidex/node_modules/nested",
    resolved: "https://registry.npmjs.org/nested/-/nested-2.0.0.tgz",
    version: "2.0.0"
  }]);
  assert.throws(
    () => lockedStandaloneDependencies(lockfile, [{ name: "example", relativePath: "example", version: "1.2.4" }]),
    /not exactly bound/
  );
});

test("bootstrap scripts expose immutable update, rollback, identity, and checksum contracts", async () => {
  const [shellInstaller, powershellInstaller, windowsInstallerTest, readme, manifest, releaseWorkflow, securityWorkflow] = await Promise.all([
    readFile(path.join(repositoryRoot, "install.sh"), "utf8"),
    readFile(path.join(repositoryRoot, "install.ps1"), "utf8"),
    readFile(path.join(repositoryRoot, "scripts/test-standalone-windows.ps1"), "utf8"),
    readFile(path.join(repositoryRoot, "README.md"), "utf8"),
    readFile(path.join(repositoryRoot, "package.json"), "utf8").then(JSON.parse),
    readFile(path.join(repositoryRoot, ".github/workflows/standalone-release.yml"), "utf8"),
    readFile(path.join(repositoryRoot, ".github/workflows/security.yml"), "utf8")
  ]);
  assert.match(shellInstaller, /SHA256SUMS\.txt/);
  assert.match(shellInstaller, /update\)/);
  assert.match(shellInstaller, /uninstall\)/);
  assert.match(shellInstaller, /rollback\)/);
  assert.match(shellInstaller, /MANIFEST_TARGET/);
  assert.match(shellInstaller, /gh attestation verify/);
  assert.match(shellInstaller, /\.intoto\.jsonl/);
  assert.match(shellInstaller, /--bundle/);
  assert.match(shellInstaller, /--source-ref/);
  assert.match(shellInstaller, /--deny-self-hosted-runners/);
  assert.match(shellInstaller, /GH_CONFIG_DIR=.*GH_TOKEN=''/);
  assert.doesNotMatch(shellInstaller, /gh auth login/);
  assert.doesNotMatch(shellInstaller, /raw\.githubusercontent\.com/);
  assert.match(shellInstaller, /Your Workspace presentations were kept/);
  assert.match(powershellInstaller, /Get-FileHash -Algorithm SHA256/);
  assert.match(powershellInstaller, /\$Command -eq "update"/);
  assert.match(powershellInstaller, /\$Command -eq "rollback"/);
  assert.match(powershellInstaller, /\$Command -eq "uninstall"/);
  assert.match(powershellInstaller, /Assert-SafeZip/);
  assert.match(powershellInstaller, /attestation verify/);
  assert.match(powershellInstaller, /\.intoto\.jsonl/);
  assert.match(powershellInstaller, /--bundle/);
  assert.match(powershellInstaller, /--source-ref/);
  assert.match(powershellInstaller, /--deny-self-hosted-runners/);
  assert.match(powershellInstaller, /Remove-Item Env:GH_TOKEN/);
  assert.doesNotMatch(powershellInstaller, /gh auth login/);
  assert.match(powershellInstaller, /function Install-GitHubCli/);
  assert.match(powershellInstaller, /winget to verify .*release attestation/);
  assert.match(powershellInstaller, /install --id GitHub\.cli --exact --source winget/);
  assert.match(powershellInstaller, /--accept-source-agreements --accept-package-agreements/);
  assert.match(windowsInstallerTest, /install-with-local-attestation/);
  assert.match(windowsInstallerTest, /Missing GitHub CLI did not invoke winget/);
  assert.doesNotMatch(powershellInstaller, /raw\.githubusercontent\.com/);
  assert.match(readme, /slidex update/);
  assert.match(readme, /slidex uninstall/);
  assert.doesNotMatch(readme, /\| sh|\| iex/);
  assert.equal(manifest.scripts["build:standalone"], "node scripts/build-standalone-release.mjs");
  const builder = await readFile(path.join(repositoryRoot, "scripts/build-standalone-release.mjs"), "utf8");
  assert.match(builder, /Git tag must exactly match/);
  assert.match(builder, /createSpdxSbom/);
  assert.match(builder, /Auditing the exact lockfile-derived production dependency tree/);
  assert.match(builder, /npmCommand\(\),\s*\["ci", "--omit=dev", "--workspace", "packages\/open-slidex"/);
  assert.match(builder, /DEPENDENCY-LOCK\.json/);
  assert.match(builder, /lockedStandaloneDependencies/);
  assert.match(releaseWorkflow, /Release security gates/);
  assert.match(releaseWorkflow, /actions\/attest@1e69f48a/);
  assert.match(releaseWorkflow, /sbom-path:/);
  assert.match(releaseWorkflow, /RESOLVED_SHA/);
  assert.match(releaseWorkflow, /verify_remote_tag/);
  assert.match(releaseWorkflow, /--target "\$\{EXPECTED_SHA\}"/);
  assert.match(releaseWorkflow, /--draft --verify-tag/);
  assert.match(releaseWorkflow, /gh release edit "\$\{RELEASE_TAG\}" --draft=false/);
  assert.match(releaseWorkflow, /--json isImmutable --jq \.isImmutable/);
  assert.doesNotMatch(releaseWorkflow, /needs: \[resolve, build, publish\]/);
  assert.match(releaseWorkflow, /Publish GitHub release[\s\S]*needs: \[resolve, build\]/);
  assert.match(releaseWorkflow, /Add offline provenance bundles/);
  assert.match(releaseWorkflow, /gh attestation download/);
  assert.match(releaseWorkflow, /\.intoto\.jsonl/);
  assert.doesNotMatch(releaseWorkflow, /--predicate-type https:\/\/slsa\.dev\/provenance\/v1/);
  assert.doesNotMatch(releaseWorkflow, /npm publish/);
  assert.doesNotMatch(releaseWorkflow, /--clobber/);
  assert.match(securityWorkflow, /pull_request:/);
  assert.match(securityWorkflow, /npm audit --omit=dev/);
  assert.match(securityWorkflow, /npm run test:release/);
  assert.match(securityWorkflow, /codeql-action\/analyze/);
  assert.match(securityWorkflow, /osv-scanner-reusable/);
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
    const releaseManifest = (version, overrides = {}) => ({
      architecture: process.arch,
      asset,
      installer: "install.sh",
      platform: "darwin",
      schemaVersion: 1,
      target,
      version,
      ...overrides
    });
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
      writeFile(path.join(payloadRoot, "release.json"), `${JSON.stringify(releaseManifest("9.9.9"), null, 2)}\n`, "utf8"),
      writeFile(path.join(payloadRoot, "install.sh"), await readFile(path.join(repositoryRoot, "install.sh"), "utf8"), "utf8"),
      writeFile(path.join(payloadRoot, "install.ps1"), await readFile(path.join(repositoryRoot, "install.ps1"), "utf8"), "utf8")
    ]);
    await Promise.all([
      chmod(path.join(payloadRoot, "node/bin/node"), 0o755),
      chmod(path.join(payloadRoot, "install.sh"), 0o755)
    ]);
    const archivePath = path.join(releaseRoot, asset);
    await execFileAsync("tar", ["-czf", archivePath, "-C", path.join(root, "payload"), "open-slidex"]);
    const digest = await sha256File(archivePath);
    await writeFile(path.join(releaseRoot, "SHA256SUMS.txt"), `${digest}  ${asset}\n`, "utf8");

    const environment = {
      ...process.env,
      OPEN_SLIDEX_BIN_DIR: binRoot,
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
      writeFile(path.join(payloadRoot, "release.json"), `${JSON.stringify(releaseManifest("9.9.10", { target: "windows-x64" }), null, 2)}\n`, "utf8")
    ]);
    await execFileAsync("tar", ["-czf", archivePath, "-C", path.join(root, "payload"), "open-slidex"]);
    await writeFile(
      path.join(releaseRoot, "SHA256SUMS.txt"),
      `${await sha256File(archivePath)}  ${asset}\n`,
      "utf8"
    );
    await assert.rejects(
      execFileAsync(path.join(binRoot, "slidex"), ["update"], { env: environment }),
      /release identity does not match/
    );
    assert.equal((await readFile(path.join(installRoot, "current"), "utf8")).trim(), "9.9.9");
    assert.equal((await execFileAsync(path.join(binRoot, "slidex"), ["--version"], { env: environment })).stdout, "--version");

    await writeFile(
      path.join(payloadRoot, "release.json"),
      `${JSON.stringify(releaseManifest("9.9.10"), null, 2)}\n`,
      "utf8"
    );
    await execFileAsync("tar", ["-czf", archivePath, "-C", path.join(root, "payload"), "open-slidex"]);
    await writeFile(path.join(releaseRoot, "SHA256SUMS.txt"), `${await sha256File(archivePath)}  ${asset}\n`, "utf8");
    const update = await execFileAsync(path.join(binRoot, "slidex"), ["update"], { env: environment });
    assert.match(update.stdout, /updated to 9\.9\.10/);
    assert.equal((await readFile(path.join(installRoot, "current"), "utf8")).trim(), "9.9.10");
    assert.equal((await readFile(path.join(installRoot, "versions/9.9.9/VERSION"), "utf8")).trim(), "9.9.9");
    assert.equal((await execFileAsync(path.join(binRoot, "slidex"), ["--version"], { env: environment })).stdout, "--version");
    const rollback = await execFileAsync(path.join(binRoot, "slidex"), ["rollback"], { env: environment });
    assert.match(rollback.stdout, /rolled back to 9\.9\.9/);
    assert.equal((await readFile(path.join(installRoot, "current"), "utf8")).trim(), "9.9.9");
    assert.equal((await readFile(path.join(installRoot, "previous"), "utf8")).trim(), "9.9.10");
    const uninstall = await execFileAsync(path.join(binRoot, "slidex"), ["uninstall"], { env: environment });
    assert.match(uninstall.stdout, /Workspace presentations were kept/);
    await assert.rejects(readFile(path.join(installRoot, "current"), "utf8"));
    await assert.rejects(readFile(path.join(binRoot, "slidex"), "utf8"));
    assert.equal(await readFile(path.join(root, "workspace", ".keep"), "utf8").catch(() => "kept"), "kept");
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("macOS bootstrap rejects direct and symlink-pivot traversal archives", { skip: process.platform !== "darwin" }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-traversal-test-"));
  const releaseRoot = path.join(root, "release");
  const installRoot = path.join(root, "installed");
  const binRoot = path.join(root, "bin");
  const sentinel = path.join(root, "outside-sentinel");
  try {
    await mkdir(releaseRoot, { recursive: true });
    await writeFile(sentinel, "safe", "utf8");
    const asset = standaloneAssetName(standaloneTarget());
    const archivePath = path.join(releaseRoot, asset);
    const environment = {
      ...process.env,
      OPEN_SLIDEX_BIN_DIR: binRoot,
      OPEN_SLIDEX_INSTALL_ROOT: installRoot,
      OPEN_SLIDEX_RELEASE_BASE_URL: releaseRoot,
      OPEN_SLIDEX_SKIP_PATH_UPDATE: "1"
    };
    const fixtures = [
      [{ name: "../outside-sentinel", content: "owned" }],
      [
        { name: "open-slidex/", type: "5" },
        { linkName: root, name: "open-slidex/pivot", type: "2" },
        { name: "open-slidex/pivot/outside-sentinel", content: "owned" }
      ]
    ];
    for (const fixture of fixtures) {
      await writeFile(archivePath, createTarGz(fixture));
      await writeFile(path.join(releaseRoot, "SHA256SUMS.txt"), `${await sha256File(archivePath)}  ${asset}\n`, "utf8");
      await assert.rejects(execFileAsync("sh", [path.join(repositoryRoot, "install.sh")], { env: environment }));
      assert.equal(await readFile(sentinel, "utf8"), "safe");
      await assert.rejects(readFile(path.join(installRoot, "current"), "utf8"));
    }
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

function createTarGz(entries) {
  const blocks = [];
  for (const entry of entries) {
    const type = entry.type ?? "0";
    const content = Buffer.from(entry.content ?? "");
    const header = Buffer.alloc(512);
    header.write(entry.name, 0, 100, "utf8");
    writeTarOctal(header, 100, 8, type === "5" ? 0o755 : 0o644);
    writeTarOctal(header, 108, 8, 0);
    writeTarOctal(header, 116, 8, 0);
    writeTarOctal(header, 124, 12, content.length);
    writeTarOctal(header, 136, 12, Math.floor(Date.now() / 1000));
    header.fill(0x20, 148, 156);
    header.write(type, 156, 1, "ascii");
    if (entry.linkName) header.write(entry.linkName, 157, 100, "utf8");
    header.write("ustar\0", 257, 6, "ascii");
    header.write("00", 263, 2, "ascii");
    writeTarOctal(header, 148, 8, header.reduce((sum, byte) => sum + byte, 0), true);
    blocks.push(header, content, Buffer.alloc((512 - (content.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

function writeTarOctal(buffer, offset, length, value, checksum = false) {
  const suffix = checksum ? "\0 " : "\0";
  const encoded = value.toString(8).padStart(length - suffix.length, "0") + suffix;
  buffer.write(encoded, offset, length, "ascii");
}
