import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import type { AssistantCanvasTarget } from "@/core/motion-doc/domain/assistantCanvasActivity";

import {
  isOpenSlideXToolName,
  openSlideXToolNames,
  type AiRunEvent,
  type OpenSlideXToolName,
  type ToolPreviewRef
} from "../shared/aiEvents";
import type { OpenSlideXAiRunInput } from "./aiBridge";
import {
  CodexAppServerTransport,
  isolatedThreadConfig,
  type JsonRecord,
  type RpcMessage
} from "./codexAppServerTransport";

const defaultRunTimeoutMs = 8 * 60_000;

export class CodexAppServer {
  private readonly previewPaths = new Map<string, string>();
  private readonly runTimeoutMs: number;
  private readonly transport: CodexAppServerTransport;

  constructor(private readonly projectRoot: string, options?: { runTimeoutMs?: number }) {
    this.transport = new CodexAppServerTransport(projectRoot);
    this.runTimeoutMs = options?.runTimeoutMs ?? defaultRunTimeoutMs;
  }

  warm() {
    return this.transport.warm();
  }

  async *run(input: OpenSlideXAiRunInput, runId: string, abortSignal?: AbortSignal): AsyncGenerator<AiRunEvent> {
    yield { label: "Connecting to Codex App Server", phase: "connecting", runId, type: "phase" };

    let threadId = "";
    let turnId = "";
    const queue = new AsyncEventQueue<RpcMessage>();
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
      const toolActivities = new Map<string, { activity: ReturnType<typeof describeToolActivity>; startedAt: number }>();
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
            message: redactLocalDetails(errorMessage(undefined, this.transport.diagnostics), this.projectRoot),
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
            ...(canvasPreview ? { canvasPreview } : {}),
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
              message: [redactLocalDetails(toolFailureMessage(item), this.projectRoot), duration].filter(Boolean).join(" · "),
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
            ...(preview ? { preview } : {}),
            details: completedDetails,
            runId,
            summary: [summarizeToolResult(tool, result), duration].filter(Boolean).join(" · "),
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

  async readPreview(runId: string, toolCallId: string) {
    const registered = this.previewPaths.get(previewKey(runId, toolCallId));
    if (!registered) throw Object.assign(new Error("AI tool preview was not found."), { status: 404 });
    const [root, file] = await Promise.all([realpath(this.projectRoot), realpath(registered)]);
    if (!isInsideRoot(root, file) || path.extname(file).toLowerCase() !== ".png") {
      throw Object.assign(new Error("AI tool preview path was rejected."), { status: 403 });
    }
    return readFile(file);
  }

  close() {
    this.transport.close();
    this.previewPaths.clear();
  }

  private async interrupt(threadId: string, turnId: string) {
    await this.transport.request("turn/interrupt", { threadId, turnId }).catch(() => undefined);
  }

  private async verifyMcpInventory(threadId: string) {
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

  private async registerPreview(
    runId: string,
    toolCallId: string,
    tool: OpenSlideXToolName,
    result: JsonRecord
  ): Promise<ToolPreviewRef | undefined> {
    const candidate = tool === "open_slidex_render"
      ? result.outputPath
      : tool === "open_slidex_edit"
        ? asRecord(result.preview).outputPath
        : undefined;
    if (typeof candidate !== "string") return undefined;
    const file = await safePreviewPath(this.projectRoot, candidate);
    if (!file) return undefined;
    this.previewPaths.set(previewKey(runId, toolCallId), file);
    return { kind: "image", runId, toolCallId };
  }
}

export function codexModelPreset(mode: "fast" | "balanced" | "quality") {
  return ({
    fast: { effort: "low", model: "gpt-5.6-luna" },
    balanced: { effort: "medium", model: "gpt-5.6-terra" },
    quality: { effort: "high", model: "gpt-5.6-sol" }
  } as const)[mode];
}

export function buildCodexInstructions(input: OpenSlideXAiRunInput) {
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
    `The active selection is slide ${input.slideIndex + 1}${input.nodeId ? `, node ${input.nodeId}` : input.blockIndex === undefined ? "" : `, block ${input.blockIndex}`}.`,
    `Tool indices are zero-based. The selected visible slide ${input.slideIndex + 1} must be passed to every open_slidex_* tool as slideIndex ${input.slideIndex}; do not convert the visible slide number into a tool index.`,
    `Unless the user explicitly requests the whole deck or multiple slides, edit only slide ${input.slideIndex + 1}${input.nodeId ? ` and node ${input.nodeId}` : input.blockIndex === undefined ? "" : ` and block ${input.blockIndex}`}. Do not add, delete, reorder, or modify any other slide.`,
    "Keep the final response concise and describe only completed work and actionable errors."
  ].join("\n");
}

function buildCodexTurnPrompt(input: OpenSlideXAiRunInput) {
  const transcript = (input.messages ?? []).slice(-8).map((message) => `${message.role}: ${message.content}`).join("\n");
  return [
    `Frozen Canvas target: visible slide ${input.slideIndex + 1} = zero-based tool slideIndex ${input.slideIndex}${input.nodeId ? `, nodeId ${input.nodeId}` : input.blockIndex === undefined ? "" : `, blockIndex ${input.blockIndex}`}.`,
    transcript ? `Recent chat:\n${transcript}` : "",
    `User request:\n${input.prompt}`
  ].filter(Boolean).join("\n\n");
}

function validateToolItem(item: JsonRecord): OpenSlideXToolName {
  if (item.server !== "open_slidex" || !isOpenSlideXToolName(item.tool)) {
    throw new Error("Codex attempted to call a tool outside the OpenSlideX allowlist.");
  }
  return item.tool;
}

function summarizeToolStart(tool: OpenSlideXToolName, args: JsonRecord) {
  if (tool === "open_slidex_inspect") return `Inspecting slide ${Number(args.slideIndex ?? 0) + 1}`;
  if (tool === "open_slidex_edit") return `Applying ${Array.isArray(args.commands) ? args.commands.length : 0} revision-safe edit${Array.isArray(args.commands) && args.commands.length === 1 ? "" : "s"}`;
  if (tool === "open_slidex_render") return args.mode === "slide" ? `Rendering slide ${Number(args.slideIndex ?? 0) + 1}` : "Rendering the deck montage";
  if (tool === "open_slidex_quality_check") return args.mode === "slide" ? `Checking slide ${Number(args.slideIndex ?? 0) + 1} layout quality` : "Checking the complete deck layout";
  return ({
    open_slidex_asset_import: "Importing a local image",
    open_slidex_catalog: "Reading the OpenSlideX component catalog",
    open_slidex_image_import: "Importing a confirmed trusted image",
    open_slidex_image_search: "Searching trusted images",
    open_slidex_knowledge_search: "Searching local project knowledge",
    open_slidex_open: "Reading presentation.mdx",
    open_slidex_skill_read: args.mode === "manifest" ? "Indexing project guidance" : `Loading ${safeIdentifier(String(args.intent ?? args.skill ?? "project"))} guidance`,
    open_slidex_template_read: args.referenceMode === "role-samples" ? "Reading template role samples" : args.includeReferenceSource === true || args.referenceMode === "full" ? "Reading the selected template MDX" : "Reading the selected template guidance",
    open_slidex_validate: "Validating presentation.mdx"
  } satisfies Partial<Record<OpenSlideXToolName, string>>)[tool] ?? "Using an OpenSlideX tool";
}

export function describeToolActivity(
  tool: OpenSlideXToolName,
  args: JsonRecord,
  selection: Pick<OpenSlideXAiRunInput, "blockIndex" | "nodeId" | "slideIndex">
): { details: string[]; summary: string; targets: AssistantCanvasTarget[] } {
  const targets = toolTargets(tool, args, selection);
  const details = tool === "open_slidex_edit"
    ? editCommandDetails(args.commands)
    : tool === "open_slidex_skill_read"
      ? guidanceDetails(args)
      : tool === "open_slidex_catalog"
        ? [`Catalog · ${safeIdentifier(String(args.section ?? "all"))}`]
        : [targetSummary(targets)];
  return {
    details: details.filter(Boolean).slice(0, 12),
    summary: summarizeToolStart(tool, args),
    targets
  };
}

export function canvasEditPreviewPlan(
  tool: OpenSlideXToolName,
  args: JsonRecord,
  frozenRevision: string
): import("../shared/aiEvents").CanvasEditPreviewPlan | undefined {
  if (tool !== "open_slidex_edit" || args.expectedRevision !== frozenRevision || !Array.isArray(args.commands)) {
    return undefined;
  }
  const commands = args.commands
    .filter((command): command is JsonRecord => Boolean(command) && typeof command === "object")
    .map((command) => structuredClone(command));
  if (commands.length === 0 || commands.length !== args.commands.length || commands.length > 100) return undefined;
  if (!commands.every((command) => typeof command.type === "string")) return undefined;
  return { commands, expectedRevision: frozenRevision, kind: "edit-commands" };
}

function toolTargets(
  tool: OpenSlideXToolName,
  args: JsonRecord,
  selection: Pick<OpenSlideXAiRunInput, "blockIndex" | "nodeId" | "slideIndex">
) {
  const targets: AssistantCanvasTarget[] = [];
  const pushSlide = (value: unknown) => {
    const slideIndex = nonNegativeInteger(value);
    if (slideIndex !== undefined) targets.push({ kind: "slide", slideIndex });
  };
  const pushBlock = (command: JsonRecord) => {
    const slideIndex = nonNegativeInteger(command.slideIndex) ?? selection.slideIndex;
    const blockIndex = nonNegativeInteger(command.blockIndex);
    const nodeId = typeof command.nodeId === "string" ? safeIdentifier(command.nodeId) : undefined;
    targets.push({
      ...(blockIndex === undefined ? {} : { blockIndex }),
      kind: "block",
      ...(nodeId ? { nodeId } : {}),
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
    targets.push(nodeId || blockIndex !== undefined
      ? { ...(blockIndex === undefined ? {} : { blockIndex }), kind: "block", ...(nodeId ? { nodeId } : {}), slideIndex }
      : { kind: "slide", slideIndex });
  } else if ((tool === "open_slidex_render" || tool === "open_slidex_quality_check") && args.mode === "slide") {
    targets.push({ kind: "slide", slideIndex: nonNegativeInteger(args.slideIndex) ?? selection.slideIndex });
  }

  return dedupeTargets(targets.length ? targets : [{ kind: "presentation" }]);
}

function editCommandDetails(value: unknown) {
  if (!Array.isArray(value)) return ["No structured edit commands reported"];
  return value.map((entry) => {
    const command = asRecord(entry);
    const operation = safeIdentifier(String(command.type ?? command.command ?? command.op ?? "edit")) || "edit";
    const slideIndex = nonNegativeInteger(command.slideIndex);
    const blockIndex = nonNegativeInteger(command.blockIndex);
    const nodeId = typeof command.nodeId === "string" ? safeIdentifier(command.nodeId) : undefined;
    return [operation, slideIndex === undefined ? "" : `slide ${slideIndex + 1}`, nodeId ? `node ${nodeId}` : blockIndex === undefined ? "" : `block ${blockIndex + 1}`]
      .filter(Boolean)
      .join(" · ");
  });
}

function targetSummary(targets: readonly AssistantCanvasTarget[]) {
  const first = targets[0];
  if (!first || first.kind === "presentation") return "Target · presentation";
  if (first.kind === "slide") return `Target · slide ${first.slideIndex + 1}`;
  return `Target · slide ${first.slideIndex + 1}${first.nodeId ? ` · node ${first.nodeId}` : first.blockIndex === undefined ? "" : ` · block ${first.blockIndex + 1}`}`;
}

function dedupeTargets(targets: AssistantCanvasTarget[]) {
  return targets.filter((target, index) => {
    const key = JSON.stringify(target);
    return targets.findIndex((candidate) => JSON.stringify(candidate) === key) === index;
  });
}

function nonNegativeInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function safeIdentifier(value: string) {
  return value.replace(/[^A-Za-z0-9._:-]/g, "").slice(0, 120);
}

function summarizeToolResult(tool: OpenSlideXToolName, result: JsonRecord) {
  const revision = typeof result.revision === "string" ? ` · ${shortRevision(result.revision)}` : "";
  if (tool === "open_slidex_edit") return `Presentation updated${revision}`;
  if (tool === "open_slidex_render") return `Preview rendered${revision}`;
  if (tool === "open_slidex_quality_check") {
    const report = asRecord(result.report);
    const summary = asRecord(report.summary);
    const errors = Number(summary.errorCount ?? 0);
    const warnings = Number(summary.warningCount ?? 0);
    const score = Number(report.score ?? 0);
    return errors === 0
      ? `Visual QA passed · ${score}/100${warnings ? ` · ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}${revision}`
      : `Visual QA found ${errors} error${errors === 1 ? "" : "s"} · ${warnings} warning${warnings === 1 ? "" : "s"}${revision}`;
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

function completedToolDetails(
  tool: OpenSlideXToolName,
  result: JsonRecord,
  fallback: readonly string[]
) {
  if (tool !== "open_slidex_quality_check") return [...fallback];
  const report = asRecord(result.report);
  const issues = Array.isArray(report.issues) ? report.issues : [];
  if (issues.length === 0) return ["Rendered geometry · no blocking findings"];
  return issues.slice(0, 10).map((value) => {
    const issue = asRecord(value);
    const slideIndex = nonNegativeInteger(issue.slideIndex) ?? 0;
    const code = safeIdentifier(String(issue.code ?? "quality"));
    const nodeIds = Array.isArray(issue.nodeIds)
      ? issue.nodeIds.map((nodeId) => safeIdentifier(String(nodeId))).filter(Boolean).slice(0, 2)
      : [];
    return [`Slide ${slideIndex + 1}`, code, nodeIds.length ? `node ${nodeIds.join(" + ")}` : ""]
      .filter(Boolean)
      .join(" · ");
  });
}

function guidanceDetails(args: JsonRecord) {
  if (args.mode === "manifest") return ["Guidance · approved manifest"];
  if (args.mode === "bundle") return [`Guidance intent · ${safeIdentifier(String(args.intent ?? "authoring"))}`];
  return [`Guidance skill · ${safeIdentifier(String(args.skill ?? "approved"))}`];
}

function durationLabel(durationMs: number) {
  return `${(Math.max(1, durationMs) / 1_000).toFixed(2)} s`;
}

function toolLabel(tool: OpenSlideXToolName) {
  return ({
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
  } satisfies Record<OpenSlideXToolName, string>)[tool];
}

function isExecutableItem(type: unknown) {
  return type === "commandExecution" || type === "fileChange" || type === "dynamicToolCall";
}

function blockedToolEvent(runId: string): AiRunEvent {
  return {
    code: "tool_not_allowed",
    message: "Codex attempted to use a tool outside the OpenSlideX MCP allowlist and was stopped.",
    runId,
    type: "run.failed"
  };
}

export function redactLocalDetails(value: string, projectRoot: string) {
  const escapedRoot = projectRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value
    .replace(new RegExp(escapedRoot, "g"), ".")
    .replace(/(^|[\s("'=])\/(?:[^\s\n\r\t"'`)]+\/?)+/g, "$1[local path]")
    .replace(/\b[A-Za-z]:\\(?:[^\s\n\r\t"'`)]+\\?)+/g, "[local path]")
    .replace(/\b[A-Z][A-Z0-9_]{2,}=\S+/g, "[redacted]")
    .replace(/(["']?(?:api[_-]?key|authorization|password|secret|token)["']?\s*[:=]\s*)["']?[^,\s}"']+["']?/gi, "$1[redacted]")
    .slice(0, 4_000);
}

export class StreamingLocalDetailRedactor {
  private pending = "";

  constructor(private readonly projectRoot: string) {}

  push(delta: string) {
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
}

function lastWhitespaceAtOrBefore(value: string, cutoff: number) {
  for (let index = Math.min(cutoff, value.length - 1); index >= 0; index -= 1) {
    if (/\s/.test(value[index] ?? "")) return index;
  }
  return -1;
}

function errorMessage(error: unknown, stderr: string) {
  const meaningful = stderr.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith("WARNING:"));
  if (meaningful && error instanceof Error && /App Server exited/.test(error.message)) return meaningful;
  if (error instanceof Error && error.message) return error.message;
  return meaningful || "Codex App Server failed unexpectedly.";
}

function shortRevision(revision: string) {
  return revision.replace(/^sha256:/, "").slice(0, 8);
}

function previewKey(runId: string, toolCallId: string) {
  return `${runId}:${toolCallId}`;
}

function isInsideRoot(root: string, file: string) {
  return file === root || file.startsWith(`${root}${path.sep}`);
}

export async function safePreviewPath(projectRoot: string, candidate: string) {
  const [root, file] = await Promise.all([realpath(projectRoot), realpath(candidate).catch(() => "")]);
  if (!file || !isInsideRoot(root, file) || path.extname(file).toLowerCase() !== ".png") return undefined;
  return (await stat(file)).isFile() ? file : undefined;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function toolFailureMessage(item: JsonRecord) {
  const error = asRecord(item.error);
  const payload = mcpResultPayload(item);
  const code = stringValue(payload.code) ?? stringValue(error.code);
  const message = stringValue(payload.message) ?? stringValue(error.message);

  if (code === "quality_gate_failed") return qualityGateFailureMessage(payload, message);
  if (code === "revision_conflict") return "The presentation changed while this edit was being prepared. Reload the Canvas, then try again.";
  return message ?? "The OpenSlideX tool failed.";
}

function mcpResultPayload(item: JsonRecord): JsonRecord {
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
      // MCP text results are not always JSON; use the explicit error object below.
    }
  }
  return asRecord(result.error);
}

function qualityGateFailureMessage(payload: JsonRecord, fallback: string | undefined) {
  const report = asRecord(payload.qualityReport);
  const summary = asRecord(report.summary);
  const issues = Array.isArray(report.issues) ? report.issues.map(asRecord) : [];
  const blocking = issues.filter((issue) => issue.severity === "error");
  const errorCount = nonNegativeInteger(summary.errorCount) ?? blocking.length;
  const findings = blocking.slice(0, 4).map((issue) => {
    const slideIndex = nonNegativeInteger(issue.slideIndex);
    const code = safeIdentifier(String(issue.code ?? "quality issue")) || "quality issue";
    const nodeIds = Array.isArray(issue.nodeIds)
      ? issue.nodeIds.map((nodeId) => safeIdentifier(String(nodeId))).filter(Boolean).slice(0, 2)
      : [];
    return [`Slide ${slideIndex === undefined ? "?" : slideIndex + 1}`, code, nodeIds.length ? `node ${nodeIds.join(" + ")}` : ""]
      .filter(Boolean)
      .join(" · ");
  });
  const count = `${errorCount} blocking ${errorCount === 1 ? "issue" : "issues"}`;
  const headline = `Candidate was not written: visual QA found ${count}.`;
  if (findings.length > 0) return `${headline} Fix: ${findings.join("; ")}. Canvas unchanged.`;
  return fallback && fallback !== "The OpenSlideX tool failed."
    ? `${headline} ${fallback} Canvas unchanged.`
    : `${headline} Canvas unchanged.`;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

class AsyncEventQueue<T> {
  private readonly values: T[] = [];
  private readonly waiters: Array<(value: T) => void> = [];

  push(value: T) {
    const waiter = this.waiters.shift();
    if (waiter) waiter(value);
    else this.values.push(value);
  }

  shift() {
    const value = this.values.shift();
    if (value !== undefined) return Promise.resolve(value);
    return new Promise<T>((resolve) => this.waiters.push(resolve));
  }
}
