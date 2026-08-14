export const minimumNodeVersion = "22.12.0";
export const packageManagers = ["npm", "pnpm", "bun"] as const;

export type PackageManager = (typeof packageManagers)[number];

export type CreateSlideXCliOptions =
  | { action: "help" }
  | { action: "version" }
  | {
      action: "create";
      installDependencies: boolean;
      packageManager: PackageManager;
      target: string;
      template?: { id: string; locale: "en" | "zh-TW" };
    };

export function parseCreateSlideXArguments(
  args: readonly string[],
  environment: Readonly<Record<string, string | undefined>> = process.env
): CreateSlideXCliOptions {
  if (args.includes("--help") || args.includes("-h")) {
    return { action: "help" };
  }
  if (args.includes("--version") || args.includes("-v")) {
    return { action: "version" };
  }

  let installDependencies = true;
  let packageManager: PackageManager | undefined;
  let target: string | undefined;
  let templateId: string | undefined;
  let templateLocale: "en" | "zh-TW" = "en";

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
    packageManager:
      packageManager ??
      detectPackageManager(
        environment.npm_config_user_agent,
        environment.npm_execpath,
        process.versions.bun
      ),
    target: target ?? "my-slidex-deck",
    ...(templateId ? { template: { id: templateId, locale: templateLocale } } : {})
  };
}

export function detectPackageManager(
  userAgent?: string,
  executablePath?: string,
  bunVersion?: string
): PackageManager {
  if (bunVersion || executablePath?.toLowerCase().includes("bun")) {
    return "bun";
  }
  const command = userAgent?.split(/\s+/, 1)[0]?.split("/", 1)[0];
  if (isPackageManager(command)) return command;
  if (executablePath?.toLowerCase().includes("pnpm")) return "pnpm";
  return "npm";
}

export function assertSupportedNodeVersion(
  currentVersion = process.versions.node
) {
  const current = parseVersion(currentVersion);
  const minimum = parseVersion(minimumNodeVersion);
  const supported = compareVersions(current, minimum) >= 0;

  if (!supported) {
    throw new Error(
      `Node.js ${minimumNodeVersion} or newer is required. Current version: ${currentVersion}.`
    );
  }
}

export function installCommand(packageManager: PackageManager) {
  return { args: ["install"], command: packageManager };
}

export function runScriptCommand(
  packageManager: PackageManager,
  script: "dev" | "export:html" | "export:pptx" | "render" | "validate"
) {
  if (packageManager === "pnpm") return `pnpm ${script}`;
  return `${packageManager} run ${script}`;
}

export function createSlideXHelp() {
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
  npx open-slidex@0.3.2 init my-deck
  pnpm dlx open-slidex@0.3.2 init my-deck
  bunx open-slidex@0.3.2 init my-deck
  open-slidex init my-deck --package-manager pnpm --no-install
  open-slidex init my-deck --template summer-time-report --locale zh-TW
`;
}

function selectPackageManager(
  current: PackageManager | undefined,
  requested: string
) {
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

function isPackageManager(value?: string): value is PackageManager {
  return packageManagers.includes(value as PackageManager);
}

function parseVersion(value: string) {
  const match = value.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`Unable to parse Node.js version: ${value}.`);
  return match.slice(1).map(Number) as [number, number, number];
}

function compareVersions(
  left: readonly number[],
  right: readonly number[]
) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
