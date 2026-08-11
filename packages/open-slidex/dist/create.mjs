#!/usr/bin/env node

// packages/open-slidex/src/cli.ts
import { spawn } from "node:child_process";
import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// core/motion-doc/domain/officialTemplateDefinitions.ts
var officialTemplatePackageVersion = "1.0.0";
var officialTemplateCompatibility = { motionDoc: "1.0.0", openSlideX: "0.2.4" };
var officialTemplateDefinitions = [
  {
    id: "open-slidex-starter",
    cover: "",
    catalog: {
      author: "OpenSlideX Contributors",
      category: "getting-started",
      featured: true,
      slideCount: 2,
      sortOrder: 10,
      tags: ["OpenSlideX", "Starter", "Local"]
    },
    locales: {
      en: {
        description: "A neutral two-slide starting point for a local presentation.",
        name: "OpenSlideX Starter",
        useCase: "New local decks and quick experiments"
      },
      "zh-TW": {
        description: "\u4E00\u4EFD\u4E2D\u6027\u7684\u5169\u9801\u672C\u6A5F\u7C21\u5831\u8D77\u9EDE\u3002",
        name: "OpenSlideX \u8D77\u59CB\u7BC4\u4F8B",
        useCase: "\u5EFA\u7ACB\u672C\u6A5F\u7C21\u5831\u8207\u5FEB\u901F\u5BE6\u9A57"
      }
    },
    blueprint: {
      schemaVersion: 1,
      narrative: {
        objective: "Turn one clear point into an actionable presentation.",
        slideRoles: ["cover", "next-steps"]
      },
      design: {
        colorTokens: ["#111827", "#F8FAFC", "#A7F3D0", "#0F766E"],
        composition: "Clear editorial hierarchy with one focal point per slide.",
        imageTreatment: "Images are optional; prefer editable shapes for the starter.",
        typography: "Large concise titles with restrained supporting copy."
      },
      imageSlots: [],
      layoutRoles: ["cover", "next-steps"],
      prohibitions: [
        "Do not depend on Cloud authentication or remote persistence.",
        "Do not use remote or Base64 media in local projects."
      ],
      qaRules: [
        "Keep every visible element editable MotionDoc content.",
        "Validate and render the deck before completion."
      ]
    }
  }
];

// core/motion-doc/application/motionDocSourceEditor.ts
function motionDocSlideSourceRanges(source) {
  return [...source.matchAll(slidePattern())].map((match) => ({
    end: (match.index ?? 0) + match[0].length,
    openingTag: match[0].slice(0, match[0].indexOf(">") + 1),
    source: match[0],
    start: match.index ?? 0
  }));
}
function slidePattern() {
  return /<(Slide|Scene)\b[^>]*>[\s\S]*?<\/\1>/g;
}

