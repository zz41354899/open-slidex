import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  openSlideXProjectSkillNames,
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
    assert.equal(manifest.skills.length, 4);
    assert.equal("content" in manifest.skills[0]!, false);
    assert.equal("content" in manifest.skills[1]!.references[0]!, false);
    assert.match(manifest.skills[0]!.checksum, /^[0-9a-f]{64}$/);
    assert.deepEqual(
      manifest.skills[1]!.references.map((resource) => resource.path),
      [
        ".agents/skills/slidex-deck-design/references/data-brief.mdx",
        ".agents/skills/slidex-deck-design/references/source-to-story.md"
      ]
    );
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
