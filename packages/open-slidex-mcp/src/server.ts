import { createHash, randomUUID } from "node:crypto";
import { basename, dirname, extname, join, resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { access, mkdir, readFile, readdir, realpath, stat } from "node:fs/promises";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v4";

import {
  applySlideXBatch,
  motionDocChartMotions,
  motionDocChartTypes,
  motionDocSlideSourceRanges,
  parseMotionDoc,
  summarizeMotionDoc
} from "@open-slidex/sdk";
import {
  analyzeSlideXDocumentQuality,
  importSlideXImageAsset,
  resolveInsideRoot,
  SlideXFileDocumentAdapter,
  type SlideXQualityReport,
  SlideXRevisionConflictError
} from "@open-slidex/sdk/node";
import { readOpenSlideXKnowledgeResource, searchOpenSlideXKnowledge } from "./knowledge";
import {
  openSlideXGuidanceIntents,
  readOpenSlideXProjectGuidanceManifest,
  readOpenSlideXProjectGuidanceResource
} from "./projectGuidance";
import {
  appendImageProvenance,
  downloadTrustedImage,
  searchTrustedImages
} from "./trustedImages";

const projectRoot = projectRootFromArgs(process.argv.slice(2));
const adapter = new SlideXFileDocumentAdapter({ projectRoot });
const workspaceRoot = workspaceRootFromArgs(process.argv.slice(2));
const authorableMotionDocTags = new Set([
  "Chart",
  "ImageBlock",
  "Shape",
  "Slide",
  "Table",
  "Text",
  "VideoBlock"
]);
const removedMotionDocTags = ["Card", "Group", "Icon", "Metric", "Notes", "Stack", "Title"] as const;

class SlideXVisualQualityGateError extends Error {
  readonly currentRevision: string;
  readonly preview: SlideXQualityReport["preview"];
  readonly report: SlideXQualityReport;
  readonly rejectedCandidateId: string;

  constructor(currentRevision: string, report: SlideXQualityReport, rejectedCandidateId: string) {
    const findings = report.issues
      .filter((issue) => issue.severity === "error")
      .slice(0, 8)
      .map((issue) => `slide ${issue.slideIndex + 1} ${issue.code} (${issue.nodeIds.join(" + ")})`)
      .join("; ");
    super(
      `Candidate edit was not written because visual QA found ${report.summary.errorCount} blocking ` +
      `error${report.summary.errorCount === 1 ? "" : "s"}. ${findings}`
    );
    this.name = "SlideXVisualQualityGateError";
    this.currentRevision = currentRevision;
    this.preview = report.preview;
    this.report = report;
    this.rejectedCandidateId = rejectedCandidateId;
  }
}

export function createOpenSlideXMcpServer(root: string | { workspaceRoot: string } = projectRoot) {
  const configuredWorkspaceRoot = typeof root === "string" ? undefined : resolve(root.workspaceRoot);
  const workspace = typeof root === "string" ? undefined : new OpenSlideXWorkspaceMcpScope(configuredWorkspaceRoot!);
  const fixedRoot = typeof root === "string" ? root : undefined;
  const projectContext = async () => {
    const resolvedRoot = fixedRoot ?? await workspace!.selectedRoot();
    return {
      documentAdapter: resolvedRoot === projectRoot ? adapter : new SlideXFileDocumentAdapter({ projectRoot: resolvedRoot }),
      root: resolvedRoot
    };
  };
  const server = new McpServer(
    { name: "open-slidex-local", version: "0.3.6" },
    {
      instructions: [
        "For Workspace scope, use open_slidex_workspace to list and explicitly select the intended presentation.",
        "Use open_slidex_read first to obtain the current revision, exact source scope, and a small skill manifest.",
        "Follow progressive disclosure: read each recommended SKILL.md, then only the reference files it routes to by passing their exact resourcePath back to open_slidex_read.",
        "Search user notes, documents, and research in knowledge/ with knowledgeQuery, then read one returned resourcePath at a time.",
        "Author only toolbar-native layers: Text, ImageBlock, VideoBlock, Chart, Table, and Shape.",
        "Card, Metric, Stack, Group, Title, Icon, and Notes no longer exist and make a document invalid.",
        "The project skills own narrative and visual direction; the MCP server owns safe file access, revision control, validation, and rendered quality gates.",
        "Submit either one complete deck source or one complete slide source to open_slidex_edit; it validates and visually checks the candidate before writing."
      ].join(" ")
    }
  );
  const rejectedCandidates = new Map<string, {
    attempts: number;
    expectedRevision: string;
    expiresAt: number;
    source: string;
  }>();

  if (workspace) {
    server.registerTool("open_slidex_workspace", {
      title: "Choose an OpenSlideX workspace presentation",
      description: "List Workspace decks or select exactly one deck for all later read, edit, media, and review calls.",
      inputSchema: {
        action: z.enum(["list", "select"]).default("list"),
        presentationId: z.string().regex(/^[A-Za-z0-9._-]+$/).optional()
      }
    }, ({ action, presentationId }) => runTool(() => {
      if (action === "select") {
        if (!presentationId) throw new Error("presentationId is required when action is select.");
        return workspace.select(presentationId);
      }
      return workspace.list();
    }));
  }

  server.registerTool("open_slidex_read", {
    title: "Read OpenSlideX source or one project resource",
    description: "Read the current deck or slide plus a compact guidance manifest. Search knowledge/ by query, or load exactly one returned skill/reference/knowledge resourcePath at a time.",
    inputSchema: {
      intent: z.enum(openSlideXGuidanceIntents).default("authoring").describe(
        "Task route for the manifest: create, redesign, design, authoring, motion, or qa."
      ),
      knowledgeQuery: z.string().trim().max(500).optional().describe(
        "Search terms for user files under knowledge/. Results are compact citations with readable resourcePath values."
      ),
      resourceCursor: z.number().int().min(0).default(0).describe(
        "Continuation cursor returned when a long knowledge resource has more chunks."
      ),
      resourcePath: z.string().trim().min(1).max(500).optional().describe(
        "Exact .agents/skills/... or knowledge/... path returned by a previous read. Loads only that resource."
      ),
      slideIndex: z.number().int().min(0).optional().describe(
        "Zero-based slide index for a focused source read; omit for the complete deck."
      )
    }
  }, ({ intent, knowledgeQuery, resourceCursor, resourcePath, slideIndex }) => runTool(async () => {
    const { documentAdapter, root } = await projectContext();
    const guidanceRoot = await resolveAuthoringGuidanceRoot(root, configuredWorkspaceRoot);
    if (resourcePath) {
      if (slideIndex !== undefined || knowledgeQuery) {
        throw new Error("resourcePath cannot be combined with slideIndex or knowledgeQuery.");
      }
      if (resourcePath.startsWith(".agents/skills/")) {
        return {
          guidance: await readOpenSlideXProjectGuidanceResource(guidanceRoot, resourcePath),
          mode: "resource"
        };
      }
      if (resourcePath.startsWith("knowledge/")) {
        return {
          knowledge: await readOpenSlideXKnowledgeResource(root, resourcePath, resourceCursor),
          mode: "resource"
        };
      }
      throw new Error("resourcePath must be an exact .agents/skills/... or knowledge/... path returned by open_slidex_read.");
    }
    if (resourceCursor !== 0) throw new Error("resourceCursor requires a knowledge resourcePath.");

    const document = await documentAdapter.open();
    const [guidance, knowledge] = await Promise.all([
      readOpenSlideXProjectGuidanceManifest(guidanceRoot, intent).catch((error: unknown) => ({
        error: error instanceof Error ? error.message : "Project skill guidance is unavailable.",
        intent,
        mode: "unavailable"
      })),
      knowledgeQuery ? searchOpenSlideXKnowledge(root, knowledgeQuery, 8) : undefined
    ]);
    const ranges = motionDocSlideSourceRanges(document.source);
    if (slideIndex !== undefined && !ranges[slideIndex]) throw new Error(`Slide index is out of range: ${slideIndex}`);
    const summary = summarizeMotionDoc(document.source);
    return {
      authoringContract: {
        allowed: ["Text", "ImageBlock", "VideoBlock", "Chart", "Table", "Shape"],
        removed: removedMotionDocTags,
        geometry: "Every visible layer needs stable id plus explicit percentage x/y/w/h; fontSize uses pt.",
        rule: "Removed tags are rejected, not parsed for compatibility. Put all visible copy inside positioned Text layers."
      },
      charts: { motions: motionDocChartMotions, types: motionDocChartTypes },
      guidance,
      knowledge,
      revision: document.revision,
      source: slideIndex === undefined ? document.source : ranges[slideIndex]!.source,
      stats: summary.stats,
      title: document.title,
      validation: summary.validation,
      workflow: [
        "Read the recommended SKILL.md files and only their task-relevant references.",
        "Plan hierarchy and geometry from the current source before writing.",
        "Submit one complete deck or slide source to open_slidex_edit with this revision.",
        "If rejected, patch the same candidate from the reported node-specific findings."
      ]
    };
  }));

  const mediaSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("search-trusted"), query: z.string().trim().min(2).max(200) }),
    z.object({
      action: z.literal("import-trusted"),
      confirmedByUser: z.literal(true),
      expectedRevision: z.string().startsWith("sha256:"),
      providerAssetId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/)
    }),
    z.object({
      action: z.literal("import-local"),
      expectedRevision: z.string().startsWith("sha256:"),
      filePath: z.string().min(1)
    })
  ]);
  server.registerTool("open_slidex_media", {
    title: "Search or import OpenSlideX media",
    description: "One media workflow: search trusted Unsplash candidates, import one user-confirmed candidate, or import a root-confined local image as content-addressed WebP.",
    inputSchema: mediaSchema
  }, (input) => runTool(async () => {
    if (input.action === "search-trusted") {
      return searchTrustedImages(input.query, { accessKey: process.env.UNSPLASH_ACCESS_KEY });
    }
    const { documentAdapter, root } = await projectContext();
    const current = await documentAdapter.open();
    if (current.revision !== input.expectedRevision) throw new SlideXRevisionConflictError(current.revision);
    if (input.action === "import-trusted") {
      const downloaded = await downloadTrustedImage(input.providerAssetId, { accessKey: process.env.UNSPLASH_ACCESS_KEY });
      const asset = await importSlideXImageAsset({
        bytes: downloaded.bytes,
        fileName: `unsplash-${input.providerAssetId}.${downloaded.mediaType.split("/")[1] ?? "jpg"}`,
        mediaType: downloaded.mediaType,
        projectRoot: root
      });
      await appendImageProvenance(root, {
        ...downloaded.photo,
        importedAt: new Date().toISOString(),
        source: asset.source
      });
      return { ...asset, provenance: downloaded.photo, revision: current.revision };
    }
    if (/^(?:data|blob|https?):/i.test(input.filePath)) throw new Error("filePath must be a local file path, not Base64 or a URL.");
    const inputPath = resolveInsideRoot(root, input.filePath);
    await access(inputPath);
    const canonicalRoot = await realpath(root);
    const canonicalInput = resolveInsideRoot(canonicalRoot, await realpath(inputPath));
    const asset = await importSlideXImageAsset({
      bytes: new Uint8Array(await readFile(canonicalInput)),
      fileName: basename(canonicalInput),
      mediaType: imageMediaType(extname(canonicalInput)),
      projectRoot: root
    });
    return { ...asset, revision: current.revision };
  }));

  server.registerTool("open_slidex_review", {
    title: "Review OpenSlideX presentation",
    description: "Run structural validation and rendered visual QA together, returning one immutable slide or montage preview. Use for review-only work; edits already include this gate.",
    inputSchema: {
      scope: z.enum(["deck", "slide"]).default("deck"),
      slideIndex: z.number().int().min(0).optional()
    }
  }, ({ scope, slideIndex }, extra) => runTool(async () => {
    const { documentAdapter, root } = await projectContext();
    const document = await documentAdapter.open();
    const mode = scope === "slide" ? "slide" : "deck";
    const revisionDirectory = document.revision.replace(/^sha256:/, "");
    const dist = resolveInsideRoot(root, join("dist", "renders", revisionDirectory));
    await mkdir(dist, { recursive: true });
    const previewOutputPath = join(dist, mode === "deck" ? "montage.png" : `slide-${slideIndex ?? 0}.png`);
    const report = await analyzeSlideXDocumentQuality({
      mode,
      previewOutputPath,
      projectRoot: root,
      slideIndex: mode === "slide" ? slideIndex ?? 0 : undefined,
      source: document.source,
      title: document.title,
      signal: extra.signal
    });
    return {
      preview: report.preview,
      report,
      revision: document.revision,
      validation: summarizeMotionDoc(document.source).validation
    };
  }));

  server.registerTool("open_slidex_edit", {
    title: "Edit OpenSlideX presentation",
    description: "Replace one complete deck or one complete slide. The server rejects removed components, validates deterministic geometry, render-checks the candidate, and atomically writes only when visual QA passes.",
    inputSchema: {
      expectedRevision: z.string().startsWith("sha256:"),
      rejectedCandidateId: z.string().uuid().optional(),
      slideIndex: z.number().int().min(0).optional(),
      source: z.string().min(1),
      target: z.enum(["deck", "slide"])
    }
  }, ({ expectedRevision, rejectedCandidateId, slideIndex, source, target }, extra) => runTool(async () => {
    const { documentAdapter, root } = await projectContext();
    extra.signal.throwIfAborted();
    const current = await documentAdapter.open();
    if (current.revision !== expectedRevision) throw new SlideXRevisionConflictError(current.revision);
    pruneRejectedCandidates(rejectedCandidates);
    const rejected = rejectedCandidateId ? rejectedCandidates.get(rejectedCandidateId) : undefined;
    if (rejectedCandidateId && !rejected) {
      throw new Error("The rejected candidate expired or is unavailable. Build a fresh candidate from the current revision.");
    }
    if (rejected && rejected.expectedRevision !== expectedRevision) {
      throw new SlideXRevisionConflictError(current.revision);
    }
    if (rejected && rejected.attempts >= 3) {
      throw new Error("The rejected candidate reached its patch retry limit. Build a materially different candidate.");
    }
    const baseSource = rejected?.source ?? current.source;
    if (target === "slide" && slideIndex === undefined) {
      throw new Error("slideIndex is required when target is slide.");
    }
    const candidateSource = target === "deck"
      ? source
      : applySlideXBatch(baseSource, [{ slideIndex: slideIndex!, slideSource: source, type: "slide.replace" }]).source;
    assertToolbarNativeDocument(candidateSource);
    const candidateDocument = parseMotionDoc(candidateSource);
    const validation = summarizeMotionDoc(candidateSource).validation;
    const blockingValidation = validation.issues.filter((issue) => issue.severity === "error");
    if (blockingValidation.length > 0) {
      throw new Error(`Candidate source is invalid: ${blockingValidation.slice(0, 6).map((issue) => issue.message).join(" ")}`);
    }
    const candidateRevision = createCandidateRevision(candidateSource);
    const qualityScope = target === "slide"
      ? { mode: "slide" as const, slideIndex }
      : { mode: "deck" as const };
    const previewOutputPath = resolveInsideRoot(root, join(
      "dist",
      "renders",
      candidateRevision.replace(/^sha256:/, ""),
      qualityScope.mode === "slide" ? `slide-${slideIndex}.png` : "montage.png"
    ));
    const quality = await analyzeSlideXDocumentQuality({
      ...qualityScope,
      previewOutputPath,
      projectRoot: root,
      source: candidateSource,
      title: candidateDocument.title,
      signal: extra.signal
    });
    if (!quality.passed) {
      const candidateId = rejectedCandidateId ?? randomUUID();
      rejectedCandidates.set(candidateId, {
        attempts: (rejected?.attempts ?? 0) + 1,
        expectedRevision,
        expiresAt: Date.now() + 10 * 60_000,
        source: candidateSource
      });
      throw new SlideXVisualQualityGateError(current.revision, quality, candidateId);
    }
    extra.signal.throwIfAborted();
    const document = await documentAdapter.save({
      expectedRevision,
      source: candidateSource,
      title: candidateDocument.title
    });
    if (rejectedCandidateId) rejectedCandidates.delete(rejectedCandidateId);
    return {
      candidateQuality: quality,
      preview: quality.preview,
      revision: document.revision,
      stats: summarizeMotionDoc(document.source).stats,
      title: document.title,
      validation: summarizeMotionDoc(document.source).validation
    };
  }));

  return server;
}

