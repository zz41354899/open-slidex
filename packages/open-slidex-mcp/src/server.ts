import { createHash, randomUUID } from "node:crypto";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { access, mkdir, readFile, readdir, realpath, unlink, writeFile } from "node:fs/promises";

import type { CallToolResult } from "@modelcontextprotocol/server";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod/v4";

import {
  createOpenSlideXMcpConfig,
  resolveOpenSlideXMcpRoot,
  type OpenSlideXMcpConfigClient,
  type OpenSlideXMcpConfigPlatform
} from "@/common/lib/openSlideXMcpConfig";

import {
  applySlideXBatch,
  isReactPresentationSource,
  motionDocChartMotions,
  motionDocChartTypes,
  motionDocSlideSourceRanges,
  parseMotionDoc,
  reactPresentationToMotionDocSource,
  summarizeMotionDoc
} from "@open-slidex/sdk";
import {
  analyzeSlideXDocumentQuality,
  ensureDirectoryInsideRoot,
  importSlideXImageAsset,
  openExistingFileInsideRoot,
  resolveExistingInsideRoot,
  resolveInsideRoot,
  SlideXFileDocumentAdapter,
  type SlideXQualityReport,
  SlideXRevisionConflictError
} from "@open-slidex/sdk/node";
import { readOpenSlideXKnowledgeResource, searchOpenSlideXKnowledge } from "./knowledge";
import {
  openSlideXGuidanceIntents,
  recommendOpenSlideXTemplates,
  readOpenSlideXProjectGuidanceManifest,
  readOpenSlideXProjectGuidanceResource
} from "./projectGuidance";
import {
  appendImageProvenance,
  downloadTrustedImage,
  searchTrustedImages
} from "./trustedImages";
import { openSlideXMcpVersion } from "./version";
import { readOpenSlideXSourceImport } from "./sourceImport";
import { ingestOpenSlideXSource } from "./sourceIntake";
import {
  analyzeHtmlPresentation,
  assertSandboxedHtml,
  inspectHtmlNetworkResources
} from "@/packages/slidex-workbench/src/server/htmlImportPolicy";
import {
  createHtmlPresentationMdx,
  MAX_WORKSPACE_IMPORT_FILE_BYTES,
  packageHtmlAssets
} from "@/packages/slidex-workbench/src/server/workspaceImport";
import {
  assertToolbarNativeDocument,
  isPureHtmlPresentation,
  listHtmlPresentationAssets,
  removedMotionDocTags,
  resolveAuthoringGuidanceRoot
} from "./serverPolicy";
import {
  documentAdapterForRoot,
  isNodeError,
  OpenSlideXWorkspaceMcpScope
} from "./serverWorkspace";

