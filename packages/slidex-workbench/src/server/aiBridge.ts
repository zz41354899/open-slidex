import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseMotionDoc, summarizeMotionDoc } from "@open-slidex/sdk";
import { renderSlideXDocument, SlideXRevisionConflictError } from "@open-slidex/sdk/node";

import { SlideXProject } from "./project";
import { CodexAppServer } from "./codexAppServer";
import type { AiRunEvent } from "../shared/aiEvents";

export const openSlideXAiProviders = ["codex", "claude"] as const;
export type OpenSlideXAiProvider = (typeof openSlideXAiProviders)[number];
export const openSlideXAiModes = ["fast", "balanced", "quality"] as const;
export type OpenSlideXAiMode = (typeof openSlideXAiModes)[number];

export type OpenSlideXAiProviderStatus = {
  authenticated: boolean;
  available: boolean;
  detail: string;
  label: string;
  provider: OpenSlideXAiProvider;
  version?: string;
};

export type OpenSlideXAiRunInput = {
  aiMode?: OpenSlideXAiMode;
  blockIndex?: number;
  expectedRevision: string;
  messages?: Array<{ content: string; role: "assistant" | "user" }>;
  nodeId?: string;
  prompt: string;
  provider: OpenSlideXAiProvider;
  slideIndex: number;
};

export type OpenSlideXAiRunResult = {
  draft?: {
    id: string;
    montage?: string;
    revision: string;
    source: string;
    validation: ReturnType<typeof summarizeMotionDoc>["validation"];
  };
  message: string;
  provider: OpenSlideXAiProvider;
  sessionId: string;
};

const maxProcessOutputBytes = 12 * 1024 * 1024;

export class OpenSlideXAiBridge {
  readonly project: SlideXProject;
  private readonly codex: CodexAppServer;
  private readonly codexRuns = new Map<string, AbortController>();
  private readonly processes = new Map<string, ChildProcessWithoutNullStreams>();
  private statusCache?: { expiresAt: number; value: Promise<OpenSlideXAiProviderStatus[]> };

  constructor(project: SlideXProject) {
    this.project = project;
    this.codex = new CodexAppServer(project.root);
  }

  async status() {
    if (this.statusCache && this.statusCache.expiresAt > Date.now()) return this.statusCache.value;
    const value = Promise.all(openSlideXAiProviders.map((provider) => providerStatus(provider)));
    this.statusCache = { expiresAt: Date.now() + 15_000, value };
    return value;
  }

  async warm() {
    const status = (await this.status()).find((provider) => provider.provider === "codex");
    if (!status?.available || !status.authenticated) return { ready: false, status };
    await this.codex.warm();
    return { ready: true, status: { ...status, detail: "App Server warmed in this local workspace" } };
  }

