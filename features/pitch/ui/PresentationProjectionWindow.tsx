import { Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { PresenterSlideStage } from "./PresenterSlideStage";
import { usePitchI18n } from "./pitchI18n";

export function PresentationProjectionWindow({ channelName, initialSlideIndex, scenes, onSubscribeRemoteSession }: { channelName: string; initialSlideIndex: number; scenes: MotionDocScene[]; onSubscribeRemoteSession: (id: string, onState: (state: { currentSlideIndex: number; slideRevision: number }) => void, onError: () => void) => () => void }) {
  const { tx } = usePitchI18n();
  const [index, setIndex] = useState(initialSlideIndex);
  const [fullscreen, setFullscreen] = useState(false);
  const [controls, setControls] = useState(true);
  const channel = useRef<BroadcastChannel | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reveal = useCallback(() => {
    setControls(true);
    clearTimeout(hide.current);
    hide.current = setTimeout(() => setControls(false), 2200);
  }, []);
  const requestSlide = useCallback((next: number) => channel.current?.postMessage({ type: "command", index: next }), []);
  const toggleFullscreen = useCallback(() => {
    const promise = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    void promise?.catch(() => undefined);
  }, []);
  useEffect(() => {
    const connection = new BroadcastChannel(channelName);
    channel.current = connection;
    let remoteId: string | null = null;
    let unsubscribe: (() => void) | undefined;
    connection.onmessage = ({ data }) => {
      if (data?.type === "slide" && Number.isInteger(data.index)) setIndex(Math.max(0, Math.min(data.index, scenes.length - 1)));
      if (data?.type === "remote-session" && (typeof data.id === "string" || data.id === null) && data.id !== remoteId) {
        unsubscribe?.();
        remoteId = data.id;
        let revision = -1;
        // Receive the authoritative page directly, even while the presenter is busy.
        if (remoteId) unsubscribe = onSubscribeRemoteSession(remoteId, state => {
          if (!Number.isSafeInteger(state.slideRevision)) return; // Old services use the BroadcastChannel relay.
          if (state.slideRevision <= revision) return;
          revision = state.slideRevision;
          setIndex(Math.max(0, Math.min(state.currentSlideIndex, scenes.length - 1)));
        }, () => {});
      }
    };
    connection.postMessage({ type: "ready" });
    return () => { unsubscribe?.(); connection.close(); channel.current = null; };
  }, [channelName, scenes.length, onSubscribeRemoteSession]);
  useEffect(() => {
    reveal();
    const changed = () => setFullscreen(Boolean(document.fullscreenElement));
    const keydown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "PageUp", "ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        channel.current?.postMessage({ type: "command", direction: event.key === "ArrowLeft" || event.key === "PageUp" ? "previous" : "next" });
      }
      if (event.key.toLowerCase() === "f") toggleFullscreen();
    };
    document.addEventListener("fullscreenchange", changed);
    window.addEventListener("keydown", keydown);
    return () => { clearTimeout(hide.current); document.removeEventListener("fullscreenchange", changed); window.removeEventListener("keydown", keydown); };
  }, [reveal, toggleFullscreen]);
  return <main aria-label={tx("Audience view")} className="fixed inset-0 bg-black text-white" onPointerMove={reveal} onPointerDown={reveal}>
    <PresenterSlideStage index={index} onRequestSlide={requestSlide} scenes={scenes} />
    <div className={"absolute bottom-5 right-5 flex items-center gap-3 rounded-lg border border-white/15 bg-black/70 px-3 py-2 text-xs transition-opacity focus-within:opacity-100 " + (controls ? "opacity-100" : "opacity-0")}>
      <span className="tabular-nums">{index + 1} / {scenes.length}</span>
      <button aria-label={tx(fullscreen ? "Exit fullscreen" : "Fullscreen")} className="rounded p-2 hover:bg-white/15" onClick={toggleFullscreen} type="button">{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
    </div>
  </main>;
}
