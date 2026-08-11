"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { PitchInspector } from "@/features/pitch/ui/PitchInspector";
import type { PitchWorkspaceProps } from "@/features/pitch/ui/workspace/PitchWorkspaceTypes";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type WorkspaceInspectorPanelProps = Pick<PitchWorkspaceProps, "commands" | "document" | "selection" | "view">;

export function WorkspaceInspectorPanel(props: WorkspaceInspectorPanelProps) {
  const { view } = props;
  const { locale, tx } = usePitchI18n();

  return (
    <>
      {!view.hideInspector ? (
        <div className="hidden h-full md:flex">
          <PitchInspectorContent {...props} />
        </div>
      ) : null}

      {view.isMobileInspectorOpen && !view.hideInspector ? (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => view.setIsMobileInspectorOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-[80] flex w-[min(88vw,340px)] flex-col overflow-hidden rounded-l-[1.5rem] border-l border-white/[0.12] bg-[#0a0a0a] shadow-[-24px_0_80px_rgba(0,0,0,0.72)] md:hidden" aria-label={tx("Options")}>
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal size={16} className="text-[#8ea5ff]" />
                <div>
                  <p className="text-sm font-semibold text-white">{tx("Options")}</p>
                  <p className="text-[10px] text-neutral-500">{locale === "zh-TW" ? "向右滑動即可關閉" : "Swipe right to close"}</p>
                </div>
              </div>
              <button
                aria-label={locale === "zh-TW" ? "關閉選項" : "Close options"}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-400 transition active:scale-95 active:bg-white/[0.08] active:text-white"
                onClick={() => view.setIsMobileInspectorOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <PitchInspectorContent
              {...props}
              onOpenMdxEditor={() => {
                view.setIsMobileInspectorOpen(false);
                view.setIsCodeEditorOpen(true);
              }}
            />
          </aside>
        </>
      ) : null}
    </>
  );
}

type PitchInspectorContentProps = WorkspaceInspectorPanelProps & {
  onOpenMdxEditor?: () => void;
};

function PitchInspectorContent({ commands, document, onOpenMdxEditor, selection, view }: PitchInspectorContentProps) {
  return (
    <PitchInspector
      activeSlide={document.activeSlide}
      activeSlideAccent={document.activeSlideAccent}
      activeSlideBackground={document.activeSlideBackground}
      activeSlideMutedColor={document.activeSlideMutedColor}
      activeSlideShader={document.activeSlideShader}
      activeSlideShaderAngle={document.activeSlideShaderAngle}
      activeSlideShaderColor1={document.activeSlideShaderColor1}
      activeSlideShaderColor2={document.activeSlideShaderColor2}
      activeSlideShaderColor3={document.activeSlideShaderColor3}
      activeSlideShaderColor4={document.activeSlideShaderColor4}
      activeSlideShaderColor5={document.activeSlideShaderColor5}
      activeSlideShaderColor6={document.activeSlideShaderColor6}
      activeSlideShaderDetail={document.activeSlideShaderDetail}
      activeSlideShaderEngine={document.activeSlideShaderEngine}
      activeSlideShaderIntensity={document.activeSlideShaderIntensity}
      activeSlideShaderPreset={document.activeSlideShaderPreset}
      activeSlideShaderScale={document.activeSlideShaderScale}
      activeSlideShaderSoftness={document.activeSlideShaderSoftness}
      activeSlideShaderSpeed={document.activeSlideShaderSpeed}
      activeSlideTextColor={document.activeSlideTextColor}
      activeSlideTheme={document.activeSlideTheme}
      addSlideWithLayout={commands.addSlideWithLayout}
      alignSelectedBlocks={commands.alignSelectedBlocks}
      imageSourceRequiresAbsoluteUrl={commands.imageSourceRequiresAbsoluteUrl}
      inspectorExtension={view.inspectorExtension}
      localAssetsOnly={view.localAssetsOnly === true}
      importImageUrlForBlock={commands.importImageUrlForBlock}
      isGridVisible={view.isCanvasGridVisible}
      isSnapEnabled={view.isCanvasSnapEnabled}
      onOpenMdxEditor={onOpenMdxEditor ?? (() => view.setIsCodeEditorOpen(true))}
      pushUndoSnapshot={commands.pushUndoSnapshot}
      removeImageForBlock={commands.removeImageForBlock}
      requestImageRemoval={commands.requestImageRemoval}
      requestImageUpload={commands.requestImageUpload}
      selectedBlockIndex={selection.selectedBlockIndex}
      selectedBlockIndices={selection.selectedBlockIndices}
      setIsGridVisible={view.setIsCanvasGridVisible}
      setIsSnapEnabled={view.setIsCanvasSnapEnabled}
      updateActiveSlideStyle={commands.updateActiveSlideStyle}
      updateAllSlidesStyle={commands.updateAllSlidesStyle}
      updateBlock={commands.updateBlock}
      updateSelectedBlockColor={commands.updateSelectedBlockColor}
      uploadImageForBlock={commands.uploadImageForBlock}
    />
  );
}
