import { useEffect, useRef } from "react";
import { MonitorPlay, PanelRight, X } from "lucide-react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { usePitchI18n } from "./pitchI18n";
import { SlideThumbnailPreview } from "./preview/SlideThumbnailPreview";
import { usePresenterFocus } from "./usePresenterFocus";

export type PresentationPlaybackMode = "presenter" | "projection";
export function PresentationPlaybackModePicker({ isOpen, onClose, onSelect, scene, index }: {
  isOpen: boolean; onClose: () => void; onSelect: (mode: PresentationPlaybackMode) => void; scene: MotionDocScene; index: number;
}) {
  const { tx } = usePitchI18n();
  const first = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement>(null);
  usePresenterFocus(root, isOpen);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    first.current?.focus();
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", keydown);
    return () => { window.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[110] bg-black/20" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={tx("Choose playback mode")} className="absolute right-5 top-20 w-[min(430px,calc(100vw-40px))] overflow-hidden rounded-xl border border-white/10 bg-[#2b2b2b] text-neutral-100 shadow-2xl outline-none">
      <header className="flex items-center justify-between px-4 py-2"><h2 className="text-xs text-neutral-400">{tx("Choose playback mode")}</h2><button aria-label={tx("Close")} className="rounded p-2 text-neutral-400 hover:bg-white/10" onClick={onClose} type="button"><X size={14} /></button></header>
      <div className="grid grid-cols-2 divide-x divide-white/10">
        {(["projection", "presenter"] as const).map((mode, n) => <button ref={n === 0 ? first : undefined} key={mode} className="group flex flex-col items-stretch px-4 pb-5 pt-2 text-left hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-300" onClick={() => onSelect(mode)} type="button">
          <span className="block text-xs font-semibold">{tx(mode === "projection" ? "Presentation" : "Presentation with notes")}</span>
          <div className="relative my-5 h-24">
            <div className="absolute left-1 right-4 top-1 aspect-video overflow-hidden rounded border border-white/10 bg-black shadow-lg"><SlideThumbnailPreview activeSlideIndex={index} replayNonce={0} scene={scene} /></div>
            {mode === "presenter" ? <div className="absolute bottom-0 right-0 flex h-14 w-24 items-center gap-2 rounded border border-white/15 bg-[#171717] p-2 shadow-xl"><MonitorPlay className="text-violet-300" size={36} /><PanelRight className="text-neutral-500" size={24} /></div> : null}
          </div>
          <span className="block text-xs leading-5 text-neutral-400">{tx(mode === "projection" ? "One view, without speaker notes." : "An audience view and a private view for your notes.")}</span>
        </button>)}
      </div>
    </section>
  </div>;
}
