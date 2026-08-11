import assert from "node:assert/strict";
import {
  access,
  readFile,
  readdir
} from "node:fs/promises";
import test from "node:test";

const skillNames = [
  "slidex-mdx-authoring",
  "slidex-deck-design",
  "slidex-motion-direction",
  "slidex-deck-qa"
] as const;

test("starter ships only the four focused MDX-first skills", async () => {
  const skillsUrl = new URL("../template/.agents/skills/", import.meta.url);
  const bundledSkillsUrl = new URL(
    "../../slidex-workbench/skills/",
    import.meta.url
  );
  const entries = (await readdir(skillsUrl, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(entries, [...skillNames].sort());

  for (const skillName of skillNames) {
    const source = await readFile(
      new URL(`${skillName}/SKILL.md`, skillsUrl),
      "utf8"
    );
    assert.match(source, new RegExp(`^---\\nname: ${skillName}\\n`, "m"));
    assert.doesNotMatch(source, /TODO|slidex_local_/);
    assert.equal(
      source,
      await readFile(new URL(`${skillName}/SKILL.md`, bundledSkillsUrl), "utf8")
    );
  }
});

test("starter contains the local Workbench, SDK, and project-scoped MCP", async () => {
  const templateUrl = new URL("../template/", import.meta.url);
  const packageJson = JSON.parse(
    await readFile(new URL("package.json", templateUrl), "utf8")
  ) as {
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };

  assert.deepEqual(packageJson.devDependencies, {
    "open-slidex": "0.2.4"
  });
  assert.equal(packageJson.scripts?.dev, "open-slidex dev");
  assert.equal(packageJson.scripts?.build, "open-slidex build");
  assert.equal(packageJson.scripts?.preview, "open-slidex preview");
  assert.equal(packageJson.scripts?.mcp, "open-slidex mcp --project .");
  assert.equal(packageJson.scripts?.["sync:skills"], "open-slidex sync:skills");
  assert.deepEqual({
    validate: packageJson.scripts?.validate,
    render: packageJson.scripts?.render,
    "export:html": packageJson.scripts?.["export:html"],
    "export:mdx": packageJson.scripts?.["export:mdx"],
    "export:pptx": packageJson.scripts?.["export:pptx"]
  }, {
    validate: "open-slidex validate presentation.mdx",
    render: "open-slidex render presentation.mdx --montage --out dist/montage.png",
    "export:html":
      "open-slidex export presentation.mdx --format html --out dist/presentation.html --overwrite",
    "export:mdx":
      "open-slidex export presentation.mdx --format mdx --out dist/presentation.mdx --overwrite",
    "export:pptx":
      "open-slidex export presentation.mdx --format pptx --out dist/presentation.pptx --overwrite"
  });

  await access(new URL("presentation.mdx", templateUrl));
  await access(new URL("AGENTS.md", templateUrl));
  await access(new URL("CLAUDE.md", templateUrl));
  await access(new URL("assets", templateUrl));
  await access(new URL("knowledge", templateUrl));
  await access(new URL("themes", templateUrl));
  await access(new URL(".codex/config.toml", templateUrl));
  await access(new URL(".mcp.json", templateUrl));
  await access(new URL("MCP.md", templateUrl));

  for (const removedPath of [
    "app",
    "components",
    "features",
    "next.config.mjs",
    "slidex.config.ts",
    "tsconfig.json"
  ]) {
    await assert.rejects(() => access(new URL(removedPath, templateUrl)));
  }

  const packageSource = await readFile(new URL("package.json", templateUrl), "utf8");
  assert.doesNotMatch(
    packageSource,
    /slidex-local-mcp|slidex-editor|next|react|supabase/i
  );
});

test("starter MCP files launch the project-local OpenSlideX server", async () => {
  const templateUrl = new URL("../template/", import.meta.url);
  const codex = await readFile(new URL(".codex/config.toml", templateUrl), "utf8");
  const claude = JSON.parse(await readFile(new URL(".mcp.json", templateUrl), "utf8")) as {
    mcpServers?: Record<string, { args?: string[]; command?: string; type?: string }>;
  };
  const guide = await readFile(new URL("MCP.md", templateUrl), "utf8");

  assert.match(codex, /\[mcp_servers\.open_slidex\]/);
  assert.match(codex, /command = "npm"/);
  assert.match(codex, /args = \["--silent", "run", "mcp"\]/);
  assert.equal(claude.mcpServers?.open_slidex?.type, "stdio");
  assert.equal(claude.mcpServers?.open_slidex?.command, "npm");
  assert.deepEqual(claude.mcpServers?.open_slidex?.args, ["--silent", "run", "mcp"]);
  assert.match(guide, /open_slidex_open/);
  assert.match(guide, /open_slidex_edit/);
  assert.match(guide, /open_slidex_render/);
});

test("published README documents single-package install and real-path MCP setup", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  assert.match(readme, /npx open-slidex@0\.2\.4 init my-deck/);
  assert.match(readme, /only development\s+dependency/);
  assert.match(readme, /open-slidex mcp --print-config codex/);
  assert.match(readme, /--project "\$PWD"/);
  assert.doesNotMatch(readme, /\/absolute\/path\/to\/deck/);
});

test("repository root launches its bundled CLI without a workspace bin link", async () => {
  const rootPackageJson = JSON.parse(
    await readFile(new URL("../../../package.json", import.meta.url), "utf8")
  ) as { scripts?: Record<string, string> };

  assert.equal(
    rootPackageJson.scripts?.dev,
    "node packages/open-slidex/dist/cli.mjs dev"
  );
  assert.equal(
    rootPackageJson.scripts?.mcp,
    "node packages/open-slidex/dist/cli.mjs mcp --project ."
  );
});
