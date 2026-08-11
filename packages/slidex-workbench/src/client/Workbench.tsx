import { RefreshCw } from "lucide-react";

import { LocalMotionDocEditor } from "./LocalMotionDocEditor";
import { useLocalDocument } from "./useLocalDocument";

export function Workbench() {
  const documentState = useLocalDocument();

  if (!documentState.snapshot && documentState.saveState === "loading") {
    return <main className="flex h-[100dvh] items-center justify-center bg-black text-sm text-neutral-500">Opening presentation.mdx…</main>;
  }

  if (!documentState.snapshot) {
    return (
      <main className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-black px-6 text-center text-neutral-300">
        <p>{documentState.message || "Could not open presentation.mdx."}</p>
        <button className="secondary-button" onClick={() => void documentState.reload()} type="button"><RefreshCw size={14} /> Try again</button>
      </main>
    );
  }

  return <LocalMotionDocEditor documentState={documentState} />;
}
