export const minimumNodeVersion = "22.12.0";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export type PackageManagerCommand = {
  args: readonly string[];
  command: PackageManager;
};

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
  userAgent = process.env.npm_config_user_agent
): CreateSlideXCliOptions {
  if (args.includes("--help") || args.includes("-h")) {
    return { action: "help" };
  }
  if (args.includes("--version") || args.includes("-v")) {
    return { action: "version" };
  }

  let installDependencies = true;
  let target: string | undefined;
  let templateId: string | undefined;
  let templateLocale: "en" | "zh-TW" = "en";
  let packageManager = packageManagerFromUserAgent(userAgent);

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--no-install") {
      installDependencies = false;
      continue;
    }
    if (argument === "--package-manager") {
      const value = args[index + 1];
      if (!isPackageManager(value)) {
        throw new Error("--package-manager requires npm, pnpm, yarn, or bun.");
      }
      packageManager = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--package-manager=")) {
      const value = argument.slice("--package-manager=".length);
      if (!isPackageManager(value)) {
        throw new Error("--package-manager requires npm, pnpm, yarn, or bun.");
      }
      packageManager = value;
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
    packageManager,
    target: target ?? "my-slidex-deck",
    ...(templateId ? { template: { id: templateId, locale: templateLocale } } : {})
  };
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

export function packageManagerFromUserAgent(userAgent?: string): PackageManager {
  if (userAgent?.startsWith("pnpm/")) return "pnpm";
  if (userAgent?.startsWith("yarn/")) return "yarn";
  if (userAgent?.startsWith("bun/")) return "bun";
  return "npm";
}

export function installCommand(packageManager: PackageManager): PackageManagerCommand {
  return { args: ["install"], command: packageManager };
}

export function runScriptCommand(
  packageManager: PackageManager,
  script: "dev" | "export:html" | "export:pptx" | "render" | "validate"
) {
  return packageManager === "npm" ? `npm run ${script}` : packageManager === "bun" ? `bun run ${script}` : `${packageManager} ${script}`;
}

export function createSlideXHelp() {
  return `Create a private, MDX-first OpenSlideX Local Workbench.

Usage:
  open-slidex init [directory] [options]

Options:
  --template <official-template-id> Create from an official template blueprint
  --locale <en|zh-TW>               Template language (default: en)
  --package-manager <manager>       npm, pnpm, yarn, or bun (auto-detected)
  --no-install                      Create files without installing dependencies
  -h, --help                        Show this help
  -v, --version                     Show the installed CLI version

Examples:
  npx open-slidex@latest init my-deck
  pnpm dlx open-slidex@latest init my-deck
  yarn dlx open-slidex@latest init my-deck
  bunx open-slidex@latest init my-deck
  open-slidex init my-deck --no-install
  open-slidex init my-deck --template summer-time-report --locale zh-TW
`;
}

function isPackageManager(value: string | undefined): value is PackageManager {
  return value === "npm" || value === "pnpm" || value === "yarn" || value === "bun";
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
