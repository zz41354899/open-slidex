#!/usr/bin/env node

// packages/slidex-workbench/src/cli.ts
import { spawn as spawn3 } from "node:child_process";
import { cp, mkdir as mkdir4, readFile as readFile6, readdir as readdir2, stat as stat4 } from "node:fs/promises";
import { createServer as createServer2 } from "node:http";
import path7 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// packages/slidex-workbench/src/server/project.ts
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildMotionDocPngSvg,
  getOfficialTemplatePackage,
  listSlideXAssetReferences,
  officialTemplatePackages,
  parseMotionDoc,
  parseTemplateRef,
  stripNonLocalMotionDocMedia,
  summarizeMotionDoc,
  validateOpenSlideXLocalMedia
} from "../sdk/index.js";
import {
  exportSlideXDocument,
  importOpenSlideXImageAsset,
  renderSlideXDocument,
  resolveInsideRoot,
  SlideXFileDocumentAdapter,
  SlideXRevisionConflictError
} from "../sdk/node.js";
var OpenSlideXLocalMediaError = class extends Error {
  constructor(issues) {
    super("OpenSlideX local decks only allow imported assets/*.webp media. Import the media through Local Assets first.");
    this.issues = issues;
    this.name = "OpenSlideXLocalMediaError";
  }
  issues;
};
var SlideXProject = class {
  adapter;
  assetsRoot;
  distRoot;
  projectId;
  root;
  stateRoot;
  constructor(root) {
    this.root = path.resolve(root);
    this.assetsRoot = path.join(this.root, "assets");
    this.distRoot = path.join(this.root, "dist");
    this.stateRoot = path.join(this.root, ".open-slidex");
    this.projectId = createHash("sha256").update(this.root).digest("hex").slice(0, 20);
    this.adapter = new SlideXFileDocumentAdapter({ projectRoot: this.root });
  }
  async prepare() {
    await Promise.all([
      mkdir(this.assetsRoot, { recursive: true }),
      mkdir(this.distRoot, { recursive: true }),
      mkdir(this.stateRoot, { recursive: true })
    ]);
    if (!await this.adapter.exists()) {
      throw new Error(`presentation.mdx was not found in ${this.root}.`);
    }
  }
  snapshot(document) {
    return {
      ...document,
      projectId: this.projectId,
      validation: summarizeMotionDoc(document.source).validation
    };
  }
  async open() {
    return this.snapshot(await this.adapter.open());
  }
  async templateCatalog(locale) {
    const current = await this.readTemplateLock().catch(() => void 0);
    return {
      canSelect: true,
      current,
      templates: officialTemplatePackages.map((template) => ({
        blueprintSummary: template.blueprint.narrative.objective,
        cover: `/api/v1/templates/${template.id}/cover.svg?locale=${encodeURIComponent(locale)}&version=${encodeURIComponent(template.version)}`,
        description: template.locales[locale].description,
        id: template.id,
        locale,
        name: template.locales[locale].name,
        slideCount: template.catalog.slideCount,
        useCase: template.locales[locale].useCase,
        version: template.version
      }))
    };
  }
  async selectTemplate(value) {
    const reference = parseTemplateRef(value);
    if (!getOfficialTemplatePackage(reference.id, reference.version)) {
      throw new Error(`Official template package is unavailable: ${reference.id}@${reference.version}`);
    }
    await mkdir(this.stateRoot, { recursive: true });
    const target = path.join(this.stateRoot, "template-lock.json");
    const temporary = path.join(this.stateRoot, `.template-lock.${process.pid}.${Date.now()}.tmp`);
    await writeFile(temporary, `${JSON.stringify(reference, null, 2)}
`, "utf8");
    await rename(temporary, target);
    return reference;
  }
  templatePreview(value) {
    const reference = parseTemplateRef(value);
    const template = getOfficialTemplatePackage(reference.id, reference.version);
    if (!template) {
      throw Object.assign(new Error(`Official template package is unavailable: ${reference.id}@${reference.version}`), { status: 404 });
    }
    return buildMotionDocPngSvg(
      stripNonLocalMotionDocMedia(template.sources[reference.locale]),
      0,
      template.locales[reference.locale].name
    );
  }
  async readTemplateLock() {
    return parseTemplateRef(JSON.parse(await readFile(path.join(this.stateRoot, "template-lock.json"), "utf8")));
  }
  async save(input) {
    assertOpenSlideXLocalMedia(input.source);
    return this.snapshot(await this.adapter.save(input));
  }
  async listAssets() {
    const document = await this.adapter.open();
    const references = listSlideXAssetReferences(document.source);
    const entries = await readdir(this.assetsRoot, { withFileTypes: true });
    const assets = await Promise.all(
      entries.filter((entry) => entry.isFile() && /^[A-Za-z0-9._-]+\.webp$/i.test(entry.name)).map(async (entry) => {
        const source = `assets/${entry.name}`;
        return {
          bytes: (await stat(path.join(this.assetsRoot, entry.name))).size,
          name: entry.name,
          source,
          usedBy: references.filter((reference) => reference.source === source).map((reference) => ({
            blockIndex: reference.blockIndex,
            prop: reference.prop,
            slideIndex: reference.slideIndex
          }))
        };
      })
    );
    return assets.sort((left, right) => left.name.localeCompare(right.name));
  }
  async importAsset(file, expectedRevision) {
    await this.assertRevision(expectedRevision);
    const asset = await importOpenSlideXImageAsset({
      bytes: new Uint8Array(await file.arrayBuffer()),
      fileName: file.name,
      mediaType: file.type,
      projectRoot: this.root
    });
    return {
      bytes: asset.bytes,
      name: asset.name,
      source: asset.source,
      usedBy: []
    };
  }
  async renameAsset(input) {
    const fromName = assetName(input.from);
    const toName = normalizedAssetName(input.to);
    if (fromName === toName) return this.open();
    const fromPath = resolveInsideRoot(this.assetsRoot, fromName);
    const toPath = resolveInsideRoot(this.assetsRoot, toName);
    if (await exists(toPath)) throw new Error("An asset with that name already exists.");
    await copyFile(fromPath, toPath, constants.COPYFILE_EXCL);
    try {
      const document = await this.adapter.edit(input.expectedRevision, [
        { from: `assets/${fromName}`, to: `assets/${toName}`, type: "asset.repath" }
      ]);
      await unlink(fromPath);
      return this.snapshot(document);
    } catch (error) {
      await unlink(toPath).catch(() => void 0);
      throw error;
    }
  }
  async deleteAsset(source, expectedRevision) {
    const name = assetName(source);
    const document = await this.adapter.open();
    if (document.revision !== expectedRevision) {
      throw new SlideXRevisionConflictError(document.revision);
    }
    const used = listSlideXAssetReferences(document.source).some(
      (reference) => reference.source === `assets/${name}`
    );
    if (used) throw new Error("The asset is still referenced by presentation.mdx.");
    await unlink(resolveInsideRoot(this.assetsRoot, name));
  }
  async assertRevision(expectedRevision) {
    const document = await this.adapter.open();
    if (document.revision !== expectedRevision) {
      throw new SlideXRevisionConflictError(document.revision);
    }
    return document;
  }
  async readAsset(name) {
    const safeName = assetName(`assets/${name}`);
    return readFile(resolveInsideRoot(this.assetsRoot, safeName));
  }
  async writeCurrent(input) {
    const document = await this.adapter.open();
    if (document.revision !== input.revision) {
      throw new SlideXRevisionConflictError(document.revision);
    }
    const slide = parseMotionDoc(document.source).scenes[input.slideIndex];
    if (!slide) throw new Error("The selected slide no longer exists.");
    const block = input.nodeId ? slide.blocks.find(
      (candidate) => candidate.props?.id === input.nodeId
    ) : input.blockIndex === void 0 ? void 0 : slide.blocks[input.blockIndex];
    const resolvedBlock = block;
    const value = {
      blockId: resolvedBlock ? input.nodeId : void 0,
      blockType: resolvedBlock?.type,
      document: "presentation.mdx",
      revision: document.revision,
      slideId: String(slide.props?.id ?? `slide-${input.slideIndex + 1}`),
      slideIndex: input.slideIndex,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      version: 1
    };
    const temporary = path.join(this.stateRoot, `.current.${process.pid}.${Date.now()}.tmp`);
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}
`, "utf8");
    await rename(temporary, path.join(this.stateRoot, "current.json"));
  }
  async export(input) {
    assertOpenSlideXLocalMedia(input.source);
    const fileName = safeExportName(input.fileName);
    const root = input.target === "download" ? await mkdtemp(path.join(os.tmpdir(), "slidex-export-")) : this.distRoot;
    const outputPath = path.join(root, `${fileName}.${input.format}`);
    try {
      await exportSlideXDocument({
        format: input.format,
        outputPath,
        overwrite: input.target === "download" || input.overwrite,
        projectRoot: this.root,
        source: input.source
      });
      return input.target === "download" ? { bytes: await readFile(outputPath), output: `${fileName}.${input.format}` } : { output: `dist/${fileName}.${input.format}` };
    } finally {
      if (input.target === "download") await rm(root, { force: true, recursive: true });
    }
  }
  async renderMontage(overwrite) {
    const outputPath = path.join(this.distRoot, "montage.png");
    if (!overwrite && await exists(outputPath)) {
      throw new Error("dist/montage.png already exists.");
    }
    const document = await this.adapter.open();
    assertOpenSlideXLocalMedia(document.source);
    await renderSlideXDocument({
      mode: "montage",
      outputPath,
      projectRoot: this.root,
      source: document.source
    });
    return "dist/montage.png";
  }
  async buildStaticSite() {
    const document = await this.adapter.open();
    assertOpenSlideXLocalMedia(document.source);
    const siteRoot = path.join(this.distRoot, "site");
    await mkdir(siteRoot, { recursive: true });
    await exportSlideXDocument({
      format: "html",
      outputPath: path.join(siteRoot, "index.html"),
      overwrite: true,
      projectRoot: this.root,
      source: document.source
    });
    return siteRoot;
  }
};
function assertOpenSlideXLocalMedia(source) {
  const result = validateOpenSlideXLocalMedia(source);
  if (!result.isValid) throw new OpenSlideXLocalMediaError(result.issues);
}
function safeExportName(value) {
  const normalized = typeof value === "string" ? value.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") : "";
  return (normalized || "presentation").slice(0, 80);
}
function assetName(source) {
  if (!/^assets\/[A-Za-z0-9._-]+\.webp$/i.test(source)) {
    throw new Error("Asset paths must use assets/<name>.webp.");
  }
  return source.slice("assets/".length);
}
function normalizedAssetName(value) {
  const name = value.startsWith("assets/") ? value.slice(7) : value;
  const base = name.replace(/\.webp$/i, "").normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
  if (!base) throw new Error("Choose a valid asset name.");
  return `${base}.webp`;
}
function exists(filePath) {
  return access(filePath).then(() => true, () => false);
}

// packages/slidex-workbench/src/server/http.ts
import { createReadStream, watch } from "node:fs";
import { readFile as readFile5, stat as stat3 } from "node:fs/promises";
import { createServer } from "node:http";
import path6 from "node:path";
import { Readable } from "node:stream";
import { summarizeMotionDoc as summarizeMotionDoc3 } from "../sdk/index.js";
import {
  SlideXImageAssetError,
  SlideXRevisionConflictError as SlideXRevisionConflictError3
} from "../sdk/node.js";

// packages/slidex-workbench/src/server/aiBridge.ts
import { randomUUID } from "node:crypto";
import { spawn as spawn2 } from "node:child_process";
import { mkdir as mkdir2, readFile as readFile3, writeFile as writeFile2 } from "node:fs/promises";
import path3 from "node:path";
import { parseMotionDoc as parseMotionDoc2, summarizeMotionDoc as summarizeMotionDoc2 } from "../sdk/index.js";
import { renderSlideXDocument as renderSlideXDocument2, SlideXRevisionConflictError as SlideXRevisionConflictError2 } from "../sdk/node.js";

// packages/slidex-workbench/src/server/codexAppServer.ts
import { readFile as readFile2, realpath, stat as stat2 } from "node:fs/promises";
import path2 from "node:path";

// packages/slidex-workbench/src/shared/aiEvents.ts
var openSlideXToolNames = [
  "open_slidex_open",
  "open_slidex_inspect",
  "open_slidex_catalog",
  "open_slidex_knowledge_search",
  "open_slidex_skill_read",
  "open_slidex_template_read",
  "open_slidex_image_search",
  "open_slidex_image_import",
  "open_slidex_validate",
  "open_slidex_render",
  "open_slidex_quality_check",
  "open_slidex_asset_import",
  "open_slidex_edit"
];
function isOpenSlideXToolName(value) {
  return typeof value === "string" && openSlideXToolNames.includes(value);
}

// packages/slidex-workbench/src/server/codexAppServerTransport.ts
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
var maxProtocolLineBytes = 16 * 1024 * 1024;
var requestTimeoutMs = 3e4;
var CodexAppServerTransport = class {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }
  projectRoot;
  child;
  initializePromise;
  listeners = /* @__PURE__ */ new Set();
  nextRequestId = 1;
  pending = /* @__PURE__ */ new Map();
  stderr = "";
  get diagnostics() {
    return this.stderr;
  }
  request(method, params) {
    return this.ensureStarted().then(() => this.rawRequest(method, params));
  }
  warm() {
    return this.ensureStarted();
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  close() {
    this.child?.kill("SIGTERM");
    this.child = void 0;
    this.initializePromise = void 0;
    this.rejectPending(new Error("Codex App Server was closed."));
  }
  async ensureStarted() {
    if (this.initializePromise) return this.initializePromise;
    this.initializePromise = this.start();
    try {
      await this.initializePromise;
    } catch (error) {
      this.initializePromise = void 0;
      throw error;
    }
  }
  async start() {
    this.stderr = "";
    const child = spawn("codex", codexAppServerArgs(this.projectRoot), {
      cwd: this.projectRoot,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.child = child;
    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => this.receiveLine(line));
    child.stderr.on("data", (chunk) => {
      this.stderr = `${this.stderr}${chunk.toString("utf8")}`.slice(-32e3);
    });
    child.once("error", (error) => this.failProcess(error));
    child.once("exit", (code, signal) => {
      const detail = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
      this.failProcess(new Error(`Codex App Server exited with ${detail}.`));
    });
    await this.rawRequest("initialize", {
      capabilities: { experimentalApi: true, requestAttestation: false },
      clientInfo: { name: "open-slidex-workbench", title: "OpenSlideX Workbench", version: "0.2.4" }
    });
    this.send({ jsonrpc: "2.0", method: "initialized" });
  }
  receiveLine(line) {
    if (Buffer.byteLength(line) > maxProtocolLineBytes) {
      this.child?.kill("SIGTERM");
      this.failProcess(new Error("Codex App Server produced an oversized protocol message."));
      return;
    }
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.id !== void 0 && (message.result !== void 0 || message.error)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message ?? "Codex App Server request failed."));
      else pending.resolve(message.result);
      return;
    }
    if (message.id !== void 0 && message.method) {
      this.answerServerRequest(message);
      return;
    }
    if (message.method) for (const listener of this.listeners) listener(message);
  }
  answerServerRequest(message) {
    if (message.method === "item/commandExecution/requestApproval" || message.method === "item/fileChange/requestApproval") {
      this.send({ id: message.id, jsonrpc: "2.0", result: { decision: "decline" } });
      return;
    }
    if (message.method === "mcpServer/elicitation/request") {
      this.send({ id: message.id, jsonrpc: "2.0", result: { _meta: null, action: "decline", content: null } });
      return;
    }
    if (message.method === "item/tool/requestUserInput") {
      this.send({ id: message.id, jsonrpc: "2.0", result: { answers: {} } });
      return;
    }
    this.send({ error: { code: -32601, message: "OpenSlideX Workbench does not expose client-side tools." }, id: message.id, jsonrpc: "2.0" });
  }
  rawRequest(method, params) {
    const id = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex App Server ${method} timed out.`));
      }, requestTimeoutMs);
      this.pending.set(id, { reject, resolve, timer });
      try {
        this.send({ id, jsonrpc: "2.0", method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  send(message) {
    if (!this.child || this.child.exitCode !== null || this.child.signalCode !== null) {
      throw new Error("Codex App Server is not running.");
    }
    this.child.stdin.write(`${JSON.stringify(message)}
`);
  }
  failProcess(error) {
    if (this.child) {
      this.child.removeAllListeners();
      this.child = void 0;
    }
    this.initializePromise = void 0;
    this.rejectPending(error);
    for (const listener of this.listeners) {
      listener({ method: "open-slidex/process-error", params: { message: error.message } });
    }
  }
  rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
};
function codexAppServerArgs(projectRoot) {
  return [
    "app-server",
    "--stdio",
    "--disable",
    "apps",
    "--disable",
    "browser_use",
    "--disable",
    "computer_use",
    "--disable",
    "image_generation",
    "--disable",
    "js_repl",
    "--disable",
    "plugins",
    "--disable",
    "shell_tool",
    "--disable",
    "unified_exec",
    "-c",
    `mcp_servers=${mcpServersToml(projectRoot)}`,
    "-c",
    'mcp_servers.node_repl={command="node",args=["--version"],enabled=false}',
    "-c",
    'mcp_servers."computer-use"={command="node",args=["--version"],enabled=false}',
    "-c",
    'web_search="disabled"'
  ];
}
function isolatedThreadConfig(projectRoot) {
  return {
    mcp_servers: {
      "computer-use": disabledMcpServer(),
      node_repl: disabledMcpServer(),
      open_slidex: mcpServerConfig(projectRoot)
    },
    web_search: "disabled"
  };
}
function disabledMcpServer() {
  return { args: ["--version"], command: "node", enabled: false };
}
function mcpServerConfig(projectRoot) {
  const launch = openSlideXMcpLaunch(projectRoot);
  return {
    ...launch,
    default_tools_approval_mode: "approve",
    enabled_tools: [...openSlideXToolNames],
    required: true
  };
}
function openSlideXMcpLaunch(projectRoot, options = {}) {
  const bundledEntry = options.bundledEntry ?? fileURLToPath(new URL("../mcp/server.mjs", import.meta.url));
  const entryExists = options.entryExists ?? existsSync;
  if (entryExists(bundledEntry)) {
    return {
      args: [bundledEntry, "--project", projectRoot],
      command: process.execPath,
      cwd: projectRoot
    };
  }
  return {
    args: process.platform === "win32" ? ["/c", "npm", "--silent", "run", "mcp"] : ["--silent", "run", "mcp"],
    command: process.platform === "win32" ? "cmd" : "npm",
    cwd: projectRoot
  };
}
function mcpServersToml(projectRoot) {
  const config = mcpServerConfig(projectRoot);
  return `{open_slidex={command=${JSON.stringify(config.command)},args=${JSON.stringify(config.args)},cwd=${JSON.stringify(config.cwd)},required=true,default_tools_approval_mode="approve",enabled_tools=${JSON.stringify(config.enabled_tools)}}}`;
}

// packages/slidex-workbench/src/server/codexAppServer.ts
var defaultRunTimeoutMs = 8 * 6e4;
var CodexAppServer = class {
  constructor(projectRoot, options) {
    this.projectRoot = projectRoot;
    this.transport = new CodexAppServerTransport(projectRoot);
    this.runTimeoutMs = options?.runTimeoutMs ?? defaultRunTimeoutMs;
  }
  projectRoot;
  previewPaths = /* @__PURE__ */ new Map();
  runTimeoutMs;
  transport;
  warm() {
    return this.transport.warm();
  }
  async *run(input, runId, abortSignal) {
    yield { label: "Connecting to Codex App Server", phase: "connecting", runId, type: "phase" };
    let threadId = "";
    let turnId = "";
    const queue = new AsyncEventQueue();
    const unsubscribe = this.transport.subscribe((message) => queue.push(message));
    const abort = () => queue.push({ method: "open-slidex/abort", params: {} });
    abortSignal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(() => queue.push({ method: "open-slidex/timeout", params: {} }), this.runTimeoutMs);
    try {
      const thread = asRecord(await this.transport.request("thread/start", {
        approvalPolicy: "never",
        baseInstructions: buildCodexInstructions(input),
        config: isolatedThreadConfig(this.projectRoot),
        cwd: this.projectRoot,
        ephemeral: true,
        historyMode: "paginated",
        runtimeWorkspaceRoots: [this.projectRoot],
        sandbox: "read-only",
        threadSource: "open-slidex-workbench"
      }));
      threadId = String(asRecord(thread.thread).id ?? "");
      if (!threadId) throw new Error("Codex App Server did not return a thread id.");
      if (abortSignal?.aborted) {
        yield { code: "cancelled", message: "The Codex run was cancelled.", runId, type: "run.failed" };
        return;
      }
      await this.verifyMcpInventory(threadId);
      if (abortSignal?.aborted) {
        yield { code: "cancelled", message: "The Codex run was cancelled.", runId, type: "run.failed" };
        return;
      }
      yield { label: "Reading the current presentation", phase: "reading", runId, type: "phase" };
      const turn = asRecord(await this.transport.request("turn/start", {
        ...codexModelPreset(input.aiMode ?? "balanced"),
        input: [{ text: buildCodexTurnPrompt(input), text_elements: [], type: "text" }],
        threadId
      }));
      turnId = String(asRecord(turn.turn).id ?? "");
      if (!turnId) throw new Error("Codex App Server did not return a turn id.");
      if (abortSignal?.aborted) {
        await this.interrupt(threadId, turnId);
        yield { code: "cancelled", message: "The Codex run was cancelled.", runId, type: "run.failed" };
        return;
      }
      const textRedactor = new StreamingLocalDetailRedactor(this.projectRoot);
      const toolActivities = /* @__PURE__ */ new Map();
      let terminal = false;
      while (!terminal) {
        const message = await queue.shift();
        if (message.method === "open-slidex/abort") {
          await this.interrupt(threadId, turnId);
          yield { code: "cancelled", message: "The Codex run was cancelled.", runId, type: "run.failed" };
          return;
        }
        if (message.method === "open-slidex/timeout") {
          await this.interrupt(threadId, turnId);
          yield { code: "timeout", message: "Codex took too long and was stopped.", runId, type: "run.failed" };
          return;
        }
        if (message.method === "open-slidex/process-error") {
          yield {
            code: "app_server_error",
            message: redactLocalDetails(errorMessage(void 0, this.transport.diagnostics), this.projectRoot),
            runId,
            type: "run.failed"
          };
          return;
        }
        const params = asRecord(message.params);
        if (params.threadId !== threadId) continue;
        const eventTurnId = String(params.turnId ?? asRecord(params.turn).id ?? "");
        if (eventTurnId && eventTurnId !== turnId) continue;
        if (message.method === "item/commandExecution/requestApproval" || message.method === "item/fileChange/requestApproval") {
          await this.interrupt(threadId, turnId);
          yield blockedToolEvent(runId);
          return;
        }
        if (message.method === "item/agentMessage/delta" && typeof params.delta === "string") {
          const delta = textRedactor.push(params.delta);
          if (delta) yield { delta, runId, type: "text" };
          continue;
        }
        if (message.method === "item/started") {
          const item = asRecord(params.item);
          if (item.type !== "mcpToolCall") {
            if (isExecutableItem(item.type)) {
              await this.interrupt(threadId, turnId);
              yield blockedToolEvent(runId);
              return;
            }
            continue;
          }
          const tool = validateToolItem(item);
          const toolArguments = asRecord(item.arguments);
          const activity = describeToolActivity(tool, toolArguments, input);
          const canvasPreview = canvasEditPreviewPlan(tool, toolArguments, input.expectedRevision);
          toolActivities.set(String(item.id), { activity, startedAt: Date.now() });
          yield {
            ...canvasPreview ? { canvasPreview } : {},
            details: activity.details,
            runId,
            summary: activity.summary,
            targets: activity.targets,
            tool,
            toolCallId: String(item.id),
            type: "tool.started"
          };
          yield { label: toolLabel(tool), phase: "working", runId, type: "phase" };
          continue;
        }
        if (message.method === "item/completed") {
          const item = asRecord(params.item);
          if (item.type !== "mcpToolCall") {
            if (isExecutableItem(item.type)) {
              await this.interrupt(threadId, turnId);
              yield blockedToolEvent(runId);
              return;
            }
            continue;
          }
          const tool = validateToolItem(item);
          const toolCallId = String(item.id);
          const tracked = toolActivities.get(toolCallId);
          const activity = tracked?.activity ?? describeToolActivity(tool, asRecord(item.arguments), input);
          const duration = tracked ? durationLabel(Date.now() - tracked.startedAt) : "";
          if (item.status === "failed" || item.error || asRecord(item.result).isError === true) {
            yield {
              details: activity.details,
              message: [redactLocalDetails(toolFailureMessage(item), this.projectRoot), duration].filter(Boolean).join(" \xB7 "),
              runId,
              targets: activity.targets,
              tool,
              toolCallId,
              type: "tool.failed"
            };
            continue;
          }
          const result = mcpResultPayload(item);
          const preview = await this.registerPreview(runId, toolCallId, tool, result);
          const completedDetails = completedToolDetails(tool, result, activity.details);
          yield {
            ...preview ? { preview } : {},
            details: completedDetails,
            runId,
            summary: [summarizeToolResult(tool, result), duration].filter(Boolean).join(" \xB7 "),
            targets: activity.targets,
            tool,
            toolCallId,
            type: "tool.completed"
          };
          continue;
        }
        if (message.method === "turn/completed") {
          terminal = true;
          const finalDelta = textRedactor.flush();
          if (finalDelta) yield { delta: finalDelta, runId, type: "text" };
          const turnResult = asRecord(params.turn);
          if (turnResult.status === "completed") {
            yield { runId, type: "run.completed" };
          } else {
            const error = asRecord(turnResult.error);
            yield {
              code: turnResult.status === "interrupted" ? "cancelled" : "codex_failed",
              message: redactLocalDetails(String(error.message ?? "Codex could not complete this run."), this.projectRoot),
              runId,
              type: "run.failed"
            };
          }
        }
      }
    } catch (error) {
      if (threadId && turnId) await this.interrupt(threadId, turnId);
      yield {
        code: "app_server_error",
        message: redactLocalDetails(errorMessage(error, this.transport.diagnostics), this.projectRoot),
        runId,
        type: "run.failed"
      };
    } finally {
      clearTimeout(timeout);
      abortSignal?.removeEventListener("abort", abort);
      unsubscribe();
    }
  }
  async readPreview(runId, toolCallId) {
    const registered = this.previewPaths.get(previewKey(runId, toolCallId));
    if (!registered) throw Object.assign(new Error("AI tool preview was not found."), { status: 404 });
    const [root, file] = await Promise.all([realpath(this.projectRoot), realpath(registered)]);
    if (!isInsideRoot(root, file) || path2.extname(file).toLowerCase() !== ".png") {
      throw Object.assign(new Error("AI tool preview path was rejected."), { status: 403 });
    }
    return readFile2(file);
  }
  close() {
    this.transport.close();
    this.previewPaths.clear();
  }
  async interrupt(threadId, turnId) {
    await this.transport.request("turn/interrupt", { threadId, turnId }).catch(() => void 0);
  }
  async verifyMcpInventory(threadId) {
    const response = asRecord(await this.transport.request("mcpServerStatus/list", {
      detail: "toolsAndAuthOnly",
      limit: 50,
      threadId
    }));
    const servers = Array.isArray(response.data) ? response.data.map(asRecord) : [];
    const active = servers.filter((server) => Object.keys(asRecord(server.tools)).length > 0);
    if (active.length !== 1 || active[0]?.name !== "open_slidex") {
      throw new Error("Codex App Server loaded an MCP server outside the OpenSlideX allowlist.");
    }
    const tools = Object.keys(asRecord(active[0].tools)).sort();
    const expected = [...openSlideXToolNames].sort();
    if (JSON.stringify(tools) !== JSON.stringify(expected)) {
      throw new Error("OpenSlideX MCP did not expose the expected tool allowlist.");
    }
  }
  async registerPreview(runId, toolCallId, tool, result) {
    const candidate = tool === "open_slidex_render" ? result.outputPath : tool === "open_slidex_edit" ? asRecord(result.preview).outputPath : void 0;
    if (typeof candidate !== "string") return void 0;
    const file = await safePreviewPath(this.projectRoot, candidate);
    if (!file) return void 0;
    this.previewPaths.set(previewKey(runId, toolCallId), file);
    return { kind: "image", runId, toolCallId };
  }
};
function codexModelPreset(mode) {
  return {
    fast: { effort: "low", model: "gpt-5.6-luna" },
    balanced: { effort: "medium", model: "gpt-5.6-terra" },
    quality: { effort: "high", model: "gpt-5.6-sol" }
  }[mode];
}
function buildCodexInstructions(input) {
  return [
    "You are the local OpenSlideX presentation agent.",
    "Use only MCP server open_slidex and only its open_slidex_* tools.",
    "Never call shell, file-change, web, browser, computer-use, app, plugin, or dynamic tools.",
    "presentation.mdx is the only presentation source. Never create a second canvas or persisted document.",
    "Read the current presentation before changing it. Every edit must use open_slidex_edit with the latest expectedRevision.",
    "For any request that changes presentation.mdx, call open_slidex_skill_read exactly once with mode='bundle' and the narrowest matching intent: authoring for structural/content edits, design for visual edits, create for a new deck, redesign for whole-deck redesign, motion for animation, or qa for review-only work.",
    "Do not read the four skills separately. Use mode='manifest' only when the task genuinely cannot be classified, and never request arbitrary skill names or paths.",
    "When the project has a template lock, read it with open_slidex_template_read and follow both the validated blueprint and its localized qualityProfile: copy limits, canonical type scale, role recipes, image policy, and deck rhythm.",
    "For a new deck, multi-slide generation, or a whole-deck redesign, call open_slidex_template_read with referenceMode='role-samples' and includeStarterSource=true. Use the returned role-based MDX excerpts as concrete geometry and component references while replacing demo copy with the user's content. Follow referenceUsage and recalculate text geometry; never submit an excerpt unchanged. Use starterSource as the clean shell and never claim template fidelity from the blueprint alone.",
    "Before the first multi-slide edit, assign one approved role per slide and budget every text string against the selected template qualityProfile. Prefer shorter copy over smaller type; do not submit text that already exceeds a role sample's copy limits.",
    "For decks of 10 or more slides, keep one message per slide, use short titles and concise supporting copy, and submit one complete candidate before any patch retry.",
    "For a single-slide or selected-element edit, request only the matching role sample when template MDX is necessary; otherwise read blueprint and qualityProfile only.",
    "External images may come only from open_slidex_image_search. Search never imports. Call open_slidex_image_import only after a later explicit user confirmation that names the exact provider asset ID.",
    "Revision conflicts are terminal: explain that the Canvas changed and do not retry against stale content.",
    "open_slidex_edit is a transaction-safe visual gate: it builds and render-checks the candidate before writing. If it returns quality_gate_failed, presentation.mdx and expectedRevision are unchanged; use its slide, code, node IDs, and metrics to submit a corrected complete candidate against the same revision.",
    "When an edit is rejected, use its rejectedCandidateId with a small patch command batch against the rejected candidate. Use at most two patch attempts for one slide and three for multi-slide work. Never resubmit identical geometry and never validate, render, or quality-check a rejected candidate separately.",
    "When an edit succeeds, candidateQuality and preview are the authoritative QA proof produced by that same transaction. Do not call open_slidex_validate, open_slidex_render, or open_slidex_quality_check again. Standalone QA tools are only for review-only requests where no edit occurs.",
    `The run began at revision ${input.expectedRevision}.`,
    `The active selection is slide ${input.slideIndex + 1}${input.nodeId ? `, node ${input.nodeId}` : input.blockIndex === void 0 ? "" : `, block ${input.blockIndex}`}.`,
    `Tool indices are zero-based. The selected visible slide ${input.slideIndex + 1} must be passed to every open_slidex_* tool as slideIndex ${input.slideIndex}; do not convert the visible slide number into a tool index.`,
    `Unless the user explicitly requests the whole deck or multiple slides, edit only slide ${input.slideIndex + 1}${input.nodeId ? ` and node ${input.nodeId}` : input.blockIndex === void 0 ? "" : ` and block ${input.blockIndex}`}. Do not add, delete, reorder, or modify any other slide.`,
    "Keep the final response concise and describe only completed work and actionable errors."
  ].join("\n");
}
function buildCodexTurnPrompt(input) {
  const transcript = (input.messages ?? []).slice(-8).map((message) => `${message.role}: ${message.content}`).join("\n");
  return [
    `Frozen Canvas target: visible slide ${input.slideIndex + 1} = zero-based tool slideIndex ${input.slideIndex}${input.nodeId ? `, nodeId ${input.nodeId}` : input.blockIndex === void 0 ? "" : `, blockIndex ${input.blockIndex}`}.`,
    transcript ? `Recent chat:
${transcript}` : "",
    `User request:
${input.prompt}`
  ].filter(Boolean).join("\n\n");
}
function validateToolItem(item) {
  if (item.server !== "open_slidex" || !isOpenSlideXToolName(item.tool)) {
    throw new Error("Codex attempted to call a tool outside the OpenSlideX allowlist.");
  }
  return item.tool;
}
function summarizeToolStart(tool, args) {
  if (tool === "open_slidex_inspect") return `Inspecting slide ${Number(args.slideIndex ?? 0) + 1}`;
  if (tool === "open_slidex_edit") return `Applying ${Array.isArray(args.commands) ? args.commands.length : 0} revision-safe edit${Array.isArray(args.commands) && args.commands.length === 1 ? "" : "s"}`;
  if (tool === "open_slidex_render") return args.mode === "slide" ? `Rendering slide ${Number(args.slideIndex ?? 0) + 1}` : "Rendering the deck montage";
  if (tool === "open_slidex_quality_check") return args.mode === "slide" ? `Checking slide ${Number(args.slideIndex ?? 0) + 1} layout quality` : "Checking the complete deck layout";
  return {
    open_slidex_asset_import: "Importing a local image",
    open_slidex_catalog: "Reading the OpenSlideX component catalog",
    open_slidex_image_import: "Importing a confirmed trusted image",
    open_slidex_image_search: "Searching trusted images",
    open_slidex_knowledge_search: "Searching local project knowledge",
    open_slidex_open: "Reading presentation.mdx",
    open_slidex_skill_read: args.mode === "manifest" ? "Indexing project guidance" : `Loading ${safeIdentifier(String(args.intent ?? args.skill ?? "project"))} guidance`,
    open_slidex_template_read: args.referenceMode === "role-samples" ? "Reading template role samples" : args.includeReferenceSource === true || args.referenceMode === "full" ? "Reading the selected template MDX" : "Reading the selected template guidance",
    open_slidex_validate: "Validating presentation.mdx"
  }[tool] ?? "Using an OpenSlideX tool";
}
function describeToolActivity(tool, args, selection) {
  const targets = toolTargets(tool, args, selection);
  const details = tool === "open_slidex_edit" ? editCommandDetails(args.commands) : tool === "open_slidex_skill_read" ? guidanceDetails(args) : tool === "open_slidex_catalog" ? [`Catalog \xB7 ${safeIdentifier(String(args.section ?? "all"))}`] : [targetSummary(targets)];
  return {
    details: details.filter(Boolean).slice(0, 12),
    summary: summarizeToolStart(tool, args),
    targets
  };
}
function canvasEditPreviewPlan(tool, args, frozenRevision) {
  if (tool !== "open_slidex_edit" || args.expectedRevision !== frozenRevision || !Array.isArray(args.commands)) {
    return void 0;
  }
  const commands = args.commands.filter((command) => Boolean(command) && typeof command === "object").map((command) => structuredClone(command));
  if (commands.length === 0 || commands.length !== args.commands.length || commands.length > 100) return void 0;
  if (!commands.every((command) => typeof command.type === "string")) return void 0;
  return { commands, expectedRevision: frozenRevision, kind: "edit-commands" };
}
function toolTargets(tool, args, selection) {
  const targets = [];
  const pushSlide = (value) => {
    const slideIndex = nonNegativeInteger(value);
    if (slideIndex !== void 0) targets.push({ kind: "slide", slideIndex });
  };
  const pushBlock = (command) => {
    const slideIndex = nonNegativeInteger(command.slideIndex) ?? selection.slideIndex;
    const blockIndex = nonNegativeInteger(command.blockIndex);
    const nodeId = typeof command.nodeId === "string" ? safeIdentifier(command.nodeId) : void 0;
    targets.push({
      ...blockIndex === void 0 ? {} : { blockIndex },
      kind: "block",
      ...nodeId ? { nodeId } : {},
      slideIndex
    });
  };
  if (tool === "open_slidex_edit" && Array.isArray(args.commands)) {
    for (const value of args.commands) {
      const command = asRecord(value);
      const operation = String(command.type ?? command.command ?? command.op ?? "");
      if (operation.includes("block")) pushBlock(command);
      else {
        pushSlide(command.slideIndex);
        pushSlide(command.fromIndex);
        pushSlide(command.toIndex);
      }
    }
  } else if (tool === "open_slidex_inspect") {
    const nodeId = typeof args.nodeId === "string" ? safeIdentifier(args.nodeId) : selection.nodeId;
    const blockIndex = nonNegativeInteger(args.blockIndex) ?? selection.blockIndex;
    const slideIndex = nonNegativeInteger(args.slideIndex) ?? selection.slideIndex;
    targets.push(nodeId || blockIndex !== void 0 ? { ...blockIndex === void 0 ? {} : { blockIndex }, kind: "block", ...nodeId ? { nodeId } : {}, slideIndex } : { kind: "slide", slideIndex });
  } else if ((tool === "open_slidex_render" || tool === "open_slidex_quality_check") && args.mode === "slide") {
    targets.push({ kind: "slide", slideIndex: nonNegativeInteger(args.slideIndex) ?? selection.slideIndex });
  }
  return dedupeTargets(targets.length ? targets : [{ kind: "presentation" }]);
}
function editCommandDetails(value) {
  if (!Array.isArray(value)) return ["No structured edit commands reported"];
  return value.map((entry) => {
    const command = asRecord(entry);
    const operation = safeIdentifier(String(command.type ?? command.command ?? command.op ?? "edit")) || "edit";
    const slideIndex = nonNegativeInteger(command.slideIndex);
    const blockIndex = nonNegativeInteger(command.blockIndex);
    const nodeId = typeof command.nodeId === "string" ? safeIdentifier(command.nodeId) : void 0;
    return [operation, slideIndex === void 0 ? "" : `slide ${slideIndex + 1}`, nodeId ? `node ${nodeId}` : blockIndex === void 0 ? "" : `block ${blockIndex + 1}`].filter(Boolean).join(" \xB7 ");
  });
}
function targetSummary(targets) {
  const first = targets[0];
  if (!first || first.kind === "presentation") return "Target \xB7 presentation";
  if (first.kind === "slide") return `Target \xB7 slide ${first.slideIndex + 1}`;
  return `Target \xB7 slide ${first.slideIndex + 1}${first.nodeId ? ` \xB7 node ${first.nodeId}` : first.blockIndex === void 0 ? "" : ` \xB7 block ${first.blockIndex + 1}`}`;
}
function dedupeTargets(targets) {
  return targets.filter((target, index) => {
    const key = JSON.stringify(target);
    return targets.findIndex((candidate) => JSON.stringify(candidate) === key) === index;
  });
}
function nonNegativeInteger(value) {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : void 0;
}
function safeIdentifier(value) {
  return value.replace(/[^A-Za-z0-9._:-]/g, "").slice(0, 120);
}
function summarizeToolResult(tool, result) {
  const revision = typeof result.revision === "string" ? ` \xB7 ${shortRevision(result.revision)}` : "";
  if (tool === "open_slidex_edit") return `Presentation updated${revision}`;
  if (tool === "open_slidex_render") return `Preview rendered${revision}`;
  if (tool === "open_slidex_quality_check") {
    const report = asRecord(result.report);
    const summary = asRecord(report.summary);
    const errors = Number(summary.errorCount ?? 0);
    const warnings = Number(summary.warningCount ?? 0);
    const score = Number(report.score ?? 0);
    return errors === 0 ? `Visual QA passed \xB7 ${score}/100${warnings ? ` \xB7 ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}${revision}` : `Visual QA found ${errors} error${errors === 1 ? "" : "s"} \xB7 ${warnings} warning${warnings === 1 ? "" : "s"}${revision}`;
  }
  if (tool === "open_slidex_validate") {
    const validation = asRecord(result.validation);
    const issues = Array.isArray(validation.issues) ? validation.issues.length : 0;
    return validation.isValid === true ? `Validation passed${revision}` : `Validation found ${issues} issue${issues === 1 ? "" : "s"}${revision}`;
  }
  if (tool === "open_slidex_open") return `${String(result.title ?? "Presentation")} loaded${revision}`;
  if (tool === "open_slidex_skill_read") {
    const skills = Array.isArray(result.skills) ? result.skills.length : 1;
    if (result.mode === "manifest") return `Indexed ${skills} approved project guides`;
    if (result.mode === "bundle") return `Loaded ${skills} project guide${skills === 1 ? "" : "s"} for ${safeIdentifier(String(result.intent ?? "this task"))}`;
    return `Loaded ${safeIdentifier(String(result.name ?? "project"))} guidance`;
  }
  if (tool === "open_slidex_catalog") return `Loaded ${safeIdentifier(String(result.section ?? "component"))} catalog`;
  return `Completed${revision}`;
}
function completedToolDetails(tool, result, fallback) {
  if (tool !== "open_slidex_quality_check") return [...fallback];
  const report = asRecord(result.report);
  const issues = Array.isArray(report.issues) ? report.issues : [];
  if (issues.length === 0) return ["Rendered geometry \xB7 no blocking findings"];
  return issues.slice(0, 10).map((value) => {
    const issue = asRecord(value);
    const slideIndex = nonNegativeInteger(issue.slideIndex) ?? 0;
    const code = safeIdentifier(String(issue.code ?? "quality"));
    const nodeIds = Array.isArray(issue.nodeIds) ? issue.nodeIds.map((nodeId) => safeIdentifier(String(nodeId))).filter(Boolean).slice(0, 2) : [];
    return [`Slide ${slideIndex + 1}`, code, nodeIds.length ? `node ${nodeIds.join(" + ")}` : ""].filter(Boolean).join(" \xB7 ");
  });
}
function guidanceDetails(args) {
  if (args.mode === "manifest") return ["Guidance \xB7 approved manifest"];
  if (args.mode === "bundle") return [`Guidance intent \xB7 ${safeIdentifier(String(args.intent ?? "authoring"))}`];
  return [`Guidance skill \xB7 ${safeIdentifier(String(args.skill ?? "approved"))}`];
}
function durationLabel(durationMs) {
  return `${(Math.max(1, durationMs) / 1e3).toFixed(2)} s`;
}
function toolLabel(tool) {
  return {
    open_slidex_asset_import: "Importing an asset",
    open_slidex_catalog: "Reading available components",
    open_slidex_image_import: "Importing a trusted image",
    open_slidex_image_search: "Searching trusted images",
    open_slidex_edit: "Updating the presentation",
    open_slidex_inspect: "Inspecting the current slide",
    open_slidex_knowledge_search: "Searching local knowledge",
    open_slidex_open: "Reading the presentation",
    open_slidex_quality_check: "Checking visual quality",
    open_slidex_render: "Rendering a preview",
    open_slidex_skill_read: "Reading project guidance",
    open_slidex_template_read: "Reading template MDX and guidance",
    open_slidex_validate: "Checking the document"
  }[tool];
}
function isExecutableItem(type) {
  return type === "commandExecution" || type === "fileChange" || type === "dynamicToolCall";
}
function blockedToolEvent(runId) {
  return {
    code: "tool_not_allowed",
    message: "Codex attempted to use a tool outside the OpenSlideX MCP allowlist and was stopped.",
    runId,
    type: "run.failed"
  };
}
function redactLocalDetails(value, projectRoot) {
  const escapedRoot = projectRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value.replace(new RegExp(escapedRoot, "g"), ".").replace(/(^|[\s("'=])\/(?:[^\s\n\r\t"'`)]+\/?)+/g, "$1[local path]").replace(/\b[A-Za-z]:\\(?:[^\s\n\r\t"'`)]+\\?)+/g, "[local path]").replace(/\b[A-Z][A-Z0-9_]{2,}=\S+/g, "[redacted]").replace(/(["']?(?:api[_-]?key|authorization|password|secret|token)["']?\s*[:=]\s*)["']?[^,\s}"']+["']?/gi, "$1[redacted]").slice(0, 4e3);
}
var StreamingLocalDetailRedactor = class {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }
  projectRoot;
  pending = "";
  push(delta) {
    this.pending += delta;
    if (this.pending.length <= 256) return "";
    const safeCutoff = this.pending.length - 128;
    const boundary = lastWhitespaceAtOrBefore(this.pending, safeCutoff);
    if (boundary < 0) return "";
    const ready = this.pending.slice(0, boundary + 1);
    this.pending = this.pending.slice(boundary + 1);
    return redactLocalDetails(ready, this.projectRoot);
  }
  flush() {
    const ready = redactLocalDetails(this.pending, this.projectRoot);
    this.pending = "";
    return ready;
  }
};
function lastWhitespaceAtOrBefore(value, cutoff) {
  for (let index = Math.min(cutoff, value.length - 1); index >= 0; index -= 1) {
    if (/\s/.test(value[index] ?? "")) return index;
  }
  return -1;
}
function errorMessage(error, stderr) {
  const meaningful = stderr.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith("WARNING:"));
  if (meaningful && error instanceof Error && /App Server exited/.test(error.message)) return meaningful;
  if (error instanceof Error && error.message) return error.message;
  return meaningful || "Codex App Server failed unexpectedly.";
}
function shortRevision(revision) {
  return revision.replace(/^sha256:/, "").slice(0, 8);
}
function previewKey(runId, toolCallId) {
  return `${runId}:${toolCallId}`;
}
function isInsideRoot(root, file) {
  return file === root || file.startsWith(`${root}${path2.sep}`);
}
async function safePreviewPath(projectRoot, candidate) {
  const [root, file] = await Promise.all([realpath(projectRoot), realpath(candidate).catch(() => "")]);
  if (!file || !isInsideRoot(root, file) || path2.extname(file).toLowerCase() !== ".png") return void 0;
  return (await stat2(file)).isFile() ? file : void 0;
}
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function toolFailureMessage(item) {
  const error = asRecord(item.error);
  const payload = mcpResultPayload(item);
  const code = stringValue(payload.code) ?? stringValue(error.code);
  const message = stringValue(payload.message) ?? stringValue(error.message);
  if (code === "quality_gate_failed") return qualityGateFailureMessage(payload, message);
  if (code === "revision_conflict") return "The presentation changed while this edit was being prepared. Reload the Canvas, then try again.";
  return message ?? "The OpenSlideX tool failed.";
}
function mcpResultPayload(item) {
  const result = asRecord(item.result);
  const structured = asRecord(result.structuredContent);
  if (Object.keys(structured).length > 0) return structured;
  const content = Array.isArray(result.content) ? result.content : [];
  for (const entry of content) {
    const text = stringValue(asRecord(entry).text);
    if (!text) continue;
    try {
      const payload = asRecord(JSON.parse(text));
      if (Object.keys(payload).length > 0) return payload;
    } catch {
    }
  }
  return asRecord(result.error);
}
function qualityGateFailureMessage(payload, fallback) {
  const report = asRecord(payload.qualityReport);
  const summary = asRecord(report.summary);
  const issues = Array.isArray(report.issues) ? report.issues.map(asRecord) : [];
  const blocking = issues.filter((issue) => issue.severity === "error");
  const errorCount = nonNegativeInteger(summary.errorCount) ?? blocking.length;
  const findings = blocking.slice(0, 4).map((issue) => {
    const slideIndex = nonNegativeInteger(issue.slideIndex);
    const code = safeIdentifier(String(issue.code ?? "quality issue")) || "quality issue";
    const nodeIds = Array.isArray(issue.nodeIds) ? issue.nodeIds.map((nodeId) => safeIdentifier(String(nodeId))).filter(Boolean).slice(0, 2) : [];
    return [`Slide ${slideIndex === void 0 ? "?" : slideIndex + 1}`, code, nodeIds.length ? `node ${nodeIds.join(" + ")}` : ""].filter(Boolean).join(" \xB7 ");
  });
  const count = `${errorCount} blocking ${errorCount === 1 ? "issue" : "issues"}`;
  const headline = `Candidate was not written: visual QA found ${count}.`;
  if (findings.length > 0) return `${headline} Fix: ${findings.join("; ")}. Canvas unchanged.`;
  return fallback && fallback !== "The OpenSlideX tool failed." ? `${headline} ${fallback} Canvas unchanged.` : `${headline} Canvas unchanged.`;
}
function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
var AsyncEventQueue = class {
  values = [];
  waiters = [];
  push(value) {
    const waiter = this.waiters.shift();
    if (waiter) waiter(value);
    else this.values.push(value);
  }
  shift() {
    const value = this.values.shift();
    if (value !== void 0) return Promise.resolve(value);
    return new Promise((resolve) => this.waiters.push(resolve));
  }
};

