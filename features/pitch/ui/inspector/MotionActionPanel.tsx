import { ArrowDown, ArrowRightFromLine, ArrowUp, ChevronDown, CornerDownLeft, CornerUpRight, Eye, Hash, Layers3, Maximize2, Minimize2, Minus, MoveRight, Play, Plus, RotateCw, Scaling, Settings2, SlidersHorizontal, Sparkles, Square, Trash2, TrendingDown, TrendingUp, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { MotionDocBlockWithProps, MotionDocProps, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import {
  interpolateMotionState,
  formatMotionNumber,
  interpolateMotionNumber,
  motionActionStarts,
  motionEasings,
  motionSequenceFromProps,
  type MotionAction,
  type MotionEasing,
  type MotionEnterAction,
  type MotionExitAction,
  type MotionExitPreset,
  type MotionNumberRange,
  type MotionTweenAction,
  type MotionTweenPreset,
  type MotionTweenState
} from "@/core/motion-doc/domain/motionSequence";
import { normalizeEnterAnimation, type EnterAnimation } from "@/features/pitch/application/motionPresets";
import {
  addTweenActionProps,
  applySequenceEnterAnimationProps,
  applySequenceExitAnimationProps,
  applyTweenPreset,
  moveMotionActionProps,
  removeMotionActionProps,
  updateMotionActionProps
} from "@/features/pitch/application/motionModel";
import { NumberInput } from "@/features/pitch/ui/inspector/InspectorControls";
import { MotionPreviewStage } from "@/features/pitch/ui/inspector/MotionPreviewStage";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Slider } from "@/common/ui/shadcnPrimitives";

type MotionStage = "start" | "action" | "end";
type Endpoint = "from" | "to" | "path";

type MotionActionPanelProps = {
  activeSlide: MotionDocScene;
  block: MotionDocBlockWithProps;
  selectedBlockIndex: number;
  updateBlock: (blockIndex: number, props: MotionDocProps, newText?: string) => void;
};

const startEffects: ReadonlyArray<{ label: string; value: EnterAnimation }> = [
  { label: "None", value: "none" },
  { label: "Fade", value: "fadeIn" },
  { label: "Fade Up", value: "fadeUp" },
  { label: "Slide in", value: "slideLeft" },
  { label: "Zoom", value: "zoomIn" },
  { label: "Pop", value: "pop" }
];

const actionEffects: ReadonlyArray<{ label: string; value: MotionTweenPreset }> = [
  { label: "Move", value: "move" },
  { label: "Drift", value: "drift" },
  { label: "Scale", value: "scale" },
  { label: "Rotate", value: "rotate" },
  { label: "Fade", value: "fade" },
  { label: "Arc up", value: "arcUp" },
  { label: "Arc down", value: "arcDown" },
  { label: "Number range", value: "numberRange" }
];

const endEffects: ReadonlyArray<{ label: string; value: MotionExitPreset | "none" }> = [
  { label: "None", value: "none" },
  { label: "Fade out", value: "fadeOut" },
  { label: "Fade down", value: "fadeDown" },
  { label: "Slide out", value: "slideRight" },
  { label: "Zoom out", value: "zoomOut" },
  { label: "Shrink", value: "shrink" }
];

export function MotionActionPanel({ activeSlide, block, selectedBlockIndex, updateBlock }: MotionActionPanelProps) {
  const { tx } = usePitchI18n();
  const actions = motionSequenceFromProps(block.props)?.actions ?? [];
  const enterAction = actions.find((action): action is MotionEnterAction => action.type === "enter");
  const exitAction = actions.find((action): action is MotionExitAction => action.type === "exit");
  const tweens = actions.filter((action): action is MotionTweenAction => action.type === "tween");
  const [stage, setStage] = useState<MotionStage>("action");
  const [endpoint, setEndpoint] = useState<Endpoint>("from");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState(tweens.at(-1)?.id ?? "");
  const selectedTween = tweens.find((action) => action.id === selectedActionId) ?? tweens.at(-1);
  const nextGlobalOrder = useMemo(
    () => Math.max(-1, ...activeSlide.blocks.flatMap((candidate) => motionSequenceFromProps(candidate.props)?.actions.map((action) => action.order) ?? [])) + 1,
    [activeSlide]
  );
  const selectedStart = enterAction?.preset ?? normalizeEnterAnimation(block.props.enter);
  const previewedAction = stage === "start"
    ? enterAction ?? legacyPreviewAction(block, selectedStart)
    : stage === "end"
      ? exitAction ?? null
      : selectedTween ?? null;

  useEffect(() => {
    if (selectedTween && selectedTween.id !== selectedActionId) setSelectedActionId(selectedTween.id);
  }, [selectedTween, selectedActionId]);

  useEffect(() => setShowAdvanced(false), [selectedActionId]);

  useEffect(() => {
    if (stage === "action" && selectedTween) {
      window.dispatchEvent(new CustomEvent("slidex:motion-action-selected", { detail: selectedTween.id }));
    } else {
      window.dispatchEvent(new CustomEvent("slidex:motion-action-selected", { detail: "" }));
    }
  }, [selectedTween, stage]);

  useEffect(() => {
    function selectFromSequence(event: Event) {
      const actionId = (event as CustomEvent<string>).detail;
      if (actionId === enterAction?.id) setStage("start");
      else if (actionId === exitAction?.id) setStage("end");
      else if (tweens.some((action) => action.id === actionId)) {
        setSelectedActionId(actionId);
        setStage("action");
      }
    }
    window.addEventListener("slidex:motion-action-selected", selectFromSequence);
    return () => window.removeEventListener("slidex:motion-action-selected", selectFromSequence);
  }, [enterAction?.id, exitAction?.id, tweens]);

  function updateAction(action: MotionAction, update: (candidate: MotionAction) => MotionAction) {
    updateBlock(selectedBlockIndex, updateMotionActionProps(block.props, action.id, update));
  }

  function addAction(preset: MotionTweenPreset = "move") {
    const result = addTweenActionProps(block.props, nextGlobalOrder, preset);
    if (preset === "numberRange") {
      const numberRange = initialNumberRange(block);
      const props = updateMotionActionProps(result.props, result.action.id, (action) => action.type === "tween"
        ? { ...action, from: action.to, numberRange, path: undefined, preset }
        : action);
      updateBlock(selectedBlockIndex, props, formatMotionNumber(numberRange.to, numberRange));
    } else {
      updateBlock(selectedBlockIndex, result.props);
    }
    setSelectedActionId(result.action.id);
    setStage("action");
  }

  function applyActionTemplate(preset: MotionTweenPreset) {
    if (selectedTween) selectTweenPreset(preset);
    else addAction(preset);
  }

  function updateTween(update: (action: MotionTweenAction) => MotionTweenAction) {
    if (!selectedTween) return;
    updateAction(selectedTween, (action) => action.type === "tween" ? update(action) : action);
  }

  function selectTweenPreset(preset: MotionTweenPreset) {
    if (!selectedTween) return;
    const updated = applyTweenPreset(selectedTween, preset);
    const nextAction = preset === "numberRange"
      ? { ...updated, numberRange: initialNumberRange(block) }
      : updated;
    const props = updateMotionActionProps(block.props, selectedTween.id, (action) => action.type === "tween" ? nextAction : action);
    updateBlock(
      selectedBlockIndex,
      props,
      nextAction.numberRange ? formatMotionNumber(nextAction.numberRange.to, nextAction.numberRange) : undefined
    );
  }

  function updateNumberRange(range: MotionNumberRange) {
    if (!selectedTween) return;
    const props = updateMotionActionProps(block.props, selectedTween.id, (action) => action.type === "tween"
      ? { ...action, from: action.to, numberRange: range, path: undefined, preset: "numberRange" }
      : action);
    updateBlock(selectedBlockIndex, props, formatMotionNumber(range.to, range));
  }

  return (
    <div className="-mx-0.5 flex flex-col gap-3 rounded-[18px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,0.025),rgba(0,0,0,0.16))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025),0_18px_45px_rgba(0,0,0,0.16)]">
      <MotionPreviewStage
        action={previewedAction}
        block={block}
        onPreviewCanvas={() => previewedAction && previewAction(block, previewedAction)}
        stageLabel={stage === "start" ? "Start effect" : stage === "end" ? "End effect" : "Action effect"}
      />
      <StageTabs onChange={setStage} stage={stage} />

      {stage === "start" ? (
        <StagePanel>
          <VisualEffectGrid
            onChange={(value) => updateBlock(selectedBlockIndex, applySequenceEnterAnimationProps(block.props, value as EnterAnimation, nextGlobalOrder))}
            options={startEffects}
            value={selectedStart}
          />
          {enterAction ? <TimingEditor action={enterAction} onChange={(update) => updateAction(enterAction, update)} /> : null}
        </StagePanel>
      ) : null}

      {stage === "action" ? (
        <StagePanel>
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-600">{tx("Effect")}</span>
            <button aria-label={tx("Add action")} className="flex size-7 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/[0.06] hover:text-white" onClick={() => addAction()} title={tx("Add action")} type="button"><Plus size={13} /></button>
          </div>
          <VisualEffectGrid
            onChange={(value) => applyActionTemplate(value as MotionTweenPreset)}
            options={quickActionEffects(block.type === "Text")}
            value={selectedTween?.preset ?? ""}
          />
          {tweens.length ? (
            <div className="flex gap-1 overflow-x-auto pb-0.5 custom-scrollbar">
              {tweens.map((action, index) => (
                <button className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition ${action.id === selectedTween?.id ? "border-violet-400/45 bg-violet-500/18 text-violet-100" : "border-white/[0.07] bg-black/25 text-neutral-500 hover:text-neutral-200"}`} key={action.id} onClick={() => setSelectedActionId(action.id)} type="button">
                  {index + 1} · {tx(actionEffectLabel(action.preset))}
                </button>
              ))}
            </div>
          ) : null}

          {selectedTween ? (
            <>
              {selectedTween.preset === "numberRange" && selectedTween.numberRange ? (
                <NumberRangeEditor
                  duration={selectedTween.duration}
                  onChange={updateNumberRange}
                  onDurationChange={(duration) => updateTween((action) => ({ ...action, duration }))}
                  onPreview={() => previewAction(block, selectedTween)}
                  range={selectedTween.numberRange}
                />
              ) : (
                <TweenCanvasControls
                  action={selectedTween}
                  endpoint={endpoint}
                  onChange={updateTween}
                  onEndpointChange={setEndpoint}
                  onPreview={() => previewAction(block, selectedTween)}
                  onToggleAdvanced={() => setShowAdvanced((current) => !current)}
                  showAdvanced={showAdvanced}
                />
              )}
              <TimingEditor
                action={selectedTween}
                footer={(
                  <div className="grid grid-cols-3 gap-1.5">
                    <IconButton label="Move action earlier" onClick={() => updateBlock(selectedBlockIndex, moveMotionActionProps(block.props, selectedTween.id, -1))}><ArrowUp size={13} /></IconButton>
                    <IconButton label="Move action later" onClick={() => updateBlock(selectedBlockIndex, moveMotionActionProps(block.props, selectedTween.id, 1))}><ArrowDown size={13} /></IconButton>
                    <IconButton danger label="Delete action" onClick={() => updateBlock(selectedBlockIndex, removeMotionActionProps(block.props, selectedTween.id))}><Trash2 size={13} /></IconButton>
                  </div>
                )}
                onChange={(update) => updateAction(selectedTween, update)}
              />
            </>
          ) : null}
        </StagePanel>
      ) : null}

      {stage === "end" ? (
        <StagePanel>
          <VisualEffectGrid
            onChange={(value) => updateBlock(selectedBlockIndex, applySequenceExitAnimationProps(block.props, value as MotionExitPreset | "none", nextGlobalOrder))}
            options={endEffects}
            value={exitAction?.preset ?? "none"}
          />
          {exitAction ? <TimingEditor action={exitAction} onChange={(update) => updateAction(exitAction, update)} /> : null}
        </StagePanel>
      ) : null}
    </div>
  );
}

function StageTabs({ onChange, stage }: { onChange: (stage: MotionStage) => void; stage: MotionStage }) {
  const { tx } = usePitchI18n();
  const tabs: Array<{ label: string; value: MotionStage }> = [
    { label: "Start", value: "start" },
    { label: "Action", value: "action" },
    { label: "End", value: "end" }
  ];
  return (
    <div className="grid grid-cols-3 gap-1 rounded-[14px] border border-white/[0.11] bg-black/25 p-1 shadow-inner">
      {tabs.map((tab) => (
        <button className={`flex h-9 items-center justify-center rounded-[10px] text-[11px] font-semibold transition-all duration-200 ${stage === tab.value ? "border border-violet-300/25 bg-[linear-gradient(180deg,rgba(139,92,246,.62),rgba(109,40,217,.48))] text-white shadow-[0_6px_18px_rgba(124,58,237,.28),inset_0_1px_0_rgba(255,255,255,.16)]" : "border border-transparent text-neutral-500 hover:bg-white/[0.045] hover:text-white"}`} key={tab.value} onClick={() => onChange(tab.value)} type="button">
          {tx(tab.label)}
        </button>
      ))}
    </div>
  );
}

function StagePanel({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

function VisualEffectGrid<T extends string>({ onChange, options, value }: { onChange: (value: T) => void; options: ReadonlyArray<{ label: string; value: T }>; value: T | "" }) {
  const { tx } = usePitchI18n();
  return (
    <div className="grid grid-cols-2 gap-2" role="listbox">
      <style>{`
        @keyframes motion-card-move { 0%, 14%, 100% { transform: translateX(-10px); } 58%, 72% { transform: translateX(18px); } }
        @keyframes motion-card-arc-up { 0%, 14%, 100% { transform: translate(-12px, 8px); } 58%, 72% { transform: translate(16px, -8px); } }
        @keyframes motion-card-arc-down { 0%, 14%, 100% { transform: translate(15px, -8px); } 58%, 72% { transform: translate(-14px, 8px); } }
        @keyframes motion-card-scale { 0%, 14%, 100% { transform: scale(.72); } 58%, 72% { transform: scale(1.2); } }
        @keyframes motion-card-rotate { 0%, 14%, 100% { transform: rotate(-12deg); } 58%, 72% { transform: rotate(34deg); } }
        @keyframes motion-card-fade { 0%, 14%, 100% { opacity: .22; transform: translateY(8px); } 58%, 72% { opacity: 1; transform: translateY(-6px); } }
        @keyframes motion-card-pop { 0%, 14%, 100% { transform: scale(.55); opacity: .35; } 48% { transform: scale(1.18); opacity: 1; } 66%, 72% { transform: scale(1); opacity: 1; } }
        @keyframes motion-card-number { 0%, 18% { opacity: .45; transform: translateY(2px); } 52%, 78% { opacity: 1; transform: translateY(0); } 100% { opacity: .45; transform: translateY(2px); } }
        .motion-effect-card:is(:hover,[aria-selected="true"]) .motion-card-move { animation: motion-card-move 1.55s ease-in-out infinite; }
        .motion-effect-card:is(:hover,[aria-selected="true"]) .motion-card-arc-up { animation: motion-card-arc-up 1.65s ease-in-out infinite; }
        .motion-effect-card:is(:hover,[aria-selected="true"]) .motion-card-arc-down { animation: motion-card-arc-down 1.65s ease-in-out infinite; }
        .motion-effect-card:is(:hover,[aria-selected="true"]) .motion-card-scale { animation: motion-card-scale 1.55s ease-in-out infinite; }
        .motion-effect-card:is(:hover,[aria-selected="true"]) .motion-card-rotate { animation: motion-card-rotate 1.55s ease-in-out infinite; }
        .motion-effect-card:is(:hover,[aria-selected="true"]) .motion-card-fade { animation: motion-card-fade 1.55s ease-in-out infinite; }
        .motion-effect-card:is(:hover,[aria-selected="true"]) .motion-card-pop { animation: motion-card-pop 1.55s ease-in-out infinite; }
        .motion-effect-card:is(:hover,[aria-selected="true"]) .motion-card-number { animation: motion-card-number 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .motion-effect-card * { animation: none !important; } }
      `}</style>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              aria-selected={selected}
              className={`motion-effect-card group relative flex h-[104px] min-w-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[14px] border transition-all duration-200 active:scale-[0.985] ${selected ? "border-violet-400/90 bg-[radial-gradient(circle_at_50%_30%,rgba(139,92,246,.2),rgba(139,92,246,.07)_55%,rgba(0,0,0,.08))] text-violet-50 shadow-[inset_0_0_0_1px_rgba(196,181,253,.16),0_10px_26px_rgba(76,29,149,.2)]" : "border-white/[0.09] bg-[linear-gradient(155deg,rgba(255,255,255,.025),rgba(0,0,0,.16))] text-neutral-500 shadow-[inset_0_1px_0_rgba(255,255,255,.025)] hover:border-white/[0.18] hover:bg-white/[0.045] hover:text-neutral-200"}`}
              key={option.value}
              onClick={() => onChange(option.value)}
              role="option"
              title={tx(option.label)}
              type="button"
            >
              <EffectVisual active={selected} value={option.value} />
              <span className={`absolute bottom-2 max-w-full truncate px-2 text-[9px] font-semibold transition-opacity ${selected ? "text-violet-200 opacity-100" : "text-neutral-500 opacity-0 group-hover:opacity-100"}`}>{tx(option.label)}</span>
            </button>
          );
        })}
    </div>
  );
}

function EffectVisual({ active, value }: { active: boolean; value: string }) {
  if (value === "numberRange") {
    return <span className={`motion-card-number font-mono text-[22px] font-medium tabular-nums transition ${active ? "text-violet-300" : "text-neutral-400"}`}>100 → 0</span>;
  }
  const motionClass = effectMotionClass(value);
  return (
    <span className="relative flex h-14 w-[92px] items-center justify-center overflow-visible text-neutral-500">
      {isFadeEffect(value) ? (
        <span className="absolute inset-0 flex items-center justify-center">
          {[0, 1, 2].map((index) => <Square className="absolute size-7 fill-violet-500/15 text-violet-400/20" key={index} style={{ transform: `translateY(${index * 7 - 2}px)`, opacity: .22 + index * .18 }} strokeWidth={1.2} />)}
        </span>
      ) : null}
      <Square className={`${motionClass} size-8 fill-violet-500/80 text-violet-300 transition-[transform,opacity] duration-500 ${active ? "drop-shadow-[0_8px_12px_rgba(124,58,237,.28)]" : "opacity-75 group-hover:opacity-100"}`} strokeWidth={1.35} />
      <span className={`absolute right-0 top-1/2 -translate-y-1/2 transition ${active ? "text-violet-100" : "text-neutral-400"}`}>{effectMotionGlyph(value)}</span>
    </span>
  );
}

function effectMotionClass(value: string) {
  if (value === "move" || value === "slideLeft" || value === "slideRight") return "motion-card-move";
  if (value === "arcUp" || value === "fadeUp" || value === "rise") return "motion-card-arc-up";
  if (value === "arcDown" || value === "fadeDown") return "motion-card-arc-down";
  if (value === "scale" || value === "zoomIn" || value === "zoomOut" || value === "shrink") return "motion-card-scale";
  if (value === "rotate" || value === "drift") return "motion-card-rotate";
  if (isFadeEffect(value)) return "motion-card-fade";
  if (value === "pop") return "motion-card-pop";
  return "motion-card-move";
}

function isFadeEffect(value: string) {
  return value === "fade" || value === "fadeIn" || value === "fadeOut";
}

function effectMotionGlyph(value: string) {
  if (value === "arcUp" || value === "fadeUp" || value === "rise") return <CornerUpRight size={20} strokeWidth={1.5} />;
  if (value === "arcDown" || value === "fadeDown") return <CornerDownLeft size={20} strokeWidth={1.5} />;
  if (value === "scale" || value === "zoomIn" || value === "zoomOut" || value === "shrink") return <Maximize2 size={19} strokeWidth={1.5} />;
  if (value === "rotate" || value === "drift") return <RotateCw size={19} strokeWidth={1.5} />;
  if (isFadeEffect(value)) return <Layers3 size={19} strokeWidth={1.5} />;
  if (value === "pop") return <Sparkles size={18} strokeWidth={1.5} />;
  if (value === "none") return <Minus size={18} strokeWidth={1.5} />;
  return <MoveRight size={20} strokeWidth={1.5} />;
}

function TweenCanvasControls({ action, endpoint, onChange, onEndpointChange, onPreview, onToggleAdvanced, showAdvanced }: {
  action: MotionTweenAction;
  endpoint: Endpoint;
  onChange: (update: (action: MotionTweenAction) => MotionTweenAction) => void;
  onEndpointChange: (endpoint: Endpoint) => void;
  onPreview: () => void;
  onToggleAdvanced: () => void;
  showAdvanced: boolean;
}) {
  const { tx } = usePitchI18n();
  const pathType = !action.path ? "straight" : action.path.controlY < midpointY(action) ? "arcUp" : "arcDown";
  function setPath(value: "straight" | "arcUp" | "arcDown") {
    if (value === "straight") onChange((candidate) => ({ ...candidate, path: undefined, preset: candidate.preset === "arcUp" || candidate.preset === "arcDown" ? "move" : candidate.preset }));
    else onChange((candidate) => applyTweenPreset(candidate, value));
  }
  return (
    <div className="overflow-hidden rounded-[16px] border border-white/[0.1] bg-[linear-gradient(150deg,rgba(255,255,255,.025),rgba(0,0,0,.18))] shadow-[inset_0_1px_0_rgba(255,255,255,.025)]">
      <div className="flex h-11 items-center gap-1.5 p-1.5">
        <button className={`flex h-8 flex-1 items-center gap-2 rounded-lg px-2 text-[9px] font-semibold transition ${endpoint === "from" ? "bg-violet-500/20 text-violet-100" : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"}`} onClick={() => onEndpointChange("from")} type="button"><span className="flex size-4 items-center justify-center rounded-full bg-violet-500 text-[8px] text-white">1</span>{tx("Start")}</button>
        <MoveRight className="shrink-0 text-neutral-700" size={12} />
        <button className={`flex h-8 flex-1 items-center gap-2 rounded-lg px-2 text-[9px] font-semibold transition ${endpoint === "to" ? "bg-white/[0.07] text-white" : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"}`} onClick={() => onEndpointChange("to")} type="button"><span className="flex size-4 items-center justify-center rounded-full bg-white text-[8px] text-black">2</span>{tx("End")}</button>
        <button aria-label={tx("Advanced")} className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition ${showAdvanced ? "bg-white/[0.08] text-white" : "text-neutral-600 hover:bg-white/[0.04] hover:text-neutral-300"}`} onClick={onToggleAdvanced} title={tx("Advanced")} type="button"><Settings2 size={12} /></button>
      </div>
      <div className="grid grid-cols-3 gap-1 border-t border-white/[0.055] p-1.5">
        {(["straight", "arcUp", "arcDown"] as const).map((value) => (
          <button className={`flex h-7 items-center justify-center gap-0.5 whitespace-nowrap rounded-lg px-1 text-[7.5px] font-semibold transition ${pathType === value ? "bg-violet-500/16 text-violet-100" : "text-neutral-600 hover:bg-white/[0.035] hover:text-neutral-300"}`} key={value} onClick={() => setPath(value)} type="button"><CornerUpRight className={value === "arcDown" ? "rotate-90" : ""} size={9} />{tx(value === "straight" ? "Straight" : value === "arcUp" ? "Arc up" : "Arc down")}</button>
        ))}
      </div>
      {showAdvanced ? (
        <div className="flex flex-col gap-2 border-t border-white/[0.055] p-2.5">
          <EndpointTabs endpoint={endpoint} onChange={onEndpointChange} />
          {endpoint === "path" ? <PathEditor action={action} onChange={onChange} /> : <StateEditor label={endpoint === "from" ? "Start point" : "End point"} onChange={(state) => onChange((candidate) => ({ ...candidate, [endpoint]: state }))} state={action[endpoint]} />}
        </div>
      ) : null}
      <div className="border-t border-white/[0.055] p-2.5">
        <button className="mx-auto flex h-9 min-w-28 items-center justify-center gap-2 rounded-xl border border-white/[0.16] bg-white/[0.035] px-4 text-[10px] font-semibold text-white transition hover:border-violet-300/45 hover:bg-violet-500/10" onClick={onPreview} type="button">
          <Play fill="currentColor" size={11} />{tx("Preview")}
        </button>
      </div>
    </div>
  );
}

function CompactSelect<T extends string>({ label, onChange, options, value }: { label: string; onChange: (value: T) => void; options: ReadonlyArray<{ label: string; value: T }>; value: T }) {
  const { tx } = usePitchI18n();
  return (
    <label className="grid grid-cols-[68px_minmax(0,1fr)] items-center gap-2 text-[10px] font-medium text-neutral-500">
      <span>{tx(label)}</span>
      <Select onValueChange={(next) => onChange(next as T)} value={value}>
        <SelectTrigger className="h-8 rounded-lg px-2.5 text-[11px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem className="min-h-8 text-[11px]" key={option.value} value={option.value}>{tx(option.label)}</SelectItem>)}
        </SelectContent>
      </Select>
    </label>
  );
}

function TimingEditor({ action, footer, onChange }: { action: MotionAction; footer?: ReactNode; onChange: (update: (candidate: MotionAction) => MotionAction) => void }) {
  const { tx } = usePitchI18n();
  const [open, setOpen] = useState(false);
  const starts = motionActionStarts.filter((value) => action.order !== 0 || value !== "withPrevious");
  return (
    <div className="overflow-hidden rounded-[14px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,.025),rgba(0,0,0,.14))]">
      <button aria-expanded={open} className="flex h-11 w-full items-center justify-between px-3 text-left transition hover:bg-white/[0.035]" onClick={() => setOpen((current) => !current)} type="button">
        <span className="flex items-center gap-2 text-[10px] font-semibold text-neutral-300"><ChevronDown className={`text-neutral-500 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`} size={13} />{tx("Advanced timing")}</span>
        <span className="flex items-center gap-2 text-[9px] text-neutral-600"><span>{tx(startLabel(action.start))} · {action.duration.toFixed(1)}s</span><SlidersHorizontal size={13} /></span>
      </button>
      {open ? (
        <div className="flex flex-col gap-2 border-t border-white/[0.055] p-2.5">
          <CompactSelect label="Start mode" onChange={(value) => onChange((candidate) => ({ ...candidate, start: value as MotionAction["start"] }))} options={starts.map((value) => ({ label: startLabel(value), value }))} value={action.start} />
          <NumberInput min="0.1" max="30" onChange={(value) => value !== "" && onChange((candidate) => ({ ...candidate, duration: Number(value) }))} prefix={tx("Duration")} step="0.1" suffix="s" value={action.duration} />
          <CompactSelect label="Easing" onChange={(value) => onChange((candidate) => ({ ...candidate, easing: value as MotionEasing }))} options={motionEasings.map((value) => ({ label: easingLabel(value), value }))} value={action.easing} />
          {footer ? <div className="border-t border-white/[0.055] pt-2">{footer}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function EndpointTabs({ endpoint, onChange }: { endpoint: Endpoint; onChange: (endpoint: Endpoint) => void }) {
  const { tx } = usePitchI18n();
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/[0.035] p-1">
      {(["from", "to", "path"] as const).map((value) => (
        <button className={`h-7 rounded-lg text-[9px] font-semibold transition ${endpoint === value ? "bg-violet-500/18 text-violet-100" : "text-neutral-600 hover:text-neutral-300"}`} key={value} onClick={() => onChange(value)} type="button">
          {tx(value === "from" ? "Start point" : value === "to" ? "End point" : "Path")}
        </button>
      ))}
    </div>
  );
}

function StateEditor({ label, onChange, state }: { label: string; onChange: (state: MotionTweenState) => void; state: MotionTweenState }) {
  const { tx } = usePitchI18n();
  return (
    <div className="rounded-xl border border-white/[0.055] bg-black/20 p-2.5">
      <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.09em] text-neutral-600">{tx(label)}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {(["x", "y", "w", "h"] as const).map((key) => (
          <NumberInput key={key} min={key === "w" || key === "h" ? "0.1" : "-200"} max="200" onChange={(value) => value !== "" && onChange({ ...state, [key]: Number(value) })} prefix={key.toUpperCase()} step="0.5" suffix="%" value={state[key]} />
        ))}
        <NumberInput min="-1080" max="1080" onChange={(value) => value !== "" && onChange({ ...state, rotation: Number(value) })} prefix={tx("Rotation")} step="1" suffix="°" value={state.rotation} />
        <NumberInput min="0" max="1" onChange={(value) => value !== "" && onChange({ ...state, opacity: Number(value) })} prefix={tx("Opacity")} step="0.05" value={state.opacity} />
      </div>
    </div>
  );
}

function PathEditor({ action, onChange }: { action: MotionTweenAction; onChange: (update: (action: MotionTweenAction) => MotionTweenAction) => void }) {
  const { tx } = usePitchI18n();
  const pathType = !action.path ? "straight" : action.path.controlY < midpointY(action) ? "arcUp" : "arcDown";
  function setPath(value: "straight" | "arcUp" | "arcDown") {
    if (value === "straight") {
      onChange((candidate) => ({ ...candidate, path: undefined, preset: candidate.preset === "arcUp" || candidate.preset === "arcDown" ? "move" : candidate.preset }));
      return;
    }
    onChange((candidate) => applyTweenPreset(candidate, value));
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/[0.055] bg-black/20 p-2.5">
      <div className="grid grid-cols-3 gap-1">
        {(["straight", "arcUp", "arcDown"] as const).map((value) => (
          <button className={`flex h-8 items-center justify-center gap-0.5 whitespace-nowrap rounded-lg px-1 text-[8px] font-semibold transition ${pathType === value ? "bg-violet-500/18 text-violet-100" : "bg-white/[0.035] text-neutral-500 hover:text-neutral-200"}`} key={value} onClick={() => setPath(value)} type="button">
            <CornerUpRight className={value === "arcDown" ? "rotate-90" : ""} size={11} />{tx(value === "straight" ? "Straight" : value === "arcUp" ? "Arc up" : "Arc down")}
          </button>
        ))}
      </div>
      {action.path ? (
        <div className="grid grid-cols-2 gap-1.5">
          <NumberInput min="-200" max="200" onChange={(value) => value !== "" && onChange((candidate) => ({ ...candidate, path: { controlX: Number(value), controlY: candidate.path?.controlY ?? 0 } }))} prefix="CX" step="0.5" suffix="%" value={action.path.controlX} />
          <NumberInput min="-200" max="200" onChange={(value) => value !== "" && onChange((candidate) => ({ ...candidate, path: { controlX: candidate.path?.controlX ?? 0, controlY: Number(value) } }))} prefix="CY" step="0.5" suffix="%" value={action.path.controlY} />
        </div>
      ) : <StageHint>{tx("Straight path uses the shortest route between both points.")}</StageHint>}
    </div>
  );
}

function NumberRangeEditor({ duration, onChange, onDurationChange, onPreview, range }: {
  duration: number;
  onChange: (range: MotionNumberRange) => void;
  onDurationChange: (duration: number) => void;
  onPreview: () => void;
  range: MotionNumberRange;
}) {
  const { tx } = usePitchI18n();
  const [draftRange, setDraftRange] = useState(range);
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => setDraftRange(range), [range.from, range.step, range.to]);
  const ascending = draftRange.to >= draftRange.from;
  const lower = Math.min(draftRange.from, draftRange.to);
  const upper = Math.max(draftRange.from, draftRange.to);
  const span = upper - lower;
  const sliderMin = span > 0 ? lower : lower - Math.max(10, Math.abs(lower) || 10);
  const sliderMax = span > 0 ? upper : upper + Math.max(10, Math.abs(upper) || 10);

  function boundsFromValues(values: number[]) {
    const nextLower = values[0] ?? lower;
    const nextUpper = values[1] ?? upper;
    return ascending
      ? { ...draftRange, from: nextLower, to: nextUpper }
      : { ...draftRange, from: nextUpper, to: nextLower };
  }

  function commitRange(nextRange: MotionNumberRange) {
    setDraftRange(nextRange);
    onChange(nextRange);
  }

  function setDirection(nextAscending: boolean) {
    if (nextAscending === ascending) return;
    commitRange({ ...draftRange, from: draftRange.to, to: draftRange.from });
  }

  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-white/[0.1] bg-[linear-gradient(150deg,rgba(255,255,255,.028),rgba(0,0,0,.18))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.03)]">
      <div className="grid grid-cols-[56px_minmax(0,1fr)_56px] items-center gap-2">
        <NumberInput aria-label={tx("Count from")} commitOnBlur min="-1000000000" max="1000000000" onChange={(value) => value !== "" && commitRange({ ...draftRange, from: Number(value) })} step="1" value={draftRange.from} />
        <Slider
          aria-label={tx("Number range")}
          className="[&_[data-slot=slider-range]]:bg-violet-400 [&_[data-slot=slider-thumb]]:border-violet-300 [&_[data-slot=slider-thumb]]:shadow-[0_0_0_3px_rgba(139,92,246,.12)]"
          max={sliderMax}
          min={sliderMin}
          onValueChange={(values) => setDraftRange(boundsFromValues(values))}
          onValueCommit={(values) => commitRange(boundsFromValues(values))}
          step={Math.max(0.000001, Math.min(draftRange.step, sliderMax - sliderMin))}
          value={[lower, upper]}
        />
        <NumberInput aria-label={tx("Count to")} commitOnBlur min="-1000000000" max="1000000000" onChange={(value) => value !== "" && commitRange({ ...draftRange, to: Number(value) })} step="1" value={draftRange.to} />
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <Select onValueChange={(value) => onDurationChange(Number(value))} value={String(duration)}>
          <SelectTrigger aria-label={tx("Duration")} className="h-8 w-24 rounded-xl border-white/[0.1] bg-black/20 px-3 text-[10px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[0.3, 0.6, 0.8, 1, 1.5, 2].map((value) => <SelectItem className="min-h-8 text-[11px]" key={value} value={String(value)}>{value.toFixed(1)} {tx("Seconds short")}</SelectItem>)}
          </SelectContent>
        </Select>
        <button aria-label={tx("Advanced")} className={`flex size-8 items-center justify-center rounded-xl border transition ${showDetails ? "border-violet-300/30 bg-violet-500/15 text-violet-100" : "border-white/[0.08] bg-black/15 text-neutral-500 hover:text-neutral-200"}`} onClick={() => setShowDetails((current) => !current)} title={tx("Advanced")} type="button"><Settings2 size={12} /></button>
      </div>
      <button className="mx-auto flex h-9 min-w-28 items-center justify-center gap-2 rounded-xl border border-white/[0.18] bg-white/[0.035] px-4 text-[10px] font-semibold text-white transition hover:border-violet-300/45 hover:bg-violet-500/10" onClick={onPreview} type="button"><Play fill="currentColor" size={11} />{tx("Preview")}</button>
      {showDetails ? (
        <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-2.5">
          <div className="flex rounded-lg bg-black/25 p-0.5">
            <button className={`flex-1 rounded-md px-2 py-1.5 text-[9px] font-semibold transition ${!ascending ? "bg-violet-500/25 text-violet-100" : "text-neutral-600 hover:text-neutral-300"}`} onClick={() => setDirection(false)} type="button">{tx("Countdown")}</button>
            <button className={`flex-1 rounded-md px-2 py-1.5 text-[9px] font-semibold transition ${ascending ? "bg-violet-500/25 text-violet-100" : "text-neutral-600 hover:text-neutral-300"}`} onClick={() => setDirection(true)} type="button">{tx("Count up")}</button>
          </div>
          <NumberInput commitOnBlur min="0.000001" max="1000000000" onChange={(value) => value !== "" && Number(value) > 0 && commitRange({ ...draftRange, step: Number(value) })} prefix={tx("Step interval")} step="1" value={draftRange.step} />
        </div>
      ) : null}
    </div>
  );
}

function StageHint({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-white/[0.025] px-2.5 py-2 text-[9px] leading-4 text-neutral-600">{children}</p>;
}

function IconButton({ children, danger = false, label, onClick }: { children: ReactNode; danger?: boolean; label: string; onClick: () => void }) {
  const { tx } = usePitchI18n();
  return <button aria-label={tx(label)} className={`flex h-8 items-center justify-center rounded-lg border transition ${danger ? "border-red-400/15 text-red-300 hover:bg-red-500/10" : "border-white/[0.07] text-neutral-400 hover:bg-white/[0.06] hover:text-white"}`} onClick={onClick} title={tx(label)} type="button">{children}</button>;
}

function previewAction(block: MotionDocBlockWithProps, action: MotionAction) {
  const id = typeof block.props.id === "string" ? block.props.id : "";
  const element = id ? document.querySelector<HTMLElement>(`[data-motion-doc-node-id="${CSS.escape(id)}"]`) : null;
  if (!element || typeof element.animate !== "function") return;
  if (action.type === "tween" && action.preset === "numberRange" && action.numberRange) {
    const target = element.querySelector<HTMLElement>("[data-motion-text-content]");
    if (!target) return;
    const previousFrame = numberPreviewFrames.get(target);
    if (previousFrame !== undefined) window.cancelAnimationFrame(previousFrame);
    const originalContent = target.innerHTML;
    const startedAt = performance.now();
    const duration = Math.max(0, action.duration) * 1000;
    const tick = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      target.textContent = formatMotionNumber(interpolateMotionNumber(action.numberRange!, progress, action.easing), action.numberRange!);
      if (progress < 1) numberPreviewFrames.set(target, window.requestAnimationFrame(tick));
      else {
        target.innerHTML = originalContent;
        numberPreviewFrames.delete(target);
      }
    };
    numberPreviewFrames.set(target, window.requestAnimationFrame(tick));
    return;
  }
  let frames: Keyframe[];
  if (action.type === "tween") {
    const frameCount = action.path ? 31 : 2;
    frames = Array.from({ length: frameCount }, (_, index) => {
      const state = interpolateMotionState(action.from, action.to, index / (frameCount - 1), action.easing, action.path);
      return { height: `${state.h}%`, left: `${state.x}%`, opacity: state.opacity, rotate: `${state.rotation}deg`, top: `${state.y}%`, width: `${state.w}%` };
    });
  } else {
    frames = action.type === "enter" ? enterFrames(action.preset) : exitFrames(action.preset);
  }
  element.getAnimations().forEach((animation) => animation.cancel());
  element.animate(frames, { duration: action.duration * 1000, easing: cssEasing(action.easing) });
}

const numberPreviewFrames = new WeakMap<HTMLElement, number>();

function enterFrames(preset: string): Keyframe[] {
  if (preset === "fadeUp" || preset === "rise") return [{ opacity: 0, transform: "translateY(28px)" }, { opacity: 1, transform: "translateY(0)" }];
  if (preset === "slideLeft") return [{ opacity: 0, transform: "translateX(52px)" }, { opacity: 1, transform: "translateX(0)" }];
  if (preset === "zoomIn") return [{ opacity: 0, transform: "scale(.86)" }, { opacity: 1, transform: "scale(1)" }];
  if (preset === "pop") return [{ opacity: 0, transform: "scale(.72)" }, { opacity: 1, transform: "scale(1)" }];
  return [{ opacity: 0 }, { opacity: 1 }];
}

function exitFrames(preset: string): Keyframe[] {
  if (preset === "fadeDown") return [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(28px)" }];
  if (preset === "slideRight") return [{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: "translateX(52px)" }];
  if (preset === "zoomOut") return [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.16)" }];
  if (preset === "shrink") return [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.72)" }];
  return [{ opacity: 1 }, { opacity: 0 }];
}

function midpointY(action: MotionTweenAction) { return (action.from.y + action.from.h / 2 + action.to.y + action.to.h / 2) / 2; }
function actionEffectLabel(value: MotionTweenPreset | undefined) { return actionEffects.find((effect) => effect.value === value)?.label ?? "Move"; }
function startLabel(value: string) { return value === "onClick" ? "On click" : value === "afterPrevious" ? "After previous" : "With previous"; }
function easingLabel(value: string) { return value === "easeIn" ? "Ease in" : value === "easeOut" ? "Ease out" : value === "easeInOut" ? "Ease in & out" : "Linear"; }
function cssEasing(value: MotionEasing) { return value === "easeIn" ? "ease-in" : value === "easeOut" ? "ease-out" : value === "easeInOut" ? "ease-in-out" : "linear"; }

function legacyPreviewAction(block: MotionDocBlockWithProps, preset: EnterAnimation): MotionEnterAction | null {
  if (preset === "none") return null;
  const duration = Number(block.props.duration);
  return {
    duration: Number.isFinite(duration) && duration >= 0.1 ? duration : 0.6,
    easing: "easeInOut",
    id: "legacy-preview",
    order: 0,
    preset,
    start: "afterPrevious",
    type: "enter"
  };
}

function effectIcon(value: string) {
  if (value === "none") return <Minus size={12} />;
  if (value === "move" || value === "slideLeft") return <MoveRight size={13} />;
  if (value === "scale") return <Scaling size={13} />;
  if (value === "rotate") return <RotateCw size={13} />;
  if (value === "fade" || value === "fadeIn" || value === "fadeOut") return <Eye size={13} />;
  if (value === "arcUp" || value === "fadeUp") return <TrendingUp size={13} />;
  if (value === "arcDown" || value === "fadeDown") return <TrendingDown size={13} />;
  if (value === "drift") return <Sparkles size={13} />;
  if (value === "slideRight") return <ArrowRightFromLine size={13} />;
  if (value === "zoomIn" || value === "pop") return <ZoomIn size={13} />;
  if (value === "zoomOut") return <ZoomOut size={13} />;
  if (value === "shrink") return <Minimize2 size={13} />;
  if (value === "numberRange") return <Hash size={13} />;
  return <Sparkles size={13} />;
}

function initialNumberRange(block: MotionDocBlockWithProps): MotionNumberRange {
  const text = "text" in block ? block.text.replaceAll(",", "").trim() : "";
  const finalValue = text && Number.isFinite(Number(text)) ? Number(text) : 0;
  return { from: finalValue === 0 ? 100 : 0, step: 1, to: finalValue };
}

function quickActionEffects(isText: boolean): ReadonlyArray<{ label: string; value: MotionTweenPreset }> {
  return [
    { label: "Move", value: "move" },
    { label: "Drift", value: "drift" },
    { label: "Arc up", value: "arcUp" },
    { label: "Scale", value: "scale" },
    { label: "Fade", value: "fade" },
    isText ? { label: "Number range", value: "numberRange" } : { label: "Rotate", value: "rotate" }
  ];
}
