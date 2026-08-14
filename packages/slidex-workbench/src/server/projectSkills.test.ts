import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverOpenSlideXSkillTargets, syncOpenSlideXProjectSkills } from "./projectSkills";

test("skill sync updates the starter and every existing inner deck recursively", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-skill-sync-"));
  context.after(async () => rm(root, { force: true, recursive: true }));
  const skillsRoot = path.join(root, "bundled-skills");
  const sourceSkill = path.join(skillsRoot, "slidex-deck-design");
  await mkdir(path.join(sourceSkill, "references"), { recursive: true });
  await writeFile(path.join(sourceSkill, "SKILL.md"), "# Current skill\n", "utf8");
  await writeFile(path.join(sourceSkill, "references", "source-to-story.md"), "# Current reference\n", "utf8");

  const workspaceRoot = path.join(root, "open-slidex-workspace");
  const deckRoot = path.join(workspaceRoot, "alpha");
  await mkdir(path.join(deckRoot, ".agents", "skills", "slidex-deck-design"), { recursive: true });
  await writeFile(path.join(deckRoot, "presentation.mdx"), "# Alpha\n\n<Slide></Slide>\n", "utf8");
  await writeFile(path.join(deckRoot, ".agents", "skills", "slidex-deck-design", "stale.md"), "stale\n", "utf8");

  const targets = await discoverOpenSlideXSkillTargets(root);
  assert.deepEqual(targets, [root, deckRoot]);
  assert.deepEqual(await syncOpenSlideXProjectSkills(skillsRoot, targets), { skillCount: 1, targetCount: 2 });

  for (const target of targets) {
    assert.match(
      await readFile(path.join(target, ".agents", "skills", "slidex-deck-design", "references", "source-to-story.md"), "utf8"),
      /Current reference/
    );
  }
  await assert.rejects(() => access(path.join(deckRoot, ".agents", "skills", "slidex-deck-design", "stale.md")));
});

test("skill sync targets only the current project when run inside a deck", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-skill-project-"));
  context.after(async () => rm(root, { force: true, recursive: true }));
  await writeFile(path.join(root, "presentation.mdx"), "# Deck\n\n<Slide></Slide>\n", "utf8");
  assert.deepEqual(await discoverOpenSlideXSkillTargets(root), [root]);
});
