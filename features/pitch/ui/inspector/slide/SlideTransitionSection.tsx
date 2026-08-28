import { ChevronDown, ChevronRight, Diamond, GalleryVerticalEnd, MousePointerClick, Play, Plus, RotateCcw, SlidersHorizontal, Sparkles, Waves } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { slideTransitionPresets, type SlideTransition } from "@/features/pitch/application/motionPresets";
import type { MotionDocProps, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import {
  hasSharedMorphReturnLink,
  normalizeSharedMorphEasing,
  sharedMorphCurveFromProps,
  sharedMorphEffectProps,
  type SharedMorphCurve,
  type SharedMorphEasing
} from "@/core/motion-doc/domain/sharedMorph";
import { interactionFromProps } from "@/core/motion-doc/domain/interaction";
import { applySlideTransitionProps, normalizeSlideMotion } from "@/features/pitch/application/motionModel";
import { captureSharedMorph, playSharedMorph } from "@/features/pitch/application/motionPlayback";
import { Field, NumberInput } from "@/features/pitch/ui/inspector/InspectorControls";
import { AccordionSection } from "@/features/pitch/ui/inspector/controls/AccordionSection";
import { MorphCurveEditor } from "@/features/pitch/ui/inspector/MorphCurveEditor";
import { MotionThumbnailGrid } from "@/features/pitch/ui/inspector/controls/MotionThumbnailGrid";
import { SlideThumbnailPreview } from "@/features/pitch/ui/preview/SlideThumbnailPreview";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Slider, Switch } from "@/common/ui/shadcnPrimitives";
import morphConnector from "@/packages/slidex-workbench/src/client/assets/morph-connector.webp";

type SlideTransitionSectionProps = {
  activeSlide: MotionDocScene | undefined;
  activeSlideIndex: number;
  duration: number;
  extendSharedMorphGroup: (endIndex: number) => void;
  nextSlide: MotionDocScene | undefined;
  onSelectBlock: (index: number | null) => void;
  onSelectSlide: (index: number) => void;
  scenes: MotionDocScene[];
  setSharedMorphReturnLink: (groupStartIndex: number, detailSlideIndex: number, enabled: boolean) => void;
  slideTransition: string | number | undefined;
  transitionDuration: string | number | undefined;
  updateActiveSlideStyle: (updates: MotionDocProps) => void;
  updateSlideStyle: (slideIndex: number, updates: MotionDocProps) => void;
};

const morphEasingOptions: ReadonlyArray<{ description: string; label: string; value: SharedMorphEasing }> = [
  { description: "Constant speed", label: "Linear", value: "linear" },
  { description: "Accelerates at the start", label: "Ease in", value: "easeIn" },
  { description: "Settles gently at the end", label: "Ease out", value: "easeOut" },
  { description: "Balanced acceleration and deceleration", label: "Ease in and out", value: "easeInOut" },
  { description: "Soft presentation motion", label: "Smooth", value: "smooth" },
  { description: "Fast focus with a calm finish", label: "Emphasized", value: "emphasized" },
  { description: "Subtle elastic response", label: "Spring", value: "spring" },
  { description: "Overshoots before settling", label: "Back out", value: "backOut" },
  { description: "Drag both curve handles", label: "Custom", value: "custom" }
];

