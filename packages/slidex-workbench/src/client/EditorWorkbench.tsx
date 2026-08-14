import { RefreshCw } from "lucide-react";

import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { LocalMotionDocEditor } from "./LocalMotionDocEditor";
import { useLocalDocument } from "./useLocalDocument";

export default function EditorWorkbench() {
  const documentState = useLocalDocument();
  const { tx } = usePitchI18n();

  if (!documentState.snapshot && documentState.saveState === "loading") {
    return <main className="flex h-[100dvh] items-center justify-center bg-black text-sm text-neutral-500">{tx("Opening presentation.mdx…")}</main>;
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
