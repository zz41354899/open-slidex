import { cp, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import { openSlideXProjectSkillNames } from "@/core/motion-doc/domain/openSlideXProjectSkills";

export async function discoverOpenSlideXSkillTargets(invocationRoot: string) {
  const root = path.resolve(invocationRoot);
  if (await isFile(path.join(root, "presentation.mdx"))) return [root];

  const targets = [root];
  const workspaceRoot = path.join(root, "open-slidex-workspace");
  const entries = await readdir(workspaceRoot, { withFileTypes: true }).catch((error: unknown) => {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw error;
  });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const candidate = path.join(workspaceRoot, entry.name);
    if (await isFile(path.join(candidate, "presentation.mdx"))) targets.push(candidate);
  }
  return targets;
}

export async function syncOpenSlideXProjectSkills(skillsRoot: string, targetRoots: readonly string[]) {
  const sourceEntries = await readdir(skillsRoot, { withFileTypes: true });
  const available = new Set(
    sourceEntries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
  );
  const missing = openSlideXProjectSkillNames.filter((skill) => !available.has(skill));
  if (missing.length > 0) {
    throw new Error(`The bundled OpenSlideX skills are incomplete: ${missing.join(", ")}.`);
  }

  for (const targetRoot of targetRoots) {
    const target = path.join(targetRoot, ".agents", "skills");
    for (const skill of openSlideXProjectSkillNames) {
      const targetSkill = path.join(target, skill);
      await rm(targetSkill, { force: true, recursive: true });
      await cp(path.join(skillsRoot, skill), targetSkill, { recursive: true });
    }
  }
  return {
    skillCount: openSlideXProjectSkillNames.length,
    targetCount: targetRoots.length
  };
}

async function isFile(filePath: string) {
  return (await stat(filePath).catch(() => undefined))?.isFile() === true;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
