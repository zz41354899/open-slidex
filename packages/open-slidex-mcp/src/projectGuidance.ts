import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { parseTemplateRef } from "@open-slidex/sdk";

export const openSlideXProjectSkillNames = [
  "slidex-mdx-authoring",
  "slidex-deck-design",
  "slidex-motion-direction",
  "slidex-deck-qa"
] as const;

export type OpenSlideXProjectSkillName = (typeof openSlideXProjectSkillNames)[number];

export const openSlideXGuidanceIntents = [
  "authoring",
  "design",
  "create",
  "redesign",
  "motion",
  "qa"
] as const;

export type OpenSlideXGuidanceIntent = (typeof openSlideXGuidanceIntents)[number];

const intentSkills = {
  authoring: ["slidex-mdx-authoring"],
  create: ["slidex-mdx-authoring", "slidex-deck-design", "slidex-deck-qa"],
  design: ["slidex-mdx-authoring", "slidex-deck-design", "slidex-deck-qa"],
  motion: ["slidex-mdx-authoring", "slidex-motion-direction", "slidex-deck-qa"],
  qa: ["slidex-deck-qa"],
  redesign: ["slidex-mdx-authoring", "slidex-deck-design", "slidex-deck-qa"]
} as const satisfies Record<OpenSlideXGuidanceIntent, readonly OpenSlideXProjectSkillName[]>;

const maximumGuidanceBytes = 64 * 1024;
const guidanceCache = new Map<string, { signature: string; value: OpenSlideXProjectSkill }>();

export type OpenSlideXProjectSkill = {
  bytes: number;
  checksum: string;
  content: string;
  description: string;
  name: OpenSlideXProjectSkillName;
  path: string;
};

export async function readOpenSlideXProjectSkill(root: string, skill: OpenSlideXProjectSkillName) {
  const canonicalRoot = await realpath(root);
  const requested = path.join(canonicalRoot, ".agents", "skills", skill, "SKILL.md");
  const canonicalFile = await realpath(requested);
  assertInside(canonicalRoot, canonicalFile);
  const fileStats = await stat(canonicalFile);
  if (!fileStats.isFile() || fileStats.size > maximumGuidanceBytes) {
    throw new Error("The requested project skill is not a readable OpenSlideX skill.");
  }
  const signature = `${fileStats.size}:${fileStats.mtimeMs}`;
  const cached = guidanceCache.get(canonicalFile);
  if (cached?.signature === signature) return cached.value;
  const content = await readFile(canonicalFile, "utf8");
  const value: OpenSlideXProjectSkill = {
    bytes: Buffer.byteLength(content),
    checksum: createHash("sha256").update(content).digest("hex"),
    content,
    description: frontmatterDescription(content),
    name: skill,
    path: path.relative(canonicalRoot, canonicalFile).split(path.sep).join("/")
  };
  guidanceCache.set(canonicalFile, { signature, value });
  return value;
}

export async function readOpenSlideXProjectSkillManifest(root: string) {
  const skills = await Promise.all(openSlideXProjectSkillNames.map((skill) => readOpenSlideXProjectSkill(root, skill)));
  return {
    intents: Object.fromEntries(Object.entries(intentSkills).map(([intent, names]) => [intent, [...names]])),
    mode: "manifest" as const,
    skills: skills.map(({ bytes, checksum, description, name, path }) => ({ bytes, checksum, description, name, path }))
  };
}

export async function readOpenSlideXProjectSkillBundle(root: string, intent: OpenSlideXGuidanceIntent) {
  const names = intentSkills[intent];
  const skills = await Promise.all(names.map((skill) => readOpenSlideXProjectSkill(root, skill)));
  return {
    intent,
    mode: "bundle" as const,
    order: [...names],
    skills,
    totalBytes: skills.reduce((total, skill) => total + skill.bytes, 0)
  };
}

export async function readOpenSlideXTemplateLock(root: string) {
  const canonicalRoot = await realpath(root);
  const requested = path.join(canonicalRoot, ".open-slidex", "template-lock.json");
  const canonicalFile = await realpath(requested);
  assertInside(canonicalRoot, canonicalFile);
  const fileStats = await stat(canonicalFile);
  if (!fileStats.isFile() || fileStats.size > 8 * 1024) {
    throw new Error("The OpenSlideX template lock is invalid.");
  }
  return parseTemplateRef(JSON.parse(await readFile(canonicalFile, "utf8")));
}

function frontmatterDescription(content: string) {
  const match = content.match(/^---\s*\n[\s\S]*?^description:\s*(.+?)\s*$[\s\S]*?^---\s*$/m);
  return match?.[1]?.replace(/^['"]|['"]$/g, "") ?? "Approved OpenSlideX project guidance.";
}

function assertInside(root: string, candidate: string) {
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    throw new Error("The requested guidance path escapes the OpenSlideX project root.");
  }
}