// packages/slidex-workbench/src/server/aiBridge.ts
var openSlideXAiProviders = ["codex", "claude"];
var openSlideXAiModes = ["fast", "balanced", "quality"];
var maxProcessOutputBytes = 12 * 1024 * 1024;
var OpenSlideXAiBridge = class {
  project;
  codex;
  codexRuns = /* @__PURE__ */ new Map();
  processes = /* @__PURE__ */ new Map();
  statusCache;
  constructor(project) {
    this.project = project;
    this.codex = new CodexAppServer(project.root);
  }
  async status() {
    if (this.statusCache && this.statusCache.expiresAt > Date.now()) return this.statusCache.value;
    const value = Promise.all(openSlideXAiProviders.map((provider) => providerStatus(provider)));
    this.statusCache = { expiresAt: Date.now() + 15e3, value };
    return value;
  }
  async warm() {
    const status = (await this.status()).find((provider) => provider.provider === "codex");
    if (!status?.available || !status.authenticated) return { ready: false, status };
    await this.codex.warm();
    return { ready: true, status: { ...status, detail: "App Server warmed in this local workspace" } };
  }
  async run(input) {
    if (input.provider === "codex") {
      let message = "";
      let sessionId2 = "";
      for await (const event of this.stream(input)) {
        sessionId2 = event.runId;
        if (event.type === "text") message += event.delta;
        if (event.type === "run.failed") throw new Error(event.message);
      }
      return {
        message: message.trim() || "Codex completed the OpenSlideX run.",
        provider: "codex",
        sessionId: sessionId2
      };
    }
    if (!openSlideXAiProviders.includes(input.provider)) throw new Error("Choose Codex or Claude Code.");
    const current = await this.project.open();
    if (current.revision !== input.expectedRevision) {
      throw new SlideXRevisionConflictError2(current.revision);
    }
    const status = await providerStatus(input.provider);
    if (!status.available) throw new Error(`${status.label} CLI is not installed or is not available in PATH.`);
    if (!status.authenticated) throw new Error(`${status.label} is installed but is not signed in. Sign in from its own CLI, then retry.`);
    const sessionId = randomUUID();
    const prompt = buildAgentPrompt(input, current.revision);
    const { args, command } = openSlideXAiProviderCommand(input.provider);
    const child = spawn2(command, args, {
      cwd: this.project.root,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.processes.set(sessionId, child);
    try {
      const { stderr, stdout } = await collectProcess(child, prompt);
      const message = assistantText(input.provider, stdout).trim() || stderr.trim() || "The local agent completed without a text response.";
      const source = extractCandidateSource(message);
      if (!source) return { message, provider: input.provider, sessionId };
      const validation = summarizeMotionDoc2(source).validation;
      const draftRoot = path3.join(this.project.stateRoot, "agent-drafts");
      await mkdir2(draftRoot, { recursive: true });
      await writeFile2(path3.join(draftRoot, `${sessionId}.mdx`), source, "utf8");
      let montage;
      if (validation.isValid) {
        const outputPath = path3.join(this.project.distRoot, `agent-draft-${sessionId}.png`);
        await renderSlideXDocument2({
          mode: "montage",
          outputPath,
          projectRoot: this.project.root,
          source
        }).then(() => {
          montage = `dist/agent-draft-${sessionId}.png`;
        }).catch(() => void 0);
      }
      return {
        draft: { id: sessionId, montage, revision: current.revision, source, validation },
        message: stripCandidateSource(message),
        provider: input.provider,
        sessionId
      };
    } finally {
      this.processes.delete(sessionId);
    }
  }
  async *stream(input, abortSignal) {
    if (input.provider !== "codex") throw new Error("Only Codex uses App Server streaming.");
    const current = await this.project.open();
    if (current.revision !== input.expectedRevision) {
      throw new SlideXRevisionConflictError2(current.revision);
    }
    const status = await providerStatus("codex");
    if (!status.available) throw new Error("Codex CLI with App Server support is not installed or is not available in PATH.");
    if (!status.authenticated) throw new Error("Codex is installed but is not signed in. Run codex login, then retry.");
    const runId = randomUUID();
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    abortSignal?.addEventListener("abort", forwardAbort, { once: true });
    this.codexRuns.set(runId, controller);
    try {
      yield* this.codex.run(input, runId, controller.signal);
    } finally {
      abortSignal?.removeEventListener("abort", forwardAbort);
      this.codexRuns.delete(runId);
    }
  }
  readToolPreview(runId, toolCallId) {
    return this.codex.readPreview(runId, toolCallId);
  }
  async apply(draftId, expectedRevision) {
    if (!/^[0-9a-f-]{36}$/i.test(draftId)) throw new Error("Invalid AI draft id.");
    const draftPath = path3.join(this.project.stateRoot, "agent-drafts", `${draftId}.mdx`);
    const source = await readFile3(draftPath, "utf8");
    const validation = summarizeMotionDoc2(source).validation;
    if (!validation.isValid) throw new Error("The AI draft is invalid and cannot be applied.");
    const title = parseMotionDoc2(source).title || "Untitled presentation";
    return this.project.save({ expectedRevision, source, title });
  }
  cancel(sessionId) {
    const codex = this.codexRuns.get(sessionId);
    if (codex) {
      codex.abort();
      return true;
    }
    const child = this.processes.get(sessionId);
    if (!child) return false;
    child.kill("SIGTERM");
    return true;
  }
  close() {
    this.codex.close();
    for (const controller of this.codexRuns.values()) controller.abort();
    this.codexRuns.clear();
    for (const child of this.processes.values()) child.kill("SIGTERM");
    this.processes.clear();
  }
};
async function providerStatus(provider) {
  const label = provider === "codex" ? "Codex" : "Claude Code";
  const command = provider === "codex" ? "codex" : "claude";
  const version = await runProbe(command, ["--version"]);
  if (!version.ok) {
    return { authenticated: false, available: false, detail: "CLI not found", label, provider };
  }
  const auth = provider === "codex" ? await runProbe(command, ["login", "status"]) : await runProbe(command, ["auth", "status"]);
  const appServer = provider === "codex" ? await runProbe(command, ["app-server", "--help"]) : { ok: true, output: "" };
  return {
    authenticated: auth.ok,
    available: appServer.ok,
    detail: !appServer.ok ? "Update Codex CLI to a version with App Server support" : auth.ok ? provider === "codex" ? "App Server ready in this local workspace" : "Ready in this local workspace" : "Sign in from the CLI to continue",
    label,
    provider,
    version: firstMeaningfulLine(version.output)
  };
}
function openSlideXAiProviderCommand(provider) {
  if (provider === "codex") {
    return {
      args: ["app-server", "--stdio"],
      command: "codex"
    };
  }
  return {
    args: ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "plan"],
    command: "claude"
  };
}
function buildAgentPrompt(input, revision) {
  const transcript = (input.messages ?? []).slice(-8).map((message) => `${message.role}: ${message.content}`).join("\n");
  return [
    "You are editing one local OpenSlideX presentation workspace.",
    "Read AGENTS.md and the four project skills before proposing changes.",
    "presentation.mdx is the only presentation source. Do not edit any file in this run.",
    `Current revision: ${revision}`,
    `Current selection: slide ${input.slideIndex + 1}${input.nodeId ? `, node ${input.nodeId}` : input.blockIndex === void 0 ? "" : `, block ${input.blockIndex}`}.`,
    `Unless the user explicitly requests the whole deck or multiple slides, change only slide ${input.slideIndex + 1}${input.nodeId ? ` and node ${input.nodeId}` : input.blockIndex === void 0 ? "" : ` and block ${input.blockIndex}`}. Preserve every other slide exactly, including its order.`,
    transcript ? `Recent chat:
${transcript}` : "",
    `User request:
${input.prompt}`,
    "If the request changes the deck, return the COMPLETE candidate presentation.mdx between these exact markers:",
    "<OPENSLIDEX_MDX>",
    "...complete source...",
    "</OPENSLIDEX_MDX>",
    "Outside the markers, explain the design decisions in concise plain language. Never return a partial patch inside the markers."
  ].filter(Boolean).join("\n\n");
}
function collectProcess(child, input) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let bytes = 0;
    const append = (target, chunk) => {
      bytes += chunk.byteLength;
      if (bytes > maxProcessOutputBytes) {
        child.kill("SIGTERM");
        reject(new Error("The local agent produced too much output."));
        return;
      }
      if (target === "stdout") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
    };
    child.stdout.on("data", (chunk) => append("stdout", chunk));
    child.stderr.on("data", (chunk) => append("stderr", chunk));
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve({ stderr, stdout });
      else reject(new Error(signal ? `The local agent was cancelled (${signal}).` : stderr.trim() || `The local agent exited with code ${code}.`));
    });
    child.stdin.end(input);
  });
}
function runProbe(command, args) {
  return new Promise((resolve) => {
    const child = spawn2(command, args, { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), 4e3);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString("utf8");
    });
    child.once("error", () => {
      clearTimeout(timer);
      resolve({ ok: false, output });
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, output });
    });
  });
}
function assistantText(provider, output) {
  const messages = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (provider === "codex") {
        const item = event.item;
        if (item?.type === "agent_message" && typeof item.text === "string") messages.push(item.text);
      } else {
        if (event.type === "result" && typeof event.result === "string") messages.push(event.result);
        const message = event.message;
        for (const part of message?.content ?? []) {
          if (part.type === "text" && typeof part.text === "string") messages.push(part.text);
        }
      }
    } catch {
    }
  }
  return messages.at(-1) ?? output;
}
function extractCandidateSource(value) {
  return value.match(/<OPENSLIDEX_MDX>\s*([\s\S]*?)\s*<\/OPENSLIDEX_MDX>/i)?.[1]?.trim();
}
function stripCandidateSource(value) {
  return value.replace(/<OPENSLIDEX_MDX>[\s\S]*?<\/OPENSLIDEX_MDX>/gi, "A validated presentation draft is ready for review.").trim();
}
function firstMeaningfulLine(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith("WARNING:"));
}

