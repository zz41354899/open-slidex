
import { SlidersHorizontal, X } from "lucide-react";
import { PitchInspector } from "@/features/pitch/ui/PitchInspector";
import type { PitchWorkspaceProps } from "@/features/pitch/ui/workspace/PitchWorkspaceTypes";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle
} from "@/common/ui/shadcnPrimitives";

type WorkspaceInspectorPanelProps = Pick<PitchWorkspaceProps, "commands" | "document" | "selection" | "view">;

export function WorkspaceInspectorPanel(props: WorkspaceInspectorPanelProps) {
  const { view } = props;
  const { tx } = usePitchI18n();

  return (
    <>
      {!view.hideInspector ? (
        <div className="hidden h-full md:flex">
          <PitchInspectorContent {...props} />
        </div>
      ) : null}

      <Dialog
        onOpenChange={view.setIsMobileInspectorOpen}
        open={view.isMobileInspectorOpen && !view.hideInspector}
      >
        <DialogContent
          aria-describedby={undefined}
          className="inset-y-0 left-auto right-0 top-0 z-[80] flex h-dvh w-[min(88vw,340px)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-l-[1.5rem] rounded-r-none border-y-0 border-l border-r-0 border-white/[0.12] bg-[#0a0a0a] p-0 shadow-[-24px_0_80px_rgba(0,0,0,0.72)] md:hidden"
          closeLabel={tx("Close options")}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.querySelector<HTMLElement>("[data-mobile-inspector-trigger]")?.focus();
          }}
          overlayClassName="md:hidden"
          showCloseButton={false}
        >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal size={16} className="text-[#8ea5ff]" />
                <div>
                  <DialogTitle className="text-sm font-semibold text-white">{tx("Options")}</DialogTitle>
                  <p className="text-[10px] text-neutral-500">{tx("Swipe right to close")}</p>
                </div>
              </div>
              <Button
                aria-label={tx("Close options")}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-400 transition active:scale-95 active:bg-white/[0.08] active:text-white"
                onClick={() => view.setIsMobileInspectorOpen(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X size={18} />
              </Button>
            </div>
            <PitchInspectorContent
              {...props}
              onOpenMdxEditor={() => {
                view.setIsMobileInspectorOpen(false);
                view.setIsCodeEditorOpen(true);
              }}
            />
        </DialogContent>
      </Dialog>
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
      distributeSelectedBlocks={commands.distributeSelectedBlocks}
      imageSourceRequiresAbsoluteUrl={commands.imageSourceRequiresAbsoluteUrl}
      inspectorExtension={view.inspectorExtension}
      localAssetsOnly={view.localAssetsOnly === true}
      importImageUrlForBlock={commands.importImageUrlForBlock}
      isGridVisible={view.isCanvasGridVisible}
      isSafeAreaVisible={view.isCanvasSafeAreaVisible}
      isSnapEnabled={view.isCanvasSnapEnabled}
      moveSelectedBlocksToEdge={commands.moveSelectedBlocksToEdge}
      onOpenMdxEditor={onOpenMdxEditor ?? (() => view.setIsCodeEditorOpen(true))}
      pushUndoSnapshot={commands.pushUndoSnapshot}
      removeImageForBlock={commands.removeImageForBlock}
      requestImageRemoval={commands.requestImageRemoval}
      requestImageUpload={commands.requestImageUpload}
      selectedBlockIndex={selection.selectedBlockIndex}
      selectedBlockIndices={selection.selectedBlockIndices}
      setIsGridVisible={view.setIsCanvasGridVisible}
      setIsSafeAreaVisible={view.setIsCanvasSafeAreaVisible}
      setIsSnapEnabled={view.setIsCanvasSnapEnabled}
      snapSelectedBlocksToGrid={commands.snapSelectedBlocksToGrid}
      updateActiveSlideStyle={commands.updateActiveSlideStyle}
      updateAllSlidesStyle={commands.updateAllSlidesStyle}
      updateBlock={commands.updateBlock}
      updateSelectedBlockColor={commands.updateSelectedBlockColor}
      uploadImageForBlock={commands.uploadImageForBlock}
      uploadVideoForBlock={commands.uploadVideoForBlock}
    />
  );
}
