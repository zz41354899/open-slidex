import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const starterRoot = path.join(repositoryRoot, "examples", "starter");
const cliEntry = path.join(repositoryRoot, "packages", "open-slidex", "dist", "cli.mjs");

const child = spawn(process.execPath, [cliEntry, "dev", ...process.argv.slice(2)], {
  cwd: starterRoot,
  env: process.env,
  stdio: "inherit",
});

child.once("error", (error) => {
  process.stderr.write(`open-slidex: ${error.message}\n`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.exitCode = 1;
    return;
  }

  process.exitCode = code ?? 1;
});
