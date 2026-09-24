import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";

import QRCode from "qrcode";
import { presenterRemotePage } from "./presenterRemotePage";

type RemoteDirection = "next" | "previous";

type PresenterTimerState = {
  breakMinutes: number;
  elapsedSeconds: number;
  focusMinutes: number;
  isRunning: boolean;
  phase: "break" | "focus" | "ready";
  remainingSeconds: number;
};

type PresenterRemoteCommand =
  | { direction: RemoteDirection; id: number; type: "slide" }
  | { breakMinutes: number; focusMinutes: number; id: number; type: "timer.configure" }
  | { id: number; type: "timer.reset" }
  | { id: number; type: "timer.toggle" };

type PresenterRemoteSessionRecord = {
  clients: Set<ServerResponse>;
  hostListeners: Set<(state: PresenterRemoteState) => void>;
  command?: PresenterRemoteCommand;
  currentSlideIndex: number;
  slideRevision: number;
  slideSequences: Map<string, number>;
  expiresAt: number;
  id: string;
  slideCount: number;
  timer: PresenterTimerState;
  token: string;
  locale: "en" | "zh-TW";
  expiryTimer: ReturnType<typeof setTimeout>;
};

export type PresenterRemoteSession = {
  protocolVersion: 2;
  expiresAt: string;
  id: string;
  qrSvg: string;
  remoteUrl: string;
};

export type PresenterRemoteState = {
  slideRevision: number;
  command?: PresenterRemoteCommand;
  connected: boolean;
  currentSlideIndex: number;
  expiresAt: string;
  slideCount: number;
  timer: PresenterTimerState;
};

const sessionLifetimeMs = 30 * 60_000;

/**
 * A short-lived, LAN-only remote control surface. The device never receives
 * slide pixels, speaker notes, or the local editor URL: only the two commands
 * needed to move the presenter console and its position indicator.
 */
export class PresenterRemoteServer {
  private commandId = 0;
  private readonly sessions = new Map<string, PresenterRemoteSessionRecord>();
  private server?: Server;
  private port?: number;

  constructor(private readonly remoteAddress = localNetworkAddress()) {}

  async create(input: { currentSlideIndex: number; slideCount: number; locale?: "en" | "zh-TW" }) {
    if (!this.remoteAddress) throw badRequest("No private IPv4 network is available for phone remote control.");
    await this.ensureListening();
    const id = randomBytes(12).toString("base64url");
    const token = randomBytes(32).toString("base64url");
    const session: PresenterRemoteSessionRecord = {
      clients: new Set(),
      hostListeners: new Set(),
      currentSlideIndex: clampSlideIndex(input.currentSlideIndex, input.slideCount),
      slideRevision: 0,
      slideSequences: new Map(),
      expiresAt: Date.now() + sessionLifetimeMs,
      id,
      locale: input.locale ?? "zh-TW",
      expiryTimer: setTimeout(() => this.closeSession(id), sessionLifetimeMs),
      slideCount: boundedSlideCount(input.slideCount),
      timer: defaultTimerState(),
      token
    };
    this.sessions.set(id, session);
    const remoteUrl = `http://${this.remoteAddress}:${this.port}/presenter/${encodeURIComponent(id)}#${token}`;
    const qrSvg = await QRCode.toString(remoteUrl, {
      color: { dark: "#101217", light: "#ffffff" },
      errorCorrectionLevel: "M",
      margin: 1,
      type: "svg",
      width: 280
    });
    return { protocolVersion: 2, expiresAt: new Date(session.expiresAt).toISOString(), id, qrSvg, remoteUrl } satisfies PresenterRemoteSession;
  }

  read(id: string): PresenterRemoteState {
    const session = this.session(id);
    return this.state(session);
  }

  subscribe(id: string, listener: (state: PresenterRemoteState) => void) {
    const session = this.session(id);
    session.hostListeners.add(listener);
    listener(this.state(session));
    return () => session.hostListeners.delete(listener);
  }

  update(id: string, input: { currentSlideIndex?: number; slideCount?: number; timer?: unknown; clientId?: string; sequence?: number }) {
    const session = this.session(id);
    const count = input.slideCount === undefined ? session.slideCount : boundedSlideCount(input.slideCount);
    if (input.currentSlideIndex !== undefined) {
      const index = clampSlideIndex(input.currentSlideIndex, count);
      if (this.acceptSlideSequence(session, input)) {
        session.slideCount = count;
        session.currentSlideIndex = index;
        session.slideRevision++;
      }
    }
    if (input.timer !== undefined) session.timer = parseTimerState(input.timer);
    this.publish(session);
    return this.state(session);
  }

