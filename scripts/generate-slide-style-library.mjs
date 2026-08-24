import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.resolve(process.argv[2] ?? "");

if (!process.argv[2]) {
  throw new Error("Usage: node scripts/generate-slide-style-library.mjs <style-prompt references directory>");
}

const curatedRoot = path.join(
  repositoryRoot,
  "packages/slidex-workbench/skills/slidex-deck-design/references"
);
const selectedStyleIds = new Set(["S01", "S05", "S08", "S09", "S19", "S20", "S25", "S27"]);

const chineseKeywords = {
  S01: "科技 極簡 專業 SaaS 軟體 產品 發表",
  S02: "黑白 單色 極簡 高對比 研究 摘要",
  S03: "瑞士 網格 理性 海報 資訊 策略 報告",
  S04: "粗獷 原始 實驗 文化 宣言",
  S05: "日式 留白 安靜 禪意 提案 故事",
  S06: "包浩斯 幾何 現代 主義 創意 教育",
  S07: "玻璃 透明 柔光 科技 產品",
  S08: "深色 優雅 高級 科技 簡報",
  S09: "企業 乾淨 董事會 營運 報告 專業",
  S10: "孟菲斯 活潑 幾何 創意 行銷 工作坊",
  S11: "新粗獷 大膽 高對比 新創 發表",
  S12: "手繪 塗鴉 草圖 教學 工作坊 創意",
  S13: "裝飾藝術 黑金 奢華 品牌 故事",
  S14: "新藝術 曲線 植物 優雅 文化 品牌",
  S15: "哥德 黑暗 戲劇 歷史 故事",
  S16: "賽博龐克 霓虹 未來 科技 願景",
  S17: "八零年代 合成波 復古 霓虹 娛樂",
  S18: "千禧 Y2K 銀色 玩味 流行",
  S19: "奢華 編輯 雜誌 品牌 時尚 故事",
  S20: "自然 有機 永續 ESG 健康 報告",
  S21: "太陽龐克 永續 未來 綠色 願景",
  S22: "金色 奢華 高端 投資 品牌",
  S23: "銀色 奢華 精密 科技 高端",
  S24: "襯線 極簡 編輯 思想 領導",
  S25: "新創 活力 成長 融資 產品 發表",
  S26: "企業 藍色 信任 董事會 顧問 報告",
  S27: "金融 科技 信任 數據 投資 報告",
  S28: "黏土 立體 親和 教育 產品",
  S29: "生物 賽博 黑紅 未來 遊戲 願景",
  S30: "極光 漸層 科技 願景 高級"
};

const sourceFiles = (await readdir(sourceRoot))
  .filter((name) => /^S\d{2}-.+\.md$/.test(name))
  .sort();

if (sourceFiles.length !== 30) {
  throw new Error(`Expected 30 style prompt references, found ${sourceFiles.length}.`);
}

const sourceProfiles = [];
for (const sourceFile of sourceFiles) {
  const content = await readFile(path.join(sourceRoot, sourceFile), "utf8");
  sourceProfiles.push(parseProfile(content));
}
const profiles = sourceProfiles.filter((profile) => selectedStyleIds.has(profile.id));
if (profiles.length !== selectedStyleIds.size) {
  throw new Error(`Expected ${selectedStyleIds.size} selected style profiles, found ${profiles.length}.`);
}

const catalog = {
  schemaVersion: 1,
  styles: profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    category: profile.category,
    industries: profile.industries,
    keywords: profile.keywords,
    bestFor: profile.bestFor,
    mdxResourcePath: `.agents/skills/slidex-deck-design/references/${profile.fileName}`
  }))
};

for (const profile of profiles) {
  const source = await readFile(path.join(curatedRoot, profile.fileName), "utf8");
  validateCuratedMdx(profile, source);
}

const existing = await readdir(curatedRoot);
await Promise.all(existing
  .filter((name) => /^style-s\d{2}-.+\.mdx$/.test(name) && !profiles.some((profile) => profile.fileName === name))
  .map((name) => rm(path.join(curatedRoot, name), { force: true })));