async function resolveAuthoringGuidanceRoot(deckRoot: string, configuredWorkspaceRoot?: string) {
  const candidates = [
    deckRoot,
    ...(configuredWorkspaceRoot ? [dirname(configuredWorkspaceRoot), configuredWorkspaceRoot] : [])
  ];
  for (const candidate of [...new Set(candidates)]) {
    try {
      const skillDirectory = await stat(join(candidate, ".agents", "skills"));
      if (skillDirectory.isDirectory()) return candidate;
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") throw error;
    }
  }
  return deckRoot;
}

function assertToolbarNativeDocument(source: string) {
  const removed = removedMotionDocTags.filter((tag) => new RegExp(`<${tag}\\b`).test(source));
  if (removed.length > 0) {
    throw new Error(
      `Removed MotionDoc component${removed.length === 1 ? "" : "s"}: ${removed.join(", ")}. ` +
      "These tags are no longer parsed or supported."
    );
  }
  for (const [slideIndex, range] of motionDocSlideSourceRanges(source).entries()) {
    assertToolbarNativeSlideSource(range.source, `slide ${slideIndex + 1}`);
  }
}

function assertToolbarNativeSlideSource(source: string, label: string) {
  const tags = [...source.matchAll(/<\/?([A-Z][A-Za-z0-9]*)\b/g)].map((match) => match[1]);
  const forbidden = [...new Set(tags.filter((tag) => !authorableMotionDocTags.has(tag)))];
  if (forbidden.length > 0) {
    throw new Error(
      `${label} may only use Workspace toolbar layers. ` +
      `Unsupported component${forbidden.length === 1 ? "" : "s"}: ${forbidden.join(", ")}. ` +
      "Use Text, ImageBlock, VideoBlock, Chart, Table, or Shape with explicit geometry."
    );
  }

  for (const match of source.matchAll(/<(Text|Chart|ImageBlock|Shape|Table|VideoBlock)\b([^>]*)>/g)) {
    const tag = match[1];
    const attributes = match[2] ?? "";
    const missing = ["id", "x", "y", "w", "h"].filter(
      (key) => !new RegExp(`\\b${key}\\s*=`).test(attributes)
    );
    if (missing.length > 0) {
      throw new Error(
        `${label} <${tag}> is missing deterministic layer attributes: ${missing.join(", ")}. ` +
        "Every MCP-authored visible layer needs a stable id and explicit percentage x/y/w/h geometry."
      );
    }
  }

  const visibleRemainder = source
    .replace(/<Text\b[^>]*>[\s\S]*?<\/Text>/g, "")
    .replace(/<(?:Chart|ImageBlock|Shape|Table|VideoBlock)\b[^>]*\/>/g, "")
    .replace(/<\/?Slide\b[^>]*>/g, "")
    .trim();
  if (visibleRemainder) {
    throw new Error(
      `${label} contains visible Markdown or malformed component markup outside toolbar-native layers. ` +
      "Put visible copy inside positioned <Text> layers."
    );
  }
}

