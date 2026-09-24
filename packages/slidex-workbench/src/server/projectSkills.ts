import { randomUUID } from "node:crypto";
import { cp, lstat, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

import { openSlideXProjectSkillNames } from "@/core/motion-doc/domain/openSlideXProjectSkills";

export async function discoverOpenSlideXSkillTargets(invocationRoot: string) {
  const root = path.resolve(invocationRoot);
  if (await isFile(path.join(root, "presentation.tsx")) || await isFile(path.join(root, "presentation.mdx"))) return [root];

  const targets = [root];
  const workspaceRoot = path.join(root, "open-slidex-workspace");
  const entries = await readdir(workspaceRoot, { withFileTypes: true }).catch((error: unknown) => {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw error;
  });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const candidate = path.join(workspaceRoot, entry.name);
    if (await isFile(path.join(candidate, "presentation.tsx")) || await isFile(path.join(candidate, "presentation.mdx"))) targets.push(candidate);
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
  for (const skill of openSlideXProjectSkillNames) {
    if (!await isFile(path.join(skillsRoot, skill, "SKILL.md"))) {
      throw new Error(`The bundled OpenSlideX skill is missing SKILL.md: ${skill}.`);
    }
  }

  for (const targetRoot of targetRoots) {
    const target = path.join(targetRoot, ".agents", "skills");
    for (const skill of openSlideXProjectSkillNames) {
      await replaceSkillDirectory(path.join(skillsRoot, skill), path.join(target, skill));
    }
  }
  return {
    skillCount: openSlideXProjectSkillNames.length,
    targetCount: targetRoots.length
  };
}

async function replaceSkillDirectory(source: string, target: string) {
  const parent = path.dirname(target);
  const name = path.basename(target);
  const token = randomUUID();
  const staged = path.join(parent, `.${name}.${token}.new`);
  const backup = path.join(parent, `.${name}.${token}.old`);
  await mkdir(parent, { recursive: true });

  let oldSkillMoved = false;
  try {
    await cp(source, staged, { recursive: true });
    if (await lstat(target).then(() => true, (error: unknown) => {
      if (isNodeError(error) && error.code === "ENOENT") return false;
      throw error;
    })) {
      await rename(target, backup);
      oldSkillMoved = true;
    }
    try {
      await rename(staged, target);
    } catch (error) {
      if (oldSkillMoved) {
        try {
          await rename(backup, target);
          oldSkillMoved = false;
        } catch (restoreError) {
          throw new AggregateError([error, restoreError], `Could not restore ${target}; the previous skill remains at ${backup}.`);
        }
      }
      throw error;
    }
    if (oldSkillMoved) await rm(backup, { force: true, recursive: true });
  } finally {
    await rm(staged, { force: true, recursive: true });
  }
}

async function isFile(filePath: string) {
  return (await stat(filePath).catch(() => undefined))?.isFile() === true;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
