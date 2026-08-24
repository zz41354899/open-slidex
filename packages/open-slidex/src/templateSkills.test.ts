import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { openSlideXProjectSkillNames } from "@/core/motion-doc/domain/openSlideXProjectSkills";
import { parseMotionDoc, summarizeMotionDoc } from "@open-slidex/sdk";

const execFileAsync = promisify(execFile);

test("starter ships the five focused OpenSlideX skills", async () => {
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

  assert.deepEqual(entries, [...openSlideXProjectSkillNames].sort());

  for (const skillName of openSlideXProjectSkillNames) {
    const sourceSkillUrl = new URL(`${skillName}/`, skillsUrl);
    const bundledSkillUrl = new URL(`${skillName}/`, bundledSkillsUrl);
    const runtimeSkillUrl = new URL(`${skillName}/`, runtimeSkillsUrl);
    const repositorySkillUrl = new URL(`../../../.agents/skills/${skillName}/`, import.meta.url);
    const source = await readFile(new URL("SKILL.md", sourceSkillUrl), "utf8");
    assert.match(source, new RegExp(`^---\\nname: ${skillName}\\n`, "m"));
    assert.doesNotMatch(source, /TODO|slidex_local_/);
    const sourceFiles = await relativeFiles(sourceSkillUrl);
    assert.deepEqual(sourceFiles, await relativeFiles(bundledSkillUrl));
    assert.deepEqual(sourceFiles, await relativeFiles(runtimeSkillUrl));
    assert.deepEqual(sourceFiles, await relativeFiles(repositorySkillUrl));
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
      assert.equal(
        await readFile(new URL(file, repositorySkillUrl), "utf8"),
        expected
      );
    }
  }

  const designSkillUrl = new URL("slidex-deck-design/", skillsUrl);
  const designFiles = await relativeFiles(designSkillUrl);
  const styleFiles = designFiles.filter((file) => /^references\/style-s\d{2}-.+\.mdx$/.test(file));
  assert.deepEqual(
    designFiles.filter((file) => file.endsWith(".mdx") && !styleFiles.includes(file)),
    [
      "references/data-brief.mdx",
      "references/editorial-story.mdx",
      "references/product-launch.mdx",
      "references/strategy-proposal.mdx",
      "references/training-workshop.mdx"
    ]
  );
  assert.equal(styleFiles.length, 8);
  assert.deepEqual(
    styleFiles.map((file) => file.match(/style-(s\d{2})-/)?.[1]),
    ["s01", "s05", "s08", "s09", "s19", "s20", "s25", "s27"]
  );
  const compositionSignatures = new Set<string>();
  for (const file of styleFiles) {
    const source = await readFile(new URL(file, designSkillUrl), "utf8");
    const parsed = parseMotionDoc(source);
    assert.equal(summarizeMotionDoc(source).validation.isValid, true, file);
    assert.doesNotMatch(
      source,
      /One idea\. Made unmistakable|Give every signal a visible role|Compare before you decide|End on the next move/,
      `${file}: generic card-style specimen copy must not return`
    );
    assert.equal(parsed.scenes.length, 12, file);
    const styleId = file.match(/style-(s\d{2})-/)?.[1];
    assert.ok(styleId, file);
    const cover = source.match(/<Slide\b[\s\S]*?<\/Slide>/)?.[0] ?? "";
    assert.match(cover, /<ImageBlock\b[^>]*src="https:\/\/images\.unsplash\.com\/photo-[^"]+"/, `${file}: cover image`);
    assert.ok((source.match(/<ImageBlock\b/g)?.length ?? 0) >= 10, `${file}: image-led visual system`);
    assert.ok(new Set([...source.matchAll(/<ImageBlock\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1])).size >= 4, `${file}: varied image paths`);
    assert.match(source, /<Chart\b/, `${file}: native Chart teaching slide`);
    assert.match(source, /<Table\b/, `${file}: native Table teaching slide`);
    assert.doesNotMatch(source, /\bsrc="(?:data:|blob:|\/Users\/)/i, `${file}: portable media`);
    for (const shape of source.matchAll(/<Shape\b([^>]*)>/g)) {
      assert.match(shape[1], /\bid="[^"]*-card[^"]*"/, `${file}: Shape is card-only`);
      assert.match(shape[1], /\bgroupId="[^"]+"/, `${file}: card Shape needs grouped children`);
      assert.match(shape[1], /\bgroupName="[^"]*card[^"]*"/i, `${file}: card group must be named`);
    }
    assertGroupedShapeContainment(parsed, file);
    compositionSignatures.add(JSON.stringify(parsed.scenes.map((scene) => scene.blocks
      .filter((block) => block.type !== "heading")
      .map((block) => [
        block.type,
        block.props.shape,
        block.props.x,
        block.props.y,
        block.props.w,
        block.props.h,
        block.props.textAlign,
        block.props.fontSize
      ]))));
    for (const scene of parsed.scenes) {
      for (const block of scene.blocks) {
        if (block.type === "heading") continue;
        assert.match(String(block.props.id), /^s\d{2}-/, `${file}: ${block.type} needs a stable style ID`);
        for (const key of ["x", "y", "w", "h"]) assert.equal(typeof block.props[key], "number", `${file}: ${key}`);
      }
    }
  }
  assert.equal(compositionSignatures.size, 8, "Each curated style MDX needs its own complete composition signature.");

  for (const file of ["data-brief.mdx", "editorial-story.mdx", "product-launch.mdx", "strategy-proposal.mdx", "training-workshop.mdx"]) {
    const source = await readFile(new URL(`references/${file}`, designSkillUrl), "utf8");
    const parsed = parseMotionDoc(source);
    assert.equal(summarizeMotionDoc(source).validation.isValid, true, file);
    assert.equal(parsed.scenes.length, 12, file);
    const cover = source.match(/<Slide\b[\s\S]*?<\/Slide>/)?.[0] ?? "";
    assert.match(cover, /<ImageBlock\b[^>]*src="https:\/\/images\.unsplash\.com\/photo-[^"]+"/, `${file}: image-led cover`);
    assert.ok((source.match(/<ImageBlock\b/g)?.length ?? 0) >= 10, `${file}: image-led inner slides`);
    assert.ok(new Set([...source.matchAll(/<ImageBlock\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1])).size >= 4, `${file}: varied image paths`);
    assert.match(source, /<Chart\b/, `${file}: native chart`);
    assert.match(source, /<Table\b/, `${file}: native table`);
    assert.doesNotMatch(source, /\bsrc="(?:data:|blob:|\/Users\/)/i, `${file}: portable media`);
    for (const shape of source.matchAll(/<Shape\b([^>]*)>/g)) {
      assert.match(shape[1], /\bid="[^"]*-card[^"]*"/, `${file}: Shape is card-only`);
      assert.match(shape[1], /\bgroupId="[^"]+"/, `${file}: card Shape needs grouped children`);
      assert.match(shape[1], /\bgroupName="[^"]*card[^"]*"/i, `${file}: card group must be named`);
    }
    assertGroupedShapeContainment(parsed, file);
  }
});

test("skill entrypoints are discoverable and every bundled reference is reachable", async () => {
  const skillsUrl = new URL("../../slidex-workbench/skills/", import.meta.url);

  for (const skillName of openSlideXProjectSkillNames) {
    const skillUrl = new URL(`${skillName}/`, skillsUrl);
    const skillSource = await readFile(new URL("SKILL.md", skillUrl), "utf8");
    const frontmatter = skillSource.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(frontmatter, `${skillName}: SKILL.md needs YAML frontmatter`);
    const name = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
    assert.equal(name, skillName);
    assert.ok(description && description.length >= 60 && description.length <= 320, `${skillName}: description must be concise and discriminating`);

    const interfaceSource = await readFile(new URL("agents/openai.yaml", skillUrl), "utf8");
    assert.match(interfaceSource, /^interface:\s*$/m);
    assert.match(interfaceSource, /^\s+display_name:\s*"[^"]+"\s*$/m);
    assert.match(interfaceSource, /^\s+short_description:\s*"[^"]+"\s*$/m);
    assert.match(interfaceSource, new RegExp(`^\\s+default_prompt:\\s*"[^"]*\\$${skillName}[^\"]*"\\s*$`, "m"));

    const referenceFiles = (await relativeFiles(new URL("references/", skillUrl)))
      .filter((file) => /\.(?:json|md|mdx|txt)$/i.test(file));
    const pending = [{ name: "SKILL.md", source: skillSource }];
    const reachable = new Set<string>();
    for (let cursor = 0; cursor < pending.length; cursor += 1) {
      const current = pending[cursor]!;
      for (const reference of referenceFiles) {
        if (reachable.has(reference)) continue;
        if (!current.source.includes(reference) && !current.source.includes(`references/${reference}`)) continue;
        reachable.add(reference);
        pending.push({
          name: reference,
          source: await readFile(new URL(`references/${reference}`, skillUrl), "utf8")
        });
      }
    }
    assert.deepEqual(
      [...reachable].sort(),
      referenceFiles,
      `${skillName}: remove unreachable references or route to them from SKILL.md`
    );
  }
});

test("agent guides keep source import conditional and the full-design skill order focused", async () => {
  const guides = [
    new URL("../../../AGENTS.md", import.meta.url),
    new URL("../template/AGENTS.md", import.meta.url)
  ];
  const expectedOrder = [
    "slidex-mdx-authoring",
    "slidex-deck-design",
    "slidex-motion-direction",
    "slidex-deck-qa"
  ];

  for (const guideUrl of guides) {
    const guide = await readFile(guideUrl, "utf8");
    assert.match(guide, /For a supplied `\.pptx`, first load `slidex-source-import`/);
    const workflow = guide.split("Apply the project-local skills in this order for a full creation or redesign:")[1] ?? "";
    const orderedSkills = [...workflow.matchAll(/^\d+\. `([^`]+)`$/gm)].map((match) => match[1]);
    assert.deepEqual(orderedSkills, expectedOrder);
  }
});

test("the style catalog contains only MCP-consumed routing metadata", async () => {
  const designSkillUrl = new URL("../../slidex-workbench/skills/slidex-deck-design/", import.meta.url);
  const catalog = JSON.parse(
    await readFile(new URL("references/style-catalog.json", designSkillUrl), "utf8")
  ) as { schemaVersion?: unknown; styles?: Array<Record<string, unknown>> };
  assert.deepEqual(Object.keys(catalog).sort(), ["schemaVersion", "styles"]);
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.styles?.length, 8);

  const allowedStyleFields = [
    "bestFor",
    "category",
    "id",
    "industries",
    "keywords",
    "mdxResourcePath",
    "name"
  ];
  for (const style of catalog.styles ?? []) {
    assert.deepEqual(Object.keys(style).sort(), allowedStyleFields);
    const resourcePath = String(style.mdxResourcePath ?? "");
    const fileName = resourcePath.match(/\/references\/([^/]+\.mdx)$/)?.[1];
    assert.ok(fileName, `${String(style.id)} needs one direct style MDX resource path`);
    await access(new URL(`references/${fileName}`, designSkillUrl));
  }
});

function assertGroupedShapeContainment(parsed: ReturnType<typeof parseMotionDoc>, file: string) {
  for (const [sceneIndex, scene] of parsed.scenes.entries()) {
    const groups = Map.groupBy(
      scene.blocks.filter((block) => "props" in block && typeof block.props.groupId === "string"),
      (block) => String("props" in block ? block.props.groupId : "")
    );
    for (const [groupId, blocks] of groups) {
      const container = blocks.find((block) => block.type === "Shape");
      if (!container || !("props" in container)) continue;
      const containerFrame = ["x", "y", "w", "h"].map((key) => Number(container.props[key]));
      const [containerX, containerY, containerW, containerH] = containerFrame;
      for (const child of blocks) {
        if (child === container || !("props" in child)) continue;
        const childX = Number(child.props.x);
        const childY = Number(child.props.y);
        const childW = Number(child.props.w);
        const childH = Number(child.props.h);
        assert.ok(
          childX >= containerX && childY >= containerY && childX + childW <= containerX + containerW && childY + childH <= containerY + containerH,
          `${file}: slide ${sceneIndex + 1} ${String(child.props.id)} must stay inside grouped Shape ${String(container.props.id)} (${groupId})`
        );
      }
    }
  }
}

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
  assert.match(readme, /six tools total/);
  assert.match(readme, /open_slidex_source_import/);
  assert.match(readme, /Installation does not download Chromium/);
  assert.doesNotMatch(readme, /Installation attempts to download/);
  assert.doesNotMatch(readme, /\/absolute\/path\/to\/deck/);
});

test("published package and generated starter both include the Workspace path", async () => {
  const rootPackageJson = JSON.parse(
    await readFile(new URL("../../../package.json", import.meta.url), "utf8")
  ) as { version?: string };
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8")
  ) as { files?: string[]; version?: string };
  const starterPackageJson = JSON.parse(
    await readFile(new URL("../template/package.json", import.meta.url), "utf8")
  ) as { devDependencies?: Record<string, string>; scripts?: Record<string, string> };

  assert.equal(packageJson.version, rootPackageJson.version);
  assert.ok(packageJson.files?.includes("runtime"));
  assert.ok(packageJson.files?.includes("template"));
  assert.equal(starterPackageJson.devDependencies?.["open-slidex"], "latest");
  assert.equal(starterPackageJson.scripts?.dev, "open-slidex workspace");
  await access(new URL("../runtime/workbench/cli.mjs", import.meta.url));
  await access(new URL("../runtime/workbench/client/index.html", import.meta.url));
  await access(new URL("../runtime/workbench/vite.config.mjs", import.meta.url));
  assert.equal(
    await readFile(new URL("../runtime/workbench/sdk/index.js", import.meta.url), "utf8"),
    'export * from "../../sdk/index.js";\n'
  );
  assert.equal(
    await readFile(new URL("../runtime/workbench/sdk/node.js", import.meta.url), "utf8"),
    'export * from "../../sdk/node.js";\n'
  );
  await assert.rejects(() => access(new URL("../runtime/workbench/sdk/cli.js", import.meta.url)));
  await assert.rejects(() => access(new URL("../runtime/workbench/sdk/pptx-browser.js", import.meta.url)));
  await access(
    new URL(
      "../runtime/workbench/source/packages/slidex-workbench/src/client/WorkspaceHome.tsx",
      import.meta.url
    )
  );
});

test("init with an official template creates the complete localized deck", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "open-slidex-init-template-"));
  try {
    const packageManifest = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8")
    ) as { version: string };
    const tsxLoaderPath = fileURLToPath(import.meta.resolve("tsx"));
    const projectRoot = path.join(tempRoot, "project");
    await execFileAsync(
      process.execPath,
      [
        "--import",
        tsxLoaderPath,
        fileURLToPath(new URL("./cli.ts", import.meta.url)),
        projectRoot,
        "--template",
        "summer-time-report",
        "--locale",
        "zh-TW",
        "--no-install"
      ],
      { cwd: process.cwd() }
    );

    const projectManifest = JSON.parse(
      await readFile(path.join(projectRoot, "package.json"), "utf8")
    ) as { devDependencies?: Record<string, string>; version?: string };
    assert.equal(projectManifest.version, packageManifest.version);
    assert.equal(
      projectManifest.devDependencies?.["open-slidex"],
      packageManifest.version,
      "A generated starter must install the same runtime version as the CLI that created it."
    );

    const deckRoot = path.join(
      tempRoot,
      "project",
      "open-slidex-workspace",
      "summer-time-report"
    );
    const source = await readFile(path.join(deckRoot, "presentation.mdx"), "utf8");
    assert.equal(source.match(/<Slide\b/g)?.length, 7);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(deckRoot, ".open-slidex", "template-lock.json"), "utf8")),
      { id: "summer-time-report", locale: "zh-TW", version: "1.0.0" }
    );
    const deckManifest = JSON.parse(
      await readFile(path.join(deckRoot, "package.json"), "utf8")
    ) as { devDependencies?: Record<string, string>; version?: string };
    assert.equal(deckManifest.version, packageManifest.version);
    assert.equal(deckManifest.devDependencies?.["open-slidex"], packageManifest.version);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
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
