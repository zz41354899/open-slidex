import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSlideXCliHelp,
  parseSlideXCliArguments
} from "./cliOptions";
import {
  exportSlideXDocument,
  renderSlideXDocument
} from "./node";
import { summarizeMotionDoc } from "./index";

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown OpenSlideX CLI failure.";
  process.stderr.write(`slidex: ${message}\n`);
  process.exitCode = 1;
});

async function main() {
  const options = parseSlideXCliArguments(process.argv.slice(2));
  if (options.action === "help") {
    process.stdout.write(createSlideXCliHelp());
    return;
  }
  if (options.action === "version") {
    process.stdout.write(`${await packageVersion()}\n`);
    return;
  }

  const inputPath = path.resolve(options.file);
  const source = await readFile(inputPath, "utf8");
  if (options.action === "validate") {
    const summary = summarizeMotionDoc(source);
    const report = {
      file: inputPath,
      sceneCount: summary.stats.sceneCount,
      valid: summary.validation.isValid,
      issues: summary.validation.issues
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!summary.validation.isValid) process.exitCode = 1;
    return;
  }

  const outputPath = path.resolve(options.outputPath);
  if (options.action === "render") {
    const result = await renderSlideXDocument({
      mode: options.mode,
      outputPath,
      projectRoot: path.dirname(inputPath),
      ...(options.slideIndex === undefined ? {} : { slideIndex: options.slideIndex }),
      source
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const result = await exportSlideXDocument({
    format: options.format,
    outputPath,
    overwrite: options.overwrite,
    projectRoot: path.dirname(inputPath),
    source
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function packageVersion() {
  const packagePath = fileURLToPath(new URL("../package.json", import.meta.url));
  const source = await readFile(packagePath, "utf8");
  const parsed = JSON.parse(source) as { version?: unknown };
  if (typeof parsed.version !== "string") {
    throw new Error("The installed SDK package has no version.");
  }
  return parsed.version;
}