// core/motion-doc/presets/templateLibrarySources.ts
var publicStarterSources = {
  en: `# Untitled presentation

<Slide duration={6} fontSizeUnit="pt" theme="dark" background="#111827" accent="#A7F3D0" textColor="#F9FAFB" mutedColor="#CBD5E1" slideTransition="fade" transitionDuration={0.7} canvasHeight={1080} canvasWidth={1920}>
  <Text id="starter-1-kicker" fontSize={14} fontWeight={700} letterSpacing={1.2} x={7} y={8} w={34} h={5} color="#A7F3D0">PROJECT STARTER / 01</Text>
  <Title id="starter-1-title" fontSize={58} fontWeight={700} lineHeight={1.08} x={7} y={28} w={62} h={24} color="#F9FAFB">Start with one clear question.</Title>
  <Text id="starter-1-body" fontSize={20} lineHeight={1.5} x={7} y={58} w={42} h={13} color="#CBD5E1">Replace this example with your point, evidence, and next action.</Text>
</Slide>

<Slide duration={6} fontSizeUnit="pt" theme="light" background="#F8FAFC" accent="#111827" textColor="#111827" mutedColor="#475569" slideTransition="pushLeft" transitionDuration={0.7} canvasHeight={1080} canvasWidth={1920}>
  <Text id="starter-2-kicker" fontSize={14} fontWeight={700} letterSpacing={1.2} x={7} y={8} w={34} h={5} color="#0F766E">PROJECT STARTER / 02</Text>
  <Title id="starter-2-title" fontSize={48} fontWeight={700} lineHeight={1.12} x={7} y={18} w={55} h={19} color="#111827">Let every slide move one decision forward.</Title>
  <Text id="starter-2-body" fontSize={19} lineHeight={1.5} x={7} y={43} w={42} h={12} color="#475569">Point \u2192 evidence \u2192 next step.</Text>
</Slide>`,
  "zh-TW": `# \u672A\u547D\u540D\u7C21\u5831

<Slide duration={6} fontSizeUnit="pt" theme="dark" background="#111827" accent="#A7F3D0" textColor="#F9FAFB" mutedColor="#CBD5E1" slideTransition="fade" transitionDuration={0.7} canvasHeight={1080} canvasWidth={1920}>
  <Text id="starter-1-kicker" fontSize={14} fontWeight={700} letterSpacing={1.2} x={7} y={8} w={34} h={5} color="#A7F3D0">PROJECT STARTER / 01</Text>
  <Title id="starter-1-title" fontSize={58} fontWeight={700} lineHeight={1.08} x={7} y={28} w={62} h={24} color="#F9FAFB">\u5F9E\u4E00\u500B\u6E05\u695A\u7684\u554F\u984C\u958B\u59CB\u3002</Title>
  <Text id="starter-1-body" fontSize={20} lineHeight={1.5} x={7} y={58} w={42} h={13} color="#CBD5E1">\u628A\u9019\u4EFD\u7BC4\u4F8B\u63DB\u6210\u4F60\u7684\u89C0\u9EDE\u3001\u8B49\u64DA\u8207\u4E0B\u4E00\u6B65\u3002</Text>
</Slide>

<Slide duration={6} fontSizeUnit="pt" theme="light" background="#F8FAFC" accent="#111827" textColor="#111827" mutedColor="#475569" slideTransition="pushLeft" transitionDuration={0.7} canvasHeight={1080} canvasWidth={1920}>
  <Text id="starter-2-kicker" fontSize={14} fontWeight={700} letterSpacing={1.2} x={7} y={8} w={34} h={5} color="#0F766E">PROJECT STARTER / 02</Text>
  <Title id="starter-2-title" fontSize={48} fontWeight={700} lineHeight={1.12} x={7} y={18} w={55} h={19} color="#111827">\u8B93\u6BCF\u4E00\u9801\u63A8\u9032\u4E00\u500B\u6C7A\u5B9A\u3002</Title>
  <Text id="starter-2-body" fontSize={19} lineHeight={1.5} x={7} y={43} w={42} h={12} color="#475569">\u89C0\u9EDE \u2192 \u8B49\u64DA \u2192 \u4E0B\u4E00\u6B65\u3002</Text>
</Slide>`
};
function getBundledTemplateLibrarySource(templateId, locale) {
  return templateId === "open-slidex-starter" ? publicStarterSources[locale] : void 0;
}
function getBundledTemplateLibraryBlankSource(templateId, locale) {
  const source = getBundledTemplateLibrarySource(templateId, locale);
  const firstSlide = source ? motionDocSlideSourceRanges(source)[0] : void 0;
  const tagName = firstSlide?.source.match(/^<(Slide|Scene)\b/)?.[1];
  return firstSlide && tagName ? `# Untitled

${firstSlide.openingTag}
</${tagName}>` : void 0;
}

// core/motion-doc/presets/officialTemplatePackages.ts
var officialTemplatePackages = officialTemplateDefinitions.map(createPackage);
function getOfficialTemplatePackage(id, version = officialTemplatePackageVersion) {
  return version === officialTemplatePackageVersion ? officialTemplatePackages.find((template) => template.id === id) : void 0;
}
function createPackage(item) {
  const sourceEn = getBundledTemplateLibrarySource(item.id, "en");
  const sourceZhTw = getBundledTemplateLibrarySource(item.id, "zh-TW");
  const starterEn = getBundledTemplateLibraryBlankSource(item.id, "en");
  const starterZhTw = getBundledTemplateLibraryBlankSource(item.id, "zh-TW");
  if (!sourceEn || !sourceZhTw || !starterEn || !starterZhTw) {
    throw new Error(`Public template source is missing: ${item.id}`);
  }
  return {
    assets: [],
    blueprint: item.blueprint,
    catalog: item.catalog,
    compatibility: officialTemplateCompatibility,
    cover: { alt: { en: `${item.locales.en.name} cover`, "zh-TW": `${item.locales["zh-TW"].name}\u5C01\u9762` }, source: item.cover || "about:blank" },
    id: item.id,
    kind: "open-slidex-template",
    locales: item.locales,
    schemaVersion: 1,
    sources: { en: sourceEn, "zh-TW": sourceZhTw },
    starterSources: { en: starterEn, "zh-TW": starterZhTw },
    version: officialTemplatePackageVersion
  };
}

