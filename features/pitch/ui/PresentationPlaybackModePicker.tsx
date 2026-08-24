import { Maximize2, MonitorPlay, X } from "lucide-react";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

export type PresentationPlaybackMode = "fullscreen" | "projection";

type PresentationPlaybackModePickerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mode: PresentationPlaybackMode) => void;
};

export function PresentationPlaybackModePicker({ isOpen, onClose, onSelect }: PresentationPlaybackModePickerProps) {
  const { tx } = usePitchI18n();
  if (!isOpen) return null;

  return (
    <div aria-labelledby="playback-mode-title" aria-modal="true" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-5 backdrop-blur-sm" role="dialog">
      <div className="animate-in fade-in zoom-in-95 w-full max-w-[34rem] rounded-[28px] border border-white/[0.12] bg-[#1c1c1e]/95 p-3 shadow-[0_28px_90px_rgba(0,0,0,0.58)] backdrop-blur-2xl duration-200">
        <header className="flex items-start justify-between px-3 pb-3 pt-2">
          <div>
            <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-white" id="playback-mode-title">{tx("Choose playback mode")}</h2>
          </div>
          <button aria-label={tx("Close")} className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/[0.1] hover:text-white" onClick={onClose} type="button">
            <X size={17} />
          </button>
        </header>
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="rounded-[21px] border border-[#9ad7ff]/20 bg-[#9ad7ff]/[0.07] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#9ad7ff]/45 hover:bg-[#9ad7ff]/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9ad7ff]" onClick={() => onSelect("projection")} type="button">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#9ad7ff] text-[#071017] shadow-sm"><MonitorPlay size={19} /></span>
            <span className="mt-5 block text-[15px] font-semibold text-white">{tx("Projection control mode")}</span>
            <span className="mt-1 block text-[12px] leading-5 text-neutral-400">{tx("Keep slides and controls visible while you present.")}</span>
          </button>
          <button className="rounded-[21px] border border-white/[0.09] bg-white/[0.045] p-4 text-left transition hover:-translate-y-0.5 hover:border-white/[0.2] hover:bg-white/[0.09] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9ad7ff]" onClick={() => onSelect("fullscreen")} type="button">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white text-black shadow-sm"><Maximize2 size={19} /></span>
            <span className="mt-5 block text-[15px] font-semibold text-white">{tx("Full screen mode")}</span>
            <span className="mt-1 block text-[12px] leading-5 text-neutral-400">{tx("Start immediately in full screen.")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