  closeSession(id: string) {
    const session = this.sessions.get(id);
    if (!session) return;
    this.sessions.delete(id);
    clearTimeout(session.expiryTimer);
    for (const client of session.clients) client.end();
    session.clients.clear();
    session.hostListeners.clear();
  }

  async close() {
    for (const id of this.sessions.keys()) this.closeSession(id);
    if (!this.server) return;
    const server = this.server;
    this.server = undefined;
    this.port = undefined;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }

  private async ensureListening() {
    if (this.server && this.port) return;
    const server = createServer((request, response) => {
      void this.route(request, response).catch((error) => sendError(response, error));
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "0.0.0.0", resolve);
    });
    this.server = server;
    this.port = (server.address() as { port: number }).port;
  }

  private async route(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? "/", "http://presenter.remote");
    const page = url.pathname.match(/^\/presenter\/([A-Za-z0-9_-]+)$/);
    if (page && request.method === "GET") {
      const session = this.session(page[1]);
      sendHtml(response, presenterRemotePage(page[1], session.locale));
      return;
    }

    const events = url.pathname.match(/^\/presenter\/([A-Za-z0-9_-]+)\/events$/);
    if (events && request.method === "GET") {
      const session = this.authorize(events[1], request);
      response.writeHead(200, {
        "cache-control": "no-store",
        connection: "keep-alive",
        "content-type": "text/event-stream",
        "x-content-type-options": "nosniff"
      });
      response.flushHeaders();
      session.clients.add(response);
      this.publish(session);
      const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 15000);
      response.once("close", () => {
        clearInterval(heartbeat);
        session.clients.delete(response);
        this.publish(session);
      });
      return;
    }

    const command = url.pathname.match(/^\/presenter\/([A-Za-z0-9_-]+)\/command$/);
    if (command && request.method === "POST") {
      const session = this.authorize(command[1], request);
      const body = await readJson(request);
      // Absolute, sequenced targets can travel concurrently: a late request
      // cannot undo a newer tap, and slides never wait for timer requests.
      if (body.type === "slide" && body.index !== undefined) {
        if (typeof body.clientId !== "string" || !Number.isSafeInteger(body.sequence)) throw badRequest("A slide sequence is required.");
        const state = this.update(session.id, { currentSlideIndex: Number(body.index), clientId: body.clientId, sequence: Number(body.sequence) });
        response.writeHead(200, { "cache-control": "no-store", "content-type": "application/json" });
        response.end(JSON.stringify(state));
        return;
      }
      session.command = parseRemoteCommand(body, ++this.commandId);
      if (session.command.type === "slide") {
        session.currentSlideIndex = Math.max(0, Math.min(session.slideCount - 1, session.currentSlideIndex + (session.command.direction === "next" ? 1 : -1)));
        session.slideRevision++;
      }
      this.publish(session);
      response.writeHead(204, { "cache-control": "no-store", "x-content-type-options": "nosniff" });
      response.end();
      return;
    }

    response.writeHead(404, { "cache-control": "no-store", "x-content-type-options": "nosniff" });
    response.end();
  }

  private authorize(id: string, request: IncomingMessage) {
    const session = this.session(id);
    const token = request.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,})$/)?.[1];
    if (!token || token !== session.token) throw Object.assign(new Error("Remote session authorization failed."), { status: 403 });
    return session;
  }

  private session(id: string) {
    const session = this.sessions.get(id);
    if (!session || session.expiresAt <= Date.now()) {
      if (session) this.closeSession(id);
      throw Object.assign(new Error("This phone remote session has expired."), { status: 410 });
    }
    return session;
  }

  private state(session: PresenterRemoteSessionRecord): PresenterRemoteState {
    return {
      slideRevision: session.slideRevision,
      command: session.command,
      connected: session.clients.size > 0,
      currentSlideIndex: session.currentSlideIndex,
      expiresAt: new Date(session.expiresAt).toISOString(),
      slideCount: session.slideCount
      ,timer: session.timer
    };
  }

  private acceptSlideSequence(session: PresenterRemoteSessionRecord, input: { clientId?: string; sequence?: number }) {
    if (input.clientId === undefined && input.sequence === undefined) return true;
    if (typeof input.clientId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(input.clientId) || !Number.isSafeInteger(input.sequence) || input.sequence! < 1) throw badRequest("A valid slide sequence is required.");
    if (input.sequence! <= (session.slideSequences.get(input.clientId) ?? 0)) return false;
    if (!session.slideSequences.has(input.clientId) && session.slideSequences.size >= 64) throw badRequest("Too many remote controllers.");
    session.slideSequences.set(input.clientId, input.sequence!);
    return true;
  }

  private publish(session: PresenterRemoteSessionRecord) {
    const state = this.state(session);
    const payload = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
    for (const client of session.clients) {
      if (client.destroyed || client.writableEnded) session.clients.delete(client);
      else client.write(payload);
    }
    for (const listener of session.hostListeners) listener(state);
  }
}

