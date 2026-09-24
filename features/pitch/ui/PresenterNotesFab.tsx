import { ChevronDown, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { usePitchI18n } from "./pitchI18n";

export function PresenterNotesFab({ notes, onChange, slideNumber }: { notes: string; onChange: (notes: string) => void; slideNumber: number }) {
  const { tx } = usePitchI18n();
  const [open, setOpen] = useState(false);
  return <aside aria-label={tx("Speaker notes")} className="fixed bottom-0 left-0 right-0 z-[90] md:left-[264px] xl:right-[390px]">
    {open ? <section className="rounded-t-xl border border-b-0 border-white/10 bg-[#252525] p-2 shadow-[0_-8px_30px_#0003]">
      <header className="flex h-8 items-center justify-between px-3">
        <span className="text-[11px] text-neutral-400">{tx("Speaker notes")} · {tx("Slide")} {slideNumber}</span>
        <span className="hidden text-[10px] text-neutral-500 sm:inline">{tx("Live notes · this session only")}</span>
        <button aria-label={tx("Collapse notes")} aria-expanded={open} className="grid h-8 w-8 place-items-center rounded text-neutral-400 hover:bg-white/10" onClick={() => setOpen(false)} type="button"><ChevronDown size={15} /></button>
      </header>
      <textarea autoFocus aria-label={tx("Speaker notes")} className="block h-32 max-h-[40vh] w-full resize-y rounded-lg bg-[#141414] p-4 text-sm leading-6 text-neutral-200 outline-none placeholder:text-neutral-500 focus-visible:ring-1 focus-visible:ring-violet-300/50" onChange={event => onChange(event.target.value)} placeholder={tx("Add notes for this slide…")} value={notes} />
    </section> : <button aria-expanded={open} className="mx-auto flex h-9 items-center gap-2 rounded-t-lg border border-b-0 border-white/10 bg-[#292929] px-4 text-xs text-neutral-300 hover:bg-[#333]" onClick={() => setOpen(true)} type="button"><MessageSquareText size={14} />{tx("Speaker notes")}{notes ? <span className="h-1 w-1 rounded-full bg-violet-300" /> : null}</button>}
  </aside>;
}
