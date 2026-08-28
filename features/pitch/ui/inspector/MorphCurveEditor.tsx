import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  defaultSharedMorphCurve,
  type SharedMorphCurve,
  type SharedMorphEasing
} from "@/core/motion-doc/domain/sharedMorph";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type MorphCurveEditorProps = {
  curve: SharedMorphCurve;
  easing: SharedMorphEasing;
  onChange: (curve: SharedMorphCurve) => void;
};

export function MorphCurveEditor({ curve, easing, onChange }: MorphCurveEditorProps) {
  const { tx } = usePitchI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayCurve = easingCurve(easing, curve);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const width = rect.width;
    const height = rect.height;
    const padding = 4;
    context.clearRect(0, 0, width, height);
    context.strokeStyle = "rgba(255,255,255,.06)";
    context.lineWidth = 1;
    for (let index = 1; index < 4; index += 1) {
      const x = padding + (width - padding * 2) * index / 4;
      const y = padding + (height - padding * 2) * index / 4;
      context.beginPath(); context.moveTo(x, padding); context.lineTo(x, height - padding); context.stroke();
      context.beginPath(); context.moveTo(padding, y); context.lineTo(width - padding, y); context.stroke();
    }
    context.strokeStyle = "rgba(167,139,250,1)";
    context.lineWidth = 2;
    context.beginPath();
    for (let index = 0; index <= 80; index += 1) {
      const t = index / 80;
      const x = padding + cubicCoordinate(t, displayCurve.x1, displayCurve.x2) * (width - padding * 2);
      const progress = clamp(cubicCoordinate(t, displayCurve.y1, displayCurve.y2), 0, 1);
      const y = height - padding - progress * (height - padding * 2);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }, [displayCurve.x1, displayCurve.x2, displayCurve.y1, displayCurve.y2]);

  function dragHandle(key: "first" | "second", event: ReactPointerEvent<HTMLButtonElement>) {
    if (easing !== "custom") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const container = event.currentTarget.parentElement;
    if (!container) return;
    const update = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      const x = clamp((clientX - rect.left - 12) / Math.max(1, rect.width - 24), 0, 1);
      const y = clamp(1 - (clientY - rect.top - 12) / Math.max(1, rect.height - 24), -1.5, 2.5);
      onChange(key === "first" ? { ...curve, x1: round(x), y1: round(y) } : { ...curve, x2: round(x), y2: round(y) });
    };
    const move = (pointerEvent: PointerEvent) => update(pointerEvent.clientX, pointerEvent.clientY);
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
    update(event.clientX, event.clientY);
  }

  const copy = easingCopy(easing);

  return (
    <div className="overflow-hidden rounded-[13px] border border-white/[0.095] bg-[#101012] shadow-[inset_0_1px_0_rgba(255,255,255,.018)]">
      <div className="flex h-[48px] items-start justify-between px-3 pt-3">
        <span>
          <span className="block text-[11px] font-semibold text-neutral-200">{tx(copy.label)}</span>
          <span className="mt-0.5 block text-[9px] text-neutral-500">{tx(copy.description)}</span>
        </span>
        <span className="pt-0.5 font-mono text-[9px] text-neutral-500">100%</span>
      </div>
      <div className="relative mb-3 ml-3 mr-10 h-[82px]">
        <canvas aria-label={tx("Morph easing curve")} className="absolute inset-0 h-full w-full" ref={canvasRef} />
        {easing === "custom" ? (
          <>
            <CurveHandle curve={curve} kind="first" label={tx("First curve control")} onPointerDown={(event) => dragHandle("first", event)} />
            <CurveHandle curve={curve} kind="second" label={tx("Second curve control")} onPointerDown={(event) => dragHandle("second", event)} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function CurveHandle({ curve, kind, label, onPointerDown }: {
  curve: SharedMorphCurve;
  kind: "first" | "second";
  label: string;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const x = kind === "first" ? curve.x1 : curve.x2;
  const y = kind === "first" ? curve.y1 : curve.y2;
  return (
    <button
      aria-label={label}
      className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-500 shadow-[0_0_0_4px_rgba(139,92,246,.16)] touch-none"
      onPointerDown={onPointerDown}
      style={{ left: `${4 + x * 92}%`, top: `${4 + (1 - clamp(y, 0, 1)) * 92}%` }}
      type="button"
    />
  );
}

function easingCurve(easing: SharedMorphEasing, custom: SharedMorphCurve): SharedMorphCurve {
  if (easing === "linear") return { x1: 0, x2: 1, y1: 0, y2: 1 };
  if (easing === "easeIn") return { x1: .42, x2: 1, y1: 0, y2: 1 };
  if (easing === "easeOut") return { x1: 0, x2: .58, y1: 0, y2: 1 };
  if (easing === "smooth") return { x1: .45, x2: .2, y1: 0, y2: 1 };
  if (easing === "emphasized") return { x1: .2, x2: 0, y1: 0, y2: 1 };
  if (easing === "spring") return { x1: .4, x2: .48, y1: .9, y2: 1.18 };
  if (easing === "backOut") return { x1: .34, x2: .64, y1: 1.56, y2: 1 };
  if (easing === "custom") return custom;
  return defaultSharedMorphCurve;
}

function easingCopy(easing: SharedMorphEasing) {
  if (easing === "spring") return { description: "Subtle elastic response", label: "Spring" };
  if (easing === "custom") return { description: "Drag both curve handles", label: "Custom" };
  if (easing === "smooth") return { description: "Soft presentation motion", label: "Smooth" };
  if (easing === "emphasized") return { description: "Fast focus with a calm finish", label: "Emphasized" };
  if (easing === "backOut") return { description: "Overshoots before settling", label: "Back out" };
  if (easing === "easeIn") return { description: "Accelerates at the start", label: "Ease in" };
  if (easing === "easeOut") return { description: "Settles gently at the end", label: "Ease out" };
  if (easing === "easeInOut") return { description: "Balanced acceleration and deceleration", label: "Ease in and out" };
  return { description: "Constant speed", label: "Linear" };
}

function cubicCoordinate(t: number, first: number, second: number) {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * first + 3 * inverse * t * t * second + t * t * t;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
