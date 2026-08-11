"use client";

import { Link2, RotateCcw, Unlink2 } from "lucide-react";
import {
  elementAnimationPresets,
  normalizeEnterAnimation,
  type EnterAnimation
} from "@/features/pitch/application/motionPresets";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import {
  blockAspectRatioLocked,
  blockRotation,
  setBlockAspectRatioLocked
} from "@/core/motion-doc/domain/blockTransform";
import { applyBlockTextStyle } from "@/core/motion-doc/domain/textStyleRanges";
import { applyElementAnimationProps } from "@/features/pitch/application/motionModel";
import { autoSizeTextFrameProps } from "@/features/pitch/application/textFrameSizing";
import { ColorControl, NumberInput, type BlockFieldProps } from "@/features/pitch/ui/inspector/InspectorControls";
import { AccordionSection } from "@/features/pitch/ui/inspector/controls/AccordionSection";
import { MotionThumbnailGrid } from "@/features/pitch/ui/inspector/controls/MotionThumbnailGrid";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

export function MotionFields({
  block,
  inheritedBackgroundColor,
  inheritedTextColor,
  isTextType,
  selectedBlockIndex,
  textValue,
  updateBlock
}: BlockFieldProps & {
  inheritedBackgroundColor: string;
  inheritedTextColor: string;
  isTextType: boolean;
  textValue: string;
}) {
  const { tx } = usePitchI18n();
  const updateProps = (nextProps: typeof block.props, options?: { resizeTextFrame?: boolean }) => {
    const resolvedProps = options?.resizeTextFrame && isTextType
      ? autoSizeTextFrameProps(block, textValue, { mode: "height", props: nextProps })
      : nextProps;

    updateBlock(selectedBlockIndex, resolvedProps, isTextType ? textValue : undefined);
  };

  const updateOptionalProp = (key: string, value: string, aliases: string[] = []) => {
    const nextProps: MotionDocProps = isTextType && key === "color"
      ? applyBlockTextStyle(block.props, { color: value.trim() || null }, textValue.length)
      : { ...block.props };

    if (!(isTextType && key === "color")) delete nextProps[key];
    aliases.forEach((alias) => delete nextProps[alias]);

    if (value.trim()) {
      nextProps[key] = value.trim();
    }

    updateProps(nextProps);
  };



  const hasCustomBackground = Boolean(block.props.background ?? block.props.backgroundColor ?? block.props.bg);
  const selectedAnimation = normalizeEnterAnimation(block.props.enter);
  const supportsAspectRatioLock = block.type === "Shape"
    ? block.props.shape !== "line"
    : block.type === "ImageBlock" || block.type === "VideoBlock" || block.type === "Icon" || block.type === "Chart";
  const isAspectRatioLocked = supportsAspectRatioLock && blockAspectRatioLocked(block.props);

  function updateFrameDimension(axis: "h" | "w", value: string | number) {
    if (!isAspectRatioLocked || value === "") {
      updateProps({ ...block.props, [axis]: value });
      return;
    }
    const nextValue = Number(value);
    const currentW = Number(block.props.w);
    const currentH = Number(block.props.h);
    if (!Number.isFinite(nextValue) || !Number.isFinite(currentW) || !Number.isFinite(currentH) || currentW <= 0 || currentH <= 0) {
      updateProps({ ...block.props, [axis]: value });
      return;
    }
    updateProps(axis === "w"
      ? { ...block.props, h: Math.round(currentH * nextValue / currentW * 10) / 10, w: nextValue }
      : { ...block.props, h: nextValue, w: Math.round(currentW * nextValue / currentH * 10) / 10 });
  }

  function updateAnimation(value: EnterAnimation) {
    updateProps(applyElementAnimationProps(block.props, value));
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Visuals & Geometry Accordion */}
      <AccordionSection title="Visuals & Geometry" defaultOpen={true}>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            {isTextType ? (
              <ColorControl
                displayValue={inheritedTextColor}
                label="Text color"
                onChange={(value) => updateOptionalProp("color", value, ["textColor"])}
                placeholder={inheritedTextColor || "#ffffff"}
                value={block.props.color ?? block.props.textColor}
              />
            ) : null}
            <ColorControl
              displayValue={hasCustomBackground ? undefined : inheritedBackgroundColor}
              label={block.type === "ImageBlock" ? "Frame background" : "Background"}
              onChange={(value) => updateOptionalProp("background", value, ["backgroundColor", "bg"])}
              placeholder={inheritedBackgroundColor || (block.type === "ImageBlock" ? "rgba(255,255,255,0.08)" : "transparent")}
              value={block.props.background ?? block.props.backgroundColor ?? block.props.bg}
            />
            {block.type !== "ImageBlock" && !isTextType ? (
              <ColorControl
                displayValue={inheritedTextColor}
                label="Text color"
                onChange={(value) => updateOptionalProp("color", value, ["textColor"])}
                placeholder={inheritedTextColor || "#ffffff"}
                value={block.props.color ?? block.props.textColor}
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <NumberInput prefix={<span className="text-[10px] font-semibold w-3">X</span>} min="0" max="100" onChange={(value) => updateProps({ ...block.props, x: value })} placeholder="10" step="0.5" suffix="%" value={block.props.x ?? ""} />
              <NumberInput prefix={<span className="text-[10px] font-semibold w-3">Y</span>} min="0" max="100" onChange={(value) => updateProps({ ...block.props, y: value })} placeholder="20" step="0.5" suffix="%" value={block.props.y ?? ""} />
              <NumberInput prefix={<span className="text-[10px] font-semibold w-3">W</span>} min="2" max="100" onChange={(value) => updateFrameDimension("w", value)} placeholder="42" step="0.5" suffix="%" value={block.props.w ?? ""} />
              <NumberInput prefix={<span className="text-[10px] font-semibold w-3">H</span>} min="2" max="100" onChange={(value) => updateFrameDimension("h", value)} placeholder="18" step="0.5" suffix="%" value={block.props.h ?? ""} />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-1.5">
              <NumberInput
                prefix={<span className="text-[10px] font-semibold text-neutral-500">°</span>}
                min="-180"
                max="180"
                onChange={(value) => updateProps({ ...block.props, rotation: value === "" ? 0 : value })}
                placeholder="0"
                step="1"
                suffix="°"
                value={blockRotation(block.props)}
              />
              <button
                aria-label={tx("Reset rotation")}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-black/30 text-neutral-400 transition hover:bg-white/[0.06] hover:text-white"
                onClick={() => updateProps({ ...block.props, rotation: 0 })}
                title={tx("Reset rotation")}
                type="button"
              >
                <RotateCcw size={13} />
              </button>
            </div>
            {supportsAspectRatioLock ? (
              <button
                aria-pressed={isAspectRatioLocked}
                className={`flex h-8 items-center justify-center gap-2 rounded-lg border text-[11px] font-semibold transition ${isAspectRatioLocked ? "border-violet-400/45 bg-violet-500/15 text-violet-100" : "border-white/[0.06] bg-black/30 text-neutral-400 hover:bg-white/[0.05] hover:text-white"}`}
                onClick={() => updateProps(setBlockAspectRatioLocked(block.props, !isAspectRatioLocked))}
                type="button"
              >
                {isAspectRatioLocked ? <Link2 size={13} /> : <Unlink2 size={13} />}
                {tx(isAspectRatioLocked ? "Aspect ratio locked" : "Lock aspect ratio")}
              </button>
            ) : null}
          </div>



          {!isTextType ? (
            <div className="flex flex-col gap-1.5">
              <NumberInput
                prefix={<span className="text-[10px] font-semibold text-neutral-500">{tx(block.type === "Shape" ? "Corner" : "Radius")}</span>}
                min="0"
                max="120"
                onChange={(value) => {
                  const { borderRadius, ...nextProps } = block.props;
                  void borderRadius;
                  updateProps({ ...nextProps, radius: value === "" ? "" : value });
                }}
                placeholder={String(defaultRadius(block.type))}
                step="1"
                suffix="px"
                value={block.props.radius ?? block.props.borderRadius ?? ""}
              />
            </div>
          ) : null}
        </div>
      </AccordionSection>

      {/* Motion Effects Accordion */}
      <AccordionSection title="Motion & Transition" defaultOpen={true}>
        <div className="flex flex-col gap-5">
          {selectedAnimation !== "none" ? (
            <div className="grid grid-cols-2 gap-1.5">
              <NumberInput prefix={<span className="text-[10px] font-semibold text-neutral-500 w-9">{tx("Delay")}</span>} min="0" onChange={(value) => updateProps({ ...block.props, delay: value })} placeholder="0" step="0.1" suffix="s" value={block.props.delay ?? ""} />
              <NumberInput prefix={<span className="text-[10px] font-semibold text-neutral-500 w-11">{tx("Duration")}</span>} min="0.1" onChange={(value) => updateProps({ ...block.props, duration: value === "" ? "" : value })} placeholder="0.6" step="0.1" suffix="s" value={block.props.duration ?? ""} />
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-neutral-500">{tx("Animation Style")}</span>
            <MotionThumbnailGrid
              label=""
              onChange={updateAnimation}
              options={elementAnimationPresets}
              value={selectedAnimation}
            />
          </div>
        </div>
      </AccordionSection>
    </div>
  );
}



function defaultRadius(type: string) {
  if (type === "ImageBlock") return 16;
  if (type === "Card" || type === "Metric") return 16;

  return 0;
}
