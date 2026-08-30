import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(repositoryRoot, "packages/open-slidex");
const expectedSkills = [
  "slidex-deck-design",
  "slidex-deck-qa",
  "slidex-html-authoring",
  "slidex-mdx-authoring",
  "slidex-motion-direction",
  "slidex-source-import"
];
const expectedTools = [
  "open_slidex_edit",
  "open_slidex_media",
  "open_slidex_read",
  "open_slidex_review",
  "open_slidex_source_import",
  "open_slidex_workspace"
];

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "open-slidex-release-"));
const npmEnvironment = {
  ...process.env,
  npm_config_cache: path.join(tempRoot, "npm-cache")
};
let client;
try {
  const packageManifest = await readJson(path.join(packageRoot, "package.json"));
  const packRoot = path.join(tempRoot, "pack");
  await mkdir(packRoot, { recursive: true });
  const { stdout: packOutput } = await execFileAsync(
    npmCommand(),
    ["pack", packageRoot, "--ignore-scripts", "--json", "--pack-destination", packRoot],
    { cwd: repositoryRoot, env: npmEnvironment, maxBuffer: 20 * 1024 * 1024 }
  );
  const packed = JSON.parse(packOutput)[0];
  assert.equal(packed.version, packageManifest.version);
  const packedFiles = new Set(
    packed.files.map(({ path: filePath }) => filePath.replace(/^package\//, ""))
  );
  for (const required of [
    "dist/cli.mjs",
    "dist/create.mjs",
    "runtime/mcp/server.mjs",
    "runtime/sdk/index.js",
    "runtime/workbench/cli.mjs",
    "runtime/workbench/sdk/index.js",
    "runtime/workbench/sdk/node.js",
    "template/AGENTS.md",
    "template/package.json",
    "template/README.md"
  ]) {
    assert.ok(packedFiles.has(required), `packed release is missing ${required}`);
  }
  for (const skill of expectedSkills) {
    assert.ok(packedFiles.has(`runtime/skills/${skill}/SKILL.md`), `runtime is missing ${skill}`);
    assert.ok(packedFiles.has(`template/.agents/skills/${skill}/SKILL.md`), `starter is missing ${skill}`);
  }
  for (const reference of [
    "slidex-deck-design/references/consulting-financial-report.md",
    "slidex-deck-design/references/consulting-financial-report.mdx",
    "slidex-deck-design/references/data-brief.mdx",
    "slidex-deck-design/references/editorial-story.mdx",
    "slidex-deck-design/references/product-launch.mdx",
    "slidex-deck-design/references/strategy-proposal.mdx",
    "slidex-deck-design/references/training-workshop.mdx",
    "slidex-deck-design/references/template-catalog.json",
    "slidex-html-authoring/references/ref-idaeo-nov.md",
    "slidex-motion-direction/references/long-deck-motion.md"
  ]) {
    assert.ok(packedFiles.has(`runtime/skills/${reference}`), `runtime is missing ${reference}`);
    assert.ok(packedFiles.has(`template/.agents/skills/${reference}`), `starter is missing ${reference}`);
  }
  for (const filePath of packedFiles) {
    assert.doesNotMatch(filePath, /(?:^|\/)\.DS_Store$/);
    assert.doesNotMatch(filePath, /onboarding-export\.mp4$/);
    assert.doesNotMatch(filePath, /deckPlan(?:Materializer|Template|V1)/);
    assert.doesNotMatch(filePath, /slidex-deck-design\/references\/style-(?:catalog|selection|s\d{2})/);
  }
  assert.ok(!packedFiles.has("runtime/workbench/sdk/cli.js"), "the runtime must not duplicate the full SDK");
  assert.ok(!packedFiles.has("runtime/workbench/sdk/pptx-browser.js"), "the runtime must not duplicate the full SDK");

  const archivePath = path.join(packRoot, packed.filename);
  const installRoot = path.join(tempRoot, "install");
  await mkdir(installRoot, { recursive: true });
  await writeFile(
    path.join(installRoot, "package.json"),
    `${JSON.stringify({ name: "open-slidex-release-smoke", private: true, version: "0.0.0" }, null, 2)}\n`,
    "utf8"
  );
  await execFileAsync(
    npmCommand(),
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", archivePath],
    { cwd: installRoot, env: npmEnvironment, maxBuffer: 20 * 1024 * 1024 }
  );

  const installedPackageRoot = path.join(installRoot, "node_modules/open-slidex");
  const cliPath = path.join(installedPackageRoot, "dist/cli.mjs");
  const { stdout: versionOutput } = await execFileAsync(process.execPath, [cliPath, "--version"], {
    cwd: installRoot
  });
  assert.equal(versionOutput.trim(), packageManifest.version);

  const workbenchCliPath = path.join(installedPackageRoot, "runtime/workbench/cli.mjs");
  const { stdout: workbenchVersionOutput } = await execFileAsync(process.execPath, [workbenchCliPath, "--version"], {
    cwd: installRoot
  });
  assert.equal(workbenchVersionOutput.trim(), packageManifest.version);

  const workbenchSdk = await import(
    `${pathToFileURL(path.join(installedPackageRoot, "runtime/workbench/sdk/index.js")).href}?release-smoke=${Date.now()}`
  );
  assert.equal(typeof workbenchSdk.parseMotionDoc, "function", "the Workbench SDK bridge must resolve");

  const starterRoot = path.join(tempRoot, "starter");
  await execFileAsync(process.execPath, [cliPath, "init", starterRoot, "--no-install"], {
    cwd: tempRoot,
    maxBuffer: 20 * 1024 * 1024
  });
  const starterManifest = await readJson(path.join(starterRoot, "package.json"));
  assert.equal(starterManifest.version, packageManifest.version);
  assert.equal(starterManifest.devDependencies?.["open-slidex"], packageManifest.version);
  assert.deepEqual(
    (await readdir(path.join(starterRoot, ".agents/skills"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(),
    [...expectedSkills].sort()
  );

  await execFileAsync(
    npmCommand(),
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", "--no-save", archivePath],
    { cwd: starterRoot, env: npmEnvironment, maxBuffer: 20 * 1024 * 1024 }
  );
  const starterCliPath = path.join(starterRoot, "node_modules/open-slidex/dist/cli.mjs");
  const { stdout: starterVersionOutput } = await execFileAsync(process.execPath, [starterCliPath, "--version"], {
    cwd: starterRoot
  });
  assert.equal(starterVersionOutput.trim(), packageManifest.version);

  const workspaceRoot = path.join(starterRoot, "open-slidex-workspace");
  const transport = new StdioClientTransport({
    args: [starterCliPath, "mcp", "--workspace", workspaceRoot],
    command: process.execPath,
    cwd: starterRoot,
    stderr: "pipe"
  });
  client = new Client(
    { name: "open-slidex-release-smoke", version: "1.0.0" },
    { versionNegotiation: { mode: "auto" } }
  );
  await client.connect(transport);
  assert.ok(client.getDiscoverResult(), "the packed MCP must negotiate the current 2026 protocol over stdio");
  assert.equal(client.getServerVersion()?.version, packageManifest.version);
  const instructions = client.getInstructions() ?? "";
  assert.ok(instructions.length > 0 && instructions.length <= 512);
  assert.match(instructions, /open_slidex_workspace/);
  assert.match(instructions, /open_slidex_read/);
  assert.match(instructions, /expectedRevision/);
  assert.match(instructions, /rendered QA/);
  assert.match(instructions, /SvgBlock/);
  assert.match(instructions, /opaque-origin/);
  assert.doesNotMatch(instructions, /open_slidex_html/);
  assert.doesNotMatch(instructions, /30 style/i);

  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), expectedTools);
  const media = tools.tools.find((tool) => tool.name === "open_slidex_media");
  const mediaProperties = media?.inputSchema?.properties ?? {};
  assert.ok(
    mediaProperties.action?.enum?.includes("ingest-source"),
    "the six-tool MCP must expose document intake through open_slidex_media"
  );
  assert.deepEqual(Object.keys(mediaProperties).sort(), [
    "action",
    "confirmedByUser",
    "expectedRevision",
    "filePath",
    "providerAssetId",
    "query"
  ]);
  const read = tools.tools.find((tool) => tool.name === "open_slidex_read");
  assert.match(read?.description ?? "", /canonical browser-native HTML/);
  assert.match(String(read?.inputSchema?.properties?.sourceFormat?.description ?? ""), /HTML/);
  const edit = tools.tools.find((tool) => tool.name === "open_slidex_edit");
  assert.match(edit?.description ?? "", /browser-native HTML/);
  for (const tool of tools.tools) {
    for (const [propertyName, property] of Object.entries(tool.inputSchema?.properties ?? {})) {
      assert.ok(
        typeof property.description === "string" && property.description.length > 0,
        `${tool.name}.${propertyName} needs an AI-readable description`
      );
    }
  }
  const listed = structured(await client.callTool({
    arguments: { action: "list" },
    name: "open_slidex_workspace"
  }));
  assert.deepEqual(listed.presentations, []);

  process.stdout.write(
    `OpenSlideX ${packageManifest.version} release smoke passed: packed, clean-installed, starter-installed, initialized, and connected to ${expectedTools.length} MCP tools.\n`
  );
} finally {
  await client?.close().catch(() => undefined);
  await rm(tempRoot, { force: true, recursive: true });
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function structured(result) {
  if (result.structuredContent && typeof result.structuredContent === "object") {
    return result.structuredContent;
  }
  const text = result.content?.find((item) => item.type === "text")?.text;
  assert.ok(text, "MCP result needs structured content or JSON text");
  return JSON.parse(text);
}
