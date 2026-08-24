import { createHash } from "node:crypto";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

import {
  openSlideXGuidanceIntents,
  openSlideXGuidanceSkillsByIntent,
  openSlideXProjectSkillNames,
  type OpenSlideXGuidanceIntent,
  type OpenSlideXProjectSkillName
} from "@/core/motion-doc/domain/openSlideXProjectSkills";

export {
  openSlideXGuidanceIntents,
  openSlideXProjectSkillNames,
  type OpenSlideXGuidanceIntent,
  type OpenSlideXProjectSkillName
} from "@/core/motion-doc/domain/openSlideXProjectSkills";

const maximumGuidanceBytes = 256 * 1024;
const guidanceCache = new Map<string, { signature: string; value: OpenSlideXGuidanceResource }>();
const referenceExtensions = new Set([".json", ".md", ".mdx", ".txt"]);

export type OpenSlideXGuidanceResource = {
  bytes: number;
  checksum: string;
  content: string;
  description: string;
  kind: "reference" | "skill";
  path: string;
  skill: OpenSlideXProjectSkillName;
};

export type OpenSlideXStyleRecommendation = {
  bestFor: string[];
  category: string;
  id: string;
  industries: string[];
  mdxResourcePath: string;
  name: string;
  score: number;
};

type OpenSlideXGuidanceResourceMetadata = Omit<OpenSlideXGuidanceResource, "content">;

export async function readOpenSlideXProjectGuidanceManifest(
  root: string,
  intent: OpenSlideXGuidanceIntent
) {
  const skills = (await Promise.all(openSlideXProjectSkillNames.map(async (skill) => {
    try {
      const skillResource = await readOpenSlideXProjectGuidanceResource(
        root,
        `.agents/skills/${skill}/SKILL.md`
      );
      const references = await listSkillReferences(root, skill);
      return {
        ...withoutContent(skillResource),
        references: references.map(withoutContent)
      };
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return undefined;
      throw error;
    }
  }))).filter((skill): skill is {
    references: OpenSlideXGuidanceResourceMetadata[];
  } & OpenSlideXGuidanceResourceMetadata => Boolean(skill));
  const available = new Set(skills.map((skill) => skill.skill));
  const recommended = openSlideXGuidanceSkillsByIntent[intent].filter((skill) => available.has(skill));
  const missingSkills = openSlideXGuidanceSkillsByIntent[intent].filter((skill) => !available.has(skill));

  return {
    intent,
    mode: "manifest" as const,
    recommended,
    ...(missingSkills.length > 0 ? { missingSkills } : {}),
    skills,
    totalBytes: skills.reduce(
      (total, skill) => total + skill.bytes + skill.references.reduce((sum, resource) => sum + resource.bytes, 0),
      0
    ),
    usage: "Read each recommended SKILL.md, then only the references it routes to. Pass an exact manifest path as resourcePath to open_slidex_read. If missingSkills is present, run open-slidex sync:skills before that workflow."
  };
}

export async function readOpenSlideXProjectGuidanceResource(
  root: string,
  requestedPath: string
): Promise<OpenSlideXGuidanceResource> {
  const parsedPath = parseGuidancePath(requestedPath);
  const canonicalRoot = await realpath(root);
  const canonicalSkillRoot = await realpath(path.join(canonicalRoot, ".agents", "skills", parsedPath.skill));
  assertInside(canonicalRoot, canonicalSkillRoot);
  const requested = path.join(canonicalRoot, ...parsedPath.segments);
  const canonicalFile = await realpath(requested);
  assertInside(canonicalSkillRoot, canonicalFile);

  const fileStats = await stat(canonicalFile);
  if (!fileStats.isFile() || fileStats.size > maximumGuidanceBytes) {
    throw new Error("The requested OpenSlideX guidance resource is not readable.");
  }

  const signature = `${fileStats.size}:${fileStats.mtimeMs}`;
  const cached = guidanceCache.get(canonicalFile);
  if (cached?.signature === signature) return cached.value;

  const content = await readFile(canonicalFile, "utf8");
  const value: OpenSlideXGuidanceResource = {
    bytes: Buffer.byteLength(content),
    checksum: createHash("sha256").update(content).digest("hex"),
    content,
    description: parsedPath.kind === "skill" ? frontmatterDescription(content) : referenceDescription(content),
    kind: parsedPath.kind,
    path: path.relative(canonicalRoot, canonicalFile).split(path.sep).join("/"),
    skill: parsedPath.skill
  };
  guidanceCache.set(canonicalFile, { signature, value });
  return value;
}

export async function recommendOpenSlideXStyles(
  root: string,
  query: string,
  limit = 3
): Promise<{ query: string; recommendations: OpenSlideXStyleRecommendation[] }> {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) throw new Error("styleQuery must contain readable style or presentation context.");
  const catalogResource = await readOpenSlideXProjectGuidanceResource(
    root,
    ".agents/skills/slidex-deck-design/references/style-catalog.json"
  );
  const catalog = parseStyleCatalog(catalogResource.content);
  const ranked = catalog.map((style) => ({
    ...style,
    score: styleScore(style, normalizedQuery)
  })).sort((left, right) => right.score - left.score || fallbackStyleRank(left.id) - fallbackStyleRank(right.id));
  const positive = ranked.filter((style) => style.score > 0);
  const recommendations = [
    ...positive,
    ...ranked.filter((style) => style.score === 0)
  ].slice(0, Math.min(Math.max(limit, 1), 5));
  return { query, recommendations };
}