export function SlideTransitionSection({
  activeSlide,
  activeSlideIndex,
  duration,
  extendSharedMorphGroup,
  onSelectBlock,
  onSelectSlide,
  scenes,
  setSharedMorphReturnLink,
  slideTransition,
  transitionDuration,
  updateActiveSlideStyle,
  updateSlideStyle
}: SlideTransitionSectionProps) {
  const { tx } = usePitchI18n();
  const sourceSlideIndex = morphSourceIndex(scenes, activeSlideIndex);
  const morphGroup = morphGroupRange(scenes, activeSlideIndex);
  const ownSourceSlide = scenes[sourceSlideIndex] ?? activeSlide;
  const sourceSlide = ownSourceSlide
    ? { ...ownSourceSlide, props: sharedMorphEffectProps(scenes, sourceSlideIndex) }
    : undefined;
  const targetSlide = scenes[sourceSlideIndex + 1];
  const sourceTransition = sourceSlideIndex === activeSlideIndex ? slideTransition : sourceSlide?.props.slideTransition;
  const sourceTransitionDuration = sourceSlideIndex === activeSlideIndex ? transitionDuration : sourceSlide?.props.transitionDuration;
  const selectedTransition = normalizeSlideMotion({ slideTransition: sourceTransition, transitionDuration: sourceTransitionDuration }).slideTransition;
  const transitionOptions = slideTransitionPresets.filter((preset) => ["none", "morph", "fade", "pushLeft", "scale", "wipe"].includes(preset.value));

  function updateSource(updates: MotionDocProps) {
    if (sourceSlideIndex === activeSlideIndex) updateActiveSlideStyle(updates);
    else updateSlideStyle(sourceSlideIndex, updates);
  }

  function updateEffect(updates: MotionDocProps) {
    const effectSourceIndex = ownSourceSlide?.props.morphEffectMode === "inherit"
      ? morphGroup.startIndex
      : sourceSlideIndex;
    if (effectSourceIndex === activeSlideIndex) updateActiveSlideStyle(updates);
    else updateSlideStyle(effectSourceIndex, updates);
  }

  function updateTransition(value: SlideTransition) {
    updateSource(applySlideTransitionProps({ transitionDuration: sourceTransitionDuration ?? "" }, value));
  }

  return <>
    <AccordionSection defaultOpen={false} icon={<MousePointerClick size={13} />} title="Slide Interaction & Timing">
      <Field label="Slide Duration">
        <NumberInput min="0.5" onChange={(value) => updateActiveSlideStyle({ duration: value || 5 })} step="0.5" suffix="s" value={duration} />
      </Field>
      <ClickAreaOverview activeSlide={activeSlide} onSelectBlock={onSelectBlock} tx={tx} />
    </AccordionSection>

    <AccordionSection icon={<Diamond className={selectedTransition === "morph" ? "fill-violet-400/45" : ""} size={12} />} title="Transition Effects" defaultOpen>
      <MotionThumbnailGrid label="Transition style" onChange={updateTransition} options={transitionOptions} value={selectedTransition} variant="slide" />
      {selectedTransition === "morph" ? (
        <MorphTransitionEditor
          activeSlideIndex={activeSlideIndex}
          groupEndIndex={morphGroup.endIndex}
          groupStartIndex={morphGroup.startIndex}
          onAddSlide={() => extendSharedMorphGroup(morphGroup.endIndex)}
          onSelectSlide={onSelectSlide}
          onUpdate={updateEffect}
          scenes={scenes}
          setSharedMorphEffectMode={(slideIndex, enabled) => updateSlideStyle(slideIndex, { morphEffectMode: enabled ? "inherit" : "custom" })}
          setSharedMorphReturnLink={setSharedMorphReturnLink}
          sourceSlide={sourceSlide}
          sourceSlideIndex={sourceSlideIndex}
          targetSlide={targetSlide}
          tx={tx}
        />
      ) : selectedTransition !== "none" ? (
        <Field label="Transition duration">
          <NumberInput min="0.1" onChange={(value) => updateSource({ transitionDuration: value === "" ? "" : value })} placeholder="0.72" step="0.05" suffix="s" value={sourceTransitionDuration ?? ""} />
        </Field>
      ) : null}
    </AccordionSection>
  </>;
}