const projectRoot = projectRootFromArgs(process.argv.slice(2));
const workspaceRoot = workspaceRootFromArgs(process.argv.slice(2));

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
  const inboxRoot = join(configuredWorkspaceRoot ?? fixedRoot ?? projectRoot, ".open-slidex-inbox");
  const projectContext = async () => {
    const resolvedRoot = fixedRoot ?? await workspace!.selectedRoot();
    return {
      documentAdapter: await documentAdapterForRoot(resolvedRoot),
      root: resolvedRoot
    };
  };
  const server = new McpServer(
    { name: "open-slidex-local", version: openSlideXMcpVersion() },
    {
      instructions: [
        "Select a deck with open_slidex_workspace.",
        "Use open_slidex_read for canonical presentation.tsx, local components, revision, and skills.",
        "For HTML use sourceFormat html and open_slidex_edit target html; playback is opaque-origin.",
        "Re-read before mutation and pass expectedRevision to open_slidex_edit.",
        "Every Morph edge needs slideTransition morph and a same-type sharedId pair.",
        "Native layers are Text, ImageBlock, VideoBlock, SvgBlock, Chart, Table, and Shape.",
        "Native edits include rendered QA."
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
      description: "List Workspace decks or select exactly one deck for all later deck-specific calls.",
      inputSchema: z.object({
        action: z.enum(["list", "select"]).default("list").describe(
          "Use list to discover presentations. Use select before any deck-specific tool call."
        ),
        presentationId: z.string().regex(/^[A-Za-z0-9._-]+$/).optional().describe(
          "Required for select. Use one exact presentation id returned by list."
        )
      })
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
    description: "Read canonical React TSX, one deck-local React component, portable MotionDoc MDX, canonical browser-native HTML, or one project resource.",
    inputSchema: z.object({
      intent: z.enum(openSlideXGuidanceIntents).default("authoring").describe(
        "Task route for the manifest: import, create, redesign, design, authoring, html, motion, or qa."
      ),
      sourceFormat: z.enum(["tsx", "mdx", "html"]).default("tsx").describe(
        "Read canonical React TSX, a generated portable MDX view, or canonical browser-native HTML."
      ),
      componentPath: z.string().regex(/^components\/[A-Za-z0-9._/-]+\.tsx$/).optional().describe(
        "Optional deck-local components/*.tsx source to read. Cannot be combined with slideIndex or HTML."
      ),
      htmlCursor: z.number().int().min(0).default(0).describe(
        "Character offset for an HTML chunk. Continue from nextCursor until it is absent."
      ),
      htmlMaxChars: z.number().int().min(1_000).max(200_000).default(60_000).describe(
        "Maximum HTML characters returned from htmlCursor, from 1,000 through 200,000."
      ),
      htmlSource: z.string().regex(/^assets\/[A-Za-z0-9._-]+\.html?$/i).optional().describe(
        "Exact canonical assets/*.html source returned by an earlier HTML read. Required only when the deck references multiple HTML sources."
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
      templateQuery: z.string().trim().min(2).max(1200).optional().describe(
        "A concise brief including source type, audience, outcome, and evidence type. Returns the three best matches from the six thirty-page core MDX references."
      ),
      slideIndex: z.number().int().min(0).optional().describe(
        "Zero-based slide index for a focused source read; omit for the complete deck."
      )
    })
  }, ({ componentPath, htmlCursor, htmlMaxChars, htmlSource, intent, knowledgeQuery, resourceCursor, resourcePath, slideIndex, sourceFormat, templateQuery }) => runTool(async () => {
    const { documentAdapter, root } = await projectContext();
    const guidanceRoot = await resolveAuthoringGuidanceRoot(root, configuredWorkspaceRoot);
    if (resourcePath) {
      if (slideIndex !== undefined || knowledgeQuery || templateQuery) {
        throw new Error("resourcePath cannot be combined with slideIndex, knowledgeQuery, or templateQuery.");
      }
      if (resourcePath.startsWith(".agents/skills/")) {
        if (resourceCursor !== 0) throw new Error("resourceCursor requires a knowledge resourcePath.");
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
    if (componentPath) {
      if (sourceFormat === "html" || slideIndex !== undefined || knowledgeQuery || templateQuery) {
        throw new Error("componentPath cannot be combined with HTML, slideIndex, knowledgeQuery, or templateQuery.");
      }
      const componentSource = await readTextInsideRoot(root, componentPath);
      return {
        componentPath,
        mode: "component",
        revision: document.revision,
        source: componentSource,
        sourceFormat: "tsx",
        title: document.title
      };
    }
    if (sourceFormat === "html") {
      if (slideIndex !== undefined || knowledgeQuery || templateQuery) {
        throw new Error("HTML source reads cannot be combined with slideIndex, knowledgeQuery, or templateQuery.");
      }
      const guidance = await readOpenSlideXProjectGuidanceManifest(guidanceRoot, "html").catch((error: unknown) => ({
        error: error instanceof Error ? error.message : "HTML skill guidance is unavailable.",
        intent: "html",
        mode: "unavailable"
      }));
      const assets = listHtmlPresentationAssets(document.source);
      const assetsRoot = await resolveExistingInsideRoot(root, join(root, "assets"), "directory").catch(() => undefined);
      const localAssets = assetsRoot ? await readdir(assetsRoot, { withFileTypes: true })
        .then((entries) => entries.filter((entry) => entry.isFile()).map((entry) => entry.name), () => [])
        : [];
      const htmlAssets = await Promise.all(assets.map(async (record) => {
        try {
          const html = await readTextInsideRoot(root, record.source);
          return { ...record, networkResources: inspectHtmlNetworkResources(html, { localAssets }), status: "ready" };
        } catch (error) {
          return {
            ...record,
            error: error instanceof Error ? error.message : "The HTML source is unavailable.",
            status: "unavailable"
          };
        }
      }));
      const selectedSource = htmlSource ?? (assets.length === 1 ? assets[0]!.source : undefined);
      if (!selectedSource) {
        return {
          guidance,
          htmlAssets,
          mode: "html-list",
          revision: document.revision,
          title: document.title
        };
      }
      const record = assets.find((asset) => asset.source === selectedSource);
      if (!record) throw new Error(`The HTML source is not referenced by presentation.tsx: ${selectedSource}`);
      const html = await readTextInsideRoot(root, selectedSource);
      const chunk = html.slice(htmlCursor, htmlCursor + htmlMaxChars);
      const nextCursor = htmlCursor + chunk.length < html.length ? htmlCursor + chunk.length : undefined;
      return {
        ...record,
        bytes: Buffer.byteLength(html, "utf8"),
        contentHash: createHash("sha256").update(html).digest("hex"),
        cursor: htmlCursor,
        guidance,
        html: chunk,
        htmlAssets,
        htmlSource: selectedSource,
        mode: "html",
        networkResources: inspectHtmlNetworkResources(html, { localAssets }),
        nextCursor,
        revision: document.revision,
        title: document.title,
        totalChars: html.length
      };
    }
    const [guidance, knowledge, templateRecommendations] = await Promise.all([
      readOpenSlideXProjectGuidanceManifest(guidanceRoot, intent).catch((error: unknown) => ({
        error: error instanceof Error ? error.message : "Project skill guidance is unavailable.",
        intent,
        mode: "unavailable"
      })),
      knowledgeQuery ? searchOpenSlideXKnowledge(root, knowledgeQuery, 8) : undefined,
      templateQuery ? recommendOpenSlideXTemplates(guidanceRoot, templateQuery).catch((error: unknown) => ({
        error: error instanceof Error ? error.message : "Template recommendation is unavailable.",
        query: templateQuery,
        recommendations: []
      })) : undefined
    ]);
    const ranges = motionDocSlideSourceRanges(document.source);
    const canonicalFormat = isReactPresentationSource(document.source) ? "tsx" : "mdx";
    if (slideIndex !== undefined && !ranges[slideIndex]) throw new Error(`Slide index is out of range: ${slideIndex}`);
    const summary = summarizeMotionDoc(document.source);
    return {
      authoringContract: {
        allowed: ["Deck", "Slide", "Text", "Image", "Video", "Svg", "Chart", "Table", "Shape", "HtmlEmbed"],
        removed: removedMotionDocTags,
        geometry: "Every visible layer needs stable id plus explicit percentage x/y/w/h; fontSize uses pt.",
        rule: "Import from @open-slidex/sdk/react. Registered local components need a props schema, asset references, and toMotionDoc(). Dynamic expressions remain code-only."
      },
      charts: { motions: motionDocChartMotions, types: motionDocChartTypes },
      designContract: {
        composition: "Treat one selected core reference as narrative and visual grammar. Design each slide from its claim and vary focal position, density, and dominant device; do not default to repeated equal cards.",
        data: "Use a native Chart for quantitative comparison, distribution, or ordered change and a Table for exact lookup. Protect room for conclusion, labels, units, period, legend, and source.",
        media: "Every cover needs a verified portable ImageBlock with an intentional crop. In reference-driven work, use Shape only as a semantic card background with named grouped children; never use it for decoration, rules, abstract artwork, fake icons, or charts.",
        typography: "Reserve frames for rendered line count and presentation distance. Repair overflow, clipping, collisions, CJK orphans, English widows, low contrast, and weak hierarchy before reducing type."
      },
      guidance,
      knowledge,
      templateRecommendations,
      revision: document.revision,
      requiresMigration: canonicalFormat === "mdx",
      source: slideIndex === undefined
        ? sourceFormat === "mdx" ? reactPresentationToMotionDocSource(document.source) : document.source
        : ranges[slideIndex]!.source,
      sourceFormat: slideIndex === undefined ? (sourceFormat === "mdx" ? "mdx" : canonicalFormat) : canonicalFormat,
      stats: summary.stats,
      title: document.title,
      validation: summary.validation,
      workflow: [
        "Read the recommended SKILL.md files and only their task-relevant references.",
        "For a supplied document, search knowledge first, preserve evidence and gaps, then define audience, outcome, thesis, and narrative pattern.",
        "For creation or redesign, use template recommendations and read exactly one componentized TSX reference before composing slides.",
        "Plan claim-specific hierarchy and geometry from the source; include a real cover image, vary image and card rhythm, and do not clone the specimen page-for-page.",
        "Submit one complete deck or slide source to open_slidex_edit with this revision.",
        "When changing a Morph sequence, re-read and submit the complete affected sequence so every adjacent edge keeps a compatible sharedId pair.",
        "If rejected, patch the same candidate from the reported node-specific findings."
      ]
    };
  }));

  server.registerTool("open_slidex_source_import", {
    title: "Read a PPTX source for high-fidelity OpenSlideX conversion",
    description: "Inspect a root-confined .pptx as ordered semantic evidence. It recovers text geometry and typography hints as native Text blocks; import-media converts supported embedded images to portable assets/*.webp with original geometry and z-order.",
    inputSchema: z.object({
      action: z.enum(["inspect", "import-media"]).default("inspect").describe(
        "inspect is read-only. import-media writes supported embedded PPTX images as content-addressed WebP assets."
      ),
      expectedRevision: z.string().startsWith("sha256:").optional().describe(
        "Required for import-media so asset import is tied to the latest selected deck revision."
      ),
      filePath: z.string().trim().min(1).max(500).describe(
        "Local path relative to the selected OpenSlideX deck. Supports .pptx only."
      )
    })
  }, ({ action, expectedRevision, filePath }) => runTool(async () => {
    const { documentAdapter, root } = await projectContext();
    if (action === "inspect") return readOpenSlideXSourceImport(root, filePath);
    if (!expectedRevision) throw new Error("expectedRevision is required when action is import-media.");
    const current = await documentAdapter.open();
    if (current.revision !== expectedRevision) throw new SlideXRevisionConflictError(current.revision);
    return { ...(await readOpenSlideXSourceImport(root, filePath, { importMedia: true })), revision: current.revision };
  }));

  server.registerTool("open_slidex_media", {
    title: "Import OpenSlideX sources or media",
    description: "One intake workflow: move an inbox document into knowledge with extracted WebP assets, search or import trusted Unsplash media, or import a deck-local image as WebP.",
    inputSchema: z.object({
      action: z.enum(["ingest-source", "search-trusted", "import-trusted", "import-local"]).describe(
        "Use ingest-source for a file staged under .open-slidex-inbox; use the other actions for trusted search or image-only import."
      ),
      confirmedByUser: z.boolean().optional().describe(
        "Must be true for import-trusted after the user selected a returned candidate."
      ),
      expectedRevision: z.string().startsWith("sha256:").optional().describe(
        "Required for every write action and must match the selected deck's latest revision."
      ),
      filePath: z.string().trim().min(1).max(500).optional().describe(
        "Required for ingest-source or import-local. For ingest-source use a path relative to .open-slidex-inbox or one public HTTPS image URL; for import-local use a path inside the selected deck."
      ),
      providerAssetId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/).optional().describe(
        "Required for import-trusted. Use an exact providerAssetId returned by search-trusted."
      ),
      query: z.string().trim().min(2).max(200).optional().describe(
        "Required for search-trusted. Describe the subject and useful visual context."
      )
    })
  }, (input, ctx) => runTool(async () => {
    if (input.action === "search-trusted") {
      if (!input.query) throw new Error("query is required when action is search-trusted.");
      return searchTrustedImages(input.query, { accessKey: process.env.UNSPLASH_ACCESS_KEY });
    }
    if (!input.expectedRevision) throw new Error(`expectedRevision is required when action is ${input.action}.`);
    const { documentAdapter, root } = await projectContext();
    const current = await documentAdapter.open();
    if (current.revision !== input.expectedRevision) throw new SlideXRevisionConflictError(current.revision);
    if (input.action === "ingest-source") {
      if (!input.filePath) throw new Error("filePath is required when action is ingest-source.");
      return ingestOpenSlideXSource({
        expectedRevision: current.revision,
        filePath: input.filePath,
        inboxRoot,
        projectRoot: root,
        signal: ctx.mcpReq.signal
      });
    }
    if (input.action === "import-trusted") {
      if (input.confirmedByUser !== true) throw new Error("confirmedByUser must be true when action is import-trusted.");
      if (!input.providerAssetId) throw new Error("providerAssetId is required when action is import-trusted.");
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
    if (!input.filePath) throw new Error("filePath is required when action is import-local.");
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
      inputSchema: z.object({
      scope: z.enum(["deck", "slide"]).default("deck").describe(
        "Review the complete deck montage or one zero-based slide."
      ),
      slideIndex: z.number().int().min(0).optional().describe(
        "Required when scope is slide; omit when scope is deck."
      )
    })
  }, ({ scope, slideIndex }, ctx) => runTool(async () => {
    if (scope === "slide" && slideIndex === undefined) {
      throw new Error("slideIndex is required when scope is slide.");
    }
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
      signal: ctx.mcpReq.signal
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
      description: "Revision-safely replace one complete React TSX deck, one native React slide, or canonical browser-native HTML. Native edits receive structural and rendered QA.",
      inputSchema: z.object({
      expectedRevision: z.string().startsWith("sha256:").describe(
        "Latest revision returned by open_slidex_read. Never reuse a stale revision."
      ),
      rejectedCandidateId: z.string().uuid().optional().describe(
        "Use only when patching the exact rejected candidate returned by the previous edit attempt."
      ),
      slideIndex: z.number().int().min(0).optional().describe(
        "Required when target is slide; identifies the zero-based slide to replace."
      ),
      htmlSource: z.string().regex(/^assets\/[A-Za-z0-9._-]+\.html?$/i).optional().describe(
        "For target html, pass the exact canonical assets/*.html returned by open_slidex_read to replace it. Omit only to replace the selected deck with a new HTML presentation."
      ),
      htmlAssetRoot: z.string().trim().min(1).max(4096).optional().describe(
        "Optional folder inside the selected deck used to resolve relative PNG, SVG, JPEG, GIF, AVIF, and WebP references. Absolute and file: image references are rejected. Images are copied into this deck's assets and PNG is converted to WebP."
      ),
      source: z.string().min(1).describe(
        "One complete presentation.tsx candidate, one complete Slide JSX block, or one complete UTF-8 HTML document according to target."
      ),
      target: z.enum(["deck", "slide", "html"]).describe(
        "Choose whether source replaces the whole native deck, one complete native slide, or canonical browser-native HTML."
      ),
      title: z.string().trim().min(1).max(200).optional().describe(
        "Optional presentation title when target is html and htmlSource is omitted."
      )
    })
  }, ({ expectedRevision, htmlAssetRoot, htmlSource, rejectedCandidateId, slideIndex, source, target, title }, ctx) => runTool(async () => {
    const { documentAdapter, root } = await projectContext();
    ctx.mcpReq.signal.throwIfAborted();
    const current = await documentAdapter.open();
    if (current.revision !== expectedRevision) throw new SlideXRevisionConflictError(current.revision);
    if (target === "html") {
      if (rejectedCandidateId) throw new Error("rejectedCandidateId is only used for native rendered-QA repairs.");
      if (slideIndex !== undefined) throw new Error("slideIndex cannot be combined with target html.");
      if (htmlSource && title) throw new Error("title is only used when htmlSource is omitted for a new HTML deck.");
      const safeHtmlAssetRoot = htmlAssetRoot
        ? await resolveExistingInsideRoot(root, htmlAssetRoot, "directory")
        : undefined;
      const packaged = await packageHtmlAssets(source, { assetRoot: safeHtmlAssetRoot });
      const bytes = Buffer.from(packaged.source, "utf8");
      if (!bytes.byteLength || bytes.byteLength > MAX_WORKSPACE_IMPORT_FILE_BYTES) {
        throw new Error("The HTML source must be between 1 byte and 50 MB.");
      }
      const assetsRoot = await ensureDirectoryInsideRoot(root, join(root, "assets"));
      const existingLocalAssets = await readdir(assetsRoot, { withFileTypes: true })
        .then((entries) => entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
      const localAssets = [...new Set([...existingLocalAssets, ...packaged.assets.map((asset) => asset.fileName)])];
      assertSandboxedHtml(packaged.source, { localAssets });
      const networkResources = inspectHtmlNetworkResources(packaged.source, { localAssets });
      const pages = analyzeHtmlPresentation(packaged.source);
      const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
      const nextSource = `assets/source-${hash}.html`;
      const nextPath = resolveInsideRoot(assetsRoot, basename(nextSource));
      const createdAssets: string[] = [];
      const writeNewAsset = async (assetPath: string, assetBytes: Uint8Array) => {
        try {
          await writeFile(assetPath, assetBytes, { flag: "wx" });
          createdAssets.push(assetPath);
        } catch (error) {
          if (!isNodeError(error) || error.code !== "EEXIST") throw error;
          const handle = await openExistingFileInsideRoot(assetsRoot, assetPath);
          const existingBytes = await handle.readFile().finally(() => handle.close());
          if (!existingBytes.equals(Buffer.from(assetBytes))) {
            throw new Error(`A packaged HTML asset already exists with different bytes: ${basename(assetPath)}`);
          }
        }
      };
      try {
        for (const asset of packaged.assets) {
          await writeNewAsset(resolveInsideRoot(assetsRoot, basename(asset.source)), asset.bytes);
        }
        await writeNewAsset(nextPath, bytes);
        let candidateSource: string;
        let replacedSource: string | undefined;
        if (htmlSource) {
          const assets = listHtmlPresentationAssets(current.source);
          const record = assets.find((asset) => asset.source === htmlSource);
          if (!record) throw new Error(`The HTML source is not referenced by presentation.tsx: ${htmlSource}`);
          replacedSource = htmlSource;
          candidateSource = isPureHtmlPresentation(current.source, htmlSource)
            ? createHtmlPresentationMdx(current.title, nextSource, hash, pages)
            : applySlideXBatch(current.source, [{ from: htmlSource, to: nextSource, type: "asset.repath" }]).source;
        } else {
          candidateSource = createHtmlPresentationMdx(title ?? current.title, nextSource, hash, pages);
        }

        const candidateDocument = parseMotionDoc(candidateSource);
        ctx.mcpReq.signal.throwIfAborted();
        const saved = candidateSource === current.source
          ? current
          : await documentAdapter.save({
              expectedRevision,
              source: candidateSource,
              title: candidateDocument.title
            });
        if (replacedSource && replacedSource !== nextSource) {
          await unlink(resolveInsideRoot(root, replacedSource)).catch(() => undefined);
        }
        return {
          action: htmlSource ? "replace" : "create",
          bytes: bytes.byteLength,
          packagedAssetCount: packaged.assets.length,
          pngConvertedToWebp: packaged.assets.filter((asset) => asset.fileName.endsWith(".webp")).length,
          networkResources,
          pageCount: Math.max(1, pages.length),
          revision: saved.revision,
          source: nextSource,
          target: "html",
          title: saved.title
        };
      } catch (error) {
        await Promise.all(createdAssets.map((assetPath) => unlink(assetPath).catch(() => undefined)));
        throw error;
      }
    }
    if (htmlAssetRoot || htmlSource || title) throw new Error("htmlAssetRoot, htmlSource, and title are only used with target html.");
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
      signal: ctx.mcpReq.signal
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
    ctx.mcpReq.signal.throwIfAborted();
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

async function readTextInsideRoot(root: string, requestedPath: string) {
  const handle = await openExistingFileInsideRoot(root, requestedPath);
  try {
    return await handle.readFile("utf8");
  } finally {
    await handle.close();
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
  if (!workspaceRoot) await (await documentAdapterForRoot(projectRoot)).open();
  process.stderr.write(`OpenSlideX MCP ready for ${workspaceRoot ? `workspace ${workspaceRoot}` : projectRoot}\n`);
  await serveStdio(() => workspaceRoot
    ? createOpenSlideXMcpServer({ workspaceRoot })
    : createOpenSlideXMcpServer());
}

export type OpenSlideXMcpClient = OpenSlideXMcpConfigClient;
export type OpenSlideXPlatform = OpenSlideXMcpConfigPlatform;
export { openSlideXMcpNpxPackage } from "@/common/lib/openSlideXMcpConfig";

export function openSlideXMcpConfig(
  client: OpenSlideXMcpClient,
  root: string,
  platform: OpenSlideXPlatform = process.platform === "win32" ? "windows" : "macos"
) {
  return createOpenSlideXMcpConfig({ client, platform, root, scope: "project" });
}

export function openSlideXWorkspaceMcpConfig(
  client: OpenSlideXMcpClient,
  root: string,
  platform: OpenSlideXPlatform = process.platform === "win32" ? "windows" : "macos"
) {
  return createOpenSlideXMcpConfig({ client, platform, root, scope: "workspace" });
}

export function openSlideXMcpSetupPrompt(
  client: OpenSlideXMcpClient,
  root: string,
  platform: OpenSlideXPlatform = process.platform === "win32" ? "windows" : "macos"
) {
  const absoluteRoot = resolveOpenSlideXMcpRoot(root, platform);
  const target = client === "claude" ? "Claude Code" : client === "claude-code"
    ? "Claude Code"
    : client === "claude-desktop"
      ? "Claude Desktop"
      : "Codex";
  return [
    `Configure the local OpenSlideX MCP server for ${target} on ${platform}.`,
    `The only allowed deck root is: ${absoluteRoot}`,
    "Replace an older open_slidex entry only when it targets this same deck. Preserve every unrelated MCP entry, do not widen the project path, and do not copy credentials.",
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
  const absoluteRoot = resolveOpenSlideXMcpRoot(root, platform);
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
