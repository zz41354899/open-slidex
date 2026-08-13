
import { Bot, ChevronRight, Copy, Group, Layers, Plus, Trash2 } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useState } from "react";
import { LayerRow } from "@/features/pitch/ui/LayerRow";
import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import type { MotionDocBlock, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
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
  copySlide,
  deleteBlock,
  deleteSlide,
  duplicateSlide,
  draggedBlockIndex,
  dragOverBlockIndex,
  moveBlock,
  moveBlockToEdge,
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
  toggleBlockPositionLock
}: {
  activeSlideIndex: number;
  copySlide: (index: number) => void;
  deleteBlock: (index: number) => void;
  deleteSlide: (index: number) => void;
  duplicateSlide: (index: number) => void;
  draggedBlockIndex: number | null;
  dragOverBlockIndex: number | null;
  moveBlock: (index: number, direction: -1 | 1) => void;
  moveBlockToEdge: (index: number, edge: "back" | "front") => void;
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
}) {
  const { tx, locale } = usePitchI18n();
  const [activeTab, setActiveTab] = useState<"slides" | "layers">("slides");
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const [dragOverSlideIndex, setDragOverSlideIndex] = useState<number | null>(null);

  function handleSlideShortcut(event: KeyboardEvent<HTMLDivElement>, slideIndex: number) {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "c") return;

    event.preventDefault();
    event.stopPropagation();
    onSelectSlide(slideIndex);
    copySlide(slideIndex);
  }

  return (
    <div id="sidebar-v4" className="relative z-10 flex h-full w-full shrink-0 select-none flex-col overflow-hidden bg-[#111111] transition-all duration-700 md:w-[265px] md:border-r md:border-white/[0.12]">
      {/* Sidebar Header / Tabs */}
      <EditorPanelTabs
        ariaLabel={tx("Slides & Layers")}
        onChange={setActiveTab}
        options={[{ label: tx("Slides"), value: "slides" }, { label: tx("Layers"), value: "layers" }]}
        value={activeTab}
      />

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col p-3">

          {/* New Slide Button */}
          <div className="mb-6 grid grid-cols-[1fr_auto] gap-2">
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
          </div>

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
              const mcpActivity = remoteMcpOperations.find((activity) => (
                remoteMcpOperationTargetsSlide(activity, slide.index, activeSlideIndex)
              ));
              return (
                <div className="flex flex-col" key={slide.index}>

                  {/* Scene Row item (Layers Tab) */}
                  {activeTab === "layers" && (
                    <div
                      className={`group/item flex cursor-pointer items-center justify-between rounded-[0.85rem] px-3 py-2.5 transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] relative ${
                        isActive
                          ? "bg-white/[0.08] text-white shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.05)] border border-white/[0.04]"
                          : "text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200 border border-transparent"
                      } ${mcpActivity ? `border-[#8b5cf6]/70 ${mcpActivity.status === "running" ? "motion-safe:animate-pulse" : "motion-safe:animate-[mcp-activity-settle_6s_ease-out_forwards]"} ${mcpActivity.status === "failed" ? "border-dashed" : "border-solid"}` : ""}`}
                      onClick={() => onSelectSlide(slide.index)}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <Layers size={13} className={isActive ? "text-[#8ea5ff]" : "text-neutral-500 group-hover:text-neutral-300 transition-colors"} />
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
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        setDraggedSlideIndex(slide.index);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedSlideIndex !== null && draggedSlideIndex !== slide.index) {
                          setDragOverSlideIndex(slide.index);
                        }
                      }}
                      onDragLeave={() => {
                        setDragOverSlideIndex(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedSlideIndex !== null && draggedSlideIndex !== slide.index) {
                          reorderSlide(draggedSlideIndex, slide.index);
                        }
                        setDraggedSlideIndex(null);
                        setDragOverSlideIndex(null);
                      }}
                      onDragEnd={() => {
                        setDraggedSlideIndex(null);
                        setDragOverSlideIndex(null);
                      }}
                      className={`relative flex flex-col p-2 pb-6 mb-2 rounded-xl outline-none transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#8ea5ff]/70 ${
                        isActive ? "bg-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" : "hover:bg-white/[0.04]"
                      } ${dragOverSlideIndex === slide.index ? (draggedSlideIndex! < slide.index ? "border-b-2 border-b-[#8ea5ff] border-b-solid" : "border-t-2 border-t-[#8ea5ff] border-t-solid") : ""}`}
                      onClick={() => onSelectSlide(slide.index)}
                      onKeyDown={(event) => handleSlideShortcut(event, slide.index)}
                      role="button"
                      tabIndex={0}
                      title={locale === "zh-TW" ? "點選後可用 ⌘C／⌘V 複製貼上投影片" : "Select, then use Cmd/Ctrl+C and Cmd/Ctrl+V to copy and paste"}
                    >
                      {isActive && <div className="absolute left-0 top-3 bottom-8 w-[3px] rounded-r bg-[#8ea5ff] z-10" />}
                      <div className={`relative aspect-video w-full overflow-hidden rounded-lg border shadow-sm transition-colors ${isActive ? "border-white/20 bg-black/60" : "border-white/5 bg-black/40 hover:border-white/10"}`}>
                        <SlideThumbnailPreview
                          activeSlideIndex={slide.index}
                          eager={isActive}
                          replayNonce={replayNonce}
                          scene={currentSlide}
                          source={source}
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
                      <button
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
                      </button>
                      {scenes.length > 1 && (
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
                  {activeTab === "layers" && isActive && currentSlide && currentSlide.blocks.length > 0 && (
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

        </div>
      </div>
    </div>
  );
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