function ClickAreaOverview({ activeSlide, onSelectBlock, tx }: {
  activeSlide: MotionDocScene | undefined;
  onSelectBlock: (index: number | null) => void;
  tx: (value: string) => string;
}) {
  const blocks = activeSlide?.blocks ?? [];
  const activeCount = blocks.filter((block) => interactionFromProps(block.props)).length;
  return (
    <section className="overflow-hidden rounded-[17px] border border-violet-400/20 bg-[linear-gradient(155deg,rgba(124,58,237,.07),rgba(0,0,0,.13)_55%)]">
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-3 py-3">
        <span className="flex size-8 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200"><MousePointerClick size={14} /></span>
        <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-neutral-100">{tx("Click Areas")}</span><span className="mt-0.5 block text-[9px] text-neutral-500">{tx("Choose a layer to define what happens when it is clicked.")}</span></span>
        <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-2 py-1 text-[9px] font-semibold text-violet-200">{activeCount}</span>
      </div>
      <div className="flex flex-col gap-1.5 p-2.5">
        {blocks.length > 0 ? blocks.map((block, index) => {
          const interaction = interactionFromProps(block.props);
          return (
            <button className="group flex min-h-11 items-center gap-2.5 rounded-[11px] border border-white/[0.055] bg-black/15 px-3 text-left transition hover:border-violet-300/25 hover:bg-violet-500/[0.07]" key={String(block.props.id ?? index)} onClick={() => onSelectBlock(index)} type="button">
              <span className={`size-2.5 rounded-[3px] border ${interaction ? "border-violet-200/60 bg-violet-400 shadow-[0_0_10px_rgba(139,92,246,.35)]" : "border-white/15 bg-white/[0.04]"}`} />
              <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-medium text-neutral-300">{layerLabel(block, index)}</span><span className={`mt-0.5 block text-[9px] ${interaction ? "text-violet-300/80" : "text-neutral-600"}`}>{interaction ? tx(clickAreaActionLabel(interaction.action.type)) : tx("Add click action")}</span></span>
              <ChevronDown className="-rotate-90 text-neutral-700 transition group-hover:text-violet-300" size={12} />
            </button>
          );
        }) : <p className="px-3 py-6 text-center text-[10px] leading-5 text-neutral-500">{tx("Add a layer before creating a click area.")}</p>}
      </div>
    </section>
  );
}

function clickAreaActionLabel(type: string) {
  if (type === "nextSlide") return "Next slide";
  if (type === "previousSlide") return "Previous slide";
  if (type === "goToSlide") return "Go to slide";
  if (type === "openUrl") return "Open link";
  return "Click action";
}

