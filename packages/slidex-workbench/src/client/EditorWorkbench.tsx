import { ArrowUpRight, LoaderCircle, RefreshCw } from "lucide-react";

import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { LocalMotionDocEditor } from "./LocalMotionDocEditor";
import { useLocalDocument } from "./useLocalDocument";

export default function EditorWorkbench() {
  const documentState = useLocalDocument();
  const { tx } = usePitchI18n();

  if (!documentState.snapshot && documentState.saveState === "loading") {
    return (
      <main aria-busy="true" className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-black text-sm text-neutral-500">
        <LoaderCircle aria-hidden="true" className="animate-spin text-[#a78bfa]" size={22} />
        <span>{tx("Opening presentation.tsx…")}</span>
      </main>
    );
  }

  if (!documentState.snapshot) {
    return (
      <main className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-black px-6 text-center text-neutral-300">
        <p>{documentState.message || tx("Could not open presentation.tsx.")}</p>
        <button className="secondary-button" onClick={() => void documentState.reload()} type="button"><RefreshCw size={14} /> {tx("Try again")}</button>
      </main>
    );
  }

  if (documentState.snapshot.requiresMigration) {
    return (
      <main className="flex h-[100dvh] items-center justify-center bg-black px-6 text-neutral-200">
        <section className="max-w-lg rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a78bfa]">Legacy MDX</p>
          <h1 className="mt-3 text-2xl font-semibold">{tx("Upgrade to React")}</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-400">{tx("This deck will become presentation.tsx. The original presentation.mdx is kept as a read-only backup in .open-slidex/legacy/.")}</p>
          {documentState.message ? <p className="mt-3 text-sm text-rose-300">{documentState.message}</p> : null}
          <button className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#7c3aed] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#8b5cf6] disabled:opacity-50" disabled={documentState.saveState === "saving"} onClick={() => void documentState.migrateLegacy()} type="button">
            {documentState.saveState === "saving" ? <LoaderCircle className="animate-spin" size={15} /> : <ArrowUpRight size={15} />}
            {tx("Upgrade to React")}
          </button>
        </section>
      </main>
    );
  }

  return <LocalMotionDocEditor documentState={documentState} />;
}
