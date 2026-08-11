"use client";

import { ChevronLeft, ChevronRight, ImagePlus, Trash2, Upload } from "lucide-react";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { ColorControl, Field, NativeSelect, NumberInput, type BlockFieldProps } from "@/features/pitch/ui/inspector/InspectorControls";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

const shapeOptions = [
  { label: "Rectangle", value: "rectangle" },
  { label: "Circle", value: "circle" },
  { label: "Triangle", value: "triangle" },
  { label: "Diamond", value: "diamond" },
  { label: "Arrow", value: "arrow" },
  { label: "Polygon", value: "polygon" },
  { label: "Line", value: "line" },
  { label: "Star", value: "star" },
  { label: "Chevron", value: "chevron" },
  { label: "Corner label", value: "corner" },
  { label: "Hexagon", value: "hexagon" },
  { label: "Parallelogram", value: "parallelogram" }
] as const;

const lineStyleOptions = [
  { label: "Solid", value: "solid" },
  { label: "Dashed", value: "dashed" },
  { label: "Dotted", value: "dotted" }
] as const;

const lineEndOptions = [
  { label: "None", value: "none" },
  { label: "Arrow", value: "arrow" },
  { label: "Circle", value: "circle" },
  { label: "Bar", value: "bar" }
] as const;

export function ShapeFields({
  block,
  removeImageForBlock,
  requestImageRemoval,
  requestImageUpload,
  selectedBlockIndex,
  updateBlock,
  uploadImageForBlock
}: BlockFieldProps & {
  removeImageForBlock: (blockIndex: number) => void;
  requestImageRemoval: () => boolean;
  requestImageUpload: () => boolean;
  uploadImageForBlock: (blockIndex: number, file: File | undefined) => void;
}) {
  const currentShape = normalizeShape(block.props.shape);
  const showSides = currentShape === "polygon";
  const showPoints = currentShape === "star";
  const sides = normalizeInt(block.props.sides, 3);
  const points = normalizeInt(block.props.points, 5);

  function adjustSides(delta: number) {
    const next = Math.min(Math.max(sides + delta, 3), 12);
    updateBlock(selectedBlockIndex, { ...block.props, shape: "polygon", sides: next });
  }

  function adjustPoints(delta: number) {
    const next = Math.min(Math.max(points + delta, 3), 12);
    updateBlock(selectedBlockIndex, { ...block.props, points: next });
  }

  return (
    <>
      <Field label="Shape">
        <NativeSelect
          onChange={(value) => {
            const nextProps: MotionDocProps = { ...block.props, shape: value };
            if (value === "polygon" && !block.props.sides) {
              nextProps.sides = 3;
            }
            if (value === "star" && !block.props.points) {
              nextProps.points = 5;
            }
            updateBlock(selectedBlockIndex, nextProps);
          }}
          options={shapeOptions}
          value={currentShape}
        />
      </Field>
      {showSides ? (
        <Field label="Sides">
          <SidesAdjuster value={sides} onChange={adjustSides} min={3} max={12} />
        </Field>
      ) : null}
      {showPoints ? (
        <Field label="Points">
          <SidesAdjuster value={points} onChange={adjustPoints} min={3} max={12} />
        </Field>
      ) : null}
      {currentShape === "line" ? <>
        <Field label="Line style"><NativeSelect onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, lineStyle: value })} options={lineStyleOptions} value={normalizeLineStyle(block.props.lineStyle)} /></Field>
        <Field label="Start"><NativeSelect onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, arrowStart: value })} options={lineEndOptions} value={normalizeLineEnd(block.props.arrowStart)} /></Field>
        {normalizeLineEnd(block.props.arrowStart) !== "none" ? <Field label="Start size"><NumberInput max="300" min="25" onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, arrowStartSize: value })} placeholder="100" step="5" suffix="%" value={block.props.arrowStartSize ?? 100} /></Field> : null}
        <Field label="End"><NativeSelect onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, arrowEnd: value })} options={lineEndOptions} value={normalizeLineEnd(block.props.arrowEnd)} /></Field>
        {normalizeLineEnd(block.props.arrowEnd) !== "none" ? <Field label="End size"><NumberInput max="300" min="25" onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, arrowEndSize: value })} placeholder="100" step="5" suffix="%" value={block.props.arrowEndSize ?? 100} /></Field> : null}
      </> : null}
      {currentShape !== "line" ? <ColorControl
        label="Fill"
        onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, fill: value })}
        placeholder="rgba(142,165,255,0.72)"
        value={block.props.fill}
      /> : null}
      {currentShape !== "line" ? (
        <Field label="Image fill">
          <div className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-black/25 p-2.5">
            {block.props.shapeImageSrc ? (
              <div className="relative h-24 overflow-hidden rounded-lg border border-white/[0.08] bg-black/30">
                <img alt="" className="h-full w-full object-cover" src={String(block.props.shapeImageSrc)} />
                <div className="absolute right-1.5 top-1.5 flex gap-1 rounded-lg bg-black/65 p-1 backdrop-blur">
                  <label className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-neutral-200 hover:bg-white/10" title="Replace image">
                    <Upload size={13} />
                    <input accept="image/*" className="sr-only" onChange={(event) => { uploadImageForBlock(selectedBlockIndex, event.target.files?.[0]); event.currentTarget.value = ""; }} onClick={(event) => { if (!requestImageUpload()) event.preventDefault(); }} type="file" />
                  </label>
                  <button className="flex h-7 w-7 items-center justify-center rounded-md text-rose-300 hover:bg-rose-500/15" onClick={() => { if (requestImageRemoval()) void removeImageForBlock(selectedBlockIndex); }} title="Remove image fill" type="button"><Trash2 size={13} /></button>
                </div>
              </div>
            ) : (
              <label className="flex h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/[0.1] text-neutral-500 transition hover:border-violet-400/40 hover:text-violet-200">
                <ImagePlus size={19} />
                <span className="text-[11px] font-semibold">Place image in shape</span>
                <input accept="image/*" className="sr-only" onChange={(event) => { uploadImageForBlock(selectedBlockIndex, event.target.files?.[0]); event.currentTarget.value = ""; }} onClick={(event) => { if (!requestImageUpload()) event.preventDefault(); }} type="file" />
              </label>
            )}
            {block.props.shapeImageSrc ? (
              <>
                <NativeSelect
                  onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, shapeImageFit: value })}
                  options={[{ label: "Fill", value: "cover" }, { label: "Fit", value: "contain" }, { label: "Stretch", value: "fill" }]}
                  value={normalizeShapeImageFit(block.props.shapeImageFit)}
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <NumberInput min="-350" max="350" onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, shapeImageCropX: value === "" ? 0 : value })} prefix={<span className="text-[9px]">X</span>} step="1" suffix="%" value={block.props.shapeImageCropX ?? 0} />
                  <NumberInput min="-350" max="350" onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, shapeImageCropY: value === "" ? 0 : value })} prefix={<span className="text-[9px]">Y</span>} step="1" suffix="%" value={block.props.shapeImageCropY ?? 0} />
                  <NumberInput min="0.1" max="8" onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, shapeImageScaleX: value === "" ? 1 : value, shapeImageScaleY: value === "" ? 1 : value })} prefix={<span className="text-[9px]">Zoom</span>} step="0.05" value={block.props.shapeImageScaleX ?? 1} />
                  <button className="rounded-lg border border-white/[0.06] bg-black/30 text-[10px] font-semibold text-neutral-400 hover:bg-white/[0.05] hover:text-white" onClick={() => updateBlock(selectedBlockIndex, { ...block.props, shapeImageCropX: 0, shapeImageCropY: 0, shapeImageScaleX: 1, shapeImageScaleY: 1 })} type="button">Reset crop</button>
                </div>
              </>
            ) : null}
          </div>
        </Field>
      ) : null}
      <ColorControl
        label={currentShape === "line" ? "Line color" : "Stroke"}
        onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, stroke: value })}
        placeholder="#ffffff"
        value={block.props.stroke}
      />
      <Field label="Stroke width">
        <NumberInput
          max="24"
          min="0"
          onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, strokeWidth: value === "" ? "" : value })}
          placeholder="2"
          step="0.5"
          suffix="px"
          value={block.props.strokeWidth ?? ""}
        />
      </Field>
      <Field label="Opacity">
        <NumberInput
          max="1"
          min="0"
          onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, opacity: value === "" ? "" : value })}
          placeholder="1"
          step="0.05"
          value={block.props.opacity ?? 1}
        />
      </Field>
    </>
  );
}