function MorphTransitionEditor({ activeSlideIndex, groupEndIndex, groupStartIndex, onAddSlide, onSelectSlide, onUpdate, scenes, setSharedMorphEffectMode, setSharedMorphReturnLink, sourceSlide, sourceSlideIndex, targetSlide, tx }: {
  activeSlideIndex: number;
  groupEndIndex: number;
  groupStartIndex: number;
  onAddSlide: () => void;
  onSelectSlide: (index: number) => void;
  onUpdate: (updates: MotionDocProps) => void;
  scenes: MotionDocScene[];
  setSharedMorphEffectMode: (sourceSlideIndex: number, enabled: boolean) => void;
  setSharedMorphReturnLink: (groupStartIndex: number, detailSlideIndex: number, enabled: boolean) => void;
  sourceSlide: MotionDocScene | undefined;
  sourceSlideIndex: number;
  targetSlide: MotionDocScene | undefined;
  tx: (value: string) => string;
}) {
  const easing = normalizeSharedMorphEasing(sourceSlide?.props.morphEasing);
  const curve = sourceSlide ? sharedMorphCurveFromProps(sourceSlide.props) : { x1: .4, x2: .2, y1: 0, y2: 1 };
  const duration = numericMorphProp(sourceSlide?.props.transitionDuration, 0.72);
  const groupSlides = scenes.slice(groupStartIndex, groupEndIndex + 1);
  const [previewNonce, setPreviewNonce] = useState(0);

  function previewEffect() {
    setPreviewNonce((current) => current + 1);
  }

  function updateCurve(next: SharedMorphCurve) {
    onUpdate({ morphCurveX1: next.x1, morphCurveX2: next.x2, morphCurveY1: next.y1, morphCurveY2: next.y2, morphEasing: "custom" });
  }

  return (
    <section className="overflow-hidden rounded-[14px] border border-white/[0.105] bg-[#151517] shadow-[0_22px_48px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.025)]">
      <div className="flex h-[68px] items-center gap-3 border-b border-white/[0.075] px-3">
        <span className="ml-2 flex size-7 rotate-45 items-center justify-center rounded-[9px] border border-violet-400/65 bg-[#2b2040] shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_9px_24px_rgba(76,29,149,.2)]"><span className="size-2.5 rounded-[2px] bg-violet-100 shadow-[0_0_10px_rgba(221,214,254,.18)]" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold tracking-[-0.02em] text-neutral-100">{tx("Morph sequence")}</span>
          <span className="mt-0.5 block text-[10px] font-medium text-neutral-500">{tx("Start")} {groupStartIndex + 1} <span className="px-1 text-neutral-700">→</span> {tx("End")} {groupEndIndex + 1}{activeSlideIndex !== sourceSlideIndex ? ` · ${tx("Editing previous transition")}` : ""}</span>
        </span>
        <button aria-label={tx("Preview Effect")} className="flex size-9 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.025] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.025)] transition hover:border-violet-300/30 hover:bg-violet-500/10 disabled:opacity-30" disabled={!targetSlide} onClick={previewEffect} type="button"><Play fill="currentColor" size={12} /></button>
      </div>

      <MorphPreviewStage endSlideIndex={groupEndIndex} onPreview={previewEffect} previewNonce={previewNonce} scenes={scenes} startSlideIndex={groupStartIndex} tx={tx} />

      <div className="flex flex-col gap-2.5 border-t border-white/[0.075] p-3">
        <div className="flex min-h-8 items-center justify-between gap-3 px-2">
          <span className="text-[11px] font-semibold text-neutral-200">{tx("Motion feel")}</span>
          <label className="flex items-center gap-2 text-[11px] font-medium text-neutral-500">
            <span>{tx("Duration")}</span>
            <span className="flex h-8 items-center rounded-[11px] border border-white/[0.1] bg-[#1b1b1d] px-2 text-neutral-200 shadow-[inset_0_1px_0_rgba(255,255,255,.025)] focus-within:border-violet-300/35">
              <input aria-label={tx("Duration")} className="w-7 appearance-none bg-transparent text-right font-mono text-[11px] tabular-nums text-neutral-100 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" max={8} min={0.1} onChange={(event) => onUpdate({ transitionDuration: event.target.value === "" ? 0.72 : Number(event.target.value) })} step={0.05} type="number" value={duration} />
              <span className="ml-1 text-[11px] text-neutral-500">{tx("Seconds short")}</span>
            </span>
          </label>
        </div>

        <div className="mx-2 grid grid-cols-3 overflow-hidden rounded-[12px] border border-white/[0.1] bg-[#121214] p-0.5">
          {(["smooth", "spring", "custom"] as SharedMorphEasing[]).map((value) => (
            <button className={`flex h-[35px] items-center justify-center gap-2 rounded-[10px] border text-[12px] font-medium transition ${easing === value ? "border-violet-400/65 bg-[#2b203b] text-violet-50 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_5px_15px_rgba(76,29,149,.16)]" : "border-transparent text-neutral-500 hover:text-neutral-200"}`} key={value} onClick={() => onUpdate({ morphEasing: value })} type="button">{value === "spring" ? <Sparkles size={13} /> : value === "custom" ? <SlidersHorizontal size={13} /> : <Waves size={13} />}{tx(value === "smooth" ? "Smooth" : value === "spring" ? "Spring" : "Custom")}</button>
          ))}
        </div>

        <div className="mx-2"><MorphCurveEditor curve={curve} easing={easing} onChange={updateCurve} /></div>
        <div className="mx-2"><MorphRange label={tx("Shape softness")} max={1} min={0} onChange={(value) => onUpdate({ morphShapeSoftness: value })} step={0.02} value={numericMorphProp(sourceSlide?.props.morphShapeSoftness, 0.32)} /></div>
        <label className="mx-2 flex h-9 items-center justify-between gap-3 rounded-[11px] border border-white/[0.095] bg-[#131315] px-3 text-[10px] text-neutral-400"><span>{tx("Fade unmatched content")}</span><Switch checked={sourceSlide?.props.morphFadeUnmatched !== "false" && sourceSlide?.props.morphFadeUnmatched !== 0} className="data-[state=checked]:bg-violet-600" onCheckedChange={(checked) => onUpdate({ morphFadeUnmatched: checked ? "true" : "false" })} /></label>

        <details className="group mx-2 rounded-[11px] border border-white/[0.095] bg-[#131315]">
          <summary className="flex h-10 cursor-pointer list-none items-center gap-2.5 px-3 [&::-webkit-details-marker]:hidden"><GalleryVerticalEnd className="shrink-0 text-violet-400" size={14} /><span className="min-w-0 flex-1 truncate text-[10px] font-medium text-neutral-300">{tx("Slide sequence")}</span><span className="shrink-0 text-[9px] font-medium tabular-nums text-violet-300/70">{groupSlides.length} {tx("slides short")}</span><ChevronRight className="text-neutral-600 transition-transform group-open:rotate-90" size={13} /></summary>
          <div className="flex flex-col gap-4 border-t border-white/[0.055] p-3">
            <MorphSlideSequence
              activeSlideIndex={activeSlideIndex}
              endIndex={groupEndIndex}
              onAddSlide={onAddSlide}
              onSelectSlide={onSelectSlide}
              scenes={scenes}
              setSharedMorphEffectMode={setSharedMorphEffectMode}
              setSharedMorphReturnLink={setSharedMorphReturnLink}
              startIndex={groupStartIndex}
              tx={tx}
            />
            <div className="flex flex-col gap-3 border-t border-white/[0.065] pt-3">
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-600">{tx("Advanced settings")}</span>
              <label className="flex min-w-0 flex-col gap-1.5 text-[9px] font-semibold text-neutral-500">
                <span>{tx("Easing curve")}</span>
                <PanelSelect onChange={(value) => onUpdate({ morphEasing: value })} options={morphEasingOptions} value={easing} />
              </label>
              <MorphRange label={tx("Shape precision")} max={96} min={12} onChange={(value) => onUpdate({ morphShapePrecision: Math.round(value) })} step={12} value={numericMorphProp(sourceSlide?.props.morphShapePrecision, 48)} />
            </div>
          </div>
        </details>

        <button className="mx-2 flex h-11 items-center justify-center gap-2 rounded-[12px] bg-[linear-gradient(100deg,#6d28d9,#7c3aed)] text-[12px] font-semibold text-white shadow-[0_10px_24px_rgba(109,40,217,.25),inset_0_1px_0_rgba(255,255,255,.14)] transition hover:brightness-110 active:scale-[.985] disabled:opacity-35" disabled={!targetSlide} onClick={previewEffect} type="button"><Play fill="currentColor" size={11} />{tx("Preview Effect")}</button>
      </div>
    </section>
  );
}

