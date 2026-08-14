import { spawn } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SlideXProject } from "./server/project";
import { startWorkbenchServer } from "./server/http";
import { OpenSlideXWorkspace } from "./server/workspace";
import { startWorkspaceServer } from "./server/workspaceHttp";

const runtimeRequire = createRequire(import.meta.url);

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

  if (command === "workspace") {
    const port = numberOption(args, "--port") ?? 4172;
    if (!(await canListen(port))) {
      throw new Error(`Workspace port ${port} is already in use. Stop the existing server or choose --port <number>.`);
    }
    const invocationRoot = path.resolve(process.cwd());
    const workspaceRoot = path.resolve(invocationRoot, positionalOption(args) ?? "open-slidex-workspace");
    const invocationPresentation = await stat(path.join(invocationRoot, "presentation.mdx")).catch(() => undefined);
    const mcpPresentationRoot = invocationPresentation?.isFile() ? invocationRoot : undefined;
    const packagedSourceRoot = fileURLToPath(new URL("./source/", import.meta.url));
    const checkoutRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
    const configPath = new URL("./vite.config.mjs", import.meta.url);
    const workspaceUrl = `http://127.0.0.1:${port}/workspace`;
    const workspace = new OpenSlideXWorkspace({
      mcpPresentationRoot,
      root: workspaceRoot,
      templateRoot: await resolveTemplateRoot(),
      workspaceUrl
    });
    await workspace.prepare();
    const sourceRoot = await prepareWorkspaceSource(workspace, packagedSourceRoot, checkoutRoot);
    const running = await startWorkspaceServer({ port: 0, uiPort: port, workspace });
    const { createServer: createViteServer } = await import("vite");
    const { createSlideXWorkbenchViteConfig } = await import(configPath.href) as {
      createSlideXWorkbenchViteConfig(options: {
        apiPort: number;
        cacheDir: string;
        port: number;
        sourceRoot: string;
        workspaceUrl?: string;
      }): Record<string, unknown>;
    };
    const vite = await createViteServer(createSlideXWorkbenchViteConfig({
      apiPort: running.port,
      cacheDir: path.join(workspace.stateRoot, "vite-cache"),
      port,
      sourceRoot,
      workspaceUrl
    }));
    try {
      await vite.listen();
      const url = `http://127.0.0.1:${port}/workspace`;
      process.stdout.write(`OpenSlideX Workspace: ${url}\n`);
      process.stdout.write(`Local decks: ${workspace.root}\n`);
      process.stdout.write("Press Ctrl-C to stop.\n");
      if (!args.includes("--no-open")) openBrowser(url);
      await waitForSignal();
    } finally {
      await vite.close();
      await running.close();
    }
    return;
  }

  const project = new SlideXProject(process.cwd());
  await project.prepare();

  if (command === "dev") {
    const port = numberOption(args, "--port") ?? 4173;
    if (!(await canListen(port))) {
      throw new Error(`Workbench port ${port} is already in use. Stop the existing dev server or choose --port <number>.`);
    }
    const clientRoot = fileURLToPath(new URL("./client/", import.meta.url));
    const packagedSourceRoot = fileURLToPath(new URL("./source/", import.meta.url));
    const configPath = new URL("./vite.config.mjs", import.meta.url);
    if (!(await isDirectory(packagedSourceRoot))) {
      throw new Error("The Workbench HMR sources are missing. Reinstall or rebuild open-slidex.");
    }
    const sourceRoot = await prepareWorkbenchSource(project, packagedSourceRoot);
    const running = await startWorkbenchServer({ clientRoot, port: 0, project });
    const { createServer: createViteServer } = await import("vite");
    const { createSlideXWorkbenchViteConfig } = await import(configPath.href) as {
      createSlideXWorkbenchViteConfig(options: {
        apiPort: number;
        cacheDir: string;
        port: number;
        sourceRoot: string;
        workspaceUrl?: string;
      }): Record<string, unknown>;
    };
    const vite = await createViteServer(createSlideXWorkbenchViteConfig({
      apiPort: running.port,
      cacheDir: path.join(project.stateRoot, "vite-cache"),
      port,
      sourceRoot,
      workspaceUrl: process.env.OPEN_SLIDEX_WORKSPACE_URL
    }));
    try {
      await vite.listen();
      const url = `http://127.0.0.1:${port}`;
      process.stdout.write(`OpenSlideX Workbench HMR: ${url}\n`);
      process.stdout.write("Press Ctrl-C to stop.\n");
      if (!args.includes("--no-open")) openBrowser(url);
      await waitForSignal();
    } finally {
      await vite.close();
      await running.close();
    }
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
  open-slidex-workbench workspace [directory] [--port 4172] [--no-open]
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

function positionalOption(args: readonly string[]) {
  return args.find((value, index) => !value.startsWith("-") && args[index - 1] !== "--port");
}

async function availablePort(start: number, excluded = new Set<number>()) {
  for (let port = start; port < start + 20 && port <= 65535; port += 1) {
    if (!excluded.has(port) && await canListen(port)) return port;
  }
  throw new Error(`No available port between ${start} and ${Math.min(start + 19, 65535)}.`);
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

async function prepareWorkbenchSource(project: SlideXProject, packagedSourceRoot: string) {
  const checkoutClient = path.join(project.root, "packages/slidex-workbench/src/client");
  if (await isDirectory(checkoutClient)) return project.root;

  const target = path.join(project.stateRoot, "workbench-source");
  await rm(target, { force: true, recursive: true });
  await cp(packagedSourceRoot, target, { recursive: true });
  await rewritePackagedTailwindImport(target);
  return target;
}

async function rewritePackagedTailwindImport(sourceRoot: string) {
  const cssPath = path.join(sourceRoot, "packages/editor-ui/src/editor.css");
  const source = await readFile(cssPath, "utf8");
  const tailwindCssPath = runtimeRequire.resolve("tailwindcss/index.css").replaceAll(path.sep, "/");
  const rewritten = source.replace(
    '@import "tailwindcss" source(none);',
    `@import "${tailwindCssPath}" source(none);`
  );
  if (rewritten === source) throw new Error("The packaged Workbench Tailwind import could not be prepared.");
  await writeFile(cssPath, rewritten, "utf8");
}

async function prepareWorkspaceSource(
  _workspace: OpenSlideXWorkspace,
  packagedSourceRoot: string,
  checkoutRoot: string
) {
  const checkoutCandidates = [process.cwd(), checkoutRoot];
  for (const candidate of checkoutCandidates) {
    if (await isDirectory(path.join(candidate, "packages/slidex-workbench/src/client"))) return candidate;
  }
  if (!(await isDirectory(packagedSourceRoot))) {
    throw new Error("The Workspace UI sources are missing. Reinstall or rebuild open-slidex.");
  }
  return packagedSourceRoot;
}

async function resolveTemplateRoot() {
  const candidates = [
    process.env.OPEN_SLIDEX_TEMPLATE_ROOT,
    fileURLToPath(new URL("../../open-slidex/template/", import.meta.url)),
    path.join(process.cwd(), "packages/open-slidex/template")
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (await isDirectory(candidate)) return candidate;
  }
  throw new Error("The OpenSlideX starter template could not be located.");
}
