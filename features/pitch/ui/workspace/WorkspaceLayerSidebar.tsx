
import { useState } from "react";
import { X } from "lucide-react";
import { LayerSidebar } from "@/features/pitch/ui/LayerSidebar";
import { TemplateLibrarySlidePanel } from "@/features/pitch/ui/sidebar/TemplateLibrarySlidePanel";
import type { PitchWorkspaceProps } from "@/features/pitch/ui/workspace/PitchWorkspaceTypes";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import type { RemoteMcpOperation } from "@/features/pitch/domain/remoteMcpOperation";

type WorkspaceLayerSidebarProps = Pick<PitchWorkspaceProps, "commands" | "document" | "selection" | "view"> & {
  onSelectSlide: (index: number) => void;
  remoteMcpOperations: readonly RemoteMcpOperation[];
};

export function WorkspaceLayerSidebar(props: WorkspaceLayerSidebarProps) {
  const { view } = props;
  const { locale, tx } = usePitchI18n();
  const [isSlideLibraryOpen, setIsSlideLibraryOpen] = useState(false);
  const templateLibraryEnabled = view.accessMode === "authenticated";
  const resolvedTemplateLibraryEnabled = !view.authoringDisabled && (view.templateLibraryEnabled ?? templateLibraryEnabled);

  function addBlankSlide() {
    props.commands.insertSlideNearActive("after");
    view.setIsMobileSidebarOpen(false);
  }

  function handleAddSlide() {
    if (!resolvedTemplateLibraryEnabled) {
      addBlankSlide();
      return;
    }
    setIsSlideLibraryOpen((current) => !current);
  }

  function addTemplateSlide(templateId: string, templateSlideSource: string) {
    props.commands.addSlideFromTemplate(templateId, templateSlideSource);
    view.setIsMobileSidebarOpen(false);
  }

  function applyTemplateDeck(templateId: string, templateSlideSources: string[]) {
    props.commands.applyTemplateDeck(templateId, templateSlideSources);
    setIsSlideLibraryOpen(false);
    view.setIsMobileSidebarOpen(false);
  }

  return (
    <>
      <div aria-disabled={view.interactionDisabled} className={`hidden h-full md:flex ${view.interactionDisabled ? "pointer-events-none opacity-60" : ""}`} inert={view.interactionDisabled}>
        <LayerSidebarContent
          {...props}
          onAddSlide={handleAddSlide}
          templateLibraryEnabled={resolvedTemplateLibraryEnabled}
        />
        {isSlideLibraryOpen && resolvedTemplateLibraryEnabled ? (
          <TemplateLibrarySlidePanel
            activeTemplateId={props.document.selectedTemplateId}
            locale={locale}
            onAddBlank={addBlankSlide}
            onAddTemplateSlide={addTemplateSlide}
            onApplyTemplateDeck={applyTemplateDeck}
            onClose={() => setIsSlideLibraryOpen(false)}
            replayNonce={view.replayNonce}
          />
        ) : null}
      </div>

      {view.isMobileSidebarOpen ? (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => view.setIsMobileSidebarOpen(false)}
          />
          <aside className={`fixed inset-y-0 left-0 z-[80] flex w-[min(88vw,340px)] flex-col overflow-hidden rounded-r-[1.5rem] border-r border-white/[0.12] bg-[#0a0a0a] shadow-[24px_0_80px_rgba(0,0,0,0.72)] md:hidden ${view.interactionDisabled ? "pointer-events-none opacity-60" : ""}`} inert={view.interactionDisabled} aria-label={tx("Slides & Layers")}>
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
              <div>
                <p className="text-sm font-semibold text-white">{tx("Slides & Layers")}</p>
                <p className="text-[10px] text-neutral-500">{locale === "zh-TW" ? "向左滑動即可關閉" : "Swipe left to close"}</p>
              </div>
              <button
                aria-label={locale === "zh-TW" ? "關閉投影片與圖層" : "Close slides and layers"}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-400 transition active:scale-95 active:bg-white/[0.08] active:text-white"
                onClick={() => view.setIsMobileSidebarOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <LayerSidebarContent
              {...props}
              onAddSlide={handleAddSlide}
              onSelectSlide={(index) => {
                props.onSelectSlide(index);
                view.setIsMobileSidebarOpen(false);
              }}
              templateLibraryEnabled={resolvedTemplateLibraryEnabled}
            />
          </aside>
        </>
      ) : null}

      {isSlideLibraryOpen && resolvedTemplateLibraryEnabled && view.isMobileSidebarOpen ? (
        <div className="fixed inset-0 z-[90] md:hidden">
          <TemplateLibrarySlidePanel
            activeTemplateId={props.document.selectedTemplateId}
            isMobile
            locale={locale}
            onAddBlank={addBlankSlide}
            onAddTemplateSlide={addTemplateSlide}
            onApplyTemplateDeck={applyTemplateDeck}
            onClose={() => setIsSlideLibraryOpen(false)}
            replayNonce={view.replayNonce}
          />
        </div>
      ) : null}
    </>
  );
}

type LayerSidebarContentProps = WorkspaceLayerSidebarProps & {
  onAddSlide: () => void;
  templateLibraryEnabled: boolean;
};

function LayerSidebarContent({
  commands,
  document,
  onAddSlide,
  onSelectSlide,
  remoteMcpOperations,
  selection,
  templateLibraryEnabled,
  view
}: LayerSidebarContentProps) {
  return (
    <LayerSidebar
      activeSlideIndex={document.activeSlideIndex}
      authoringDisabled={view.authoringDisabled === true}
      copySlide={commands.copySlide}
      deleteBlock={commands.deleteBlock}
      deleteSlide={commands.deleteSlide}
      duplicateSlide={commands.duplicateSlide}
      draggedBlockIndex={selection.draggedBlockIndex}
      dragOverBlockIndex={selection.dragOverBlockIndex}
      moveBlock={commands.moveBlock}
      moveBlockToEdge={commands.moveBlockToEdge}
      moveSlideIntoMorphGroup={commands.moveSlideIntoMorphGroup}
      moveSlideOutOfMorphGroup={commands.moveSlideOutOfMorphGroup}
      onAddSlide={onAddSlide}
      onSelectBlock={selection.selectBlockFromLayer}
      onSelectSlide={onSelectSlide}
      renameBlock={commands.renameBlock}
      remoteMcpOperations={remoteMcpOperations}
      reorderBlock={commands.reorderBlock}
      reorderSlide={commands.reorderSlide}
      replayNonce={view.replayNonce}
      scenes={document.scenes}
      selectedBlockIndex={selection.selectedBlockIndex}
      selectedBlockIndices={selection.selectedBlockIndices}
      setDraggedBlockIndex={selection.setDraggedBlockIndex}
      setDragOverBlockIndex={selection.setDragOverBlockIndex}
      slideRows={document.slideRows}
      source={document.canvasSource}
      templateLibraryEnabled={templateLibraryEnabled}
      toggleBlockPositionLock={commands.toggleBlockPositionLock}
      unlinkSharedMorphGroup={commands.unlinkSharedMorphGroup}
    />
  );
}
