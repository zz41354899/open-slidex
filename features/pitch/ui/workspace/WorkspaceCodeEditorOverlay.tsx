"use client";

import { Code2, X } from "lucide-react";
import { MdxEditorPane } from "@/features/pitch/ui/MdxEditorPane";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import type { PitchWorkspaceProps } from "@/features/pitch/ui/workspace/PitchWorkspaceTypes";

type WorkspaceCodeEditorOverlayProps = Pick<PitchWorkspaceProps, "commands" | "document" | "selection" | "view"> & {
  sceneCount: number;
};

export function WorkspaceCodeEditorOverlay({ commands, document, sceneCount, selection, view }: WorkspaceCodeEditorOverlayProps) {
  const { tx } = usePitchI18n();
  if (!view.isCodeEditorOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm transition-all" onMouseDown={() => view.setIsCodeEditorOpen(false)}>
      <div
        className="absolute inset-y-4 right-4 flex w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0814]/90 shadow-[-20px_0_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl md:max-w-[700px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Code2 className="text-[#a78bfa]" size={16} />
            <span className="text-sm font-semibold tracking-wide text-white">{tx("MDX Editor")}</span>
          </div>
          <button
            aria-label={tx("Close MDX editor")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-all hover:bg-white/10 hover:text-white"
            onClick={() => view.setIsCodeEditorOpen(false)}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
        <MdxEditorPane
          copySource={commands.copySource}
          onSelectionSourceChange={commands.updateSelectionMdx}
          onSourceChange={(value) => {
            commands.pushUndoSnapshot();
            commands.commitMdxSource(value);
          }}
          sceneCount={sceneCount}
          selectionLabel={selection.selectionMdx.label}
          selectionSource={selection.selectionMdx.source}
          source={document.source}
        />
      </div>
    </div>
  );
}