// packages/open-slidex/src/cliOptions.ts
var minimumNodeVersion = "22.12.0";
var packageManagers = ["npm", "pnpm", "bun"];
function parseCreateSlideXArguments(args, environment = process.env) {
  if (args.includes("--help") || args.includes("-h")) {
    return { action: "help" };
  }
  if (args.includes("--version") || args.includes("-v")) {
    return { action: "version" };
  }
  let installDependencies = true;
  let packageManager;
  let target;
  let templateId;
  let templateLocale = "en";
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--no-install") {
      installDependencies = false;
      continue;
    }
    if (argument === "--template") {
      const value = args[index + 1];
      if (!value || value.startsWith("-") || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
        throw new Error("--template requires an official template ID.");
      }
      templateId = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--template=")) {
      const value = argument.slice("--template=".length);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
        throw new Error("--template requires an official template ID.");
      }
      templateId = value;
      continue;
    }
    if (argument === "--locale") {
      const value = args[index + 1];
      if (value !== "en" && value !== "zh-TW") {
        throw new Error("--locale requires en or zh-TW.");
      }
      templateLocale = value;
      index += 1;
      continue;
    }
    if (argument === "--package-manager") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--package-manager requires npm, pnpm, or bun.");
      }
      packageManager = selectPackageManager(packageManager, value);
      index += 1;
      continue;
    }
    if (argument.startsWith("--package-manager=")) {
      packageManager = selectPackageManager(
        packageManager,
        argument.slice("--package-manager=".length)
      );
      continue;
    }
    if (argument === "--npm" || argument === "--pnpm" || argument === "--bun") {
      packageManager = selectPackageManager(
        packageManager,
        argument.slice(2)
      );
      continue;
    }
    if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}. Run open-slidex init --help.`);
    }
    if (target) {
      throw new Error(`Only one target directory is allowed: ${target} and ${argument}.`);
    }
    target = argument;
  }
  return {
    action: "create",
    installDependencies,
    packageManager: packageManager ?? detectPackageManager(
      environment.npm_config_user_agent,
      environment.npm_execpath,
      process.versions.bun
    ),
    target: target ?? "my-slidex-deck",
    ...templateId ? { template: { id: templateId, locale: templateLocale } } : {}
  };
}
function detectPackageManager(userAgent, executablePath, bunVersion) {
  if (bunVersion || executablePath?.toLowerCase().includes("bun")) {
    return "bun";
  }
  const command = userAgent?.split(/\s+/, 1)[0]?.split("/", 1)[0];
  if (isPackageManager(command)) return command;
  if (executablePath?.toLowerCase().includes("pnpm")) return "pnpm";
  return "npm";
}
function assertSupportedNodeVersion(currentVersion = process.versions.node) {
  const current = parseVersion(currentVersion);
  const minimum = parseVersion(minimumNodeVersion);
  const supported = compareVersions(current, minimum) >= 0;
  if (!supported) {
    throw new Error(
      `Node.js ${minimumNodeVersion} or newer is required. Current version: ${currentVersion}.`
    );
  }
}
function installCommand(packageManager) {
  return { args: ["install"], command: packageManager };
}
function runScriptCommand(packageManager, script) {
  if (packageManager === "pnpm") return `pnpm ${script}`;
  return `${packageManager} run ${script}`;
}
function createSlideXHelp() {
  return `Create a private, MDX-first OpenSlideX Local Workbench.

Usage:
  open-slidex init [directory] [options]

Options:
  --template <official-template-id> Create from an official template blueprint
  --locale <en|zh-TW>               Template language (default: en)
  --package-manager <npm|pnpm|bun>  Select the installer
  --npm                             Use npm
  --pnpm                            Use pnpm
  --bun                             Use bun
  --no-install                      Create files without installing dependencies
  -h, --help                        Show this help
  -v, --version                     Show the installed CLI version

Examples:
  npx open-slidex@latest init my-deck
  pnpm dlx open-slidex@latest init my-deck
  bunx open-slidex@latest init my-deck
  open-slidex init my-deck --package-manager pnpm --no-install
  open-slidex init my-deck --template open-slidex-starter --locale zh-TW
`;
}
function selectPackageManager(current, requested) {
  if (!isPackageManager(requested)) {
    throw new Error(
      `Unsupported package manager: ${requested || "missing"}. Use npm, pnpm, or bun.`
    );
  }
  if (current && current !== requested) {
    throw new Error(
      `Choose only one package manager; received ${current} and ${requested}.`
    );
  }
  return requested;
}
function isPackageManager(value) {
  return packageManagers.includes(value);
}
function parseVersion(value) {
  const match = value.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`Unable to parse Node.js version: ${value}.`);
  return match.slice(1).map(Number);
}
function compareVersions(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

// packages/open-slidex/src/cli.ts
void main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown OpenSlideX init failure.";
  process.stderr.write(`open-slidex init: ${message}
