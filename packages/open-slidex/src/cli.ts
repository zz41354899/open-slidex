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

import { getOfficialTemplatePackage } from "@/core/motion-doc/presets/officialTemplatePackages";

import {
  assertSupportedNodeVersion,
  createSlideXHelp,
  installCommand,
  parseCreateSlideXArguments,
  runScriptCommand,
  type PackageManager
} from "./cliOptions";

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown OpenSlideX init failure.";
  process.stderr.write(`open-slidex init: ${message}\n`);
  process.exitCode = 1;
});

async function main() {
  const options = parseCreateSlideXArguments(process.argv.slice(2));

  if (options.action === "help") {
    process.stdout.write(createSlideXHelp());
    return;
  }
  if (options.action === "version") {
    process.stdout.write(`${await packageVersion()}\n`);
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
}: {
  installDependencies: boolean;
  packageManager: PackageManager;
  targetDir: string;
  templateId?: string;
}) {
  const install = installCommand(packageManager);
  return [
    "",
    `Created OpenSlideX MDX-first Local Workbench in ${targetDir}`,
    `Package manager: ${packageManager}`,
    ...(templateId ? [`Official template: ${templateId}`] : []),
    "",
    `  cd ${path.relative(process.cwd(), targetDir) || "."}`,
    ...(installDependencies
      ? []
      : [`  ${install.command} ${install.args.join(" ")}`]),
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

async function applyOfficialTemplate(
  root: string,
  reference: { id: string; locale: "en" | "zh-TW" }
) {
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
    }, null, 2)}\n`,
    "utf8"
  );
}

async function assertTargetIsAvailable(target: string) {
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

async function assertPackageManagerAvailable(packageManager: PackageManager) {
  try {
    await run(packageManager, ["--version"], process.cwd(), "ignore");
  } catch {
    throw new Error(
      `${packageManager} is not available. Install it, select another package manager, or pass --no-install.`
    );
  }
}

async function replaceProjectName(root: string, projectName: string) {
  const packagePath = path.join(root, "package.json");
  const source = await readFile(packagePath, "utf8");
  const safeName =
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "slidex-deck";
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
  const parsed = JSON.parse(source) as { version?: unknown };
  if (typeof parsed.version !== "string") {
    throw new Error("The installed open-slidex package has no version.");
  }
  return parsed.version;
}

function run(
  command: string,
  commandArgs: readonly string[],
  cwd: string,
  stdio: "ignore" | "inherit"
) {
  return new Promise<void>((resolve, reject) => {
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
