import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, Copy, MonitorPlay, Minus, Plus, Smartphone, X } from "lucide-react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { usePitchI18n } from "./pitchI18n";
import { SlideThumbnailPreview } from "./preview/SlideThumbnailPreview";
import { PresenterSlideStage } from "./PresenterSlideStage";
import { presenterNotesKey } from "../application/presenterNotes";
import { usePresenterFocus } from "./usePresenterFocus";

type RemoteSession = { protocolVersion?: 2; expiresAt: string; id: string; qrSvg: string; remoteUrl: string };
type RemoteState = {
  slideRevision: number;
  command?: { direction: "next" | "previous"; id: number; type: "slide" } |
    { breakMinutes: number; focusMinutes: number; id: number; type: "timer.configure" } |
    { id: number; type: "timer.reset" | "timer.toggle" };
  connected: boolean; currentSlideIndex: number; expiresAt: string; slideCount: number;
  timer: { breakMinutes: number; elapsedSeconds: number; focusMinutes: number; isRunning: boolean; phase: "break" | "focus" | "ready"; remainingSeconds: number };
};
type Props = {
  activeSlideIndex: number; documentTitle: string; isOpen: boolean; onClose: () => void;
  onCloseRemoteSession: (id: string) => Promise<void>;
  onCreateRemoteSession: (input: { currentSlideIndex: number; slideCount: number; locale?: "en" | "zh-TW" }) => Promise<RemoteSession>;
  onOpenProjection: () => void;
  onSubscribeRemoteSession: (id: string, onState: (state: RemoteState) => void, onError: () => void) => () => void;
  onUpdateRemoteSession: (id: string, input: { currentSlideIndex?: number; slideCount?: number; timer?: RemoteState["timer"]; clientId?: string; sequence?: number }) => Promise<RemoteState>;
  projectionChannel: string; scenes: MotionDocScene[];
  notes: Record<string, string>; onNotesChange: (sceneId: string, value: string) => void;
};
const initialTimer: RemoteState["timer"] = { breakMinutes: 2, focusMinutes: 10, elapsedSeconds: 0, isRunning: false, phase: "ready", remainingSeconds: 600 };
const clock = (value: number) => String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
const button = "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs text-neutral-300 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300 disabled:opacity-30";

