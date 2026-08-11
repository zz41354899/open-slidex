import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

import { openSlideXToolNames } from "../shared/aiEvents";

export type JsonRecord = Record<string, unknown>;
export type RpcMessage = {
  error?: { code?: number; message?: string };
  id?: number | string;
  method?: string;
  params?: JsonRecord;
  result?: unknown;
};

type PendingRequest = {
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
  timer: NodeJS.Timeout;
};
type NotificationListener = (message: RpcMessage) => void;

const maxProtocolLineBytes = 16 * 1024 * 1024;
const requestTimeoutMs = 30_000;

export class CodexAppServerTransport {
  private child?: ChildProcessWithoutNullStreams;
  private initializePromise?: Promise<void>;
  private readonly listeners = new Set<NotificationListener>();
  private nextRequestId = 1;
  private readonly pending = new Map<number | string, PendingRequest>();
  private stderr = "";

  constructor(private readonly projectRoot: string) {}

  get diagnostics() {
    return this.stderr;
  }

  request(method: string, params: JsonRecord) {
    return this.ensureStarted().then(() => this.rawRequest(method, params));
  }

  warm() {
    return this.ensureStarted();
  }

  subscribe(listener: NotificationListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close() {
    this.child?.kill("SIGTERM");
    this.child = undefined;
    this.initializePromise = undefined;
    this.rejectPending(new Error("Codex App Server was closed."));
  }

  private async ensureStarted() {
    if (this.initializePromise) return this.initializePromise;
    this.initializePromise = this.start();
    try {
      await this.initializePromise;
    } catch (error) {
      this.initializePromise = undefined;
      throw error;
    }
  }

  private async start() {
    this.stderr = "";
    const child = spawn("codex", codexAppServerArgs(this.projectRoot), {
      cwd: this.projectRoot,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.child = child;
    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => this.receiveLine(line));
    child.stderr.on("data", (chunk: Buffer) => {
      this.stderr = `${this.stderr}${chunk.toString("utf8")}`.slice(-32_000);
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

  private receiveLine(line: string) {
    if (Buffer.byteLength(line) > maxProtocolLineBytes) {
      this.child?.kill("SIGTERM");
      this.failProcess(new Error("Codex App Server produced an oversized protocol message."));
      return;
    }
    let message: RpcMessage;
    try {
      message = JSON.parse(line) as RpcMessage;
    } catch {
      return;
    }
    if (message.id !== undefined && (message.result !== undefined || message.error)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message ?? "Codex App Server request failed."));
      else pending.resolve(message.result);
      return;
    }
    if (message.id !== undefined && message.method) {
      this.answerServerRequest(message);
      return;
    }
    if (message.method) for (const listener of this.listeners) listener(message);
  }

  private answerServerRequest(message: RpcMessage) {
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

  private rawRequest(method: string, params: JsonRecord) {
    const id = this.nextRequestId++;
    return new Promise<unknown>((resolve, reject) => {
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

  private send(message: JsonRecord) {
    if (!this.child || this.child.exitCode !== null || this.child.signalCode !== null) {
      throw new Error("Codex App Server is not running.");
    }
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private failProcess(error: Error) {
    if (this.child) {
      this.child.removeAllListeners();
      this.child = undefined;
    }
    this.initializePromise = undefined;
    this.rejectPending(error);
    for (const listener of this.listeners) {
      listener({ method: "open-slidex/process-error", params: { message: error.message } });
    }
  }

  private rejectPending(error: Error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

export function codexAppServerArgs(projectRoot: string) {
  return [
    "app-server",
    "--stdio",
    "--disable", "apps",
    "--disable", "browser_use",
    "--disable", "computer_use",
    "--disable", "image_generation",
    "--disable", "js_repl",
    "--disable", "plugins",
    "--disable", "shell_tool",
    "--disable", "unified_exec",
    "-c", `mcp_servers=${mcpServersToml(projectRoot)}`,
    "-c", 'mcp_servers.node_repl={command="node",args=["--version"],enabled=false}',
    "-c", 'mcp_servers."computer-use"={command="node",args=["--version"],enabled=false}',
    "-c", 'web_search="disabled"'
  ];
}

export function isolatedThreadConfig(projectRoot: string) {
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

function mcpServerConfig(projectRoot: string) {
  const launch = openSlideXMcpLaunch(projectRoot);
  return {
    ...launch,
    default_tools_approval_mode: "approve",
    enabled_tools: [...openSlideXToolNames],
    required: true
  };
}

export function openSlideXMcpLaunch(
  projectRoot: string,
  options: {
    bundledEntry?: string;
    entryExists?: (entry: string) => boolean;
  } = {}
) {
  const bundledEntry = options.bundledEntry
    ?? fileURLToPath(new URL("../mcp/server.mjs", import.meta.url));
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

function mcpServersToml(projectRoot: string) {
  const config = mcpServerConfig(projectRoot);
  return `{open_slidex={command=${JSON.stringify(config.command)},args=${JSON.stringify(config.args)},cwd=${JSON.stringify(config.cwd)},required=true,default_tools_approval_mode="approve",enabled_tools=${JSON.stringify(config.enabled_tools)}}}`;
}