`);
  process.exitCode = 1;
});
async function main() {
  const options = parseCreateSlideXArguments(process.argv.slice(2));
  if (options.action === "help") {
    process.stdout.write(createSlideXHelp());
    return;
  }
  if (options.action === "version") {
    process.stdout.write(`${await packageVersion()}
`);
    return;
  }
  assertSupportedNodeVersion();
  const targetDir = path.resolve(process.cwd(), options.target);
  const templateDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../template"
  );
  await assertTargetIsAvailable(targetDir);
  if (options.installDependencies) {
    await assertPackageManagerAvailable(options.packageManager);
  }
  await mkdir(targetDir, { recursive: true });
  await cp(templateDir, targetDir, { recursive: true });
  await replaceProjectName(targetDir, path.basename(targetDir));
  if (options.template) {
    await applyOfficialTemplate(targetDir, options.template);
  }
  if (options.installDependencies) {
    const install = installCommand(options.packageManager);
    await run(install.command, install.args, targetDir, "inherit");
  }
  process.stdout.write(
    completionMessage({
      installDependencies: options.installDependencies,
      packageManager: options.packageManager,
      targetDir,
      templateId: options.template?.id
    })
  );
}
function completionMessage({
  installDependencies,
  packageManager,
  targetDir,
  templateId
}) {
  const install = installCommand(packageManager);
  return [
    "",
    `Created OpenSlideX MDX-first Local Workbench in ${targetDir}`,
    `Package manager: ${packageManager}`,
    ...templateId ? [`Official template: ${templateId}`] : [],
    "",
    `  cd ${path.relative(process.cwd(), targetDir) || "."}`,
    ...installDependencies ? [] : [`  ${install.command} ${install.args.join(" ")}`],
    `  ${runScriptCommand(packageManager, "dev")}`,
    "",
    "CLI checks and exports:",
    `  ${runScriptCommand(packageManager, "validate")}`,
    `  ${runScriptCommand(packageManager, "render")}`,
    "",
    "Project-local OpenSlideX skills are ready in .agents/skills:",
    "  slidex-mdx-authoring",
    "  slidex-deck-design",
    "  slidex-motion-direction",
    "  slidex-deck-qa",
    "",
    "Project-local MCP configuration is ready:",
    "  Codex: .codex/config.toml",
    "  Claude Code: .mcp.json",
    "  Setup and verification: MCP.md",
    ""
  ].join("\n");
}
async function applyOfficialTemplate(root, reference) {
  const template = getOfficialTemplatePackage(reference.id);
  if (!template) {
    throw new Error(`Unknown official template: ${reference.id}`);
  }
  await writeFile(
    path.join(root, "presentation.mdx"),
    template.starterSources[reference.locale],
    "utf8"
  );
  const stateRoot = path.join(root, ".open-slidex");
  await mkdir(stateRoot, { recursive: true });
  await writeFile(
    path.join(stateRoot, "template-lock.json"),
    `${JSON.stringify({
      id: template.id,
      locale: reference.locale,
      version: template.version
    }, null, 2)}
`,
    "utf8"
  );
}
async function assertTargetIsAvailable(target) {
  const exists = await access(target).then(
    () => true,
    () => false
  );
  if (!exists) return;
  const entries = await readdir(target);
  if (entries.length > 0) {
    throw new Error(`Target directory is not empty: ${target}`);
  }
}
async function assertPackageManagerAvailable(packageManager) {
  try {
    await run(packageManager, ["--version"], process.cwd(), "ignore");
  } catch {
    throw new Error(
      `${packageManager} is not available. Install it, select another package manager, or pass --no-install.`
    );
  }
}
async function replaceProjectName(root, projectName) {
  const packagePath = path.join(root, "package.json");
  const source = await readFile(packagePath, "utf8");
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "slidex-deck";
  await writeFile(
    packagePath,
    source.replaceAll("__PROJECT_NAME__", safeName),
    "utf8"
  );
}
async function packageVersion() {
  const source = await readFile(
    new URL("../package.json", import.meta.url),
    "utf8"
  );
  const parsed = JSON.parse(source);
  if (typeof parsed.version !== "string") {
    throw new Error("The installed open-slidex package has no version.");
  }
  return parsed.version;
}
function run(command, commandArgs, cwd, stdio) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd,
      env: process.env,
      stdio
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code ?? "unknown"}.`));
    });
  });
}
