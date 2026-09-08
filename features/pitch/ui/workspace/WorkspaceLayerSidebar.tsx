
import { lazy, memo, Suspense, useCallback, useState } from "react";
import { X } from "lucide-react";
import { LayerSidebar } from "@/features/pitch/ui/LayerSidebar";
import type { PitchWorkspaceProps } from "@/features/pitch/ui/workspace/PitchWorkspaceTypes";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import type { RemoteMcpOperation } from "@/features/pitch/domain/remoteMcpOperation";

let templateLibraryPanelPromise: Promise<typeof import("@/features/pitch/ui/sidebar/TemplateLibrarySlidePanel")> | undefined;

export function preloadTemplateLibrarySlidePanel() {
  templateLibraryPanelPromise ??= import("@/features/pitch/ui/sidebar/TemplateLibrarySlidePanel")
    .catch((error) => {
      templateLibraryPanelPromise = undefined;
      throw error;
    });
  return templateLibraryPanelPromise;
}

const TemplateLibrarySlidePanel = lazy(() => preloadTemplateLibrarySlidePanel().then((module) => ({
  default: module.TemplateLibrarySlidePanel
})));

function requestTemplateLibraryPreload() {
  void preloadTemplateLibrarySlidePanel().catch(() => undefined);
}

type WorkspaceLayerSidebarProps = Pick<PitchWorkspaceProps, "commands" | "document" | "selection" | "view"> & {
  onSelectSlide: (index: number) => void;
  remoteMcpOperations: readonly RemoteMcpOperation[];
};

export const WorkspaceLayerSidebar = memo(function WorkspaceLayerSidebar(props: WorkspaceLayerSidebarProps) {
  const { view } = props;
  const { locale, tx } = usePitchI18n();
  const [isSlideLibraryOpen, setIsSlideLibraryOpen] = useState(false);
  const templateLibraryEnabled = view.accessMode === "authenticated";
  const resolvedTemplateLibraryEnabled = !view.authoringDisabled && (view.templateLibraryEnabled ?? templateLibraryEnabled);
  const addSlideFromTemplate = props.commands.addSlideFromTemplate;
  const applyTemplateDeckCommand = props.commands.applyTemplateDeck;
  const insertSlideNearActive = props.commands.insertSlideNearActive;
  const setIsMobileSidebarOpen = view.setIsMobileSidebarOpen;

  const addBlankSlide = useCallback(() => {
    insertSlideNearActive("after");
    setIsMobileSidebarOpen(false);
  }, [insertSlideNearActive, setIsMobileSidebarOpen]);

  const handleAddSlide = useCallback(() => {
    if (!resolvedTemplateLibraryEnabled) {
      addBlankSlide();
      return;
    }
    setIsSlideLibraryOpen((current) => !current);
  }, [addBlankSlide, resolvedTemplateLibraryEnabled]);

  const addTemplateSlide = useCallback((templateId: string, templateSlideSource: string) => {
    addSlideFromTemplate(templateId, templateSlideSource);
    setIsMobileSidebarOpen(false);
  }, [addSlideFromTemplate, setIsMobileSidebarOpen]);

  const applyTemplateDeck = useCallback((templateId: string, templateSlideSources: string[]) => {
    applyTemplateDeckCommand(templateId, templateSlideSources);
    setIsSlideLibraryOpen(false);
    setIsMobileSidebarOpen(false);
  }, [applyTemplateDeckCommand, setIsMobileSidebarOpen]);

  return (
    <>
      <div aria-disabled={view.interactionDisabled} className={`hidden h-full md:flex ${view.interactionDisabled ? "pointer-events-none opacity-60" : ""}`} inert={view.interactionDisabled}>
        <LayerSidebarContent
          {...props}
          onAddSlide={handleAddSlide}
          templateLibraryEnabled={resolvedTemplateLibraryEnabled}
        />
        {isSlideLibraryOpen && resolvedTemplateLibraryEnabled ? (
          <Suspense fallback={<TemplateLibraryLoading label={tx("Loading templates…")} />}>
            <TemplateLibrarySlidePanel
              activeTemplateId={props.document.selectedTemplateId}
              locale={locale}
              onAddBlank={addBlankSlide}
              onAddTemplateSlide={addTemplateSlide}
              onApplyTemplateDeck={applyTemplateDeck}
              onClose={() => setIsSlideLibraryOpen(false)}
              replayNonce={view.replayNonce}
            />
          </Suspense>
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
          <Suspense fallback={<TemplateLibraryLoading label={tx("Loading templates…")} mobile />}>
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
          </Suspense>
        </div>
      ) : null}
    </>
  );
});

function TemplateLibraryLoading({ label, mobile = false }: { label: string; mobile?: boolean }) {
  return (
    <div
      aria-live="polite"
      className={`${mobile ? "h-full w-full" : "h-full w-[320px] border-l border-white/[0.08]"} flex items-center justify-center bg-[#111] px-6 text-center text-sm text-neutral-400`}
    >
      {label}
    </div>
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
      onPreloadTemplateLibrary={templateLibraryEnabled ? requestTemplateLibraryPreload : undefined}
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
      templateLibraryEnabled={templateLibraryEnabled}
      toggleBlockPositionLock={commands.toggleBlockPositionLock}
      unlinkSharedMorphGroup={commands.unlinkSharedMorphGroup}
    />
  );
}
