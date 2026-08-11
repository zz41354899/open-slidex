import { spawn } from "node:child_process";
import { cp, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SlideXProject } from "./server/project";
import { startWorkbenchServer } from "./server/http";

void main().catch((error: unknown) => {
  process.stderr.write(`open-slidex-workbench: ${error instanceof Error ? error.message : "Unknown error."}\n`);
  process.exitCode = 1;
});

async function main() {
  const [command = "help", ...args] = process.argv.slice(2);
  if (command === "--version" || command === "-v") {
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    process.stdout.write(`${packageJson.version}\n`);
    return;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(help());
    return;
  }

  const project = new SlideXProject(process.cwd());
  await project.prepare();

  if (command === "dev") {
    const requestedPort = numberOption(args, "--port") ?? 4173;
    const port = await availablePort(requestedPort);
    const clientRoot = fileURLToPath(new URL("./client/", import.meta.url));
    const running = await startWorkbenchServer({ clientRoot, port, project });
    const url = `http://127.0.0.1:${running.port}`;
    process.stdout.write(`OpenSlideX Workbench: ${url}\n`);
    process.stdout.write("Press Ctrl-C to stop.\n");
    if (!args.includes("--no-open")) openBrowser(url);
    await waitForSignal();
    await running.close();
    return;
  }

  if (command === "build") {
    const output = await project.buildStaticSite();
    process.stdout.write(`Built static presentation: ${output}\n`);
    return;
  }

  if (command === "preview") {
    const root = path.join(project.distRoot, "site");
    if (!(await isDirectory(root))) throw new Error("Run open-slidex-workbench build first.");
    const requestedPort = numberOption(args, "--port") ?? 4174;
    const port = await availablePort(requestedPort);
    const server = createServer(async (request, response) => {
      const requested = request.url === "/" ? "index.html" : (request.url ?? "").slice(1);
      const filePath = path.resolve(root, requested);
      if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== path.join(root, "index.html")) {
        response.writeHead(404).end();
        return;
      }
      const bytes = await readFile(filePath).catch(() => null);
      if (!bytes) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { "content-type": filePath.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
      response.end(bytes);
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
    process.stdout.write(`OpenSlideX Preview: http://127.0.0.1:${port}\n`);
    await waitForSignal();
    server.close();
    return;
  }

  if (command === "sync:skills") {
    const skillsRoot = fileURLToPath(new URL("../skills/", import.meta.url));
    const target = path.join(project.root, ".agents", "skills");
    await mkdir(target, { recursive: true });
    for (const entry of await readdir(skillsRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        await cp(path.join(skillsRoot, entry.name), path.join(target, entry.name), {
          force: true,
          recursive: true
        });
      }
    }
    process.stdout.write("Synchronized OpenSlideX project skills.\n");
    return;
  }

  throw new Error(`Unknown command: ${command}. Run open-slidex-workbench --help.`);
}

function help() {
  return `OpenSlideX Local Workbench

Usage:
  open-slidex-workbench dev [--port 4173] [--no-open]
  open-slidex-workbench build
  open-slidex-workbench preview [--port 4174]
  open-slidex-workbench sync:skills
  open-slidex-workbench --version
`;
}

function numberOption(args: readonly string[], name: string) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = Number(args[index + 1]);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error(`${name} must be a port between 1024 and 65535.`);
  }
  return value;
}

async function availablePort(start: number) {
  for (let port = start; port < start + 20; port += 1) {
    if (await canListen(port)) return port;
  }
  throw new Error(`No available port between ${start} and ${start + 19}.`);
}

function canListen(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

function waitForSignal() {
  return new Promise<void>((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
}

function openBrowser(url: string) {
  const command =
    process.platform === "darwin"
      ? { args: [url], file: "open" }
      : process.platform === "win32"
        ? { args: ["/c", "start", "", url], file: "cmd" }
        : { args: [url], file: "xdg-open" };
  const child = spawn(command.file, command.args, {
    detached: true,
    stdio: "ignore"
  });
  child.on("error", () => undefined);
  child.unref();
}

async function isDirectory(filePath: string) {
  return stat(filePath).then((value) => value.isDirectory(), () => false);
}
