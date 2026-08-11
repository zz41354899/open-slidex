import { existsSync, statSync } from "node:fs";
import { chmod, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = path.join(rootDir, "packages/open-slidex");
const distDir = path.join(packageDir, "dist");
const runtimeDir = path.join(packageDir, "runtime");
const manifest = JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf8"));

await runBuild("build-slidex-sdk.mjs");
await runBuild("build-slidex-workbench.mjs");
await runBuild("build-open-slidex-mcp.mjs");

await mkdir(distDir, { recursive: true });
await build({
  absWorkingDir: rootDir,
  banner: { js: "#!/usr/bin/env node" },
  bundle: true,
  entryPoints: [path.join(packageDir, "src/cli.ts")],
  format: "esm",
  logLevel: "info",
  outfile: path.join(distDir, "create.mjs"),
  platform: "node",
  target: "node20",
  plugins: [rootAliasPlugin()]
});

function rootAliasPlugin() {
  return {
    name: "root-alias",
    setup(buildContext) {
      buildContext.onResolve({ filter: /^@\// }, (args) => {
        const basePath = path.join(rootDir, args.path.slice(2));
        const candidates = [basePath, `${basePath}.ts`, `${basePath}.tsx`, path.join(basePath, "index.ts")];
        const resolved = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
        return resolved ? { path: resolved } : { errors: [{ text: `Could not resolve ${args.path}` }] };
      });
    }
  };
}

await build({
  absWorkingDir: rootDir,
  banner: { js: "#!/usr/bin/env node" },
  bundle: true,
  entryPoints: [path.join(packageDir, "src/openSlideXCli.ts")],
  format: "esm",
  logLevel: "info",
  outfile: path.join(distDir, "cli.mjs"),
  platform: "node",
  target: "node20"
});

await chmod(path.join(distDir, "cli.mjs"), 0o755);
await rm(runtimeDir, { force: true, recursive: true });
await mkdir(runtimeDir, { recursive: true });
await Promise.all([
  cp(path.join(rootDir, "packages/slidex-sdk/dist"), path.join(runtimeDir, "sdk"), { recursive: true }),
  cp(path.join(rootDir, "packages/slidex-workbench/dist"), path.join(runtimeDir, "workbench"), { recursive: true }),
  cp(path.join(rootDir, "packages/open-slidex-mcp/dist"), path.join(runtimeDir, "mcp"), { recursive: true }),
  cp(path.join(rootDir, "packages/slidex-workbench/skills"), path.join(runtimeDir, "skills"), { recursive: true })
]);
await writeFile(
  path.join(runtimeDir, "package.json"),
  `${JSON.stringify({ name: "open-slidex-runtime", type: "module", version: manifest.version }, null, 2)}\n`,
  "utf8"
);

function runBuild(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(rootDir, "scripts", script)], {
      cwd: rootDir,
      stdio: "inherit"
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${script} exited with ${code ?? "unknown"}.`)));
  });
}
