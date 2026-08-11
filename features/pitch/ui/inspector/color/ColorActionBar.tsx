"use client";

import { useEffect, useState, type PointerEvent } from "react";
import { Ban, Eraser, Pipette } from "lucide-react";
import {
  browserSupportsEyeDropper,
  pickColorFromScreen
} from "@/features/pitch/infrastructure/browserEyeDropper";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type ColorActionBarProps = {
  label: string;
  onClear?: () => void;
  onPick: (color: string) => void;
  onTransparent?: () => void;
};

export function ColorActionBar({
  label,
  onClear,
  onPick,
  onTransparent
}: ColorActionBarProps) {
  const { tx } = usePitchI18n();
  const [isEyeDropperSupported, setIsEyeDropperSupported] = useState(false);
  const [isPicking, setIsPicking] = useState(false);

  useEffect(() => {
    setIsEyeDropperSupported(browserSupportsEyeDropper());
  }, []);

  async function handlePickColor() {
    if (isPicking) return;

    setIsPicking(true);
    const color = await pickColorFromScreen();
    setIsPicking(false);
    if (color) onPick(color);
  }

  return (
    <div className="mt-3 flex items-center gap-1.5 border-t border-white/[0.06] pt-3">
      {isEyeDropperSupported ? (
        <button
          aria-busy={isPicking}
          aria-label={`${tx("Pick color from screen")}：${label}`}
          className={`flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border text-[10px] font-medium transition active:scale-[0.98] ${
            isPicking
              ? "border-white/25 bg-white/[0.1] text-white"
              : "border-white/[0.1] bg-white/[0.035] text-neutral-300 hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
          }`}
          onClick={handlePickColor}
          onPointerDown={stopActionPointer}
          title={tx("Pick color from screen")}
          type="button"
        >
          <Pipette aria-hidden="true" className={isPicking ? "animate-pulse" : ""} size={13} strokeWidth={1.8} />
          <span>{tx(isPicking ? "Picking…" : "Pick color")}</span>
        </button>
      ) : null}

      {onClear ? (
        <button
          aria-label={`${tx("Clear color")}：${label}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-neutral-500 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white active:scale-95"
          onClick={onClear}
          onPointerDown={stopActionPointer}
          title={tx("Clear color")}
          type="button"
        >
          <Eraser aria-hidden="true" size={13} strokeWidth={1.8} />
        </button>
      ) : null}

      {onTransparent ? (
        <button
          aria-label={tx("Use transparent")}
          className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-[linear-gradient(135deg,#222_25%,#111_25%,#111_50%,#222_50%,#222_75%,#111_75%)] bg-[length:8px_8px] text-neutral-400 transition hover:border-white/25 hover:text-white active:scale-95"
          onClick={onTransparent}
          onPointerDown={stopActionPointer}
          title={tx("Use transparent")}
          type="button"
        >
          <span className="absolute inset-0 bg-black/25" />
          <Ban aria-hidden="true" className="relative" size={13} strokeWidth={1.9} />
        </button>
      ) : null}
    </div>
  );
}

function stopActionPointer(event: PointerEvent<HTMLButtonElement>) {
  event.stopPropagation();
}
