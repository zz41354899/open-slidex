export type SlideXCliOptions =
  | { action: "help" }
  | { action: "version" }
  | { action: "validate"; file: string }
  | {
      action: "render";
      file: string;
      mode: "montage" | "slide";
      outputPath: string;
      slideIndex?: number;
    }
  | {
      action: "export";
      file: string;
      format: "html" | "mdx" | "pptx";
      outputPath: string;
      overwrite: boolean;
    };

export function parseSlideXCliArguments(args: readonly string[]): SlideXCliOptions {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return { action: "help" };
  }
  if (args.includes("--version") || args.includes("-v")) {
    return { action: "version" };
  }

  const [command, ...commandArgs] = args;
  if (command === "validate") {
    return {
      action: "validate",
      file: singleInputFile(commandArgs, "validate")
    };
  }
  if (command === "render") return parseRenderArguments(commandArgs);
  if (command === "export") return parseExportArguments(commandArgs);

  throw new Error(`Unknown command: ${command}. Run open-slidex --help.`);
}

export function createSlideXCliHelp() {
  return `Validate, render, and export an OpenSlideX MotionDoc.

Usage:
  open-slidex validate [presentation.mdx]
  open-slidex render [presentation.mdx] --montage --out <file.png>
  open-slidex render [presentation.mdx] --slide <index> --out <file.png>
  open-slidex export [presentation.mdx] --format <html|mdx|pptx> --out <file> [--overwrite]

Options:
  --montage       Render every slide into one contact sheet
  --slide <index> Render one zero-based slide index
  --format        Export as html, mdx, or pptx
  --out           Required output path for render and export
  --overwrite     Replace an existing export
  -h, --help      Show this help
  -v, --version   Show the installed SDK version
`;
}

function parseRenderArguments(args: readonly string[]): SlideXCliOptions {
  let file: string | undefined;
  let mode: "montage" | "slide" | undefined;
  let outputPath: string | undefined;
  let slideIndex: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--montage") {
      if (mode) throw new Error("Choose either --montage or --slide.");
      mode = "montage";
      continue;
    }
    if (argument === "--slide") {
      if (mode) throw new Error("Choose either --montage or --slide.");
      const value = requiredOptionValue(args, index, "--slide");
      slideIndex = Number(value);
      if (!Number.isInteger(slideIndex) || slideIndex < 0) {
        throw new Error("--slide must be a non-negative integer.");
      }
      mode = "slide";
      index += 1;
      continue;
    }
    if (argument === "--out") {
      outputPath = requiredOptionValue(args, index, "--out");
      index += 1;
      continue;
    }
    if (argument.startsWith("-")) {
      throw new Error(`Unknown render option: ${argument}.`);
    }
    if (file) throw new Error("render accepts only one presentation file.");
    file = argument;
  }

  if (!mode) throw new Error("render requires --montage or --slide <index>.");
  if (!outputPath) throw new Error("render requires --out <file.png>.");
  return {
    action: "render",
    file: file ?? "presentation.mdx",
    mode,
    outputPath,
    ...(slideIndex === undefined ? {} : { slideIndex })
  };
}

function parseExportArguments(args: readonly string[]): SlideXCliOptions {
  let file: string | undefined;
  let format: "html" | "mdx" | "pptx" | undefined;
  let outputPath: string | undefined;
  let overwrite = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--format") {
      const value = requiredOptionValue(args, index, "--format");
      if (value !== "html" && value !== "mdx" && value !== "pptx") {
        throw new Error("--format must be html, mdx, or pptx.");
      }
      format = value;
      index += 1;
      continue;
    }
    if (argument === "--out") {
      outputPath = requiredOptionValue(args, index, "--out");
      index += 1;
      continue;
    }
    if (argument === "--overwrite") {
      overwrite = true;
      continue;
    }
    if (argument.startsWith("-")) {
      throw new Error(`Unknown export option: ${argument}.`);
    }
    if (file) throw new Error("export accepts only one presentation file.");
    file = argument;
  }

  if (!format) throw new Error("export requires --format <html|mdx|pptx>.");
  if (!outputPath) throw new Error("export requires --out <file>.");
  return {
    action: "export",
    file: file ?? "presentation.mdx",
    format,
    outputPath,
    overwrite
  };
}

function singleInputFile(args: readonly string[], command: string) {
  const files = args.filter((argument) => !argument.startsWith("-"));
  const option = args.find((argument) => argument.startsWith("-"));
  if (option) throw new Error(`Unknown ${command} option: ${option}.`);
  if (files.length > 1) throw new Error(`${command} accepts only one presentation file.`);
  return files[0] ?? "presentation.mdx";
}

function requiredOptionValue(
  args: readonly string[],
  index: number,
  option: string
) {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}
