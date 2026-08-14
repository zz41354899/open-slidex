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
  const runtimeSkillsUrl = new URL("../runtime/skills/", import.meta.url);
  const entries = (await readdir(skillsUrl, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(entries, [...skillNames].sort());

  for (const skillName of skillNames) {
    const sourceSkillUrl = new URL(`${skillName}/`, skillsUrl);
    const bundledSkillUrl = new URL(`${skillName}/`, bundledSkillsUrl);
    const runtimeSkillUrl = new URL(`${skillName}/`, runtimeSkillsUrl);
    const source = await readFile(new URL("SKILL.md", sourceSkillUrl), "utf8");
    assert.match(source, new RegExp(`^---\\nname: ${skillName}\\n`, "m"));
    assert.doesNotMatch(source, /TODO|slidex_local_/);
    const sourceFiles = await relativeFiles(sourceSkillUrl);
    assert.deepEqual(sourceFiles, await relativeFiles(bundledSkillUrl));
    assert.deepEqual(sourceFiles, await relativeFiles(runtimeSkillUrl));
    for (const file of sourceFiles) {
      const expected = await readFile(new URL(file, bundledSkillUrl), "utf8");
      assert.equal(
        await readFile(new URL(file, sourceSkillUrl), "utf8"),
        expected
      );
      assert.equal(
        await readFile(new URL(file, runtimeSkillUrl), "utf8"),
        expected
      );
    }
  }

  const designFiles = await relativeFiles(new URL("slidex-deck-design/", skillsUrl));
  assert.deepEqual(
    designFiles.filter((file) => file.endsWith(".mdx")),
    [
      "references/data-brief.mdx",
      "references/editorial-story.mdx",
      "references/product-launch.mdx",
      "references/strategy-proposal.mdx",
      "references/training-workshop.mdx"
    ]
  );
});

test("starter contains the local Workbench and SDK without project-scoped MCP", async () => {
  const templateUrl = new URL("../template/", import.meta.url);
  const packageJson = JSON.parse(
    await readFile(new URL("package.json", templateUrl), "utf8")
  ) as {
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };

  assert.deepEqual(packageJson.devDependencies, {
    "open-slidex": "latest"
  });
  assert.equal(packageJson.scripts?.dev, "open-slidex workspace");
  assert.equal(packageJson.scripts?.["dev:workbench"], undefined);
  assert.equal(packageJson.scripts?.build, undefined);
  assert.equal(packageJson.scripts?.preview, undefined);
  assert.equal(packageJson.scripts?.mcp, undefined);
  assert.equal(packageJson.scripts?.["sync:skills"], "open-slidex sync:skills");
  for (const removedScript of ["validate", "render", "export:html", "export:mdx", "export:pptx"]) {
    assert.equal(packageJson.scripts?.[removedScript], undefined);
  }

  await assert.rejects(() => access(new URL("presentation.mdx", templateUrl)));
  await access(new URL("AGENTS.md", templateUrl));
  await access(new URL("CLAUDE.md", templateUrl));
  await access(new URL("assets", templateUrl));
  await access(new URL("knowledge", templateUrl));
  await assert.rejects(() => access(new URL("ref", templateUrl)));
  await access(new URL("themes", templateUrl));
  const starterGitignore = await readFile(new URL("gitignore", templateUrl), "utf8");
  assert.match(starterGitignore, /^\.open-slidex\/$/m);
  assert.match(starterGitignore, /^open-slidex-workspace\/$/m);
  for (const removedPath of [
    ".codex/config.toml",
    ".mcp.json",
    "MCP.md",
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
  const starterReadme = await readFile(new URL("README.md", templateUrl), "utf8");
  assert.doesNotMatch(
    packageSource,
    /slidex-local-mcp|slidex-editor|next|react|supabase/i
  );
  assert.match(starterReadme, /does not need a project-level `vite\.config\.mjs`/);
  assert.match(starterReadme, /ships the tested Vite configuration/);
});

async function relativeFiles(root: URL, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await relativeFiles(new URL(`${entry.name}/`, root), `${relative}/`));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files.sort();
}

test("published README documents single-package install and workspace-global MCP setup", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  assert.match(readme, /npx open-slidex@latest init my-deck/);
  assert.match(readme, /only development\s+dependency/);
  assert.match(readme, /open-slidex mcp --workspace/);
  assert.match(readme, /Workspace Settings/);
  assert.match(readme, /five tools total/);
  assert.doesNotMatch(readme, /\/absolute\/path\/to\/deck/);
});

test("published package and generated starter both include the Workspace path", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8")
  ) as { files?: string[]; version?: string };
  const starterPackageJson = JSON.parse(
    await readFile(new URL("../template/package.json", import.meta.url), "utf8")
  ) as { devDependencies?: Record<string, string>; scripts?: Record<string, string> };

  assert.equal(packageJson.version, "0.3.5");
  assert.ok(packageJson.files?.includes("runtime"));
  assert.ok(packageJson.files?.includes("template"));
  assert.equal(starterPackageJson.devDependencies?.["open-slidex"], "latest");
  assert.equal(starterPackageJson.scripts?.dev, "open-slidex workspace");
  await access(new URL("../runtime/workbench/cli.mjs", import.meta.url));
  await access(new URL("../runtime/workbench/client/index.html", import.meta.url));
  await access(new URL("../runtime/workbench/vite.config.mjs", import.meta.url));
  await access(
    new URL(
      "../runtime/workbench/source/packages/slidex-workbench/src/client/WorkspaceHome.tsx",
      import.meta.url
    )
  );
});

test("repository root launches its bundled CLI without a workspace bin link", async () => {
  const rootPackageJson = JSON.parse(
    await readFile(new URL("../../../package.json", import.meta.url), "utf8")
  ) as { scripts?: Record<string, string> };

  assert.equal(
    rootPackageJson.scripts?.dev,
    "node packages/open-slidex/dist/cli.mjs workspace"
  );
  assert.equal(
    rootPackageJson.scripts?.workspace,
    "node packages/open-slidex/dist/cli.mjs workspace"
  );
  assert.equal(rootPackageJson.scripts?.["dev:workbench"], undefined);
  assert.equal(
    rootPackageJson.scripts?.mcp,
    "node packages/open-slidex/dist/cli.mjs mcp --workspace open-slidex-workspace"
  );
});