// packages/slidex-workbench/src/server/aiConversations.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { mkdir as mkdir3, readFile as readFile4, rename as rename2, writeFile as writeFile3 } from "node:fs/promises";
import path4 from "node:path";
var emptyDocument = () => ({ threads: [], version: 1 });
var AiConversationStore = class {
  constructor(projectRoot, stateRoot) {
    this.projectRoot = projectRoot;
    this.filePath = path4.join(stateRoot, "ai-conversations.json");
  }
  projectRoot;
  filePath;
  writeQueue = Promise.resolve();
  list() {
    return this.read();
  }
  async create(provider, title) {
    return this.mutate((document) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const thread = {
        createdAt: now,
        id: randomUUID2(),
        messages: [],
        provider,
        title: sanitizeText(title || "New conversation", this.projectRoot, 100),
        updatedAt: now
      };
      document.threads.unshift(thread);
      return thread;
    });
  }
  async delete(threadId) {
    return this.mutate((document) => {
      const before = document.threads.length;
      document.threads = document.threads.filter((thread) => thread.id !== threadId);
      return before !== document.threads.length;
    });
  }
  async append(threadId, input) {
    return this.mutate((document) => {
      const thread = document.threads.find((candidate) => candidate.id === threadId);
      if (!thread) throw Object.assign(new Error("AI conversation was not found."), { status: 404 });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const message = {
        ...input.activities?.length ? { activities: sanitizeActivities(input.activities, this.projectRoot) } : {},
        content: sanitizeText(input.content, this.projectRoot, 12e3),
        createdAt: now,
        id: randomUUID2(),
        role: input.role
      };
      thread.messages.push(message);
      thread.updatedAt = now;
      if (thread.messages.length === 1 && input.role === "user") {
        thread.title = sanitizeText(input.content, this.projectRoot, 72) || thread.title;
      }
      document.threads.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      return message;
    });
  }
  mutate(change) {
    let result;
    this.writeQueue = this.writeQueue.then(async () => {
      const document = await this.read();
      result = change(document);
      await this.write(document);
    });
    return this.writeQueue.then(() => result);
  }
  async read() {
    try {
      const value = JSON.parse(await readFile4(this.filePath, "utf8"));
      return parseDocument(value, this.projectRoot);
    } catch (error) {
      if (error.code === "ENOENT" || error instanceof SyntaxError) return emptyDocument();
      throw error;
    }
  }
  async write(document) {
    await mkdir3(path4.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${randomUUID2()}.tmp`;
    await writeFile3(tempPath, `${JSON.stringify(document, null, 2)}
`, { encoding: "utf8", mode: 384 });
    await rename2(tempPath, this.filePath);
  }
};
function parseDocument(value, projectRoot) {
  if (!value || typeof value !== "object") return emptyDocument();
  const document = value;
  if (document.version !== 1 || !Array.isArray(document.threads)) return emptyDocument();
  return {
    threads: document.threads.map((value2) => parseThread(value2, projectRoot)).filter(Boolean),
    version: 1
  };
}
function parseThread(value, projectRoot) {
  if (!value || typeof value !== "object") return void 0;
  const thread = value;
  if (typeof thread.id !== "string" || thread.provider !== "codex" && thread.provider !== "claude") return void 0;
  const createdAt = validDate(thread.createdAt);
  const updatedAt = validDate(thread.updatedAt);
  return {
    createdAt,
    id: thread.id,
    messages: Array.isArray(thread.messages) ? thread.messages.map((message) => parseMessage(message, projectRoot)).filter(Boolean) : [],
    provider: thread.provider,
    title: sanitizeText(String(thread.title ?? "Conversation"), projectRoot, 100),
    updatedAt
  };
}
function parseMessage(value, projectRoot) {
  if (!value || typeof value !== "object") return void 0;
  const message = value;
  if (typeof message.id !== "string" || message.role !== "assistant" && message.role !== "user") return void 0;
  const activities = Array.isArray(message.activities) ? sanitizeActivities(message.activities, projectRoot) : [];
  return {
    ...activities.length ? { activities } : {},
    content: sanitizeText(String(message.content ?? ""), projectRoot, 12e3),
    createdAt: validDate(message.createdAt),
    id: message.id,
    role: message.role
  };
}
function sanitizeActivities(values, projectRoot) {
  return values.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const activity = value;
    if (!isOpenSlideXToolName(activity.tool) || activity.status !== "completed" && activity.status !== "failed") return [];
    return [{
      details: Array.isArray(activity.details) ? activity.details.filter((detail) => typeof detail === "string").slice(0, 12).map((detail) => sanitizeText(detail, projectRoot, 240)) : [],
      id: sanitizeText(String(activity.id ?? randomUUID2()), projectRoot, 160),
      ...typeof activity.message === "string" ? { message: sanitizeText(activity.message, projectRoot, 1e3) } : {},
      status: activity.status,
      summary: sanitizeText(String(activity.summary ?? "OpenSlideX tool"), projectRoot, 240),
      targets: Array.isArray(activity.targets) ? activity.targets.flatMap(sanitizeTarget) : [],
      tool: activity.tool
    }];
  });
}
function sanitizeTarget(value) {
  if (!value || typeof value !== "object") return [];
  const target = value;
  if (target.kind === "presentation") return [{ kind: "presentation" }];
  if (!Number.isInteger(target.slideIndex) || Number(target.slideIndex) < 0) return [];
  if (target.kind === "slide") return [{ kind: "slide", slideIndex: Number(target.slideIndex) }];
  if (target.kind !== "block") return [];
  return [{
    ...Number.isInteger(target.blockIndex) && Number(target.blockIndex) >= 0 ? { blockIndex: Number(target.blockIndex) } : {},
    kind: "block",
    ...typeof target.nodeId === "string" ? { nodeId: target.nodeId.replace(/[^A-Za-z0-9._:-]/g, "").slice(0, 120) } : {},
    slideIndex: Number(target.slideIndex)
  }];
}
function sanitizeText(value, projectRoot, maxLength) {
  return redactLocalDetails(value.replace(/<OPENSLIDEX_MDX>[\s\S]*?<\/OPENSLIDEX_MDX>/gi, "[presentation source omitted]").replace(/data:[^\s]+/gi, "[binary preview omitted]"), projectRoot).slice(0, maxLength).trim();
}
function validDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : (/* @__PURE__ */ new Date(0)).toISOString();
}

// packages/slidex-workbench/src/server/mcpConfig.ts
import path5 from "node:path";
var openSlideXMcpClients = ["codex", "claude-code", "claude-desktop"];
function workbenchMcpConfig(client, root, platform) {
  const absoluteRoot = platform === "windows" && /^[A-Za-z]:[\\/]/.test(root) ? path5.win32.resolve(root) : path5.resolve(root);
  const command = platform === "windows" ? "cmd" : "npx";
  const args = platform === "windows" ? ["/c", "npx", "-y", "open-slidex", "mcp", "--project", absoluteRoot] : ["-y", "open-slidex", "mcp", "--project", absoluteRoot];
  if (client === "codex") {
    return `[mcp_servers.open_slidex]
command = ${JSON.stringify(command)}
args = ${JSON.stringify(args)}`;
  }
  if (client === "claude-desktop") {
    return JSON.stringify({ mcpServers: { open_slidex: { args, command, type: "stdio" } } }, null, 2);
  }
  const launch = platform === "windows" ? `cmd /c npx -y open-slidex mcp --project "${absoluteRoot.replaceAll('"', '\\"')}"` : `npx -y open-slidex mcp --project '${absoluteRoot.replaceAll("'", `'"'"'`)}'`;
  return `claude mcp add open-slidex -- ${launch}`;
}
function workbenchMcpPrompt(client, root, platform) {
  const label = client === "codex" ? "Codex" : client === "claude-code" ? "Claude Code" : "Claude Desktop";
  return [
    `Help me configure the OpenSlideX local MCP server for ${label} on ${platform}.`,
    `Restrict it to this exact deck root: ${path5.resolve(root)}`,
    "Preserve every unrelated MCP entry and show the proposed change before writing a global config.",
    "Use this generated configuration:",
    "",
    workbenchMcpConfig(client, root, platform),
    "",
    "Then verify open_slidex_open, open_slidex_edit with expectedRevision, open_slidex_render, and open_slidex_quality_check."
  ].join("\n");
}
function parseWorkbenchMcpClient(value) {
  if (value && openSlideXMcpClients.includes(value)) return value;
  throw Object.assign(new Error("Choose Codex, Claude Code, or Claude Desktop."), { status: 400 });
}
function parseWorkbenchMcpPlatform(value) {
  if (value === "macos" || value === "windows") return value;
  throw Object.assign(new Error("Choose macOS or Windows."), { status: 400 });
}

// packages/slidex-workbench/src/server/http.ts
async function startWorkbenchServer(input) {
  const clients = /* @__PURE__ */ new Set();
  const aiBridge = new OpenSlideXAiBridge(input.project);
  const aiConversations = new AiConversationStore(input.project.root, input.project.stateRoot);
  const notify = (event) => {
    for (const client of clients) client.write(`event: ${event}
data: {}

`);
  };
  const server = createServer((request, response) => {
    void routeRequest(request, response, input, clients, aiBridge, aiConversations).catch((error) => {
      sendError(response, error);
    });
  });
  const documentWatcher = watch(
    path6.join(input.project.root, "presentation.mdx"),
    { persistent: false },
    () => notify("document.changed")
  );
  const assetWatcher = watch(
    input.project.assetsRoot,
    { persistent: false },
    () => notify("assets.changed")
  );
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(input.port, "127.0.0.1", resolve);
  });
  return {
    close: async () => {
      aiBridge.close();
      documentWatcher.close();
      assetWatcher.close();
      for (const client of clients) client.end();
      await new Promise(
        (resolve, reject) => server.close((error) => error ? reject(error) : resolve())
      );
    },
    port: server.address().port
  };
}
async function routeRequest(incoming, outgoing, input, clients, aiBridge, aiConversations) {
  const request = await webRequest(incoming, input.port);
  const url = new URL(request.url);
  assertLocalRequest(request, input.port);
  if (request.method === "GET" && url.pathname === "/api/v1/events") {
    outgoing.writeHead(200, {
      "cache-control": "no-cache",
      "connection": "keep-alive",
      "content-type": "text/event-stream",
      "x-content-type-options": "nosniff"
    });
    const stopHeartbeat = startSseHeartbeat(incoming, outgoing);
    outgoing.write("event: connected\ndata: {}\n\n");
    clients.add(outgoing);
    outgoing.once("close", () => {
      stopHeartbeat();
      clients.delete(outgoing);
    });
    return;
  }
  if (url.pathname === "/api/v1/document") {
    if (request.method === "GET") return sendJson(outgoing, await input.project.open());
    if (request.method === "PUT") {
      const body = await jsonBody(request);
      if (typeof body.expectedRevision !== "string" || typeof body.source !== "string" || typeof body.title !== "string") {
        return sendJson(outgoing, { code: "invalid_request", message: "source, title, and expectedRevision are required." }, 400);
      }
      const validation = summarizeMotionDoc3(body.source).validation;
      if (!validation.isValid) {
        return sendJson(outgoing, { code: "invalid_source", issues: validation.issues, message: "The draft is invalid and was not written." }, 422);
      }
      return sendJson(outgoing, await input.project.save({
        expectedRevision: body.expectedRevision,
        source: body.source,
        title: body.title
      }));
    }
  }
  if (url.pathname === "/api/v1/context" && request.method === "POST") {
    const body = await jsonBody(request);
    if (typeof body.revision !== "string" || !Number.isInteger(body.slideIndex) || body.slideIndex < 0) {
      return sendJson(outgoing, { code: "invalid_request", message: "A valid revision and slideIndex are required." }, 400);
    }
    await input.project.writeCurrent(body);
    return sendJson(outgoing, { ok: true });
  }
  if (url.pathname === "/api/v1/templates" && request.method === "GET") {
    const locale = url.searchParams.get("locale") === "zh-TW" ? "zh-TW" : "en";
    return sendJson(outgoing, await input.project.templateCatalog(locale));
  }
  const templateCoverMatch = url.pathname.match(/^\/api\/v1\/templates\/([a-z0-9]+(?:-[a-z0-9]+)*)\/cover\.svg$/);
  if (templateCoverMatch && request.method === "GET") {
    const locale = url.searchParams.get("locale") === "zh-TW" ? "zh-TW" : "en";
    const version = url.searchParams.get("version");
    if (!version) return sendJson(outgoing, { code: "invalid_request", message: "Template version is required." }, 400);
    const svg = input.project.templatePreview({ id: templateCoverMatch[1], locale, version });
    outgoing.writeHead(200, {
      "cache-control": "public, max-age=31536000, immutable",
      "content-security-policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      "content-type": "image/svg+xml; charset=utf-8",
      "x-content-type-options": "nosniff"
    });
    outgoing.end(svg);
    return;
  }
  if (url.pathname === "/api/v1/templates/select" && request.method === "POST") {
    return sendJson(outgoing, { template: await input.project.selectTemplate(await jsonBody(request)) });
  }
  if (url.pathname === "/api/v1/ai/status" && request.method === "GET") {
    return sendJson(outgoing, { providers: await aiBridge.status() });
  }
  if (url.pathname === "/api/v1/ai/warm" && request.method === "POST") {
    return sendJson(outgoing, await aiBridge.warm());
  }
  if (url.pathname === "/api/v1/ai/conversations" && request.method === "GET") {
    return sendJson(outgoing, await aiConversations.list());
  }
  if (url.pathname === "/api/v1/ai/conversations" && request.method === "POST") {
    const body = await jsonBody(request);
    if (body.provider !== "codex" && body.provider !== "claude") {
      return sendJson(outgoing, { code: "invalid_request", message: "A valid provider is required." }, 400);
    }
    return sendJson(outgoing, await aiConversations.create(
      body.provider,
      typeof body.title === "string" ? body.title : void 0
    ));
  }
  const conversationMatch = url.pathname.match(/^\/api\/v1\/ai\/conversations\/([0-9a-f-]{36})(?:\/messages)?$/i);
  if (conversationMatch) {
    const threadId = conversationMatch[1] ?? "";
    if (request.method === "DELETE" && !url.pathname.endsWith("/messages")) {
      return sendJson(outgoing, { deleted: await aiConversations.delete(threadId) });
    }
    if (request.method === "POST" && url.pathname.endsWith("/messages")) {
      const body = await jsonBody(request);
      if (body.role !== "user" && body.role !== "assistant" || typeof body.content !== "string") {
        return sendJson(outgoing, { code: "invalid_request", message: "A visible message role and content are required." }, 400);
      }
      return sendJson(outgoing, await aiConversations.append(threadId, {
        ...Array.isArray(body.activities) ? { activities: body.activities } : {},
        content: body.content,
        role: body.role
      }));
    }
  }
  if (url.pathname === "/api/v1/ai/chat" && request.method === "POST") {
    const body = await jsonBody(request);
    if (typeof body.expectedRevision !== "string" || typeof body.prompt !== "string" || !openSlideXAiProviders.includes(body.provider) || !Number.isInteger(body.slideIndex) || Number(body.slideIndex) < 0) {
      return sendJson(outgoing, { code: "invalid_request", message: "provider, prompt, slideIndex, and expectedRevision are required." }, 400);
    }
    const messages = Array.isArray(body.messages) ? body.messages.filter(isAiMessage).slice(-8) : void 0;
    return sendJson(outgoing, await aiBridge.run({
      ...typeof body.blockIndex === "number" ? { blockIndex: body.blockIndex } : {},
      expectedRevision: body.expectedRevision,
      ...messages ? { messages } : {},
      ...typeof body.nodeId === "string" ? { nodeId: body.nodeId } : {},
      prompt: body.prompt,
      provider: body.provider,
      slideIndex: Number(body.slideIndex)
    }));
  }
  if (url.pathname === "/api/v1/ai/chat/stream" && request.method === "POST") {
    const body = await jsonBody(request);
    if (body.provider !== "codex" || body.aiMode !== void 0 && !openSlideXAiModes.includes(body.aiMode) || typeof body.expectedRevision !== "string" || typeof body.prompt !== "string" || !Number.isInteger(body.slideIndex) || Number(body.slideIndex) < 0) {
      return sendJson(outgoing, { code: "invalid_request", message: "Codex, prompt, slideIndex, and expectedRevision are required." }, 400);
    }
    const messages = Array.isArray(body.messages) ? body.messages.filter(isAiMessage).slice(-8) : void 0;
    const controller = new AbortController();
    const abort = () => controller.abort();
    outgoing.once("close", abort);
    outgoing.once("error", abort);
    outgoing.writeHead(200, {
      "cache-control": "no-cache, no-store",
      "connection": "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
      "x-content-type-options": "nosniff"
    });
    const stopHeartbeat = startSseHeartbeat(incoming, outgoing);
    outgoing.write(": open-slidex-ai\n\n");
    try {
      for await (const event of aiBridge.stream({
        ...body.aiMode ? { aiMode: body.aiMode } : {},
        ...typeof body.blockIndex === "number" ? { blockIndex: body.blockIndex } : {},
        expectedRevision: body.expectedRevision,
        ...messages ? { messages } : {},
        ...typeof body.nodeId === "string" ? { nodeId: body.nodeId } : {},
        prompt: body.prompt,
        provider: "codex",
        slideIndex: Number(body.slideIndex)
      }, controller.signal)) {
        if (outgoing.destroyed) break;
        outgoing.write(encodeAiSseEvent(event));
      }
    } catch (error) {
      if (!outgoing.destroyed) outgoing.write(encodeAiSseEvent(aiStreamError(error)));
    } finally {
      stopHeartbeat();
      outgoing.off("close", abort);
      outgoing.off("error", abort);
      if (!outgoing.destroyed) outgoing.end();
    }
    return;
  }
  if (url.pathname === "/api/v1/ai/apply" && request.method === "POST") {
    const body = await jsonBody(request);
    if (typeof body.draftId !== "string" || typeof body.expectedRevision !== "string") {
      return sendJson(outgoing, { code: "invalid_request", message: "draftId and expectedRevision are required." }, 400);
    }
    return sendJson(outgoing, await aiBridge.apply(body.draftId, body.expectedRevision));
  }
  if (url.pathname === "/api/v1/ai/cancel" && request.method === "POST") {
    const body = await jsonBody(request);
    if (typeof body.sessionId !== "string") {
      return sendJson(outgoing, { code: "invalid_request", message: "sessionId is required." }, 400);
    }
    return sendJson(outgoing, { cancelled: aiBridge.cancel(body.sessionId) });
  }
  if (url.pathname === "/api/v1/ai/draft-image" && request.method === "GET") {
    const draftId = url.searchParams.get("id");
    if (!draftId || !/^[0-9a-f-]{36}$/i.test(draftId)) {
      return sendJson(outgoing, { code: "invalid_request", message: "A valid draft id is required." }, 400);
    }
    const bytes = await readFile5(path6.join(input.project.distRoot, `agent-draft-${draftId}.png`));
    outgoing.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "image/png",
      "x-content-type-options": "nosniff"
    });
    outgoing.end(bytes);
    return;
  }
  if (url.pathname === "/api/v1/ai/tool-preview" && request.method === "GET") {
    const runId = url.searchParams.get("runId");
    const toolCallId = url.searchParams.get("toolCallId");
    if (!runId || !/^[0-9a-f-]{36}$/i.test(runId) || !toolCallId || !/^[A-Za-z0-9._:-]{1,160}$/.test(toolCallId)) {
      return sendJson(outgoing, { code: "invalid_request", message: "A valid runId and toolCallId are required." }, 400);
    }
    const bytes = await aiBridge.readToolPreview(runId, toolCallId);
    outgoing.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "image/png",
      "x-content-type-options": "nosniff"
    });
    outgoing.end(bytes);
    return;
  }
  if (url.pathname === "/api/v1/mcp/setup" && request.method === "GET") {
    const client = parseWorkbenchMcpClient(url.searchParams.get("client"));
    const platform = parseWorkbenchMcpPlatform(url.searchParams.get("platform"));
    return sendJson(outgoing, {
      client,
      config: workbenchMcpConfig(client, input.project.root, platform),
      configPath: client === "claude-desktop" ? platform === "windows" ? "%APPDATA%\\Claude\\claude_desktop_config.json" : "~/Library/Application Support/Claude/claude_desktop_config.json" : client === "codex" ? ".codex/config.toml" : ".mcp.json / claude mcp add",
      platform,
      prompt: workbenchMcpPrompt(client, input.project.root, platform),
      projectRoot: input.project.root
    });
  }
  if (url.pathname === "/api/v1/assets") {
    if (request.method === "GET") return sendJson(outgoing, { assets: await input.project.listAssets() });
    if (request.method === "POST") {
      const form = await request.formData();
      const file = form.get("file");
      const expectedRevision = form.get("expectedRevision");
      if (!(file instanceof File) || typeof expectedRevision !== "string") {
        return sendJson(outgoing, { code: "missing_file", message: "Choose one image file and provide expectedRevision." }, 400);
      }
      return sendJson(outgoing, { asset: await input.project.importAsset(file, expectedRevision) });
    }
    if (request.method === "PATCH") {
      const body = await jsonBody(request);
      if (typeof body.expectedRevision !== "string" || typeof body.from !== "string" || typeof body.to !== "string") {
        return sendJson(outgoing, { code: "invalid_request", message: "from, to, and expectedRevision are required." }, 400);
      }
      return sendJson(outgoing, {
        document: await input.project.renameAsset(body)
      });
    }
    if (request.method === "DELETE") {
      const source = url.searchParams.get("source");
      const expectedRevision = url.searchParams.get("expectedRevision");
      if (!source || !expectedRevision) return sendJson(outgoing, { code: "invalid_request", message: "source and expectedRevision are required." }, 400);
      await input.project.deleteAsset(source, expectedRevision);
      return sendJson(outgoing, { ok: true });
    }
  }
  if (url.pathname === "/api/v1/export" && request.method === "POST") {
    const body = await jsonBody(request);
    if (typeof body.source !== "string" || !["html", "mdx", "pptx"].includes(body.format) || !["download", "dist"].includes(body.target)) {
      return sendJson(outgoing, { code: "invalid_request", message: "Choose a valid format and target." }, 400);
    }
    const result = await input.project.export({
      fileName: body.fileName,
      format: body.format,
      overwrite: body.overwrite === true,
      source: body.source,
      target: body.target
    });
    if ("bytes" in result) {
      outgoing.writeHead(200, {
        "content-disposition": `attachment; filename="${result.output}"`,
        "content-type": mimeType(result.output),
        "x-content-type-options": "nosniff"
      });
      outgoing.end(result.bytes);
      return;
    }
    return sendJson(outgoing, result);
  }
  if (url.pathname === "/api/v1/render" && request.method === "POST") {
    const body = await jsonBody(request);
    return sendJson(outgoing, {
      output: await input.project.renderMontage(body.overwrite === true)
    });
  }
  if (request.method === "GET" && url.pathname.startsWith("/assets/")) {
    const name = decodeURIComponent(url.pathname.slice("/assets/".length));
    const bytes = await input.project.readAsset(name);
    outgoing.writeHead(200, {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": "image/webp",
      "x-content-type-options": "nosniff"
    });
    outgoing.end(bytes);
    return;
  }
  if (request.method === "GET") {
    const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const filePath = path6.resolve(input.clientRoot, requested);
    if (!filePath.startsWith(`${path6.resolve(input.clientRoot)}${path6.sep}`) && filePath !== path6.join(input.clientRoot, "index.html")) {
      return sendJson(outgoing, { code: "not_found", message: "Not found." }, 404);
    }
    const fileStats = await stat3(filePath).catch(() => null);
    if (fileStats?.isFile()) {
      outgoing.writeHead(200, {
        "cache-control": requested === "index.html" ? "no-cache" : "public, max-age=31536000, immutable",
        "content-security-policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-slidex-workbench-preview'; frame-src 'self' blob:; connect-src 'self'; font-src 'self' data:",
        "content-type": mimeType(filePath),
        "x-content-type-options": "nosniff"
      });
      createReadStream(filePath).pipe(outgoing);
      return;
    }
  }
  return sendJson(outgoing, { code: "not_found", message: "Not found." }, 404);
}
async function webRequest(incoming, port) {
  const method = incoming.method ?? "GET";
  return new Request(`http://127.0.0.1:${port}${incoming.url ?? "/"}`, {
    body: method === "GET" || method === "HEAD" ? void 0 : Readable.toWeb(incoming),
    duplex: "half",
    headers: incoming.headers,
    method
  });
}
function assertLocalRequest(request, port) {
  const host = request.headers.get("host");
  if (host && host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
    throw Object.assign(new Error("Invalid Host header."), { status: 403 });
  }
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) {
      throw Object.assign(new Error("Cross-origin mutation rejected."), { status: 403 });
    }
  }
}
function isAiMessage(value) {
  if (!value || typeof value !== "object") return false;
  const message = value;
  return typeof message.content === "string" && (message.role === "assistant" || message.role === "user");
}
async function jsonBody(request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 10 * 1024 * 1024) {
    throw Object.assign(new Error("Request body is too large."), { status: 413 });
  }
  return await request.json().catch(() => ({}));
}
function sendJson(response, value, status = 200) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(value));
}
function encodeAiSseEvent(event) {
  return `event: ai
data: ${JSON.stringify(event)}

`;
}
function startSseHeartbeat(incoming, outgoing) {
  const heartbeatMs = 5e3;
  incoming.socket.setKeepAlive(true, heartbeatMs);
  incoming.socket.setNoDelay(true);
  outgoing.flushHeaders();
  const heartbeat = setInterval(() => {
    if (!outgoing.destroyed && !outgoing.writableEnded) outgoing.write(": keep-alive\n\n");
  }, heartbeatMs);
  heartbeat.unref();
  return () => clearInterval(heartbeat);
}
function aiStreamError(error) {
  if (error instanceof SlideXRevisionConflictError3) {
    return {
      code: "revision_conflict",
      message: "presentation.mdx changed. Reload the Canvas, then retry.",
      runId: "unavailable",
      type: "run.failed"
    };
  }
  return {
    code: "stream_error",
    message: error instanceof Error ? error.message : "The local AI stream failed.",
    runId: "unavailable",
    type: "run.failed"
  };
}
function sendError(response, error) {
  if (response.headersSent) {
    response.end();
    return;
  }
  if (error instanceof SlideXRevisionConflictError3) {
    sendJson(response, {
      code: "revision_conflict",
      currentRevision: error.currentRevision,
      message: "presentation.mdx changed outside the workbench."
    }, 409);
    return;
  }
  if (error instanceof SlideXImageAssetError) {
    sendJson(response, { code: error.code, message: error.message }, 422);
    return;
  }
  if (error instanceof OpenSlideXLocalMediaError) {
    sendJson(response, {
      code: "local_media_not_allowed",
      issues: error.issues,
      message: error.message
    }, 422);
    return;
  }
  const message = error instanceof Error ? error.message : "Unexpected workbench error.";
  const status = typeof error?.status === "number" ? error.status : /already exists/i.test(message) ? 409 : /referenced|invalid|must|required/i.test(message) ? 422 : 500;
  sendJson(response, {
    code: status === 409 ? "file_exists" : status === 422 ? "invalid_request" : "internal_error",
    message
  }, status);
}
function mimeType(filePath) {
  const extension = path6.extname(filePath).toLowerCase();
  return {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mdx": "text/mdx; charset=utf-8",
    ".png": "image/png",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
  }[extension] ?? "application/octet-stream";
}