async function listSkillReferences(root: string, skill: OpenSlideXProjectSkillName) {
  const referencesRoot = path.join(root, ".agents", "skills", skill, "references");
  const entries = await readdir(referencesRoot, { withFileTypes: true }).catch((error: unknown) => {
    if (isNodeError(error) && error.code === "ENOENT") return [];
    throw error;
  });
  return Promise.all(entries
    .filter((entry) => entry.isFile() && referenceExtensions.has(path.extname(entry.name).toLowerCase()))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => readOpenSlideXProjectGuidanceResource(
      root,
      `.agents/skills/${skill}/references/${entry.name}`
    )));
}

function parseGuidancePath(requestedPath: string) {
  if (requestedPath.includes("\\") || path.posix.normalize(requestedPath) !== requestedPath) {
    throw new Error("resourcePath must be an exact path from the OpenSlideX guidance manifest.");
  }
  const segments = requestedPath.split("/");
  if (segments[0] !== ".agents" || segments[1] !== "skills") {
    throw new Error("resourcePath must point to a project-local OpenSlideX skill resource.");
  }
  const skill = segments[2];
  if (!openSlideXProjectSkillNames.includes(skill as OpenSlideXProjectSkillName)) {
    throw new Error("resourcePath names an unapproved OpenSlideX skill.");
  }
  if (segments.length === 4 && segments[3] === "SKILL.md") {
    return { kind: "skill" as const, segments, skill: skill as OpenSlideXProjectSkillName };
  }
  if (
    segments.length === 5 &&
    segments[3] === "references" &&
    Boolean(segments[4]) &&
    referenceExtensions.has(path.posix.extname(segments[4]!).toLowerCase())
  ) {
    return { kind: "reference" as const, segments, skill: skill as OpenSlideXProjectSkillName };
  }
  throw new Error("resourcePath must name SKILL.md or one direct file under that skill's references/ directory.");
}

function withoutContent(resource: OpenSlideXGuidanceResource): OpenSlideXGuidanceResourceMetadata {
  const { content: _content, ...metadata } = resource;
  return metadata;
}

function frontmatterDescription(content: string) {
  const match = content.match(/^---\s*\n[\s\S]*?^description:\s*(.+?)\s*$[\s\S]*?^---\s*$/m);
  return match?.[1]?.replace(/^['"]|['"]$/g, "") ?? "Approved OpenSlideX project skill.";
}

function referenceDescription(content: string) {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "Approved OpenSlideX skill reference.";
}

type StyleCatalogEntry = Omit<OpenSlideXStyleRecommendation, "score"> & {
  keywords: string[];
};

function parseStyleCatalog(content: string): StyleCatalogEntry[] {
  const parsed = JSON.parse(content) as { styles?: unknown };
  if (!Array.isArray(parsed.styles) || parsed.styles.length !== 8) {
    throw new Error("The OpenSlideX style catalog must contain exactly 8 curated styles.");
  }
  return parsed.styles.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(`Style catalog entry ${index + 1} is invalid.`);
    const style = value as Record<string, unknown>;
    const id = stringField(style, "id");
    if (!/^S\d{2}$/.test(id)) throw new Error(`Style catalog entry ${index + 1} has an invalid ID.`);
    const mdxResourcePath = stringField(style, "mdxResourcePath");
    if (!/^\.agents\/skills\/slidex-deck-design\/references\/style-s\d{2}-[a-z0-9-]+\.mdx$/.test(mdxResourcePath)) {
      throw new Error(`Style catalog entry ${id} has an invalid MDX resource path.`);
    }
    return {
      bestFor: stringArrayField(style, "bestFor"),
      category: stringField(style, "category"),
      id,
      industries: stringArrayField(style, "industries"),
      keywords: stringArrayField(style, "keywords"),
      mdxResourcePath,
      name: stringField(style, "name")
    };
  });
}

function styleScore(style: StyleCatalogEntry, query: string) {
  let score = 0;
  const id = style.id.toLowerCase();
  const name = normalizeSearchText(style.name);
  if (query.includes(id)) score += 100;
  if (query.includes(name)) score += 60;
  for (const value of style.keywords) score += matchScore(query, value, 8);
  for (const value of style.bestFor) score += matchScore(query, value, 7);
  for (const value of style.industries) score += matchScore(query, value, 5);
  score += matchScore(query, style.category, 4);
  return score;
}

function matchScore(query: string, candidate: string, weight: number) {
  const normalized = normalizeSearchText(candidate);
  if (!normalized || normalized.length < 2) return 0;
  if (query.includes(normalized)) return weight;
  const terms = normalized.split(" ").filter((term) => term.length >= 3);
  return terms.reduce((score, term) => score + (query.includes(term) ? Math.max(1, Math.floor(weight / 3)) : 0), 0);
}

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function fallbackStyleRank(id: string) {
  const preferred = ["S09", "S01", "S24", "S03", "S26"];
  const rank = preferred.indexOf(id);
  return rank === -1 ? preferred.length + Number(id.slice(1)) : rank;
}

function stringField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  if (typeof field !== "string" || !field.trim()) throw new Error(`Style catalog field ${key} is invalid.`);
  return field;
}

function stringArrayField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  if (!Array.isArray(field) || !field.every((item) => typeof item === "string" && item.trim())) {
    throw new Error(`Style catalog field ${key} is invalid.`);
  }
  return field;
}

function assertInside(root: string, candidate: string) {
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    throw new Error("The requested guidance path escapes the OpenSlideX project root.");
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