  async run(input: OpenSlideXAiRunInput): Promise<OpenSlideXAiRunResult> {
    if (input.provider === "codex") {
      let message = "";
      let sessionId = "";
      for await (const event of this.stream(input)) {
        sessionId = event.runId;
        if (event.type === "text") message += event.delta;
        if (event.type === "run.failed") throw new Error(event.message);
      }
      return {
        message: message.trim() || "Codex completed the OpenSlideX run.",
        provider: "codex",
        sessionId
      };
    }
    if (!openSlideXAiProviders.includes(input.provider)) throw new Error("Choose Codex or Claude Code.");
    const current = await this.project.open();
    if (current.revision !== input.expectedRevision) {
      throw new SlideXRevisionConflictError(current.revision);
    }

    const status = await providerStatus(input.provider);
    if (!status.available) throw new Error(`${status.label} CLI is not installed or is not available in PATH.`);
    if (!status.authenticated) throw new Error(`${status.label} is installed but is not signed in. Sign in from its own CLI, then retry.`);

    const sessionId = randomUUID();
    const prompt = buildAgentPrompt(input, current.revision);
    const { args, command } = openSlideXAiProviderCommand(input.provider);
    const child = spawn(command, args, {
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

      const validation = summarizeMotionDoc(source).validation;
      const draftRoot = path.join(this.project.stateRoot, "agent-drafts");
      await mkdir(draftRoot, { recursive: true });
      await writeFile(path.join(draftRoot, `${sessionId}.mdx`), source, "utf8");

      let montage: string | undefined;
      if (validation.isValid) {
        const outputPath = path.join(this.project.distRoot, `agent-draft-${sessionId}.png`);
        await renderSlideXDocument({
          mode: "montage",
          outputPath,
          projectRoot: this.project.root,
          source
        }).then(() => {
          montage = `dist/agent-draft-${sessionId}.png`;
        }).catch(() => undefined);
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

  async *stream(input: OpenSlideXAiRunInput, abortSignal?: AbortSignal): AsyncGenerator<AiRunEvent> {
    if (input.provider !== "codex") throw new Error("Only Codex uses App Server streaming.");
    const current = await this.project.open();
    if (current.revision !== input.expectedRevision) {
      throw new SlideXRevisionConflictError(current.revision);
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

  readToolPreview(runId: string, toolCallId: string) {
    return this.codex.readPreview(runId, toolCallId);
  }

  async apply(draftId: string, expectedRevision: string) {
    if (!/^[0-9a-f-]{36}$/i.test(draftId)) throw new Error("Invalid AI draft id.");
    const draftPath = path.join(this.project.stateRoot, "agent-drafts", `${draftId}.mdx`);
    const source = await readFile(draftPath, "utf8");
    const validation = summarizeMotionDoc(source).validation;
    if (!validation.isValid) throw new Error("The AI draft is invalid and cannot be applied.");
    const title = parseMotionDoc(source).title || "Untitled presentation";
    return this.project.save({ expectedRevision, source, title });
  }

  cancel(sessionId: string) {
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
}

async function providerStatus(provider: OpenSlideXAiProvider): Promise<OpenSlideXAiProviderStatus> {
  const label = provider === "codex" ? "Codex" : "Claude Code";
  const command = provider === "codex" ? "codex" : "claude";
  const version = await runProbe(command, ["--version"]);
  if (!version.ok) {
    return { authenticated: false, available: false, detail: "CLI not found", label, provider };
  }
  const auth = provider === "codex"
    ? await runProbe(command, ["login", "status"])
    : await runProbe(command, ["auth", "status"]);
  const appServer = provider === "codex"
    ? await runProbe(command, ["app-server", "--help"])
    : { ok: true, output: "" };
  return {
    authenticated: auth.ok,
    available: appServer.ok,
    detail: !appServer.ok
      ? "Update Codex CLI to a version with App Server support"
      : auth.ok
        ? provider === "codex" ? "App Server ready in this local workspace" : "Ready in this local workspace"
        : "Sign in from the CLI to continue",
    label,
    provider,
    version: firstMeaningfulLine(version.output)
  };
}

/**
 * Keep the bridge explicitly read-only. Codex CLI rejects --approve-for-me
 * together with --sandbox, and a read-only run never needs write approval.
 */
export function openSlideXAiProviderCommand(provider: OpenSlideXAiProvider) {
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

export function buildAgentPrompt(input: OpenSlideXAiRunInput, revision: string) {
  const transcript = (input.messages ?? []).slice(-8).map((message) => `${message.role}: ${message.content}`).join("\n");
  return [
    "You are editing one local OpenSlideX presentation workspace.",
    "Read AGENTS.md and the four project skills before proposing changes.",
    "presentation.mdx is the only presentation source. Do not edit any file in this run.",
    `Current revision: ${revision}`,
    `Current selection: slide ${input.slideIndex + 1}${input.nodeId ? `, node ${input.nodeId}` : input.blockIndex === undefined ? "" : `, block ${input.blockIndex}`}.`,
    `Unless the user explicitly requests the whole deck or multiple slides, change only slide ${input.slideIndex + 1}${input.nodeId ? ` and node ${input.nodeId}` : input.blockIndex === undefined ? "" : ` and block ${input.blockIndex}`}. Preserve every other slide exactly, including its order.`,
    transcript ? `Recent chat:\n${transcript}` : "",
    `User request:\n${input.prompt}`,
    "If the request changes the deck, return the COMPLETE candidate presentation.mdx between these exact markers:",
    "<OPENSLIDEX_MDX>",
    "...complete source...",
    "</OPENSLIDEX_MDX>",
    "Outside the markers, explain the design decisions in concise plain language. Never return a partial patch inside the markers."
  ].filter(Boolean).join("\n\n");
}

function collectProcess(child: ChildProcessWithoutNullStreams, input: string) {
  return new Promise<{ stderr: string; stdout: string }>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let bytes = 0;
    const append = (target: "stderr" | "stdout", chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > maxProcessOutputBytes) {
        child.kill("SIGTERM");
        reject(new Error("The local agent produced too much output."));
        return;
      }
      if (target === "stdout") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
    };
    child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk));
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve({ stderr, stdout });
      else reject(new Error(signal ? `The local agent was cancelled (${signal}).` : stderr.trim() || `The local agent exited with code ${code}.`));
    });
    child.stdin.end(input);
  });
}

function runProbe(command: string, args: string[]) {
  return new Promise<{ ok: boolean; output: string }>((resolve) => {
    const child = spawn(command, args, { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), 4_000);
    child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { output += chunk.toString("utf8"); });
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

function assistantText(provider: OpenSlideXAiProvider, output: string) {
  const messages: string[] = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      if (provider === "codex") {
        const item = event.item as { text?: unknown; type?: unknown } | undefined;
        if (item?.type === "agent_message" && typeof item.text === "string") messages.push(item.text);
      } else {
        if (event.type === "result" && typeof event.result === "string") messages.push(event.result);
        const message = event.message as { content?: Array<{ text?: unknown; type?: unknown }> } | undefined;
        for (const part of message?.content ?? []) {
          if (part.type === "text" && typeof part.text === "string") messages.push(part.text);
        }
      }
    } catch {
      // Ignore provider progress lines that are not JSON.
    }
  }
  return messages.at(-1) ?? output;
}

function extractCandidateSource(value: string) {
  return value.match(/<OPENSLIDEX_MDX>\s*([\s\S]*?)\s*<\/OPENSLIDEX_MDX>/i)?.[1]?.trim();
}

function stripCandidateSource(value: string) {
  return value.replace(/<OPENSLIDEX_MDX>[\s\S]*?<\/OPENSLIDEX_MDX>/gi, "A validated presentation draft is ready for review.").trim();
}

function firstMeaningfulLine(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith("WARNING:"));
}
