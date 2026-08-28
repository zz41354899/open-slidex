import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  MousePointerClick,
  Play,
  Timer,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { motionSequenceFromProps } from "@/core/motion-doc/domain/motionSequence";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

export function MotionSequenceStrip({ onPreview, onReorder, onSelectBlock, scene }: {
  onPreview?: () => void;
  onReorder: (sourceActionId: string, targetActionId: string) => void;
  onSelectBlock: (blockIndex: number) => void;
  scene: MotionDocScene | undefined;
}) {
  const { tx } = usePitchI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [draggedId, setDraggedId] = useState("");
  const [dragOverId, setDragOverId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const entries = useMemo(() => (scene?.blocks ?? []).flatMap((block, blockIndex) =>
    (motionSequenceFromProps(block.props)?.actions ?? []).map((action) => ({ action, block, blockIndex }))
  ).sort((left, right) => left.action.order - right.action.order), [scene]);

  useEffect(() => {
    if (!entries.some(({ action }) => action.id === selectedId)) setSelectedId(entries[0]?.action.id ?? "");
  }, [entries, selectedId]);

  if (entries.length === 0) return null;
  const maxDuration = Math.max(...entries.map(({ action }) => action.duration), 0.1);

  function selectAction(actionId: string, blockIndex: number) {
    setSelectedId(actionId);
    onSelectBlock(blockIndex);
    window.dispatchEvent(new CustomEvent("slidex:motion-action-selected", { detail: actionId }));
  }

  function previewActions() {
    const selected = entries.find(({ action }) => action.id === selectedId) ?? entries[0];
    if (selected) selectAction(selected.action.id, selected.blockIndex);
    onPreview?.();
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    const targetIndex = event.key === "ArrowLeft" ? index - 1 : index + 1;
    const source = entries[index];
    const target = entries[targetIndex];
    if (source && target) onReorder(source.action.id, target.action.id);
  }

  return (
    <section
      aria-label={tx("Action order")}
      className="absolute bottom-4 left-1/2 z-[70] w-[min(1180px,calc(100%-2rem))] -translate-x-1/2 overflow-hidden rounded-[20px] border border-white/[0.11] bg-[#161619]/95 shadow-[0_22px_60px_rgba(0,0,0,.52),inset_0_1px_0_rgba(255,255,255,.035)] backdrop-blur-2xl"
      data-motion-sequence-strip
    >
      <div className="flex h-11 items-center gap-2 border-b border-white/[0.065] px-3">
        <button
          aria-label={tx("Preview actions")}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-violet-300/25 bg-violet-500/20 text-violet-100 shadow-[0_0_24px_rgba(139,92,246,.18)] transition hover:border-violet-300/45 hover:bg-violet-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          onClick={previewActions}
          type="button"
        >
          <Play className="ml-0.5" fill="currentColor" size={13} />
        </button>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-[0.01em] text-neutral-100">{tx("Actions")}</div>
          <div className="text-[9px] text-neutral-500">{entries.length} {tx("items")}</div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[9px] text-neutral-600">
          <span className="hidden sm:inline">{tx("Alt + arrow keys to reorder")}</span>
          <button
            aria-expanded={!collapsed}
            aria-label={tx(collapsed ? "Expand action order" : "Collapse action order")}
            className="flex size-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-white/[0.06] hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            onClick={() => setCollapsed((value) => !value)}
            type="button"
          >
            {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div className="custom-scrollbar overflow-x-auto px-3 py-2.5">
          <div className="relative flex min-w-max items-center gap-2 pb-0.5">
            <div className="pointer-events-none absolute left-5 right-5 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-violet-400/25 to-transparent" />
            {entries.map(({ action, block, blockIndex }, index) => {
              const selected = action.id === selectedId;
              const dragging = action.id === draggedId;
              const isDropTarget = Boolean(draggedId) && dragOverId === action.id && action.id !== draggedId;
              const durationWidth = `${Math.max(28, (action.duration / maxDuration) * 100)}%`;
              return (
                <div className="relative flex shrink-0 items-center" key={action.id}>
                  {isDropTarget ? <span className="pointer-events-none absolute -left-[5px] top-1/2 z-20 h-[52px] w-0.5 -translate-y-1/2 rounded-full bg-violet-400 shadow-[0_0_14px_rgba(167,139,250,.9)]" /> : null}
                  <button
                    aria-label={`${index + 1}. ${layerLabel(block, blockIndex)}, ${tx(startLabel(action.start))}, ${action.duration.toFixed(1)}s. ${tx("Drag to reorder")}`}
                    aria-pressed={selected}
                    className={`group relative z-10 grid h-[54px] w-[154px] grid-cols-[20px_minmax(0,1fr)] grid-rows-[22px_16px] items-center gap-x-2 rounded-[13px] px-2.5 text-left outline-none transition-[width,background-color,border-color,box-shadow,opacity,transform] duration-200 focus-visible:ring-2 focus-visible:ring-violet-400 ${selected ? "w-[184px] border border-violet-400/65 bg-violet-500/[0.13] shadow-[0_10px_30px_rgba(76,29,149,.22),inset_0_1px_0_rgba(255,255,255,.06)]" : "border border-white/[0.075] bg-[#202024]/94 hover:border-white/[0.15] hover:bg-[#26262b]"} ${dragging ? "scale-[.98] border-dashed border-violet-300/60 opacity-45" : ""}`}
                    draggable
                    onClick={() => selectAction(action.id, blockIndex)}
                    onDragEnd={() => {
                      setDraggedId("");
                      setDragOverId("");
                    }}
                    onDragEnter={() => setDragOverId(action.id)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDragStart={(event) => {
                      setDraggedId(action.id);
                      setSelectedId(action.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", action.id);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sourceId = event.dataTransfer.getData("text/plain") || draggedId;
                      if (sourceId && sourceId !== action.id) onReorder(sourceId, action.id);
                      setDraggedId("");
                      setDragOverId("");
                    }}
                    onKeyDown={(event) => moveWithKeyboard(event, index)}
                    type="button"
                  >
                    <span className={`row-span-1 flex size-5 items-center justify-center rounded-full text-[9px] font-bold tabular-nums ${selected ? "bg-violet-400 text-[#18151f]" : "bg-white/[0.075] text-neutral-300"}`}>{index + 1}</span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className={`truncate text-[10px] font-semibold ${selected ? "text-violet-50" : "text-neutral-200"}`}>{layerLabel(block, blockIndex)}</span>
                      <GripVertical className="ml-auto shrink-0 text-neutral-600 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" size={12} />
                    </span>
                    <span className="col-start-1 row-start-2 flex justify-center text-neutral-500">{startIcon(action.start)}</span>
                    <span className="col-start-2 row-start-2 flex min-w-0 items-center gap-2">
                      <span className="truncate text-[8px] text-neutral-500">{tx(startLabel(action.start))}</span>
                      <span className="relative ml-auto h-1 w-[52px] shrink-0 overflow-hidden rounded-full bg-white/[0.07]">
                        <span className={`absolute inset-y-0 left-0 rounded-full ${selected ? "bg-violet-400" : "bg-neutral-500"}`} style={{ width: durationWidth }} />
                      </span>
                      <span className="w-[28px] shrink-0 font-mono text-[8px] tabular-nums text-neutral-500">{action.duration.toFixed(1)}s</span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function layerLabel(block: MotionDocScene["blocks"][number], index: number) {
  if ("text" in block && block.text.trim()) return block.text.trim().slice(0, 24);
  const name = typeof block.props.groupName === "string" ? block.props.groupName.trim() : "";
  return name || `${block.type} ${index + 1}`;
}

function startIcon(value: string) {
  if (value === "onClick") return <MousePointerClick size={10} />;
  if (value === "withPrevious") return <Users size={10} />;
  return <Timer size={10} />;
}

function startLabel(value: string) { return value === "onClick" ? "Click" : value === "withPrevious" ? "With" : "After"; }
