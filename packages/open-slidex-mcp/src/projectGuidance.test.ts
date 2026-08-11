import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  openSlideXProjectSkillNames,
  readOpenSlideXProjectSkill,
  readOpenSlideXProjectSkillBundle,
  readOpenSlideXProjectSkillManifest
} from "./projectGuidance";

test("project skill reader allows approved files and rejects symlink escape", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-guidance-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "open-slidex-guidance-outside-"));
  try {
    const skillRoot = path.join(root, ".agents", "skills", "slidex-deck-design");
    await mkdir(skillRoot, { recursive: true });
    await writeFile(path.join(skillRoot, "SKILL.md"), "# Approved\n", "utf8");
    assert.match((await readOpenSlideXProjectSkill(root, "slidex-deck-design")).content, /Approved/);

    await rm(path.join(skillRoot, "SKILL.md"));
    await writeFile(path.join(outside, "SKILL.md"), "# Escaped\n", "utf8");
    await symlink(path.join(outside, "SKILL.md"), path.join(skillRoot, "SKILL.md"));
    await assert.rejects(() => readOpenSlideXProjectSkill(root, "slidex-deck-design"), /escapes/);
  } finally {
    await rm(root, { force: true, recursive: true });
    await rm(outside, { force: true, recursive: true });
  }
});

test("project guidance returns task-scoped bundles and a checksum manifest", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-guidance-bundle-"));
  try {
    await Promise.all(openSlideXProjectSkillNames.map(async (skill) => {
      const skillRoot = path.join(root, ".agents", "skills", skill);
      await mkdir(skillRoot, { recursive: true });
      await writeFile(
        path.join(skillRoot, "SKILL.md"),
        `---\nname: ${skill}\ndescription: Guidance for ${skill}.\n---\n\n# ${skill}\n`,
        "utf8"
      );
    }));

    const manifest = await readOpenSlideXProjectSkillManifest(root);
    assert.equal(manifest.mode, "manifest");
    assert.equal(manifest.skills.length, 4);
    assert.deepEqual(manifest.intents.motion, ["slidex-mdx-authoring", "slidex-motion-direction", "slidex-deck-qa"]);
    assert.match(manifest.skills[0]?.checksum ?? "", /^[0-9a-f]{64}$/);
    assert.equal("content" in (manifest.skills[0] ?? {}), false);

    const bundle = await readOpenSlideXProjectSkillBundle(root, "design");
    assert.equal(bundle.mode, "bundle");
    assert.deepEqual(bundle.order, ["slidex-mdx-authoring", "slidex-deck-design", "slidex-deck-qa"]);
    assert.equal(bundle.skills.length, 3);
    assert.ok(bundle.totalBytes > 0);
    assert.match(bundle.skills[1]?.description ?? "", /slidex-deck-design/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
