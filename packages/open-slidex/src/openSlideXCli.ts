import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type RuntimeTarget =
  | "create"
  | "mcp"
  | "sdk"
  | "workbench";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown OpenSlideX CLI failure.";
  process.stderr.write(`open-slidex: ${message}\n`);
  process.exitCode = 1;
});

async function main() {
  const [command = "help", ...args] = process.argv.slice(2);
  if (command === "--version" || command === "-v") {
    const manifest = JSON.parse(
      await readFile(path.join(packageRoot, "package.json"), "utf8")
    ) as { version?: unknown };
    if (typeof manifest.version !== "string") throw new Error("Package version is unavailable.");
    process.stdout.write(`${manifest.version}\n`);
    return;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(help());
    return;
  }

  const target = runtimeFor(command);
  const childArgs = target === "create" ? args : target === "mcp" ? args : [command, ...args];
  await run(runtimeEntry(target), childArgs);
}

function runtimeFor(command: string): RuntimeTarget {
  if (command === "init") return "create";
  if (command === "mcp") return "mcp";
  if (["workspace", "dev", "build", "preview", "sync:skills"].includes(command)) return "workbench";
  if (["validate", "render", "export"].includes(command)) return "sdk";
  throw new Error(`Unknown command: ${command}. Run open-slidex --help.`);
}

function runtimeEntry(target: RuntimeTarget) {
  const entries: Record<RuntimeTarget, string> = {
    create: "dist/create.mjs",
    mcp: "runtime/mcp/server.mjs",
    sdk: "runtime/sdk/cli.js",
    workbench: "runtime/workbench/cli.mjs"
  };
  return path.join(packageRoot, entries[target]);
}

function run(entry: string, args: readonly string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...(entry === runtimeEntry("workbench") ? {
          OPEN_SLIDEX_TEMPLATE_ROOT: path.join(packageRoot, "template")
        } : {})
      },
      stdio: "inherit"
    });
    const forwardSignal = (signal: NodeJS.Signals) => {
      if (child.exitCode === null && child.signalCode === null) child.kill(signal);
    };
    const forwardInterrupt = () => forwardSignal("SIGINT");
    const forwardTermination = () => forwardSignal("SIGTERM");
    const cleanup = () => {
      process.off("SIGINT", forwardInterrupt);
      process.off("SIGTERM", forwardTermination);
    };

    process.once("SIGINT", forwardInterrupt);
    process.once("SIGTERM", forwardTermination);
    child.once("error", (error) => {
      cleanup();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      cleanup();
      if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") resolve();
      else reject(new Error(`open-slidex ${args[0] ?? ""} exited with code ${code ?? "unknown"}.`));
    });
  });
}

function help() {
  return `OpenSlideX

Usage:
  open-slidex workspace [directory] [--port 4172] [--no-open]
  open-slidex init [directory] [--template <id>] [--locale <en|zh-TW>] [--npm|--pnpm|--bun|--no-install]
  open-slidex dev [--port 4173] [--no-open]
  open-slidex build
  open-slidex preview [--port 4174]
  open-slidex mcp --project <directory> [--print-config <codex|claude-code|claude-desktop>]
  open-slidex mcp --workspace <directory> [--print-config <codex|claude-code|claude-desktop>]
  open-slidex mcp --project <directory> [--print-setup-prompt <codex|claude-code|claude-desktop>]
  open-slidex mcp --workspace <directory> [--print-setup-prompt <codex|claude-code|claude-desktop>]
  open-slidex validate [presentation.mdx]
  open-slidex render [presentation.mdx] --montage --out <file.png>
  open-slidex export [presentation.mdx] --format <html|mdx|pptx> --out <file> [--overwrite]

Examples:
  open-slidex workspace ~/Presentations
  npx open-slidex@0.3.4 init my-deck
  open-slidex init my-deck --template summer-time-report --locale zh-TW
  cd my-deck && npm run dev
  open-slidex mcp --project ./my-deck --print-config codex
  open-slidex mcp --workspace ~/Presentations --print-config codex
`;
}