class OpenSlideXWorkspaceMcpScope {
  private selectedPresentationId?: string;
  readonly workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = resolve(workspaceRoot);
  }

  async list() {
    // A freshly initialized starter may configure MCP before its first
    // Workspace launch has created the local deck directory. Treat that as an
    // empty Workspace instead of leaking ENOENT through the MCP tool call.
    const entries = await readdir(this.workspaceRoot, { withFileTypes: true }).catch((error: unknown) => {
      if (isNodeError(error) && error.code === "ENOENT") return [];
      throw error;
    });
    const described = await Promise.all(entries.flatMap((entry) => {
      if (!entry.isDirectory() || entry.name.startsWith(".") || !/^[A-Za-z0-9._-]+$/.test(entry.name)) return [];
      return [this.describe(entry.name)];
    }));
    const presentations = described.filter((value) => value !== undefined);
    presentations.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    if (!this.selectedPresentationId && presentations[0]) this.selectedPresentationId = presentations[0].id;
    if (this.selectedPresentationId && !presentations.some((item) => item.id === this.selectedPresentationId)) {
      this.selectedPresentationId = presentations[0]?.id;
    }
    return {
      presentations,
      selectedPresentationId: this.selectedPresentationId,
      workspaceRoot: this.workspaceRoot
    };
  }

  async select(presentationId: string) {
    const snapshot = await this.list();
    const presentation = snapshot.presentations.find((item) => item.id === presentationId);
    if (!presentation) throw new Error(`Workspace presentation was not found: ${presentationId}`);
    this.selectedPresentationId = presentation.id;
    return { presentation, selectedPresentationId: presentation.id };
  }

  async selectedRoot() {
    const snapshot = await this.list();
    if (!snapshot.selectedPresentationId) {
      throw new Error("This OpenSlideX workspace has no presentations. Create or import one in Workspace first.");
    }
    return resolve(this.workspaceRoot, snapshot.selectedPresentationId);
  }

  private async describe(id: string) {
    const root = resolve(this.workspaceRoot, id);
    const sourceStats = await stat(resolve(root, "presentation.mdx")).catch(() => undefined);
    if (!sourceStats?.isFile()) return undefined;
    try {
      const document = await new SlideXFileDocumentAdapter({ projectRoot: root }).open();
      return { id, root, title: document.title, updatedAt: sourceStats.mtime.toISOString() };
    } catch {
      return undefined;
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

async function main() {
  const configurationRoot = workspaceRoot ?? projectRoot;
  const printPromptIndex = process.argv.indexOf("--print-setup-prompt");
  if (printPromptIndex >= 0) {
    const client = parseMcpClient(process.argv[printPromptIndex + 1]);
    process.stdout.write(`${workspaceRoot
      ? openSlideXWorkspaceMcpSetupPrompt(client, configurationRoot, platformFromArgs(process.argv))
      : openSlideXMcpSetupPrompt(client, configurationRoot, platformFromArgs(process.argv))}\n`);
    return;
  }
  const printConfigIndex = process.argv.indexOf("--print-config");
  if (printConfigIndex >= 0) {
    const client = parseMcpClient(process.argv[printConfigIndex + 1]);
    process.stdout.write(`${workspaceRoot
      ? openSlideXWorkspaceMcpConfig(client, configurationRoot, platformFromArgs(process.argv))
      : openSlideXMcpConfig(client, configurationRoot, platformFromArgs(process.argv))}\n`);
    return;
  }
  if (!workspaceRoot) await adapter.open();
  const server = workspaceRoot
    ? createOpenSlideXMcpServer({ workspaceRoot })
    : createOpenSlideXMcpServer();
  await server.connect(new StdioServerTransport());
  process.stderr.write(`OpenSlideX MCP connected to ${workspaceRoot ? `workspace ${workspaceRoot}` : projectRoot}\n`);
}

export type OpenSlideXMcpClient = "claude" | "claude-code" | "claude-desktop" | "codex";
export type OpenSlideXPlatform = "macos" | "windows";
export const openSlideXMcpNpxPackage = "open-slidex@latest";

export function openSlideXMcpConfig(
  client: OpenSlideXMcpClient,
  root: string,
  platform: OpenSlideXPlatform = process.platform === "win32" ? "windows" : "macos"
) {
  const absoluteRoot = platform === "windows" && /^[A-Za-z]:[\\/]/.test(root)
    ? win32.resolve(root)
    : resolve(root);
  const command = platform === "windows" ? "cmd" : "npx";
  const args = platform === "windows"
    ? ["/c", "npx", "-y", openSlideXMcpNpxPackage, "mcp", "--project", absoluteRoot]
    : ["-y", openSlideXMcpNpxPackage, "mcp", "--project", absoluteRoot];
  if (client === "codex") {
    return `[mcp_servers.open_slidex]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}`;
  }
  if (client === "claude-desktop") {
    return JSON.stringify({
      mcpServers: {
        open_slidex: { args, command, type: "stdio" }
      }
    }, null, 2);
  }
  const launch = platform === "windows"
    ? `cmd /c npx -y ${openSlideXMcpNpxPackage} mcp --project ${windowsQuote(absoluteRoot)}`
    : `npx -y ${openSlideXMcpNpxPackage} mcp --project ${shellQuote(absoluteRoot)}`;
  return `claude mcp add open-slidex -- ${launch}`;
}

export function openSlideXWorkspaceMcpConfig(
  client: OpenSlideXMcpClient,
  root: string,
  platform: OpenSlideXPlatform = process.platform === "win32" ? "windows" : "macos"
) {
  const absoluteRoot = platform === "windows" && /^[A-Za-z]:[\\/]/.test(root)
    ? win32.resolve(root)
    : resolve(root);
  const command = platform === "windows" ? "cmd" : "npx";
  const args = platform === "windows"
    ? ["/c", "npx", "-y", openSlideXMcpNpxPackage, "mcp", "--workspace", absoluteRoot]
    : ["-y", openSlideXMcpNpxPackage, "mcp", "--workspace", absoluteRoot];
  if (client === "codex") {
    return `[mcp_servers.open_slidex_workspace]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}`;
  }
  if (client === "claude-desktop") {
    return JSON.stringify({
      mcpServers: {
        open_slidex_workspace: { args, command, type: "stdio" }
      }
    }, null, 2);
  }
  const launch = platform === "windows"
    ? `cmd /c npx -y ${openSlideXMcpNpxPackage} mcp --workspace ${windowsQuote(absoluteRoot)}`
    : `npx -y ${openSlideXMcpNpxPackage} mcp --workspace ${shellQuote(absoluteRoot)}`;
  return `claude mcp add --scope user open-slidex-workspace -- ${launch}`;
}

export function openSlideXMcpSetupPrompt(
  client: OpenSlideXMcpClient,
  root: string,
  platform: OpenSlideXPlatform = process.platform === "win32" ? "windows" : "macos"
) {
  const absoluteRoot = platform === "windows" && /^[A-Za-z]:[\\/]/.test(root)
    ? win32.resolve(root)
    : resolve(root);
  const target = client === "claude" ? "Claude Code" : client === "claude-code"
    ? "Claude Code"
    : client === "claude-desktop"
      ? "Claude Desktop"
      : "Codex";
  return [
    `Configure the local OpenSlideX MCP server for ${target} on ${platform}.`,
    `The only allowed deck root is: ${absoluteRoot}`,
    "Replace an older open_slidex_workspace entry only when it targets this same deck. Preserve every unrelated MCP entry, do not widen the project path, and do not copy credentials.",
    "Show me the exact proposed change before writing any global configuration file.",
    "Use this generated configuration:",
    "",
    openSlideXMcpConfig(client, absoluteRoot, platform),
    "",
    "After configuration, restart the client when required and verify open_slidex_read, open_slidex_edit with expectedRevision, and open_slidex_review."
  ].join("\n");
}

export function openSlideXWorkspaceMcpSetupPrompt(
  client: OpenSlideXMcpClient,
  root: string,
  platform: OpenSlideXPlatform = process.platform === "win32" ? "windows" : "macos"
) {
  const absoluteRoot = platform === "windows" && /^[A-Za-z]:[\\/]/.test(root)
    ? win32.resolve(root)
    : resolve(root);
  const target = client === "codex" ? "Codex" : client === "claude-desktop" ? "Claude Desktop" : "Claude Code";
  return [
    `Configure one user-level OpenSlideX Workspace MCP server for ${target} on ${platform}.`,
    `Restrict it to this exact workspace root: ${absoluteRoot}`,
    "Preserve every unrelated MCP entry and show the exact proposed change before writing any global configuration file.",
    "Use this generated configuration:",
    "",
    openSlideXWorkspaceMcpConfig(client, absoluteRoot, platform),
    "",
    "After restarting the client, use open_slidex_workspace to list and select a presentation, then verify open_slidex_read and open_slidex_review."
  ].join("\n");
}

function parseMcpClient(value: string | undefined): OpenSlideXMcpClient {
  if (value === "codex" || value === "claude" || value === "claude-code" || value === "claude-desktop") return value;
  throw new Error("MCP client must be codex, claude-code, or claude-desktop.");
}

function platformFromArgs(args: string[]): OpenSlideXPlatform {
  const index = args.indexOf("--platform");
  const value = index >= 0 ? args[index + 1] : undefined;
  if (value === "windows" || value === "macos") return value;
  if (value) throw new Error("--platform must be followed by macos or windows.");
  return process.platform === "win32" ? "windows" : "macos";
}

export function projectRootFromArgs(args: string[]) {
  const index = args.indexOf("--project");
  const value = index >= 0 ? args[index + 1] : undefined;
  if (index >= 0 && (!value || value.startsWith("--"))) {
    throw new Error("--project must be followed by a directory.");
  }
  return resolve(value || process.cwd());
}

export function workspaceRootFromArgs(args: string[]) {
  const index = args.indexOf("--workspace");
  const value = index >= 0 ? args[index + 1] : undefined;
  if (index >= 0 && (!value || value.startsWith("--"))) {
    throw new Error("--workspace must be followed by a directory.");
  }
  return value ? resolve(value) : undefined;
}

function imageMediaType(extension: string) {
  const types: Record<string, string> = {
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp"
  };
  return types[extension.toLowerCase()];
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function windowsQuote(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function sourceChecksum(source: string) {
  return createHash("sha256").update(source).digest("hex");
}

function createCandidateRevision(source: string) {
  return `sha256:${sourceChecksum(source)}`;
}

function pruneRejectedCandidates(
  candidates: Map<string, { expiresAt: number }>
) {
  const now = Date.now();
  for (const [id, candidate] of candidates) {
    if (candidate.expiresAt <= now) candidates.delete(id);
  }
  while (candidates.size > 20) {
    const oldest = candidates.keys().next().value;
    if (typeof oldest !== "string") break;
    candidates.delete(oldest);
  }
}

async function runTool(action: () => unknown | Promise<unknown>): Promise<CallToolResult> {
  try {
    const value = await action();
    return {
      content: [{ type: "text", text: JSON.stringify(value) }],
      structuredContent: value && typeof value === "object" ? value as Record<string, unknown> : { value }
    };
  } catch (error) {
    const qualityFailure = error instanceof SlideXVisualQualityGateError ? error : undefined;
    const currentRevision = error instanceof SlideXRevisionConflictError
      ? error.currentRevision
      : qualityFailure?.currentRevision;
    const payload = {
      code: qualityFailure ? "quality_gate_failed" : currentRevision ? "revision_conflict" : "open_slidex_error",
      currentRevision,
      message: error instanceof Error ? error.message : "OpenSlideX tool failed.",
      preview: qualityFailure?.preview,
      qualityReport: qualityFailure?.report,
      rejectedCandidateId: qualityFailure?.rejectedCandidateId
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      isError: true,
      structuredContent: payload
    };
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