export function PresentationConsoleModal(props: Props) {
  return props.isOpen ? <PresenterConsole {...props} /> : null;
}
function PresenterConsole({ activeSlideIndex, documentTitle, onClose, onCloseRemoteSession, onCreateRemoteSession, onOpenProjection, onSubscribeRemoteSession, onUpdateRemoteSession, projectionChannel, scenes, notes, onNotesChange }: Props) {
  const { tx, locale } = usePitchI18n();
  const root = useRef<HTMLDivElement>(null);
  usePresenterFocus(root);
  const [index, setIndex] = useState(activeSlideIndex);
  const indexRef = useRef(index);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [timer, setTimer] = useState(initialTimer);
  const [remote, setRemote] = useState<RemoteSession | null>(null);
  const remoteRef = useRef(remote);
  remoteRef.current = remote;
  const slideSequence = useRef(0);
  const slideRevision = useRef(-1);
  const controllerId = useRef(crypto.randomUUID());
  const [connected, setConnected] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [fontSize, setFontSize] = useState(20);
  const lastCommand = useRef(0);
  const mounted = useRef(true);
  const scene = scenes[index];
  const notesKey = presenterNotesKey(scene, index);
  const goToSlide = useCallback((next: number, publish = true) => {
    const bounded = Math.max(0, Math.min(next, scenes.length - 1));
    indexRef.current = bounded;
    setIndex(bounded);
    if (!publish) return;
    channelRef.current?.postMessage({ type: "slide", index: bounded });
    const session = remoteRef.current;
    if (session) void onUpdateRemoteSession(session.id, { currentSlideIndex: bounded, slideCount: scenes.length, clientId: controllerId.current, sequence: ++slideSequence.current }).catch(() => setError(tx("Phone remote disconnected.")));
  }, [scenes.length, onUpdateRemoteSession, tx]);
  const move = useCallback((delta: number) => goToSlide(indexRef.current + delta), [goToSlide]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const channel = new BroadcastChannel(projectionChannel);
    channelRef.current = channel;
    channel.onmessage = ({ data }) => {
      if (data?.type === "ready") {
        channel.postMessage({ type: "slide", index: indexRef.current });
        channel.postMessage({ type: "remote-session", id: remoteRef.current?.id ?? null });
      }
      if (data?.type === "command") {
        if (Number.isInteger(data.index)) goToSlide(data.index);
        else if (data.direction === "next" || data.direction === "previous") move(data.direction === "next" ? 1 : -1);
      }
    };
    channel.postMessage({ type: "slide", index: indexRef.current });
    return () => { channel.close(); channelRef.current = null; };
  }, [projectionChannel, goToSlide, move]);
  useEffect(() => {
    slideRevision.current = -1;
    channelRef.current?.postMessage({ type: "remote-session", id: remote?.id ?? null });
    return () => { channelRef.current?.postMessage({ type: "remote-session", id: null }); };
  }, [remote]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { if (pairing) setPairing(false); else onClose(); return; }
      if ((event.target as HTMLElement)?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (["ArrowLeft", "PageUp", "ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        move(event.key === "ArrowLeft" || event.key === "PageUp" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [move, onClose, pairing]);
  useEffect(() => {
    document.querySelector('[data-presenter-slide][aria-current="true"]')?.scrollIntoView({ block: "nearest" });
  }, [index]);

  // Catch up after background throttling instead of losing seconds.
  useEffect(() => {
    if (!timer.isRunning) return;
    const started = Date.now();
    const base = timer;
    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      const remaining = Math.max(0, base.remainingSeconds - elapsed);
      setTimer(current => current.remainingSeconds === remaining ? current : {
        ...base, elapsedSeconds: Math.min(86400, base.elapsedSeconds + elapsed),
        remainingSeconds: remaining, isRunning: remaining > 0
      });
    }, 250);
    return () => window.clearInterval(interval);
  }, [timer.isRunning, timer.phase, timer.focusMinutes, timer.breakMinutes]);

  useEffect(() => {
    if (!remote) return;
    return onSubscribeRemoteSession(remote.id, state => {
      setConnected(state.connected);
      setError("");
      if (state.slideRevision > slideRevision.current) {
        slideRevision.current = state.slideRevision;
        goToSlide(state.currentSlideIndex, false);
      }
      const command = state.command;
      if (!command || command.id <= lastCommand.current) return;
      lastCommand.current = command.id;
      if (command.type === "slide") {
        // An already-running pre-upgrade service still needs its browser relay.
        if (remote.protocolVersion !== 2) move(command.direction === "next" ? 1 : -1);
        return;
      }
      else setTimer(current => {
        if (command.type === "timer.configure") return { ...initialTimer, focusMinutes: command.focusMinutes, breakMinutes: command.breakMinutes, remainingSeconds: command.focusMinutes * 60 };
        if (command.type === "timer.reset") return { ...current, elapsedSeconds: 0, remainingSeconds: current.focusMinutes * 60, isRunning: false, phase: "ready" };
        const phase = current.remainingSeconds === 0 ? (current.phase === "focus" && current.breakMinutes > 0 ? "break" : "focus") : current.phase === "ready" ? "focus" : current.phase;
        return { ...current, phase, isRunning: !current.isRunning, remainingSeconds: current.remainingSeconds || (phase === "break" ? current.breakMinutes : current.focusMinutes) * 60 };
      });
    }, () => { setConnected(false); setError(tx("Phone remote disconnected.")); });
  }, [remote, goToSlide, move, onSubscribeRemoteSession, tx]);

  // Serialize writes; coalesce pending ticks so stale requests cannot roll state back.
  const syncPending = useRef<{ timer: RemoteState["timer"] } | null>(null);
  const syncBusy = useRef(false);
  useEffect(() => {
    if (!remote) return;
    syncPending.current = { timer };
    if (syncBusy.current) return;
    syncBusy.current = true;
    void (async () => {
      try {
        while (syncPending.current && mounted.current) {
          const payload = syncPending.current;
          syncPending.current = null;
          await onUpdateRemoteSession(remote.id, remote.protocolVersion === 2 ? payload : { ...payload, currentSlideIndex: indexRef.current, slideCount: scenes.length });
        }
      } catch { if (mounted.current) setError(tx("Phone remote disconnected.")); }
      finally { syncBusy.current = false; }
    })();
  }, [remote, timer, scenes.length, onUpdateRemoteSession, tx]);
  useEffect(() => {
    if (!remote) return;
    return () => { void onCloseRemoteSession(remote.id).catch(() => undefined); };
  }, [remote, onCloseRemoteSession]);

  const pair = async (renew = false) => {
    setPairing(true);
    if (creating || (remote && !renew)) return;
    if (renew) { setRemote(null); setConnected(false); setCopied(false); lastCommand.current = 0; }
    setCreating(true); setError("");
    try {
      const session = await onCreateRemoteSession({ currentSlideIndex: indexRef.current, slideCount: scenes.length, locale });
      if (mounted.current) setRemote(session);
      else void onCloseRemoteSession(session.id);
    } catch { setError(tx("Unable to create phone remote.")); }
    finally { setCreating(false); }
  };
  return <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={tx("Presentation with notes")} className="fixed inset-0 z-[120] flex h-dvh flex-col overflow-hidden bg-[#202020] text-neutral-100 outline-none">
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-white/10 px-5">
      <span className="text-sm font-bold tracking-tight">Slide<span className="text-violet-300">X</span></span>
      <h1 className="min-w-0 flex-1 truncate text-xs font-medium">{documentTitle}</h1>
      <div className="hidden items-center gap-2 text-xs text-neutral-400 sm:flex" title={tx("Adjust the timer from your phone")}>
        <Clock3 size={14} /><span>{tx(timer.phase === "break" ? "Break" : "Pomodoro")}</span>
        <span className={"font-mono tabular-nums " + (timer.remainingSeconds === 0 ? "text-amber-300" : "text-neutral-100")}>{clock(timer.remainingSeconds)}</span>
        <span className="ml-3 hidden text-neutral-500 lg:inline">{tx("Elapsed")} {clock(timer.elapsedSeconds)}</span>
      </div>
      <button className={button} onClick={() => void pair()} type="button"><Smartphone size={16} /><span className="hidden sm:inline">{tx("Phone remote")}</span>{connected ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> : null}</button>
      <button aria-label={tx("Close presentation console")} className={button} onClick={onClose} type="button"><X size={17} /></button>
    </header>
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(220px,26%)] md:grid-cols-[150px_minmax(0,1fr)_minmax(240px,24%)] xl:grid-cols-[200px_minmax(0,1fr)_300px]">
      <nav aria-label={tx("Slides")} className="hidden min-h-0 overflow-y-auto border-r border-white/10 p-2 md:block">
        <p className="px-3 pb-3 pt-4 text-xs font-medium text-neutral-400">{tx("Slides")}</p>
        {scenes.map((item, n) => <button key={presenterNotesKey(item, n)} data-presenter-slide aria-current={index === n ? "true" : undefined} aria-label={tx("Slide") + " " + (n + 1)} className={"mb-1 flex w-full items-start gap-2 rounded-md p-2 text-xs transition-colors focus-visible:outline focus-visible:outline-violet-300 " + (index === n ? "bg-[#49445f] text-white" : "text-neutral-400 hover:bg-white/5")} onClick={() => goToSlide(n)} type="button">
          <span className="w-4 shrink-0 pt-1 tabular-nums">{n + 1}</span><span className="relative block aspect-video min-w-0 flex-1 overflow-hidden rounded bg-black"><SlideThumbnailPreview activeSlideIndex={n} replayNonce={0} scene={item} /></span>
        </button>)}
      </nav>
      <main className="flex min-h-0 min-w-0 flex-col p-4 pb-3 xl:p-6 xl:pb-4">
        <div className="min-h-0 flex-1"><PresenterSlideStage index={index} onRequestSlide={goToSlide} scenes={scenes} /></div>
        <footer className="flex h-14 shrink-0 items-end justify-between gap-2">
          <nav aria-label={tx("Slide controls")} className="flex items-center rounded-xl border border-white/10 bg-[#2b2b2b] p-1 shadow-lg">
            <button aria-label={tx("Previous")} className={button} disabled={index === 0} onClick={() => move(-1)} type="button"><ChevronLeft size={16} /></button>
            <span className="min-w-14 text-center text-xs tabular-nums">{index + 1} / {scenes.length}</span>
            <button aria-label={tx("Next")} className={button} disabled={index >= scenes.length - 1} onClick={() => move(1)} type="button"><ChevronRight size={16} /></button>
          </nav>
          <button className={button + " border border-white/10"} onClick={onOpenProjection} type="button"><MonitorPlay size={15} /><span className="hidden lg:inline">{tx("Open audience view")}</span></button>
        </footer>
      </main>
      <aside className="flex min-h-0 flex-col border-l border-white/10 px-5 pb-4 pt-6">
        <h2 className="text-xs font-medium text-neutral-400">{tx("Speaker notes")}</h2>
        <textarea
          aria-label={tx("Speaker notes")}
          className="mt-4 min-h-0 w-full flex-1 cursor-text resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-3 leading-relaxed text-neutral-100 caret-violet-300 outline-none transition-colors placeholder:text-neutral-500 hover:border-white/20 hover:bg-black/25 focus:border-violet-300/55 focus:bg-black/30 focus:ring-2 focus:ring-violet-300/15"
          data-presenter-notes-editor
          onChange={event => onNotesChange(notesKey, event.target.value)}
          placeholder={tx("Add notes for this slide…")}
          spellCheck
          style={{ fontSize }}
          value={notes[notesKey] ?? String(scene?.props.presenterNotes ?? "")}
        />
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[10px] leading-4 text-neutral-500">{tx("Live notes · this session only")}</span>
          <div className="flex rounded-md border border-white/10">
            <button aria-label={tx("Decrease notes text size")} className={button + " !px-2"} disabled={fontSize <= 14} onClick={() => setFontSize(size => size - 2)} type="button"><Minus size={14} /></button>
            <button aria-label={tx("Increase notes text size")} className={button + " !px-2"} disabled={fontSize >= 36} onClick={() => setFontSize(size => size + 2)} type="button"><Plus size={14} /></button>
          </div>
        </div>
      </aside>
    </div>
    {pairing ? <div className="absolute inset-0 z-10 grid place-items-center bg-black/60 p-5" onMouseDown={event => { if (event.currentTarget === event.target) setPairing(false); }}>
      <section role="dialog" aria-modal="true" aria-label={tx("Phone remote")} className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#292929] p-6 shadow-2xl">
        <header className="flex items-center justify-between"><h2 className="text-sm font-semibold">{tx("Phone remote")}</h2><button aria-label={tx("Close")} className={button} onClick={() => setPairing(false)} type="button"><X size={17} /></button></header>
        <p className="mt-2 text-xs leading-5 text-neutral-400">{tx("Scan to change slides and set your timer.")}</p>
        {remote ? <><img alt={tx("QR code for phone remote")} className="mx-auto my-6 h-48 w-48 rounded-xl bg-white p-3" src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(remote.qrSvg)} /><p role="status" className="text-center text-xs text-neutral-300">{connected ? tx("Phone connected") : tx("Scan with your phone")}</p><button className={button + " mt-4 w-full border border-white/10"} onClick={async () => { try { await navigator.clipboard.writeText(remote.remoteUrl); setCopied(true); } catch { setError(tx("Unable to copy pairing link. Scan the QR code instead.")); } }} type="button"><Copy size={14} />{tx(copied ? "Copied" : "Copy pairing link")}</button></> : <p role="status" className="py-8 text-sm text-neutral-400">{creating ? tx("Connecting…") : tx("Unable to create phone remote.")}</p>}
        <p className="mt-4 text-center text-[11px] text-neutral-500">{tx("Same Wi‑Fi only · expires in 30 minutes")}</p>
        {remote ? <a className={button + " mt-2 w-full"} href={remote.remoteUrl} target="_blank" rel="noopener noreferrer">{tx("Open phone remote")}</a> : null}
        <button className={button + " mt-3 w-full"} disabled={creating} onClick={() => void pair(true)} type="button">{tx("New pairing code")}</button>
        {error ? <p role="alert" className="mt-3 text-xs text-amber-200">{error}</p> : null}
      </section>
    </div> : null}
  </div>;
}