await rm(path.join(curatedRoot, "assets", "style-covers"), { recursive: true, force: true });
await writeFile(path.join(curatedRoot, "style-catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

process.stdout.write(
  `Compiled ${sourceProfiles.length} source profiles into ${profiles.length} curated MDX directions in the canonical Workbench skill. Run build:runtime and sync:skills to refresh generated mirrors.\n`
);

function parseProfile(content) {
  const heading = requiredMatch(content, /^# Style:\s+(.+?)\s+\((S\d{2})\)$/m, "style heading");
  const name = heading[1];
  const id = heading[2];
  const industries = requiredMatch(content, /^- \*\*Industries\*\*:\s*(.+)$/m, "industries")[1]
    .split(",")
    .map((value) => value.trim());
  const category = requiredMatch(content, /^- \*\*Category\*\*:\s*(.+)$/m, "category")[1].trim();
  const roles = bestFor(category, industries);
  const keywords = unique([
    id,
    name,
    category,
    ...industries,
    ...roles,
    ...(chineseKeywords[id] ?? "").split(" ")
  ]);
  return {
    id,
    name,
    category,
    industries,
    bestFor: roles,
    keywords,
    fileName: `style-${id.toLowerCase()}-${slugify(name)}.mdx`
  };
}

function validateCuratedMdx(profile, source) {
  const slideCount = source.match(/^<Slide\b/gm)?.length ?? 0;
  if (slideCount !== 12) throw new Error(`${profile.id} must contain exactly twelve curated style specimen slides.`);
  if (!source.startsWith(`# ${profile.name} Twelve-Page Style Grammar\n`)) {
    throw new Error(`${profile.id} has an unexpected document heading.`);
  }
  const componentTags = [...source.matchAll(/<\/?([A-Z][A-Za-z0-9]*)\b/g)].map((match) => match[1]);
  const allowedTags = new Set(["Slide", "Text", "ImageBlock", "VideoBlock", "Chart", "Table", "Shape"]);
  const invalidTag = componentTags.find((tag) => !allowedTags.has(tag));
  if (invalidTag) throw new Error(`${profile.id} uses unsupported MotionDoc tag ${invalidTag}.`);
  for (const match of source.matchAll(/<(Text|ImageBlock|VideoBlock|Chart|Table|Shape)\b([^>]*)>/g)) {
    const attributes = match[2];
    if (!new RegExp(`\\bid="${profile.id.toLowerCase()}-[a-z0-9-]+"`).test(attributes)) {
      throw new Error(`${profile.id} contains a visible layer without a stable style-prefixed ID.`);
    }
    for (const key of ["x", "y", "w", "h"]) {
      if (!new RegExp(`\\b${key}=\\{-?\\d+(?:\\.\\d+)?\\}`).test(attributes)) {
        throw new Error(`${profile.id} contains a visible layer without explicit ${key} geometry.`);
      }
    }
  }
  if (/\bsrc="(?:data:|blob:|\/)/i.test(source)) {
    throw new Error(`${profile.id} style specimens must not depend on Base64, blob, or absolute local media.`);
  }
  const firstSlide = source.match(/<Slide\b[\s\S]*?<\/Slide>/)?.[0] ?? "";
  if (!/<ImageBlock\b/.test(firstSlide)) {
    throw new Error(`${profile.id} cover must contain one portable ImageBlock visual.`);
  }
  if ((source.match(/<ImageBlock\b/g)?.length ?? 0) < 10) {
    throw new Error(`${profile.id} must teach an image-led visual system across the twelve-page sequence.`);
  }
  const imageSources = new Set([...source.matchAll(/<ImageBlock\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]));
  if (imageSources.size < 4) {
    throw new Error(`${profile.id} must use at least four different image paths.`);
  }
  if (!/<Chart\b/.test(source) || !/<Table\b/.test(source)) {
    throw new Error(`${profile.id} must demonstrate native Chart and Table evidence treatments.`);
  }
  if (!/src="https:\/\/images\.unsplash\.com\/photo-[^"]+"/.test(firstSlide)) {
    throw new Error(`${profile.id} cover must use a verified Unsplash image.`);
  }
  for (const match of source.matchAll(/<Shape\b([^>]*)>/g)) {
    const id = match[1].match(/\bid="([^"]+)"/)?.[1] ?? "";
    if (!id.includes("-card")) {
      throw new Error(`${profile.id} Shape ${id || "without an ID"} is decorative; Shape is reserved for semantic cards.`);
    }
    if (!/\bgroupId="[^"]+"/.test(match[1]) || !/\bgroupName="[^"]*card[^"]*"/i.test(match[1])) {
      throw new Error(`${profile.id} Shape ${id} must belong to a named card group.`);
    }
  }
  if (/One idea\. Made unmistakable|Give every signal a visible role|Compare before you decide|End on the next move/.test(source)) {
    throw new Error(`${profile.id} still contains the removed generic card-style specimen copy.`);
  }
}

function bestFor(category, industries) {
  const value = `${category} ${industries.join(" ")}`.toLowerCase();
  const roles = [];
  if (/professional|corporate|finance|fintech|minimal/.test(value)) roles.push("report", "strategy", "board update", "data brief");
  if (/tech|futur/.test(value)) roles.push("product launch", "vision", "technical proposal");
  if (/luxury|lifestyle|creative/.test(value)) roles.push("brand story", "keynote", "creative proposal");
  if (/playful|creative|organic/.test(value)) roles.push("workshop", "campaign", "editorial story");
  if (roles.length === 0) roles.push("editorial story", "proposal");
  return unique(roles);
}

function requiredMatch(content, expression, label) {
  const match = content.match(expression);
  if (!match) throw new Error(`Missing ${label}.`);
  return match;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function unique(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}