function localNetworkAddress() {
  for (const network of Object.values(networkInterfaces())) {
    for (const address of network ?? []) {
      if (address.family === "IPv4" && !address.internal && isPrivateIpv4(address.address)) return address.address;
    }
  }
  return undefined;
}

function isPrivateIpv4(value: string) {
  return /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/.test(value);
}

function boundedSlideCount(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 10_000) throw badRequest("A valid slide count is required.");
  return value;
}

function clampSlideIndex(value: number, slideCount: number) {
  if (!Number.isInteger(value) || value < 0 || value >= slideCount) throw badRequest("A valid current slide is required.");
  return value;
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > 8 * 1024) throw badRequest("Remote command is too large.");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
}

function defaultTimerState(): PresenterTimerState {
  return { breakMinutes: 2, elapsedSeconds: 0, focusMinutes: 10, isRunning: false, phase: "ready", remainingSeconds: 600 };
}

function parseTimerState(value: unknown): PresenterTimerState {
  if (!value || typeof value !== "object") throw badRequest("A valid timer state is required.");
  const timer = value as Record<string, unknown>;
  if (!Number.isInteger(timer.focusMinutes) || !Number.isInteger(timer.breakMinutes) || !Number.isInteger(timer.elapsedSeconds) || !Number.isInteger(timer.remainingSeconds) || typeof timer.isRunning !== "boolean" || (timer.phase !== "ready" && timer.phase !== "focus" && timer.phase !== "break")) throw badRequest("A valid timer state is required.");
  const focusMinutes = Number(timer.focusMinutes);
  const breakMinutes = Number(timer.breakMinutes);
  const elapsedSeconds = Number(timer.elapsedSeconds);
  const remainingSeconds = Number(timer.remainingSeconds);
  if (focusMinutes < 1 || focusMinutes > 120 || breakMinutes < 0 || breakMinutes > 120 || elapsedSeconds < 0 || elapsedSeconds > 86400 || remainingSeconds < 0 || remainingSeconds > 86400) throw badRequest("A valid timer state is required.");
  return { breakMinutes, elapsedSeconds, focusMinutes, isRunning: timer.isRunning, phase: timer.phase, remainingSeconds };
}

function parseRemoteCommand(body: Record<string, unknown>, id: number): PresenterRemoteCommand {
  if (body.type === "slide" && (body.direction === "next" || body.direction === "previous")) return { direction: body.direction, id, type: "slide" };
  if (body.type === "timer.toggle") return { id, type: "timer.toggle" };
  if (body.type === "timer.reset") return { id, type: "timer.reset" };
  if (body.type === "timer.configure" && Number.isInteger(body.focusMinutes) && Number.isInteger(body.breakMinutes) && Number(body.focusMinutes) >= 1 && Number(body.focusMinutes) <= 120 && Number(body.breakMinutes) >= 0 && Number(body.breakMinutes) <= 120) return { breakMinutes: Number(body.breakMinutes), focusMinutes: Number(body.focusMinutes), id, type: "timer.configure" };
  throw badRequest("A valid remote command is required.");
}


function sendHtml(response: ServerResponse, html: string) {
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-security-policy": "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    "content-type": "text/html; charset=utf-8",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff"
  });
  response.end(html);
}

function sendError(response: ServerResponse, error: unknown) {
  const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
  if (!response.headersSent) response.writeHead(status, { "cache-control": "no-store", "x-content-type-options": "nosniff" });
  response.end();
}

function badRequest(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}
