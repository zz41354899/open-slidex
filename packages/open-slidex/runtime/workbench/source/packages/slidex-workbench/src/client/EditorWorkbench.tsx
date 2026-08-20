import { LoaderCircle, RefreshCw } from "lucide-react";

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
        <span>{tx("Opening presentation.mdx…")}</span>
      </main>
    );
  }

  if (!documentState.snapshot) {
    return (
      <main className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-black px-6 text-center text-neutral-300">
        <p>{documentState.message || tx("Could not open presentation.mdx.")}</p>
        <button className="secondary-button" onClick={() => void documentState.reload()} type="button"><RefreshCw size={14} /> {tx("Try again")}</button>
      </main>
    );
  }

  return <LocalMotionDocEditor documentState={documentState} />;
}
