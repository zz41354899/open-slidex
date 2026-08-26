import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  openSlideXProjectSkillNames,
  recommendOpenSlideXStyles,
  readOpenSlideXProjectGuidanceManifest,
  readOpenSlideXProjectGuidanceResource
} from "./projectGuidance";

test("guidance manifest exposes metadata and routes resources without eager content", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-guidance-manifest-"));
  try {
    await seedSkills(root);
    const manifest = await readOpenSlideXProjectGuidanceManifest(root, "create");

    assert.equal(manifest.mode, "manifest");
    assert.deepEqual(manifest.recommended, [
      "slidex-mdx-authoring",
      "slidex-deck-design",
      "slidex-motion-direction",
      "slidex-deck-qa"
    ]);
    assert.equal(manifest.skills.length, 6);
    assert.equal("content" in manifest.skills[0]!, false);
    const designSkill = manifest.skills.find((skill) => skill.skill === "slidex-deck-design");
    assert.ok(designSkill);
    assert.equal("content" in designSkill.references[0]!, false);
    assert.match(manifest.skills[0]!.checksum, /^[0-9a-f]{64}$/);
    assert.deepEqual(
      designSkill.references.map((resource) => resource.path),
      [
        ".agents/skills/slidex-deck-design/references/data-brief.mdx",
        ".agents/skills/slidex-deck-design/references/source-to-story.md"
      ]
    );
    const imported = await readOpenSlideXProjectGuidanceManifest(root, "import");
    assert.deepEqual(imported.recommended, [
      "slidex-source-import",
      "slidex-mdx-authoring",
      "slidex-deck-design",
      "slidex-motion-direction",
      "slidex-deck-qa"
    ]);
    const html = await readOpenSlideXProjectGuidanceManifest(root, "html");
    assert.deepEqual(html.recommended, [
      "slidex-html-authoring",
      "slidex-deck-design",
      "slidex-motion-direction",
      "slidex-deck-qa"
    ]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("guidance resource reader loads one approved direct file and rejects path or symlink escape", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-guidance-resource-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "open-slidex-guidance-outside-"));
  try {
    await seedSkills(root);
    const selected = await readOpenSlideXProjectGuidanceResource(
      root,
      ".agents/skills/slidex-deck-design/references/source-to-story.md"
    );
    assert.equal(selected.kind, "reference");
    assert.match(selected.content, /Source to story/);
    assert.match(selected.checksum, /^[0-9a-f]{64}$/);

    await assert.rejects(
      () => readOpenSlideXProjectGuidanceResource(root, ".agents/skills/slidex-deck-design/agents/openai.yaml"),
      /SKILL\.md or one direct file/
    );
    await assert.rejects(
      () => readOpenSlideXProjectGuidanceResource(root, ".agents/skills/slidex-deck-design/references/../SKILL.md"),
      /exact path/
    );

    const referenceRoot = path.join(root, ".agents", "skills", "slidex-deck-design", "references");
    await writeFile(path.join(outside, "escaped.md"), "# Escaped\n", "utf8");
    await symlink(path.join(outside, "escaped.md"), path.join(referenceRoot, "escaped.md"));
    await assert.rejects(
      () => readOpenSlideXProjectGuidanceResource(
        root,
        ".agents/skills/slidex-deck-design/references/escaped.md"
      ),
      /escapes/
    );
  } finally {
    await rm(root, { force: true, recursive: true });
    await rm(outside, { force: true, recursive: true });
  }
});

test("an older project without the source-import skill remains readable", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-guidance-older-project-"));
  try {
    await seedSkills(root);
    await rm(path.join(root, ".agents", "skills", "slidex-source-import"), { force: true, recursive: true });
    const authoring = await readOpenSlideXProjectGuidanceManifest(root, "authoring");
    assert.deepEqual(authoring.recommended, ["slidex-mdx-authoring"]);
    const imported = await readOpenSlideXProjectGuidanceManifest(root, "import");
    assert.deepEqual(imported.missingSkills, ["slidex-source-import"]);
    assert.deepEqual(imported.recommended, [
      "slidex-mdx-authoring",
      "slidex-deck-design",
      "slidex-motion-direction",
      "slidex-deck-qa"
    ]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("style recommendation ranks one of eight curated native MDX directions from a Chinese report summary", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-style-recommendation-"));
  try {
    await seedSkills(root);
    await writeStyleCatalog(root);
    const result = await recommendOpenSlideXStyles(root, "董事會營運報告，需要企業、乾淨、可信任的視覺方向");

    assert.equal(result.recommendations.length, 3);
    assert.equal(result.recommendations[0]?.id, "S09");
    assert.match(result.recommendations[0]?.mdxResourcePath ?? "", /style-s09-/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

async function seedSkills(root: string) {
  await Promise.all(openSlideXProjectSkillNames.map(async (skill) => {
    const skillRoot = path.join(root, ".agents", "skills", skill);
    await mkdir(path.join(skillRoot, "references"), { recursive: true });
    await writeFile(
      path.join(skillRoot, "SKILL.md"),
      `---\nname: ${skill}\ndescription: Guidance for ${skill}.\n---\n\n# ${skill}\n`,
      "utf8"
    );
    if (skill === "slidex-deck-design") {
      await writeFile(path.join(skillRoot, "references", "source-to-story.md"), "# Source to story\n", "utf8");
      await writeFile(path.join(skillRoot, "references", "data-brief.mdx"), "# Data brief\n", "utf8");
    }
  }));
}

async function writeStyleCatalog(root: string) {
  const referenceRoot = path.join(root, ".agents", "skills", "slidex-deck-design", "references");
  const selectedIds = ["S01", "S05", "S08", "S09", "S19", "S20", "S25", "S27"];
  const styles = selectedIds.map((id) => {
    const isCorporate = id === "S09";
    return {
      bestFor: isCorporate ? ["board update", "report"] : ["editorial story"],
      category: isCorporate ? "Professional" : "Creative",
      id,
      industries: isCorporate ? ["Corporate"] : ["Creative"],
      keywords: isCorporate ? ["企業", "董事會", "營運", "報告", "乾淨", "可信任"] : [id],
      mdxResourcePath: `.agents/skills/slidex-deck-design/references/style-${id.toLowerCase()}-curated.mdx`,
      name: isCorporate ? "Corporate Clean" : `Style ${id}`
    };
  });
  await writeFile(path.join(referenceRoot, "style-catalog.json"), `${JSON.stringify({ schemaVersion: 1, styles })}\n`, "utf8");
}