function MorphPreviewStage({ endSlideIndex, onPreview, previewNonce, scenes, startSlideIndex, tx }: { endSlideIndex: number; onPreview: () => void; previewNonce: number; scenes: MotionDocScene[]; startSlideIndex: number; tx: (value: string) => string }) {
  const previewRootRef = useRef<HTMLDivElement | null>(null);
  const snapshotRef = useRef<ReturnType<typeof captureSharedMorph> | null>(null);
  const [displayedSlideIndex, setDisplayedSlideIndex] = useState(startSlideIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const stepCount = Math.max(1, endSlideIndex - startSlideIndex);
  const stepNumber = Math.max(0, displayedSlideIndex - startSlideIndex);

  useEffect(() => {
    snapshotRef.current = null;
    setDisplayedSlideIndex(startSlideIndex);
    setIsPlaying(previewNonce > 0);
  }, [endSlideIndex, previewNonce, startSlideIndex]);

  useLayoutEffect(() => {
    const root = thumbnailMotionRoot(previewRootRef.current);
    if (!root || !isPlaying) return;
    if (displayedSlideIndex === startSlideIndex && !snapshotRef.current) {
      snapshotRef.current = captureSharedMorph(root);
      const frame = window.requestAnimationFrame(() => setDisplayedSlideIndex(startSlideIndex + 1));
      return () => window.cancelAnimationFrame(frame);
    }
    const snapshot = snapshotRef.current;
    const sourceSlideIndex = displayedSlideIndex - 1;
    if (!snapshot || sourceSlideIndex < startSlideIndex) return;
    const effectProps = sharedMorphEffectProps(scenes, sourceSlideIndex);
    const duration = numericMorphProp(effectProps.transitionDuration, 0.72);
    const cleanup = playSharedMorph(root, snapshot, {
      curve: sharedMorphCurveFromProps(effectProps),
      duration,
      easing: normalizeSharedMorphEasing(effectProps.morphEasing),
      fadeUnmatched: effectProps.morphFadeUnmatched !== "false" && effectProps.morphFadeUnmatched !== 0,
      shapePrecision: numericMorphProp(effectProps.morphShapePrecision, 48),
      shapeSoftness: numericMorphProp(effectProps.morphShapeSoftness, 0.32)
    });
    const timer = window.setTimeout(() => {
      if (displayedSlideIndex < endSlideIndex) {
        snapshotRef.current = captureSharedMorph(root);
        setDisplayedSlideIndex((current) => current + 1);
      } else {
        snapshotRef.current = null;
        setIsPlaying(false);
      }
    }, duration * 1000 + 160);
    return () => {
      window.clearTimeout(timer);
      cleanup();
    };
  }, [displayedSlideIndex, endSlideIndex, isPlaying, scenes, startSlideIndex]);

  const displayedSlide = scenes[displayedSlideIndex] ?? scenes[startSlideIndex];
  return (
    <div className="relative isolate h-[230px] w-full overflow-hidden border-b border-white/[0.075] bg-[#0d0d11]">
      <img alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full object-cover opacity-30" src={morphConnector} />
      <div className="absolute inset-x-4 top-4 flex items-center justify-between text-[9px] font-semibold text-neutral-500">
        <span>{tx("Effect preview")}</span>
        <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-2 py-1 text-violet-200">{Math.min(stepNumber, stepCount)} / {stepCount}</span>
      </div>
      <div className="absolute inset-x-4 top-[46px] aspect-video overflow-hidden rounded-[11px] border border-violet-400/55 bg-black shadow-[0_0_0_1px_rgba(196,181,253,.1),0_12px_28px_rgba(76,29,149,.22)]" ref={previewRootRef}>
        {displayedSlide ? <SlideThumbnailPreview activeSlideIndex={displayedSlideIndex} eager replayNonce={previewNonce} scene={displayedSlide} /> : null}
      </div>
      <button className="absolute bottom-2.5 left-1/2 z-10 flex h-[26px] -translate-x-1/2 items-center justify-center gap-1 rounded-full border border-white/[0.12] bg-[#171719]/95 px-2.5 text-[9px] font-medium text-neutral-400 shadow-[0_8px_20px_rgba(0,0,0,.25)] transition hover:border-violet-300/30 hover:text-neutral-100 disabled:opacity-30" disabled={!scenes[endSlideIndex] || isPlaying} onClick={onPreview} type="button"><RotateCcw size={10} />{isPlaying ? tx("Playing") : tx("Replay preview")}</button>
    </div>
  );
}

function thumbnailMotionRoot(container: HTMLDivElement | null) {
  return container?.querySelector<HTMLElement>("[data-motion-doc-slide-preview] > div") ?? null;
}

function morphSourceIndex(scenes: MotionDocScene[], activeSlideIndex: number) {
  if (scenes[activeSlideIndex]?.props.slideTransition === "morph") return activeSlideIndex;
  if (activeSlideIndex > 0 && scenes[activeSlideIndex - 1]?.props.slideTransition === "morph") return activeSlideIndex - 1;
  return activeSlideIndex;
}

function morphGroupRange(scenes: MotionDocScene[], activeSlideIndex: number) {
  let startIndex = activeSlideIndex;
  while (startIndex > 0 && scenes[startIndex - 1]?.props.slideTransition === "morph") startIndex -= 1;
  let endIndex = activeSlideIndex;
  while (endIndex < scenes.length - 1 && scenes[endIndex]?.props.slideTransition === "morph") endIndex += 1;
  return { endIndex, startIndex };
}

function MorphSlideSequence({ activeSlideIndex, endIndex, onAddSlide, onSelectSlide, scenes, setSharedMorphEffectMode, setSharedMorphReturnLink, startIndex, tx }: {
  activeSlideIndex: number;
  endIndex: number;
  onAddSlide: () => void;
  onSelectSlide: (index: number) => void;
  scenes: MotionDocScene[];
  setSharedMorphEffectMode: (sourceSlideIndex: number, enabled: boolean) => void;
  setSharedMorphReturnLink: (groupStartIndex: number, detailSlideIndex: number, enabled: boolean) => void;
  startIndex: number;
  tx: (value: string) => string;
}) {
  const slides = scenes.slice(startIndex, endIndex + 1);
  const selectedOffset = activeSlideIndex - startIndex;
  const selectedScene = scenes[activeSlideIndex];
  const canConfigureSelectedSlide = selectedOffset > 0 && selectedOffset < slides.length;
  const canInheritSelectedEffect = canConfigureSelectedSlide && activeSlideIndex < endIndex;
  const selectedInheritsEffect = canInheritSelectedEffect && selectedScene?.props.morphEffectMode === "inherit";
  const selectedHasReturnMorph = canConfigureSelectedSlide && hasSharedMorphReturnLink(scenes, startIndex, activeSlideIndex);

  return <div className="flex flex-col gap-2">
    <div className="relative flex flex-col gap-1">
      <span className="absolute bottom-6 left-[12px] top-6 w-px bg-violet-400/20" />
      {slides.map((scene, offset) => {
        const slideIndex = startIndex + offset;
        const isActive = slideIndex === activeSlideIndex;
        const label = offset === 0 ? tx("Start slide") : offset === slides.length - 1 ? tx("End slide") : `${tx("Step")} ${offset + 1}`;
        return <button aria-pressed={isActive} className={`relative z-10 grid h-[50px] w-full grid-cols-[16px_56px_minmax(0,1fr)] items-center gap-2 rounded-[10px] border px-1.5 text-left transition ${isActive ? "border-violet-300/35 bg-violet-500/12" : "border-transparent hover:border-white/[0.07] hover:bg-white/[0.03]"}`} key={slideIndex} onClick={() => onSelectSlide(slideIndex)} type="button">
          <span className={`ml-0.5 size-2.5 rotate-45 rounded-[2px] border ${isActive ? "border-violet-100 bg-violet-400 shadow-[0_0_10px_rgba(139,92,246,.35)]" : "border-violet-400/40 bg-[#21162e]"}`} />
          <span className="relative block aspect-video overflow-hidden rounded-[6px] border border-white/[0.09] bg-black/50"><SlideThumbnailPreview activeSlideIndex={slideIndex} eager={isActive} replayNonce={0} scene={scene} /></span>
          <span className="min-w-0"><span className={`block truncate text-[10px] font-semibold ${isActive ? "text-violet-100" : "text-neutral-300"}`}>{label}</span><span className="mt-0.5 block truncate text-[9px] text-neutral-600">{tx("Slide")} {slideIndex + 1}</span></span>
        </button>;
      })}
    </div>
    {canConfigureSelectedSlide ? <div className="mt-1 rounded-[10px] border border-white/[0.075] bg-black/15 px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between"><span className="text-[9px] font-semibold text-neutral-500">{tx("Current slide")}</span><span className="font-mono text-[9px] tabular-nums text-neutral-600">{activeSlideIndex + 1}</span></div>
      {canInheritSelectedEffect ? <label className="flex h-8 items-center justify-between border-t border-white/[0.055] text-[9px] font-medium text-neutral-400"><span>{tx("Same effect")}</span><Switch aria-label={`${tx("Same effect")} ${tx("Slide")} ${activeSlideIndex + 1}`} checked={selectedInheritsEffect} className="scale-[.78] data-[state=checked]:bg-violet-500" onCheckedChange={(checked) => setSharedMorphEffectMode(activeSlideIndex, checked)} /></label> : null}
      <label className="flex h-8 items-center justify-between border-t border-white/[0.055] text-[9px] font-medium text-neutral-400"><span>{tx("Return Morph")}</span><Switch aria-label={`${tx("Return Morph")} ${tx("Slide")} ${activeSlideIndex + 1}`} checked={selectedHasReturnMorph} className="scale-[.78] data-[state=checked]:bg-violet-500" onCheckedChange={(checked) => setSharedMorphReturnLink(startIndex, activeSlideIndex, checked)} /></label>
    </div> : null}
    <button className="mt-1 flex h-9 items-center justify-center gap-2 rounded-[10px] border border-dashed border-violet-300/25 bg-violet-500/[0.055] text-[10px] font-semibold text-violet-200 transition hover:border-violet-300/45 hover:bg-violet-500/10" onClick={onAddSlide} type="button"><Plus size={12} />{tx("Add slide to Morph")}</button>
  </div>;
}

function PanelSelect({ onChange, options, value }: { onChange: (value: string) => void; options: ReadonlyArray<{ description?: string; label: string; value: string }>; value: string }) {
  const { tx } = usePitchI18n();
  const selectValue = value || "__none__";
  return <Select onValueChange={(next) => onChange(next === "__none__" ? "" : next)} value={selectValue}><SelectTrigger className="h-9 rounded-[11px] border-white/[0.08] bg-black/20 px-2.5 text-[10px]"><SelectValue /></SelectTrigger><SelectContent className="max-h-[340px]">{options.map((option) => <SelectItem className="min-h-9 text-[11px]" key={option.value || "__none__"} value={option.value || "__none__"}><span className="flex flex-col"><span>{tx(option.label)}</span>{option.description ? <span className="text-[9px] text-neutral-500">{tx(option.description)}</span> : null}</span></SelectItem>)}</SelectContent></Select>;
}

function MorphRange({ label, max, min, onChange, step, value }: { label: string; max: number; min: number; onChange: (value: number) => void; step: number; value: number }) {
  return <label className="flex h-[54px] flex-col justify-center gap-2 rounded-[11px] border border-white/[0.095] bg-[#131315] px-3"><span className="flex items-center justify-between text-[10px] font-medium text-neutral-400"><span>{label}</span><span className="font-mono tabular-nums text-neutral-200">{value}</span></span><Slider className="[&_[data-slot=slider-range]]:bg-violet-500 [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:shadow-none [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-track]]:bg-white/10" max={max} min={min} onValueChange={(next) => onChange(next[0] ?? value)} step={step} value={[value]} /></label>;
}

function layerLabel(block: MotionDocScene["blocks"][number], index: number) {
  const name = typeof block.props.name === "string" ? block.props.name.trim() : "";
  return name || `${block.type} ${index + 1}`;
}

function numericMorphProp(value: string | number | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