// packages/slidex-workbench/src/cli.ts
void main().catch((error) => {
  process.stderr.write(`open-slidex-workbench: ${error instanceof Error ? error.message : "Unknown error."}
`);
  process.exitCode = 1;
});
async function main() {
  const [command = "help", ...args] = process.argv.slice(2);
  if (command === "--version" || command === "-v") {
    const packageJson = JSON.parse(await readFile6(new URL("../package.json", import.meta.url), "utf8"));
    process.stdout.write(`${packageJson.version}
`);
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
    const clientRoot = fileURLToPath2(new URL("./client/", import.meta.url));
    const running = await startWorkbenchServer({ clientRoot, port, project });
    const url = `http://127.0.0.1:${running.port}`;
    process.stdout.write(`OpenSlideX Workbench: ${url}
`);
    process.stdout.write("Press Ctrl-C to stop.\n");
    if (!args.includes("--no-open")) openBrowser(url);
    await waitForSignal();
    await running.close();
    return;
  }
  if (command === "build") {
    const output = await project.buildStaticSite();
    process.stdout.write(`Built static presentation: ${output}
`);
    return;
  }
  if (command === "preview") {
    const root = path7.join(project.distRoot, "site");
    if (!await isDirectory(root)) throw new Error("Run open-slidex-workbench build first.");
    const requestedPort = numberOption(args, "--port") ?? 4174;
    const port = await availablePort(requestedPort);
    const server = createServer2(async (request, response) => {
      const requested = request.url === "/" ? "index.html" : (request.url ?? "").slice(1);
      const filePath = path7.resolve(root, requested);
      if (!filePath.startsWith(`${root}${path7.sep}`) && filePath !== path7.join(root, "index.html")) {
        response.writeHead(404).end();
        return;
      }
      const bytes = await readFile6(filePath).catch(() => null);
      if (!bytes) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { "content-type": filePath.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
      response.end(bytes);
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
    process.stdout.write(`OpenSlideX Preview: http://127.0.0.1:${port}
`);
    await waitForSignal();
    server.close();
    return;
  }
  if (command === "sync:skills") {
    const skillsRoot = fileURLToPath2(new URL("../skills/", import.meta.url));
    const target = path7.join(project.root, ".agents", "skills");
    await mkdir4(target, { recursive: true });
    for (const entry of await readdir2(skillsRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        await cp(path7.join(skillsRoot, entry.name), path7.join(target, entry.name), {
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
function numberOption(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return void 0;
  const value = Number(args[index + 1]);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error(`${name} must be a port between 1024 and 65535.`);
  }
  return value;
}
async function availablePort(start) {
  for (let port = start; port < start + 20; port += 1) {
    if (await canListen(port)) return port;
  }
  throw new Error(`No available port between ${start} and ${start + 19}.`);
}
function canListen(port) {
  return new Promise((resolve) => {
    const server = createServer2();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}
function waitForSignal() {
  return new Promise((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
}
function openBrowser(url) {
  const command = process.platform === "darwin" ? { args: [url], file: "open" } : process.platform === "win32" ? { args: ["/c", "start", "", url], file: "cmd" } : { args: [url], file: "xdg-open" };
  const child = spawn3(command.file, command.args, {
    detached: true,
    stdio: "ignore"
  });
  child.on("error", () => void 0);
  child.unref();
}
async function isDirectory(filePath) {
  return stat4(filePath).then((value) => value.isDirectory(), () => false);
}
