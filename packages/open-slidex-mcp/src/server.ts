import { createHash, randomUUID } from "node:crypto";
import { basename, extname, join, resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { access, mkdir, readFile, readdir, realpath, stat } from "node:fs/promises";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v4";

import {
  applySlideXBatch,
  getSlideXCatalog,
  getOfficialTemplatePackage,
  getOfficialTemplateQualityProfile,
  inspectSlideXDocument,
  motionDocChartMotions,
  motionDocChartTypes,
  motionDocSlideSourceRanges,
  parseMotionDoc,
  stripNonLocalMotionDocMedia,
  summarizeMotionDoc,
  type SlideXEditCommand
} from "@open-slidex/sdk";
import {
  analyzeSlideXDocumentQuality,
  importSlideXImageAsset,
  renderSlideXDocument,
  resolveInsideRoot,
  SlideXFileDocumentAdapter,
  type SlideXQualityReport,
  SlideXRevisionConflictError
} from "@open-slidex/sdk/node";
import { searchOpenSlideXKnowledge } from "./knowledge";
import {
  openSlideXGuidanceIntents,
  openSlideXProjectSkillNames,
  readOpenSlideXProjectSkill,
  readOpenSlideXProjectSkillBundle,
  readOpenSlideXProjectSkillManifest,
  readOpenSlideXTemplateLock
} from "./projectGuidance";
import {
  appendImageProvenance,
  downloadTrustedImage,
  searchTrustedImages
} from "./trustedImages";

const projectRoot = projectRootFromArgs(process.argv.slice(2));
const adapter = new SlideXFileDocumentAdapter({ projectRoot });
const workspaceRoot = workspaceRootFromArgs(process.argv.slice(2));
const propValueSchema = z.union([z.string(), z.number(), z.boolean()]);
const propsSchema = z.record(z.string(), propValueSchema);
const editCommandSchema = z.discriminatedUnion("type", [
  z.object({ title: z.string(), type: z.literal("document.setTitle") }),
  z.object({ from: z.string(), to: z.string(), type: z.literal("asset.repath") }),
  z.object({ afterSlideIndex: z.number().int().min(0).optional(), slideSource: z.string().optional(), type: z.literal("slide.add") }),
  z.object({ slideIndex: z.number().int().min(0), type: z.literal("slide.delete") }),
  z.object({ slideIndex: z.number().int().min(0), type: z.literal("slide.duplicate") }),
  z.object({ fromIndex: z.number().int().min(0), toIndex: z.number().int().min(0), type: z.literal("slide.reorder") }),
  z.object({ slideIndex: z.number().int().min(0), slideSource: z.string(), type: z.literal("slide.replace") }),
  z.object({ layoutId: z.string(), options: propsSchema.optional(), slideIndex: z.number().int().min(0).optional(), type: z.literal("slide.applyLayout") }),
  z.object({ props: propsSchema, slideIndex: z.number().int().min(0), type: z.literal("slide.updateProps") }),
  z.object({ blockType: z.string(), options: z.record(z.string(), z.unknown()).optional(), slideIndex: z.number().int().min(0), type: z.literal("block.add") }),
  z.object({ blockIndex: z.number().int().min(0).optional(), nodeId: z.string().optional(), props: propsSchema.optional(), slideIndex: z.number().int().min(0), text: z.string().optional(), type: z.literal("block.update") }),
  z.object({ blockIndex: z.number().int().min(0).optional(), nodeId: z.string().optional(), slideIndex: z.number().int().min(0), type: z.literal("block.delete") }),
  z.object({ blockIndex: z.number().int().min(0).optional(), nodeId: z.string().optional(), offset: z.number().optional(), slideIndex: z.number().int().min(0), type: z.literal("block.duplicate") }),
  z.object({ fromIndex: z.number().int().min(0), slideIndex: z.number().int().min(0), toIndex: z.number().int().min(0), type: z.literal("block.reorder") })
]);

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
  const workspace = typeof root === "string" ? undefined : new OpenSlideXWorkspaceMcpScope(root.workspaceRoot);
  const fixedRoot = typeof root === "string" ? root : undefined;
  const projectContext = async () => {
    const resolvedRoot = fixedRoot ?? await workspace!.selectedRoot();
    return {
      documentAdapter: resolvedRoot === projectRoot ? adapter : new SlideXFileDocumentAdapter({ projectRoot: resolvedRoot }),
      root: resolvedRoot
    };
  };
  const server = new McpServer({ name: "open-slidex-local", version: "0.3.2" });
  const rejectedCandidates = new Map<string, {
    attempts: number;
    expectedRevision: string;
    expiresAt: number;
    source: string;
  }>();

  if (workspace) {
    server.registerTool("open_slidex_workspace_list", {
      title: "List OpenSlideX workspace presentations",
      description: "List presentation folders available to this workspace-scoped MCP server and show the active selection.",
      inputSchema: {}
    }, () => runTool(() => workspace.list()));
    server.registerTool("open_slidex_workspace_select", {
      title: "Select OpenSlideX workspace presentation",
      description: "Select one workspace presentation. All other open_slidex tools use this presentation until another is selected.",
      inputSchema: { presentationId: z.string().regex(/^[A-Za-z0-9._-]+$/) }
    }, ({ presentationId }) => runTool(() => workspace.select(presentationId)));
  }

  server.registerTool("open_slidex_open", {
    title: "Open OpenSlideX presentation",
    description: "Read the canonical local presentation.mdx and its SHA-256 revision.",
    inputSchema: { includeSource: z.boolean().default(true) }
  }, ({ includeSource }) => runTool(async () => {
    const { documentAdapter } = await projectContext();
    const document = await documentAdapter.open();
    const summary = summarizeMotionDoc(document.source);
    return {
      revision: document.revision,
      source: includeSource ? document.source : undefined,
      stats: summary.stats,
      title: document.title,
      validation: summary.validation
    };
  }));

  server.registerTool("open_slidex_inspect", {
    title: "Inspect OpenSlideX presentation",
    description: "Inspect one slide or selected node without returning unrelated deck source.",
    inputSchema: {
      nodeId: z.string().optional(),
      slideIndex: z.number().int().min(0).optional()
    }
  }, (input) => runTool(async () => {
    const { documentAdapter } = await projectContext();
    const document = await documentAdapter.open();
    return { revision: document.revision, result: inspectSlideXDocument(document.source, input) };
  }));

  server.registerTool("open_slidex_catalog", {
    title: "OpenSlideX component catalog",
    description: "Read only the component catalog section needed for the task. Use section 'all' only when planning a full deck.",
    inputSchema: {
      includeLayoutSource: z.boolean().default(false),
      section: z.enum(["all", "blocks", "design-rules", "exports", "layouts", "schema", "shaders"]).default("all")
    }
  }, ({ includeLayoutSource, section }) => runTool(() => ({
    ...(section === "all" ? { charts: { motions: motionDocChartMotions, types: motionDocChartTypes } } : {}),
    catalog: getSlideXCatalog({ includeLayoutSource, section }),
    section
  })));

  server.registerTool("open_slidex_knowledge_search", {
    title: "Search local OpenSlideX knowledge",
    description: "Search user-provided Markdown, text, CSV, and PDF files under knowledge/. Results include relative source paths, line ranges, and hashes.",
    inputSchema: {
      limit: z.number().int().min(1).max(20).default(8),
      query: z.string().max(500)
    }
  }, ({ limit, query }) => runTool(async () => {
    const { root } = await projectContext();
    return searchOpenSlideXKnowledge(root, query, limit);
  }));

  server.registerTool("open_slidex_skill_read", {
    title: "Read approved OpenSlideX project guidance",
    description: "Read root-confined approved guidance. Prefer one mode='bundle' call with the task intent; use mode='manifest' only to discover capabilities, or mode='skill' for one named approved skill. Arbitrary paths and names are rejected.",
    inputSchema: {
      intent: z.enum(openSlideXGuidanceIntents).default("authoring"),
      mode: z.enum(["bundle", "manifest", "skill"]).default("skill"),
      skill: z.enum(openSlideXProjectSkillNames).optional()
    }
  }, ({ intent, mode, skill }) => runTool(async () => {
    const { root } = await projectContext();
    if (mode === "manifest") return readOpenSlideXProjectSkillManifest(root);
    if (mode === "bundle") return readOpenSlideXProjectSkillBundle(root, intent);
    if (!skill) throw new Error("mode='skill' requires one approved skill name.");
    return readOpenSlideXProjectSkill(root, skill);
  }));

  server.registerTool("open_slidex_template_read", {
    title: "Read official template MDX and blueprint",
    description: "Read a validated official Template Blueprint plus localized quality profile. Prefer role-samples for compact, concrete MDX geometry references; full reference source is retained only for compatibility and diagnostics. Defaults to the template lock selected for this project.",
    inputSchema: {
      id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
      includeReferenceSource: z.boolean().default(false),
      includeStarterSource: z.boolean().default(false),
      locale: z.enum(["en", "zh-TW"]).optional(),
      referenceMode: z.enum(["none", "role-samples", "full"]).default("none"),
      roles: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
      version: z.string().regex(/^\d+\.\d+\.\d+$/).optional()
    }
  }, ({ id, includeReferenceSource, includeStarterSource, locale, referenceMode, roles, version }) => runTool(async () => {
    const { root } = await projectContext();
    const explicitTemplateFields = [id, locale, version].filter((value) => value !== undefined).length;
    if (explicitTemplateFields > 0 && explicitTemplateFields < 3) {
      throw new Error("An explicit template requires id, locale, and version together.");
    }
    const lock = explicitTemplateFields === 3
      ? { id: id!, locale: locale!, version: version! }
      : await readOpenSlideXTemplateLock(root);
    const template = getOfficialTemplatePackage(lock.id, lock.version);
    if (!template) throw new Error(`Official template package is unavailable: ${lock.id}@${lock.version}`);
    const qualityProfile = getOfficialTemplateQualityProfile(lock.id, lock.locale);
    if (!qualityProfile) throw new Error(`Official template quality profile is unavailable: ${lock.id}@${lock.locale}`);
    const referenceSource = stripNonLocalMotionDocMedia(template.sources[lock.locale]);
    const resolvedReferenceMode = includeReferenceSource ? "full" : referenceMode;
    const referenceSamples = resolvedReferenceMode === "role-samples"
      ? templateRoleSamples(referenceSource, template.blueprint.narrative.slideRoles, roles)
      : undefined;
    const starterSource = template.starterSources[lock.locale];
    return {
      blueprint: template.blueprint,
      catalog: template.catalog,
      id: template.id,
      locale: lock.locale,
      metadata: template.locales[lock.locale],
      qualityProfile,
      referenceUsage: {
        mode: "design-reference",
        rules: [
          "Use the reference MDX for visual grammar and layout variety; do not submit it unchanged as the candidate deck.",
          "Recalculate every text frame for the replacement copy. As a baseline, reserve at least 4.5% canvas height for a one-line label, 8% for supporting copy, and 16% for a display title.",
          "Shorten copy or enlarge and reposition its frame before editing. Never shrink text below the quality profile to force a fit.",
          "Remote media is intentionally removed from this Local reference. Import user-confirmed media through the approved asset tools only."
        ]
      },
      referenceMode: resolvedReferenceMode,
      referenceSamples,
      referenceSource: resolvedReferenceMode === "full" ? referenceSource : undefined,
      referenceSourceBytes: resolvedReferenceMode === "full" ? Buffer.byteLength(referenceSource) : undefined,
      referenceSourceChecksum: resolvedReferenceMode === "full" ? sourceChecksum(referenceSource) : undefined,
      starterSource: includeStarterSource ? starterSource : undefined,
      starterSourceBytes: includeStarterSource ? Buffer.byteLength(starterSource) : undefined,
      starterSourceChecksum: includeStarterSource ? sourceChecksum(starterSource) : undefined,
      version: template.version
    };
  }));

  server.registerTool("open_slidex_image_search", {
    title: "Search trusted external images",
    description: "Search the configured Unsplash provider and return attribution-safe candidates. Search never downloads or writes an asset.",
    inputSchema: { query: z.string().trim().min(2).max(200) }
  }, ({ query }) => runTool(() => searchTrustedImages(query, { accessKey: process.env.UNSPLASH_ACCESS_KEY })));

  server.registerTool("open_slidex_image_import", {
    title: "Import a user-confirmed trusted image",
    description: "Import one explicitly user-confirmed Unsplash candidate as a local content-addressed WebP and record provenance. Never call without a clear user confirmation naming the candidate ID.",
    inputSchema: {
      confirmedByUser: z.literal(true),
      expectedRevision: z.string().startsWith("sha256:"),
      providerAssetId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/)
    }
  }, ({ expectedRevision, providerAssetId }) => runTool(async () => {
    const { documentAdapter, root } = await projectContext();
    const current = await documentAdapter.open();
    if (current.revision !== expectedRevision) throw new SlideXRevisionConflictError(current.revision);
    const downloaded = await downloadTrustedImage(providerAssetId, { accessKey: process.env.UNSPLASH_ACCESS_KEY });
    const asset = await importSlideXImageAsset({
      bytes: downloaded.bytes,
      fileName: `unsplash-${providerAssetId}.${downloaded.mediaType.split("/")[1] ?? "jpg"}`,
      mediaType: downloaded.mediaType,
      projectRoot: root
    });
    await appendImageProvenance(root, {
      ...downloaded.photo,
      importedAt: new Date().toISOString(),
      source: asset.source
    });
    return { ...asset, provenance: downloaded.photo, revision: current.revision };
  }));

  server.registerTool("open_slidex_validate", {
    title: "Validate OpenSlideX presentation",
    description: "Validate the current canonical presentation without writing it.",
    inputSchema: {}
  }, () => runTool(async () => {
    const { documentAdapter } = await projectContext();
    const document = await documentAdapter.open();
    return { revision: document.revision, validation: summarizeMotionDoc(document.source).validation };
  }));

  server.registerTool("open_slidex_render", {
    title: "Render OpenSlideX presentation",
    description: "Render a montage or one slide to the local dist/ directory.",
    inputSchema: {
      mode: z.enum(["montage", "slide"]).default("montage"),
      slideIndex: z.number().int().min(0).optional()
    }
  }, ({ mode, slideIndex }, extra) => runTool(async () => {
    const { documentAdapter, root } = await projectContext();
    const document = await documentAdapter.open();
    const revisionDirectory = document.revision.replace(/^sha256:/, "");
    const dist = resolveInsideRoot(root, join("dist", "renders", revisionDirectory));
    await mkdir(dist, { recursive: true });
    const outputPath = join(dist, mode === "montage" ? "montage.png" : `slide-${slideIndex ?? 0}.png`);
    const result = await renderSlideXDocument({
      mode,
      outputPath,
      projectRoot: root,
      slideIndex: mode === "slide" ? slideIndex ?? 0 : undefined,
      source: document.source,
      signal: extra.signal
    });
    return { ...result, revision: document.revision };
  }));

  server.registerTool("open_slidex_quality_check", {
    title: "Check OpenSlideX visual quality",
    description: "Measure the actual rendered DOM and return structured slide-specific findings for text overflow, collisions, CJK orphan lines, unresolved media, unsafe edges, density, and repeated deck composition. This is the AI-readable visual QA gate after render.",
    inputSchema: {
      mode: z.enum(["deck", "slide"]).default("deck"),
      slideIndex: z.number().int().min(0).optional()
    }
  }, ({ mode, slideIndex }, extra) => runTool(async () => {
    const { documentAdapter, root } = await projectContext();
    const document = await documentAdapter.open();
    const report = await analyzeSlideXDocumentQuality({
      mode,
      projectRoot: root,
      slideIndex: mode === "slide" ? slideIndex ?? 0 : undefined,
      source: document.source,
      title: document.title,
      signal: extra.signal
    });
    return { report, revision: document.revision };
  }));

  server.registerTool("open_slidex_asset_import", {
    title: "Import local image asset",
    description: "Read a local binary image path, optimize it to content-addressed WebP, and return its presentation-relative source. Base64 and data URLs are rejected.",
    inputSchema: {
      expectedRevision: z.string().startsWith("sha256:"),
      filePath: z.string().min(1)
    }
  }, ({ expectedRevision, filePath }) => runTool(async () => {
    const { documentAdapter, root } = await projectContext();
    const current = await documentAdapter.open();
    if (current.revision !== expectedRevision) throw new SlideXRevisionConflictError(current.revision);
    if (/^(?:data|blob|https?):/i.test(filePath)) throw new Error("filePath must be a local file path, not Base64 or a URL.");
    const inputPath = resolveInsideRoot(root, filePath);
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

  server.registerTool("open_slidex_edit", {
    title: "Edit OpenSlideX presentation",
    description: "Build and structurally validate a candidate batch, render-check it, return an immutable preview, and atomically write only when visual QA passes. A rejected result includes rejectedCandidateId; retry with that ID and small patch commands instead of regenerating the whole candidate. Revision conflicts are terminal.",
    inputSchema: {
      commands: z.array(editCommandSchema).min(1).max(100),
      expectedRevision: z.string().startsWith("sha256:"),
      rejectedCandidateId: z.string().uuid().optional()
    }
  }, ({ commands, expectedRevision, rejectedCandidateId }, extra) => runTool(async () => {
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
    const typedCommands = commands as SlideXEditCommand[];
    const candidate = applySlideXBatch(rejected?.source ?? current.source, typedCommands);
    const candidateRevision = createCandidateRevision(candidate.source);
    const qualityScope = qualityScopeForCommands(typedCommands);
    const previewOutputPath = qualityScope
      ? resolveInsideRoot(root, join(
          "dist",
          "renders",
          candidateRevision.replace(/^sha256:/, ""),
          qualityScope.mode === "slide" ? `slide-${qualityScope.slideIndex ?? 0}.png` : "montage.png"
        ))
      : undefined;
    const quality = qualityScope
      ? await analyzeSlideXDocumentQuality({
          ...qualityScope,
          previewOutputPath,
          projectRoot: root,
          source: candidate.source,
          title: parseMotionDoc(candidate.source).title,
          signal: extra.signal
        })
      : undefined;
    if (quality && !quality.passed) {
      const candidateId = rejectedCandidateId ?? randomUUID();
      rejectedCandidates.set(candidateId, {
        attempts: (rejected?.attempts ?? 0) + 1,
        expectedRevision,
        expiresAt: Date.now() + 10 * 60_000,
        source: candidate.source
      });
      throw new SlideXVisualQualityGateError(current.revision, quality, candidateId);
    }
    extra.signal.throwIfAborted();
    const candidateDocument = parseMotionDoc(candidate.source);
    const document = await documentAdapter.save({
      expectedRevision,
      source: candidate.source,
      title: candidateDocument.title
    });
    if (rejectedCandidateId) rejectedCandidates.delete(rejectedCandidateId);
    return {
      candidateQuality: quality,
      preview: quality?.preview,
      revision: document.revision,
      stats: summarizeMotionDoc(document.source).stats,
      title: document.title,
      validation: summarizeMotionDoc(document.source).validation
    };
  }));

  return server;
}

function qualityScopeForCommands(commands: readonly SlideXEditCommand[]): {
  mode: "deck" | "slide";
  slideIndex?: number;
} | undefined {
  const visualCommands = commands.filter((command) => command.type !== "document.setTitle");
  if (visualCommands.length === 0) return undefined;

  const slideIndices = new Set<number>();
  for (const command of visualCommands) {
    if (
      command.type === "asset.repath" ||
      command.type === "slide.add" ||
      command.type === "slide.delete" ||
      command.type === "slide.duplicate" ||
      command.type === "slide.reorder" ||
      command.type === "slide.applyLayout" && command.slideIndex === undefined
    ) {
      return { mode: "deck" };
    }
    if ("slideIndex" in command && typeof command.slideIndex === "number") {
      slideIndices.add(command.slideIndex);
    }
  }

  return slideIndices.size === 1
    ? { mode: "slide", slideIndex: [...slideIndices][0] }
    : { mode: "deck" };
}

class OpenSlideXWorkspaceMcpScope {
  private selectedPresentationId?: string;
  readonly workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = resolve(workspaceRoot);
  }

  async list() {
    const entries = await readdir(this.workspaceRoot, { withFileTypes: true });
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
export const openSlideXMcpNpxPackage = "open-slidex@0.3.2";

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
    "After configuration, restart the client when required and verify open_slidex_open, open_slidex_edit with expectedRevision, open_slidex_render, and open_slidex_quality_check."
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
    "After restarting the client, call open_slidex_workspace_list, select a presentation, then verify open_slidex_open and open_slidex_validate."
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

function templateRoleSamples(
  source: string,
  slideRoles: readonly string[],
  requestedRoles?: readonly string[]
) {
  const ranges = motionDocSlideSourceRanges(source);
  const wanted = requestedRoles?.length
    ? [...new Set(requestedRoles)]
    : [...new Set(slideRoles)].slice(0, 4);
  const selected = new Set<number>();
  for (const role of wanted) {
    const index = slideRoles.findIndex((candidate, slideIndex) => candidate === role && !selected.has(slideIndex));
    if (index >= 0 && ranges[index]) selected.add(index);
  }
  if (selected.size === 0 && ranges[0]) selected.add(0);
  return [...selected].map((slideIndex) => {
    const sample = ranges[slideIndex]!.source;
    return {
      bytes: Buffer.byteLength(sample),
      checksum: sourceChecksum(sample),
      role: slideRoles[slideIndex] ?? "slide",
      slideIndex,
      source: sample
    };
  });
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
