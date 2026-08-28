
import { Bot, ChevronDown, ChevronRight, Copy, Diamond, Group, Layers, Link2, MoreHorizontal, MousePointerClick, Plus, Trash2, Unlink2 } from "lucide-react";
import type { DragEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { LayerRow } from "@/features/pitch/ui/LayerRow";
import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import type { MotionDocBlock, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { interactionFromProps } from "@/core/motion-doc/domain/interaction";
import { SlideThumbnailPreview } from "@/features/pitch/ui/preview/SlideThumbnailPreview";
import type { SlideRow } from "@/features/pitch/application/slideRows";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { EditorPanelTabs } from "@/common/ui/editor/EditorPrimitives";
import {
  remoteMcpOperationAction,
  remoteMcpOperationTargetsSlide
} from "@/features/pitch/application/remoteMcpOperation";
import type { RemoteMcpOperation } from "@/features/pitch/domain/remoteMcpOperation";

export function LayerSidebar({
  activeSlideIndex,
  authoringDisabled = false,
  copySlide,
  deleteBlock,
  deleteSlide,
  duplicateSlide,
  draggedBlockIndex,
  dragOverBlockIndex,
  moveBlock,
  moveBlockToEdge,
  moveSlideIntoMorphGroup,
  moveSlideOutOfMorphGroup,
  onAddSlide,
  onSelectBlock,
  onSelectSlide,
  reorderBlock,
  reorderSlide,
  renameBlock,
  remoteMcpOperations,
  replayNonce,
  scenes,
  selectedBlockIndex,
  selectedBlockIndices,
  setDragOverBlockIndex,
  setDraggedBlockIndex,
  slideRows,
  source,
  templateLibraryEnabled,
  toggleBlockPositionLock,
  unlinkSharedMorphGroup
}: {
  activeSlideIndex: number;
  authoringDisabled?: boolean;
  copySlide: (index: number) => void;
  deleteBlock: (index: number) => void;
  deleteSlide: (index: number) => void;
  duplicateSlide: (index: number) => void;
  draggedBlockIndex: number | null;
  dragOverBlockIndex: number | null;
  moveBlock: (index: number, direction: -1 | 1) => void;
  moveBlockToEdge: (index: number, edge: "back" | "front") => void;
  moveSlideIntoMorphGroup: (slideIndex: number, groupStartIndex: number) => void;
  moveSlideOutOfMorphGroup: (slideIndex: number, targetSlideIndex: number) => void;
  onAddSlide: () => void;
  onSelectBlock: (index: number, event: MouseEvent<HTMLDivElement>, target?: "group" | "layer") => void;
  onSelectSlide: (index: number) => void;
  reorderBlock: (fromIndex: number, toIndex: number) => void;
  reorderSlide: (fromIndex: number, toIndex: number) => void;
  renameBlock: (index: number, name: string) => void;
  remoteMcpOperations: readonly RemoteMcpOperation[];
  replayNonce: number;
  scenes: MotionDocScene[];
  selectedBlockIndex: number | null;
  selectedBlockIndices: number[];
  setDragOverBlockIndex: (index: number | null) => void;
  setDraggedBlockIndex: (index: number | null) => void;
  slideRows: SlideRow[];
  source: string;
  templateLibraryEnabled: boolean;
  toggleBlockPositionLock: (index: number) => void;
  unlinkSharedMorphGroup: (startIndex: number, endIndex: number) => void;
}) {
  const { tx, locale } = usePitchI18n();
  const [activeTab, setActiveTab] = useState<"slides" | "layers">("slides");
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const draggedSlideIndexRef = useRef<number | null>(null);
  const [dragOverSlideIndex, setDragOverSlideIndex] = useState<number | null>(null);
  const [dragOverMorphGroupStart, setDragOverMorphGroupStart] = useState<number | null>(null);
  const [isMorphExitDropTarget, setIsMorphExitDropTarget] = useState(false);
  const [expandedMorphGroups, setExpandedMorphGroups] = useState<Set<number>>(() => new Set());
  const [openMorphMenu, setOpenMorphMenu] = useState<number | null>(null);

  useEffect(() => {
    if (authoringDisabled) setActiveTab("slides");
  }, [authoringDisabled]);

  function handleSlideShortcut(event: KeyboardEvent<HTMLDivElement>, slideIndex: number) {
    if (authoringDisabled) return;
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "c") return;

    event.preventDefault();
    event.stopPropagation();
    onSelectSlide(slideIndex);
    copySlide(slideIndex);
  }

  function draggedSlideFrom(event: DragEvent<HTMLElement>) {
    const transferValue = event.dataTransfer.getData("application/x-slidex-slide");
    const transferIndex = transferValue ? Number(transferValue) : Number.NaN;
    return draggedSlideIndex ?? draggedSlideIndexRef.current ?? (Number.isInteger(transferIndex) && transferIndex >= 0 ? transferIndex : null);
  }

  function beginSlideDrag(event: DragEvent<HTMLElement>, slideIndex: number) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-slidex-slide", String(slideIndex));
    draggedSlideIndexRef.current = slideIndex;
    setDraggedSlideIndex(slideIndex);
  }

  function finishSlideDrag() {
    draggedSlideIndexRef.current = null;
    setDraggedSlideIndex(null);
    setDragOverSlideIndex(null);
    setDragOverMorphGroupStart(null);
    setIsMorphExitDropTarget(false);
  }

  function clearMorphDropTarget() {
    setDragOverMorphGroupStart(null);
  }

  return (
    <div id="sidebar-v4" className="editor-readable-sidebar relative z-10 flex h-full w-full shrink-0 select-none flex-col overflow-hidden bg-[#171717] transition-all duration-300 md:w-[265px] md:border-r md:border-white/[0.08]">
      {/* Sidebar Header / Tabs */}
      <EditorPanelTabs
        ariaLabel={tx("Slides & Layers")}
        onChange={setActiveTab}
        options={authoringDisabled
          ? [{ label: tx("Slides"), value: "slides" }]
          : [{ label: tx("Slides"), value: "slides" }, { label: tx("Layers"), value: "layers" }]}
        value={activeTab}
      />

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col p-3">

          {/* New Slide Button */}
          {!authoringDisabled ? <div className="mb-6 grid grid-cols-[1fr_auto] gap-2">
            <button
              className="group flex items-center justify-between rounded-[1rem] border border-white/[0.04] bg-white/[0.02] p-3.5 text-left text-neutral-400 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/[0.06] hover:text-white active:scale-[0.96]"
              data-slide-library-trigger={templateLibraryEnabled ? "" : undefined}
              onClick={onAddSlide}
              type="button"
            >
              <span className="flex items-center gap-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/20 border border-white/[0.08] text-white shadow-inner transition-transform duration-500 group-hover:scale-110">
                  <Plus size={14} className="stroke-[2]" />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-[14px] font-bold text-white leading-none">{tx("New Slide")}</span>
                  <span className="text-[14px] text-neutral-500 leading-none">
                    {tx(templateLibraryEnabled ? "Templates & blank" : "Blank slide")}
                  </span>
                </span>
              </span>
              {templateLibraryEnabled ? (
                <ChevronRight className="mr-1 text-neutral-500 transition-transform group-hover:translate-x-0.5" size={14} />
              ) : null}
            </button>
            <button
              aria-label={locale === "zh-TW" ? "從目前投影片複製" : "Duplicate current slide"}
              className="flex w-11 items-center justify-center rounded-[1rem] border border-white/[0.05] bg-white/[0.025] text-neutral-500 transition hover:border-[#8ea5ff]/30 hover:bg-[#8ea5ff]/10 hover:text-[#bac6ff] active:scale-95"
              onClick={() => duplicateSlide(activeSlideIndex)}
              title={locale === "zh-TW" ? "從目前投影片複製" : "Duplicate current slide"}
              type="button"
            >
              <Copy size={15} />
            </button>
          </div> : null}

          {/* Section Indicator */}
          <div className="mb-2 flex items-center justify-between px-1.5">
            <span className="text-[14px] font-semibold text-neutral-400">{tx("Scenes")}</span>
            <span className="font-mono text-[14px] font-medium text-neutral-500">{scenes.length}</span>
          </div>

          {/* Slides List Grid */}
          <div className="flex flex-col gap-1">
            {slideRows.map((slide) => {
              const isActive = slide.index === activeSlideIndex;
              const currentSlide = scenes[slide.index];
              const morphRole = slideMorphRole(scenes, slide.index);
              const morphGroup = morphGroupStartingAt(scenes, slideRows, slide.index);
              if (activeTab === "slides" && !morphGroup && slide.index > 0 && scenes[slide.index - 1]?.props.slideTransition === "morph") return null;
              const mcpActivity = remoteMcpOperations.find((activity) => (
                remoteMcpOperationTargetsSlide(activity, slide.index, activeSlideIndex)
              ));
              if (activeTab === "slides" && morphGroup) {
                const isExpanded = expandedMorphGroups.has(morphGroup.startIndex);
                return (
                  <MorphSlideGroup
                    activeSlideIndex={activeSlideIndex}
                    authoringDisabled={authoringDisabled}
                    expanded={isExpanded}
                    group={morphGroup}
                    key={`morph-${morphGroup.startIndex}`}
                    locale={locale}
                    menuOpen={openMorphMenu === morphGroup.startIndex}
                    dragOver={dragOverMorphGroupStart === morphGroup.startIndex}
                    onEdit={() => {
                      onSelectSlide(morphGroup.startIndex);
                      setOpenMorphMenu(null);
                    }}
                    onDragEnd={finishSlideDrag}
                    onDragLeave={clearMorphDropTarget}
                    onDragOver={(event) => {
                      if (authoringDisabled) return;
                      const draggedIndex = draggedSlideFrom(event);
                      if (draggedIndex === null || draggedIndex >= morphGroup.startIndex && draggedIndex <= morphGroup.endIndex) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDragOverMorphGroupStart(morphGroup.startIndex);
                    }}
                    onDrop={(event) => {
                      if (authoringDisabled) return;
                      const draggedIndex = draggedSlideFrom(event);
                      event.preventDefault();
                      if (draggedIndex !== null && (draggedIndex < morphGroup.startIndex || draggedIndex > morphGroup.endIndex)) {
                        moveSlideIntoMorphGroup(draggedIndex, morphGroup.startIndex);
                      }
                      finishSlideDrag();
                    }}
                    onSlideDragStart={beginSlideDrag}
                    onSelectSlide={onSelectSlide}
                    onToggleExpanded={() => setExpandedMorphGroups((current) => {
                      const next = new Set(current);
                      if (next.has(morphGroup.startIndex)) next.delete(morphGroup.startIndex);
                      else next.add(morphGroup.startIndex);
                      return next;
                    })}
                    onToggleMenu={() => setOpenMorphMenu((current) => current === morphGroup.startIndex ? null : morphGroup.startIndex)}
                    onUnlink={() => {
                      unlinkSharedMorphGroup(morphGroup.startIndex, morphGroup.endIndex);
                      setOpenMorphMenu(null);
                    }}
                    replayNonce={replayNonce}
                    tx={tx}
                  />
                );
              }
              return (
                <div className="flex flex-col" key={slide.index}>

                  {/* Scene Row item (Layers Tab) */}
                  {!authoringDisabled && activeTab === "layers" && (
                    <div
                      className={`group/item flex cursor-pointer items-center justify-between rounded-[0.85rem] px-3 py-2.5 transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] relative ${
                        isActive
                          ? "bg-white/[0.08] text-white shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.05)] border border-white/[0.04]"
                          : "text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200 border border-transparent"
                      } ${mcpActivity ? `border-[#8b5cf6]/70 ${mcpActivity.status === "running" ? "motion-safe:animate-pulse" : "motion-safe:animate-[mcp-activity-settle_6s_ease-out_forwards]"} ${mcpActivity.status === "failed" ? "border-dashed" : "border-solid"}` : ""}`}
                      onClick={() => onSelectSlide(slide.index)}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        {morphRole ? <Diamond aria-label={locale === "zh-TW" ? "Morph 投影片" : "Morph slide"} className={morphRole === "root" ? "fill-violet-400/35 text-violet-300" : "text-violet-400/75"} size={11} /> : <Layers size={13} className={isActive ? "text-[#8ea5ff]" : "text-neutral-500 group-hover:text-neutral-300 transition-colors"} />}
                        <span className={`truncate text-sm font-medium ${isActive ? "text-white" : "text-neutral-400 group-hover:text-neutral-200"}`}>
                          {tx("Slide")} {slide.index + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        {mcpActivity ? <Bot aria-label={`AI · ${mcpActivity.clientName}`} className="h-3.5 w-3.5 text-[#a78bfa]" /> : null}
                        <span className="font-mono text-[14px] font-semibold text-neutral-400/80 bg-neutral-900/40 px-2 py-0.5 rounded-lg border border-white/[0.04]">
                          {slide.duration}s
                        </span>
                        {scenes.length > 1 && (
                          <button
                            aria-label={locale === "zh-TW" ? `刪除第 ${slide.index + 1} 張投影片` : `Delete slide ${slide.index + 1}`}
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-red-300/80 transition active:scale-95 active:bg-red-500/15 sm:h-auto sm:w-auto sm:rounded-none sm:text-neutral-500 sm:opacity-0 sm:hover:text-red-400 sm:group-hover/item:opacity-100"
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteSlide(slide.index);
                            }}
                            type="button"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Scene Thumbnail (Slides Tab) */}
                  {activeTab === "slides" && (
                    <div
                      aria-label={locale === "zh-TW" ? `第 ${slide.index + 1} 張投影片` : `Slide ${slide.index + 1}`}
                      data-slide-thumbnail-index={slide.index}
                      draggable={!authoringDisabled}
                      onDragStart={(e) => {
                        if (authoringDisabled) return;
                        beginSlideDrag(e, slide.index);
                      }}
                      onDragOver={(e) => {
                        if (authoringDisabled) return;
                        e.preventDefault();
                        const draggedIndex = draggedSlideFrom(e);
                        if (draggedIndex !== null && draggedIndex !== slide.index) {
                          setDragOverSlideIndex(slide.index);
                        }
                      }}
                      onDragLeave={() => {
                        setDragOverSlideIndex(null);
                      }}
                      onDrop={(e) => {
                        if (authoringDisabled) return;
                        e.preventDefault();
                        const draggedIndex = draggedSlideFrom(e);
                        const draggedGroupStart = draggedIndex === null ? null : morphGroupStartContaining(scenes, draggedIndex);
                        if (draggedIndex !== null && draggedIndex !== slide.index) {
                          if (draggedGroupStart !== null) moveSlideOutOfMorphGroup(draggedIndex, slide.index);
                          else reorderSlide(draggedIndex, slide.index);
                        }
                        finishSlideDrag();
                      }}
                      onDragEnd={() => {
                        finishSlideDrag();
                      }}
                      className={`relative flex flex-col p-2 pb-6 mb-2 rounded-xl outline-none transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#8ea5ff]/70 ${
                        isActive ? "bg-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" : "hover:bg-white/[0.04]"
                      } ${dragOverSlideIndex === slide.index ? (draggedSlideIndex! < slide.index ? "border-b-2 border-b-[#8ea5ff] border-b-solid" : "border-t-2 border-t-[#8ea5ff] border-t-solid") : ""}`}
                      onClick={() => onSelectSlide(slide.index)}
                      onKeyDown={(event) => handleSlideShortcut(event, slide.index)}
                      role="button"
                      tabIndex={0}
                      title={authoringDisabled
                        ? (locale === "zh-TW" ? "點選以預覽這一頁 HTML" : "Select to preview this HTML page")
                        : (locale === "zh-TW" ? "點選後可用 ⌘C／⌘V 複製貼上投影片" : "Select, then use Cmd/Ctrl+C and Cmd/Ctrl+V to copy and paste")}
                    >
                      {morphRole ? (
                        <div className="pointer-events-none absolute left-0 top-0 z-20 flex h-full w-5 flex-col items-center" title={locale === "zh-TW" ? "Morph 連續投影片" : "Morph continuation"}>
                          {morphRole !== "root" ? <span className="h-2.5 w-px bg-violet-400/45" /> : <span className="h-2.5" />}
                          <span className={`flex h-4 w-4 items-center justify-center rounded-md border bg-[#20172d] shadow-[0_0_12px_rgba(139,92,246,.24)] ${morphRole === "root" ? "border-violet-300/60" : "border-violet-500/35"}`}>
                            <Diamond className={morphRole === "root" ? "fill-violet-400/45 text-violet-200" : "text-violet-300/80"} size={8} />
                          </span>
                          {morphRole !== "end" ? <span className="min-h-0 flex-1 w-px bg-violet-400/45" /> : null}
                        </div>
                      ) : null}
                      {isActive && <div className="absolute left-0 top-3 bottom-8 w-[3px] rounded-r bg-[#8ea5ff] z-10" />}
                      <div className={`relative aspect-video w-full overflow-hidden rounded-lg border shadow-sm transition-colors ${isActive ? "border-white/20 bg-black/60" : "border-white/5 bg-black/40 hover:border-white/10"}`}>
                        <SlideThumbnailPreview
                          activeSlideIndex={slide.index}
                          eager={isActive}
                          replayNonce={replayNonce}
                          scene={currentSlide}
                        />
                        {mcpActivity ? (
                          <div className={`pointer-events-none absolute inset-0 z-10 rounded-lg border-2 border-[#8b5cf6] shadow-[inset_0_0_0_1px_rgba(139,92,246,0.22),0_0_18px_rgba(139,92,246,0.2)] ${mcpActivity.status === "running" ? "motion-safe:animate-pulse" : "motion-safe:animate-[mcp-activity-settle_6s_ease-out_forwards]"} ${mcpActivity.status === "failed" ? "border-dashed" : "border-solid"}`}>
                            <div className="absolute bottom-1 left-1 flex max-w-[calc(100%-8px)] items-center gap-1 rounded bg-[#2e1065]/92 px-1.5 py-0.5 text-[14px] leading-4 text-[#ede9fe]">
                              <Bot className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate font-semibold">AI · {mcpActivity.clientName}</span>
                              <span className="truncate text-[#ddd6fe]/65">{remoteMcpOperationAction(mcpActivity, locale)}</span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <span className={`absolute bottom-1.5 left-2.5 text-[14px] font-medium ${isActive ? "text-[#8ea5ff]" : "text-neutral-500"}`}>
                        {slide.index + 1}
                      </span>
                      {!authoringDisabled ? <button
                        aria-label={locale === "zh-TW" ? `複製第 ${slide.index + 1} 張投影片` : `Duplicate slide ${slide.index + 1}`}
                        className="absolute bottom-1 right-8 z-20 flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 opacity-0 transition hover:bg-white/[0.08] hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          duplicateSlide(slide.index);
                        }}
                        title={locale === "zh-TW" ? "複製投影片" : "Duplicate slide"}
                        type="button"
                      >
                        <Copy size={12} />
                      </button> : null}
                      {!authoringDisabled && scenes.length > 1 && (
                        <button
                          aria-label={locale === "zh-TW" ? `刪除第 ${slide.index + 1} 張投影片` : `Delete slide ${slide.index + 1}`}
                          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.1] bg-black/70 text-red-300 shadow-lg backdrop-blur transition active:scale-95 active:bg-red-500/20 sm:right-2 sm:top-auto sm:bottom-1.5 sm:h-auto sm:w-auto sm:rounded-none sm:border-0 sm:bg-transparent sm:text-black/40 sm:opacity-0 sm:shadow-none sm:backdrop-blur-none sm:hover:text-white sm:group-hover:opacity-100"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteSlide(slide.index);
                          }}
                          type="button"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Active layers child lists */}
                  {!authoringDisabled && activeTab === "layers" && isActive && currentSlide && currentSlide.blocks.length > 0 && (
                    <div className="ml-3 mt-2 animate-[bubble-appear_0.2s_ease-out]">
                      <div className="flex flex-col gap-1 border-l border-white/[0.07] pl-2.5">
                        {layerTreeEntries(currentSlide.blocks).map((entry) => {
                        if (entry.kind === "group") {
                          const isGroupSelected = entry.layers.every(({ blockIndex }) => selectedBlockIndices.includes(blockIndex));
                          return (
                            <div className={`overflow-hidden rounded-xl border transition-colors ${isGroupSelected ? "border-[#8ea5ff]/45 bg-[#8ea5ff]/[0.08]" : "border-white/[0.07] bg-white/[0.018]"}`} key={entry.id}>
                              <div
                                aria-pressed={isGroupSelected}
                                className="flex h-10 cursor-pointer items-center gap-2 border-b border-white/[0.06] px-3 text-[14px] font-semibold text-neutral-300 outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-[#8ea5ff]/65"
                                onClick={(event) => onSelectBlock(entry.layers[0].blockIndex, event, "group")}
                                role="button"
                                tabIndex={0}
                                title={locale === "zh-TW" ? "選取整個群組" : "Select group"}
                              >
                                <Group className="text-[#8ea5ff]" size={13} />
                                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                                <span className="font-mono text-[14px] text-neutral-500">{entry.layers.length}</span>
                              </div>
                              <div className="flex flex-col gap-0.5 p-1.5 pl-3">
                                {entry.layers.map(({ block, blockIndex }) => (
                                  <LayerRow
                                    block={block}
                                    deleteBlock={deleteBlock}
                                    draggedBlockIndex={draggedBlockIndex}
                                    dragOverBlockIndex={dragOverBlockIndex}
                                    index={blockIndex}
                                    key={motionDocBlockKey(block, blockIndex)}
                                    moveBlock={moveBlock}
                                    moveBlockToEdge={moveBlockToEdge}
                                    onSelectBlock={onSelectBlock}
                                    reorderBlock={reorderBlock}
                                    renameBlock={renameBlock}
                                    selectedBlockIndex={selectedBlockIndex}
                                    selectedBlockIndices={selectedBlockIndices}
                                    setDraggedBlockIndex={setDraggedBlockIndex}
                                    setDragOverBlockIndex={setDragOverBlockIndex}
                                    totalBlocks={currentSlide.blocks.length}
                                    toggleBlockPositionLock={toggleBlockPositionLock}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        }

                        const { block, blockIndex } = entry;
                        return (
                          <LayerRow
                            block={block}
                            deleteBlock={deleteBlock}
                            draggedBlockIndex={draggedBlockIndex}
                            dragOverBlockIndex={dragOverBlockIndex}
                            index={blockIndex}
                            key={motionDocBlockKey(block, blockIndex)}
                            moveBlock={moveBlock}
                            moveBlockToEdge={moveBlockToEdge}
                            onSelectBlock={onSelectBlock}
                            reorderBlock={reorderBlock}
                            renameBlock={renameBlock}
                            selectedBlockIndex={selectedBlockIndex}
                            selectedBlockIndices={selectedBlockIndices}
                            setDraggedBlockIndex={setDraggedBlockIndex}
                            setDragOverBlockIndex={setDragOverBlockIndex}
                            totalBlocks={currentSlide.blocks.length}
                            toggleBlockPositionLock={toggleBlockPositionLock}
                          />
                        );
                        })}
                      </div>
                    </div>
                  )}
                  {activeTab === "layers" && isActive && currentSlide && currentSlide.blocks.length === 0 ? (
                    <div className="ml-4 mt-2 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.025] px-4 py-5 text-center">
                      <p className="text-[14px] font-semibold text-neutral-300">{locale === "zh-TW" ? "尚無圖層" : "No layers yet"}</p>
                      <p className="mt-1 text-[14px] leading-relaxed text-neutral-500">{locale === "zh-TW" ? "使用中央的＋按鈕加入文字、圖片或其他內容。" : "Use the center + button to add text, images, or other content."}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {activeTab === "slides" && !authoringDisabled ? (
            <div
              aria-label={locale === "zh-TW" ? "拖曳到此處轉為一般投影片" : "Drop here to make an ordinary slide"}
              className={`relative mt-2 flex min-h-[72px] items-center justify-center overflow-hidden rounded-xl border border-dashed px-4 text-center transition-all duration-200 ${isMorphExitDropTarget ? "border-violet-200 bg-violet-500/20 shadow-[inset_0_0_24px_rgba(139,92,246,.2)]" : "border-white/[0.1] bg-white/[0.018] text-neutral-500"}`}
              data-morph-exit-drop-zone
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                setIsMorphExitDropTarget(false);
              }}
              onDragOver={(event) => {
                const draggedIndex = draggedSlideFrom(event);
                if (draggedIndex === null || morphGroupStartContaining(scenes, draggedIndex) === null) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setIsMorphExitDropTarget(true);
              }}
              onDrop={(event) => {
                const draggedIndex = draggedSlideFrom(event);
                event.preventDefault();
                if (draggedIndex !== null && morphGroupStartContaining(scenes, draggedIndex) !== null) {
                  moveSlideOutOfMorphGroup(draggedIndex, scenes.length);
                }
                finishSlideDrag();
              }}
              role="status"
            >
              <span className={`pointer-events-none absolute inset-1 rounded-[9px] border-2 border-dashed border-violet-200/70 transition-opacity ${isMorphExitDropTarget ? "opacity-100 motion-safe:animate-pulse" : "opacity-0"}`} />
              <span className="relative flex items-center gap-2.5">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border transition ${isMorphExitDropTarget ? "border-violet-200 bg-violet-400 text-violet-950 shadow-[0_0_0_5px_rgba(196,181,253,.15)] motion-safe:animate-bounce" : "border-white/[0.1] bg-black/20 text-neutral-500"}`}><Unlink2 size={14} /></span>
                <span className="text-left"><span className={`block text-[11px] font-semibold ${isMorphExitDropTarget ? "text-white" : "text-neutral-400"}`}>{locale === "zh-TW" ? "拖到這裡，轉為一般 Slide" : "Drop here to make an ordinary slide"}</span><span className={`mt-0.5 block text-[9px] ${isMorphExitDropTarget ? "text-violet-200/85" : "text-neutral-600"}`}>{locale === "zh-TW" ? "放開後會移到最後一張" : "Release to move it to the end"}</span></span>
              </span>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );
}

function slideMorphRole(scenes: MotionDocScene[], index: number): "root" | "child" | "end" | null {
  const continuesFromPrevious = index > 0 && scenes[index - 1]?.props.slideTransition === "morph";
  const continuesToNext = scenes[index]?.props.slideTransition === "morph";
  if (!continuesFromPrevious && !continuesToNext) return null;
  if (!continuesFromPrevious) return "root";
  if (!continuesToNext) return "end";
  return "child";
}

type MorphSlideGroupModel = {
  endIndex: number;
  rows: SlideRow[];
  scenes: MotionDocScene[];
  startIndex: number;
};

function morphGroupStartingAt(scenes: MotionDocScene[], slideRows: SlideRow[], index: number): MorphSlideGroupModel | null {
  if (scenes[index]?.props.slideTransition !== "morph" || (index > 0 && scenes[index - 1]?.props.slideTransition === "morph")) return null;
  let endIndex = index + 1;
  while (endIndex < scenes.length - 1 && scenes[endIndex]?.props.slideTransition === "morph") endIndex += 1;
  return {
    endIndex,
    rows: slideRows.slice(index, endIndex + 1),
    scenes: scenes.slice(index, endIndex + 1),
    startIndex: index
  };
}

function morphGroupStartContaining(scenes: MotionDocScene[], index: number) {
  if (!scenes[index]) return null;
  let startIndex = index;
  while (startIndex > 0 && scenes[startIndex - 1]?.props.slideTransition === "morph") startIndex -= 1;
  return scenes[startIndex]?.props.slideTransition === "morph" ? startIndex : null;
}

function MorphSlideGroup({
  activeSlideIndex,
  authoringDisabled,
  dragOver,
  expanded,
  group,
  locale,
  menuOpen,
  onEdit,
  onDragEnd,
  onDragLeave,
  onDragOver,
  onDrop,
  onSlideDragStart,
  onSelectSlide,
  onToggleExpanded,
  onToggleMenu,
  onUnlink,
  replayNonce,
  tx
}: {
  activeSlideIndex: number;
  authoringDisabled: boolean;
  dragOver: boolean;
  expanded: boolean;
  group: MorphSlideGroupModel;
  locale: string;
  menuOpen: boolean;
  onEdit: () => void;
  onDragEnd: () => void;
  onDragLeave: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onSlideDragStart: (event: DragEvent<HTMLElement>, slideIndex: number) => void;
  onSelectSlide: (index: number) => void;
  onToggleExpanded: () => void;
  onToggleMenu: () => void;
  onUnlink: () => void;
  replayNonce: number;
  tx: (value: string) => string;
}) {
  const active = activeSlideIndex >= group.startIndex && activeSlideIndex <= group.endIndex;
  const interactions = group.scenes.flatMap((scene, offset) => scene.blocks.flatMap((block) => {
    const value = interactionFromProps(block.props);
    return value ? [{ interaction: value, slideIndex: group.startIndex + offset }] : [];
  }));
  const interaction = interactions[0];
  const title = group.rows[0]?.title || tx("Morph sequence");
  const interactionLabel = interactions.length > 1
    ? `${interactions.length} ${tx("click actions")}`
    : interaction ? interactionActionLabel(interaction.interaction.action, tx) : tx("No click action");

  return (
    <section
      className={`relative mb-3 overflow-visible rounded-[16px] border transition-all duration-200 ${dragOver ? "border-violet-300 bg-violet-400/[0.12] ring-2 ring-violet-400/35" : active ? "border-violet-400/40 bg-violet-500/[0.07] shadow-[0_14px_32px_rgba(30,10,58,.25)]" : "border-white/[0.075] bg-white/[0.018] hover:border-white/[0.13]"}`}
      data-morph-slide-group={group.startIndex}
      onDragEnd={onDragEnd}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        onDragLeave();
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-2.5 px-3 pb-2 pt-3">
        <span className="flex size-7 shrink-0 rotate-45 items-center justify-center rounded-[7px] border border-violet-300/35 bg-violet-500/25 shadow-[0_0_16px_rgba(139,92,246,.18)]">
          <span className="size-2.5 rounded-[2px] bg-violet-200/90" />
        </span>
        <button className="min-w-0 flex-1 text-left" onClick={() => onSelectSlide(group.startIndex)} type="button">
          <span className="block truncate text-[13px] font-semibold text-neutral-100">{title}</span>
          <span className="mt-0.5 block text-[10px] font-medium text-violet-300/75">Morph · {group.rows.length} {tx("slides short")}</span>
        </button>
        <button aria-label={tx(expanded ? "Collapse slides" : "Expand slides")} className="flex size-7 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/[0.06] hover:text-white" onClick={onToggleExpanded} type="button"><ChevronDown className={`transition-transform ${expanded ? "rotate-180" : ""}`} size={13} /></button>
        {!authoringDisabled ? <button aria-label={tx("Morph options")} className="flex size-7 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/[0.06] hover:text-white" onClick={onToggleMenu} type="button"><MoreHorizontal size={14} /></button> : null}
      </div>

      {menuOpen ? (
        <div className="absolute right-2 top-11 z-50 w-[168px] overflow-hidden rounded-[13px] border border-white/[0.12] bg-[#242426] p-1.5 shadow-[0_20px_48px_rgba(0,0,0,.55)]">
          <MorphMenuButton icon={<Layers size={13} />} label={tx(expanded ? "Collapse slides" : "Expand slides")} onClick={onToggleExpanded} />
          <MorphMenuButton icon={<Link2 size={13} />} label={tx("Edit Morph")} onClick={onEdit} />
          <div className="my-1 h-px bg-white/[0.07]" />
          <MorphMenuButton danger icon={<Unlink2 size={13} />} label={tx("Unlink Morph")} onClick={onUnlink} />
        </div>
      ) : null}

      {dragOver ? (
        <div aria-live="polite" className="pointer-events-none absolute inset-1 z-40 flex items-center justify-center rounded-[13px] border-2 border-dashed border-violet-200/80 bg-[#32155d]/72 p-3 text-center shadow-[inset_0_0_36px_rgba(167,139,250,.28)] backdrop-blur-[2px] motion-safe:animate-pulse">
          <span className="flex flex-col items-center gap-1.5 rounded-xl border border-violet-200/30 bg-[#1d1033]/90 px-4 py-3 shadow-[0_10px_28px_rgba(0,0,0,.38)]">
            <span className="flex size-8 items-center justify-center rounded-full bg-violet-400 text-violet-950 shadow-[0_0_0_5px_rgba(196,181,253,.16)] motion-safe:animate-bounce">
              <Plus size={17} strokeWidth={2.8} />
            </span>
            <span className="text-[11px] font-bold text-white">{locale === "zh-TW" ? "放開以加入 Morph" : "Release to add to Morph"}</span>
            <span className="flex items-center gap-1 text-[9px] font-medium text-violet-200/80"><MousePointerClick size={10} />{locale === "zh-TW" ? "建立下一個動態步驟" : "Create the next motion step"}</span>
          </span>
        </div>
      ) : null}

      {expanded ? (
        <div className="relative flex flex-col gap-2 border-t border-white/[0.055] px-3 py-3">
          <span className="absolute bottom-6 left-[22px] top-6 w-px bg-violet-400/25" />
          {group.rows.map((row, offset) => {
            const scene = group.scenes[offset];
            const isActive = row.index === activeSlideIndex;
            const sceneInteractionLabel = scene
              ? sceneInteractionActionLabel(scene, row.index, tx)
              : null;
            return (
              <button
                className={`relative z-10 grid grid-cols-[14px_72px_minmax(0,1fr)] items-center gap-2 rounded-xl p-1.5 text-left transition ${authoringDisabled ? "" : "cursor-grab active:cursor-grabbing"} ${isActive ? "bg-white/[0.075]" : "hover:bg-white/[0.04]"}`}
                draggable={!authoringDisabled}
                key={row.index}
                onClick={() => onSelectSlide(row.index)}
                onDragStart={(event) => {
                  if (!authoringDisabled) onSlideDragStart(event, row.index);
                }}
                type="button"
              >
                <span className={`size-2.5 rotate-45 rounded-[2px] border ${offset === 0 ? "border-violet-200/70 bg-violet-400" : "border-violet-400/45 bg-[#21162e]"}`} />
                <span className="relative block aspect-video overflow-hidden rounded-[6px] border border-white/[0.1] bg-black/50">
                  <SlideThumbnailPreview activeSlideIndex={row.index} eager={isActive} replayNonce={replayNonce} scene={scene} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-semibold text-neutral-300">{offset === 0 ? tx("Start slide") : offset === group.rows.length - 1 ? tx("End slide") : `${tx("Step")} ${offset + 1}`}</span>
                  <span className={`mt-1 flex items-center gap-1 text-[9px] ${sceneInteractionLabel ? "text-violet-300/75" : "text-neutral-600"}`}>{sceneInteractionLabel ? <><MousePointerClick size={10} /><span className="truncate">{sceneInteractionLabel}</span></> : <span>{locale === "zh-TW" ? `投影片 ${row.index + 1}` : `Slide ${row.index + 1}`}</span>}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <button className="group/stack relative mx-3 mb-3 block aspect-video w-[calc(100%-1.5rem)]" onClick={() => onSelectSlide(group.startIndex)} type="button">
          <span className="absolute inset-x-3 bottom-[-7px] top-3 rounded-[9px] border border-white/[0.06] bg-[#29262f]" />
          <span className="absolute inset-x-1.5 bottom-[-3px] top-1.5 rounded-[9px] border border-white/[0.08] bg-[#302b38]" />
          <span className={`absolute inset-0 overflow-hidden rounded-[9px] border bg-black shadow-sm transition ${active ? "border-violet-300/55" : "border-white/[0.11] group-hover/stack:border-white/[0.2]"}`}>
            <SlideThumbnailPreview activeSlideIndex={group.startIndex} eager={active} replayNonce={replayNonce} scene={group.scenes[0]} />
          </span>
        </button>
      )}

      <div className="mx-3 mb-3 flex min-h-9 items-center gap-2 rounded-[11px] border border-white/[0.055] bg-black/20 px-2.5 text-[10px] text-neutral-400">
        <MousePointerClick className={interaction ? "text-violet-300" : "text-neutral-600"} size={12} />
        <span>{tx(interaction ? "Click" : "Interaction")}</span>
        <ChevronRight className="text-neutral-700" size={11} />
        <span className="min-w-0 flex-1 truncate text-neutral-300">{interactionLabel}</span>
        {interaction ? <Link2 className="text-violet-300/75" size={12} /> : null}
      </div>
    </section>
  );
}

function MorphMenuButton({ danger = false, icon, label, onClick }: { danger?: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={`flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[11px] transition ${danger ? "text-red-300 hover:bg-red-500/10" : "text-neutral-300 hover:bg-white/[0.06]"}`} onClick={onClick} type="button">{icon}<span>{label}</span></button>;
}

function interactionActionLabel(action: NonNullable<ReturnType<typeof interactionFromProps>>["action"], tx: (value: string) => string) {
  if (action.type === "nextSlide") return tx("Next slide");
  if (action.type === "previousSlide") return tx("Previous slide");
  if (action.type === "goToSlide") return `${tx("Go to slide")} ${action.slide}`;
  return tx("Open link");
}

function sceneInteractionActionLabel(scene: MotionDocScene, slideIndex: number, tx: (value: string) => string) {
  const actions = scene.blocks.flatMap((block) => {
    const action = interactionFromProps(block.props)?.action;
    return action ? [action] : [];
  });
  if (actions.length === 0) return null;
  const targets = actions.flatMap((action) => {
    if (action.type === "goToSlide") return [action.slide];
    if (action.type === "nextSlide") return [slideIndex + 2];
    if (action.type === "previousSlide") return [Math.max(1, slideIndex)];
    return [];
  });
  const uniqueTargets = [...new Set(targets)].sort((left, right) => left - right);
  if (uniqueTargets.length === actions.length && uniqueTargets.length > 0) {
    return `${tx(uniqueTargets.length === 1 ? "Go to slide" : "Go to slides")} ${uniqueTargets.join(", ")}`;
  }
  return actions.length === 1
    ? interactionActionLabel(actions[0]!, tx)
    : `${actions.length} ${tx("click actions")}`;
}

type LayerTreeEntry =
  | { block: MotionDocBlock; blockIndex: number; kind: "layer" }
  | { id: string; kind: "group"; layers: Array<{ block: MotionDocBlock; blockIndex: number }>; name: string };

function layerTreeEntries(blocks: MotionDocBlock[]): LayerTreeEntry[] {
  const entries: LayerTreeEntry[] = [];
  const seenGroups = new Set<string>();

  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    const groupId = "props" in block && typeof block.props.groupId === "string" ? block.props.groupId : "";
    if (!groupId) {
      entries.push({ block, blockIndex: index, kind: "layer" });
      continue;
    }
    if (seenGroups.has(groupId)) continue;
    seenGroups.add(groupId);
    const layers = blocks.flatMap((candidate, blockIndex) => (
      "props" in candidate && candidate.props.groupId === groupId ? [{ block: candidate, blockIndex }] : []
    )).reverse();
    const groupName = "props" in block && typeof block.props.groupName === "string" && block.props.groupName.trim()
      ? block.props.groupName
      : "Group";
    entries.push({ id: groupId, kind: "group", layers, name: groupName });
  }

  return entries;
}