function SidesAdjuster({
  max,
  min,
  onChange,
  value
}: {
  max: number;
  min: number;
  onChange: (delta: number) => void;
  value: number;
}) {
  const { tx } = usePitchI18n();
  return (
    <div className="flex items-center gap-0 rounded-xl border border-white/[0.06] bg-black/40 overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
      <button
        aria-label={tx("Decrease")}
        className="flex h-8 w-8 items-center justify-center text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
        disabled={value <= min}
        onClick={() => onChange(-1)}
        type="button"
      >
        <ChevronLeft size={14} />
      </button>
      <span className="flex min-w-[40px] items-center justify-center font-mono text-[13px] font-bold text-neutral-200 select-none">
        {value}
      </span>
      <button
        aria-label={tx("Increase")}
        className="flex h-8 w-8 items-center justify-center text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
        disabled={value >= max}
        onClick={() => onChange(1)}
        type="button"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

function normalizeShape(value: string | number | undefined) {
  if (value === "arrow" || value === "chevron" || value === "circle" || value === "corner" || value === "diamond" || value === "hexagon" || value === "parallelogram" || value === "polygon" || value === "line" || value === "star" || value === "triangle") {
    return value;
  }

  return "rectangle" as const;
}

function normalizeInt(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : parseInt(String(value), 10);

  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 3), 12) : fallback;
}

function normalizeLineStyle(value: string | number | undefined) {
  return value === "dashed" || value === "dotted" ? value : "solid";
}

function normalizeLineEnd(value: string | number | undefined) {
  return value === "arrow" || value === "circle" || value === "bar" ? value : "none";
}

function normalizeShapeImageFit(value: string | number | undefined) {
  return value === "contain" || value === "fill" ? value : "cover";
}
