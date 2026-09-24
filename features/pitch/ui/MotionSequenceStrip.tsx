import {
  GripVertical,
  MousePointerClick,
  Play,
  Timer,
  Users
} from "lucide-react";
import { memo, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { motionSequenceFromProps } from "@/core/motion-doc/domain/motionSequence";
import { InspectorSection } from "@/features/pitch/ui/inspector/InspectorControls";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

export const MotionSequencePanel = memo(function MotionSequencePanel({ onPreview, onReorder, onSelectBlock, scene }: {
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
    <InspectorSection
      defaultOpen
      rightElement={(
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-neutral-500">{entries.length} {tx("items")}</span>
          <button
            aria-label={tx("Preview actions")}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-violet-300/25 bg-violet-500/15 text-violet-100 transition hover:border-violet-300/45 hover:bg-violet-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            onClick={previewActions}
            type="button"
          >
            <Play className="ml-0.5" fill="currentColor" size={12} />
          </button>
        </div>
      )}
      title="Action order"
    >
      <div aria-label={tx("Action order")} className="flex flex-col gap-1.5" data-motion-sequence-panel>
        <p className="px-0.5 text-[10px] text-neutral-500">{tx("Alt + arrow keys to reorder")}</p>
        {entries.map(({ action, block, blockIndex }, index) => {
          const selected = action.id === selectedId;
          const dragging = action.id === draggedId;
          const isDropTarget = Boolean(draggedId) && dragOverId === action.id && action.id !== draggedId;
          const durationWidth = `${Math.max(28, (action.duration / maxDuration) * 100)}%`;
          return (
            <div className="relative" key={action.id}>
              {isDropTarget ? <span className="pointer-events-none absolute inset-x-1 -top-1 z-20 h-0.5 rounded-full bg-violet-400 shadow-[0_0_14px_rgba(167,139,250,.9)]" /> : null}
              <button
                aria-label={`${index + 1}. ${layerLabel(block, blockIndex)}, ${tx(startLabel(action.start))}, ${action.duration.toFixed(1)}s. ${tx("Drag to reorder")}`}
                aria-pressed={selected}
                className={`group grid h-[58px] w-full grid-cols-[22px_minmax(0,1fr)_auto] grid-rows-[24px_18px] items-center gap-x-2 rounded-xl px-2.5 text-left outline-none transition-[background-color,border-color,box-shadow,opacity,transform] duration-150 focus-visible:ring-2 focus-visible:ring-violet-400 ${selected ? "border border-violet-400/65 bg-violet-500/[0.13] shadow-[0_8px_24px_rgba(76,29,149,.18),inset_0_1px_0_rgba(255,255,255,.06)]" : "border border-white/[0.075] bg-[#202024]/94 hover:border-white/[0.15] hover:bg-[#26262b]"} ${dragging ? "scale-[.98] border-dashed border-violet-300/60 opacity-45" : ""}`}
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
                <span className={`row-span-2 flex size-5 items-center justify-center rounded-full text-[9px] font-bold tabular-nums ${selected ? "bg-violet-400 text-[#18151f]" : "bg-white/[0.075] text-neutral-300"}`}>{index + 1}</span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={`truncate text-[10px] font-semibold ${selected ? "text-violet-50" : "text-neutral-200"}`}>{layerLabel(block, blockIndex)}</span>
                  <GripVertical className="ml-auto shrink-0 text-neutral-600 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" size={12} />
                </span>
                <span className="row-span-2 flex size-6 items-center justify-center text-neutral-500">{startIcon(action.start)}</span>
                <span className="col-start-2 row-start-2 flex min-w-0 items-center gap-2">
                  <span className="truncate text-[9px] text-neutral-500">{tx(startLabel(action.start))}</span>
                  <span className="relative ml-auto h-1 w-[58px] shrink-0 overflow-hidden rounded-full bg-white/[0.07]">
                    <span className={`absolute inset-y-0 left-0 rounded-full ${selected ? "bg-violet-400" : "bg-neutral-500"}`} style={{ width: durationWidth }} />
                  </span>
                  <span className="w-[28px] shrink-0 font-mono text-[8px] tabular-nums text-neutral-500">{action.duration.toFixed(1)}s</span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </InspectorSection>
  );
});

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
