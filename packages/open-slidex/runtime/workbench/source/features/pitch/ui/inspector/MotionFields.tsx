
import { Link2, Unlink2 } from "lucide-react";
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
import { motionDocBlockFrame } from "@/core/motion-doc/domain/frame";
import { relativeCornerFromRadius } from "@/core/motion-doc/application/continuousRoundedRect";
import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";
import { applyElementAnimationProps } from "@/features/pitch/application/motionModel";
import { autoSizeTextFrameProps } from "@/features/pitch/application/textFrameSizing";
import { ColorControl, Field, NumberInput, type BlockFieldProps } from "@/features/pitch/ui/inspector/InspectorControls";
import { AccordionSection } from "@/features/pitch/ui/inspector/controls/AccordionSection";
import { MotionThumbnailGrid } from "@/features/pitch/ui/inspector/controls/MotionThumbnailGrid";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { Toggle } from "@/common/ui/shadcnPrimitives";

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
  const frame = motionDocBlockFrame(block);
  const shadowEnabled = Number(block.props.shadowOpacity) > 0
    && block.props.shadow !== "none"
    && block.props.shadowEnabled !== "false";

  function framePixels(axis: "h" | "w" | "x" | "y") {
    const canvasSize = axis === "x" || axis === "w" ? MOTION_DOC_CANVAS_WIDTH : MOTION_DOC_CANVAS_HEIGHT;
    return Math.round(frame[axis] / 100 * canvasSize * 10) / 10;
  }

  function updateFramePixels(axis: "h" | "w" | "x" | "y", value: number | "") {
    if (value === "") return;
    const canvasSize = axis === "x" || axis === "w" ? MOTION_DOC_CANVAS_WIDTH : MOTION_DOC_CANVAS_HEIGHT;
    const percent = Math.round(Number(value) / canvasSize * 1000) / 10;
    if (axis === "w" || axis === "h") updateFrameDimension(axis, percent);
    else updateProps({ ...block.props, [axis]: percent });
  }

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
      <AccordionSection title="Appearance" defaultOpen={true}>
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

          {!isTextType ? (
            <div className="flex flex-col gap-1.5">
              <NumberInput
                prefix={<span className="text-[10px] font-semibold text-neutral-500">{tx(block.type === "Shape" ? "Corner" : "Radius")}</span>}
                min="0"
                max={block.type === "Shape" ? "50" : "120"}
                onChange={(value) => {
                  const { borderRadius, radius, corner, ...nextProps } = block.props;
                  void borderRadius;
                  void radius;
                  void corner;
                  updateProps(block.type === "Shape"
                    ? { ...nextProps, corner: value === "" ? 0 : value }
                    : { ...nextProps, radius: value === "" ? 0 : value });
                }}
                placeholder={String(defaultRadius(block.type))}
                step="1"
                suffix={block.type === "Shape" ? "/50" : "px"}
                value={block.type === "Shape"
                  ? block.props.corner ?? relativeCornerFromRadius(
                      Number(block.props.radius ?? block.props.borderRadius ?? 0),
                      frame.w / 100 * MOTION_DOC_CANVAS_WIDTH,
                      frame.h / 100 * MOTION_DOC_CANVAS_HEIGHT
                    )
                  : block.props.radius ?? block.props.borderRadius ?? ""}
              />
            </div>
          ) : null}
          <div className="flex flex-col gap-2 rounded-xl border border-white/[0.055] bg-black/20 p-2.5">
            <Toggle
              className={`flex h-8 items-center justify-center rounded-lg border text-[11px] font-semibold transition ${shadowEnabled ? "border-violet-400/45 bg-violet-500/15 text-violet-100" : "border-white/[0.06] text-neutral-400 hover:bg-white/[0.05]"}`}
              onPressedChange={(pressed) => updateProps({
                ...block.props,
                shadowEnabled: String(pressed),
                shadowOpacity: pressed ? Number(block.props.shadowOpacity) || 0.28 : 0
              })}
              pressed={shadowEnabled}
              size="sm"
            >
              {tx(shadowEnabled ? "Shadow on" : "Add shadow")}
            </Toggle>
            {shadowEnabled ? (
              <>
                <ColorControl label="Shadow color" onChange={(value) => updateProps({ ...block.props, shadowColor: value || "#000000" })} placeholder="#000000" value={block.props.shadowColor ?? "#000000"} />
                <div className="grid grid-cols-2 gap-1.5">
                  <NumberInput prefix={tx("Opacity")} min="0" max="1" onChange={(value) => updateProps({ ...block.props, shadowOpacity: value === "" ? 0 : value })} step="0.05" value={block.props.shadowOpacity ?? 0.28} />
                  <NumberInput prefix={tx("Shadow blur")} min="0" max="200" onChange={(value) => updateProps({ ...block.props, shadowBlur: value === "" ? 0 : value })} step="1" suffix="px" value={block.props.shadowBlur ?? 12} />
                  <NumberInput prefix="X" min="-200" max="200" onChange={(value) => updateProps({ ...block.props, shadowOffsetX: value === "" ? 0 : value })} step="1" suffix="px" value={block.props.shadowOffsetX ?? 0} />
                  <NumberInput prefix="Y" min="-200" max="200" onChange={(value) => updateProps({ ...block.props, shadowOffsetY: value === "" ? 0 : value })} step="1" suffix="px" value={block.props.shadowOffsetY ?? 6} />
                </div>
              </>
            ) : null}
          </div>
        </div>
      </AccordionSection>

      <AccordionSection title="Position & size" defaultOpen={false}>
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <NumberInput prefix={<span className="text-[10px] font-semibold w-3">X</span>} min={String(-MOTION_DOC_CANVAS_WIDTH)} max={String(MOTION_DOC_CANVAS_WIDTH)} onChange={(value) => updateFramePixels("x", value)} placeholder="192" step="1" suffix="px" value={framePixels("x")} />
            <NumberInput prefix={<span className="text-[10px] font-semibold w-3">Y</span>} min={String(-MOTION_DOC_CANVAS_HEIGHT)} max={String(MOTION_DOC_CANVAS_HEIGHT)} onChange={(value) => updateFramePixels("y", value)} placeholder="216" step="1" suffix="px" value={framePixels("y")} />
            <NumberInput prefix={<span className="text-[10px] font-semibold w-3">W</span>} min="1" max={String(MOTION_DOC_CANVAS_WIDTH * 2)} onChange={(value) => updateFramePixels("w", value)} placeholder="806" step="1" suffix="px" value={framePixels("w")} />
            <NumberInput prefix={<span className="text-[10px] font-semibold w-3">H</span>} min="1" max={String(MOTION_DOC_CANVAS_HEIGHT * 2)} onChange={(value) => updateFramePixels("h", value)} placeholder="194" step="1" suffix="px" value={framePixels("h")} />
          </div>
          <Field label="Rotation">
            <div>
              <NumberInput
                aria-label={tx("Rotation")}
                prefix={<span className="text-[10px] font-semibold text-neutral-500">°</span>}
                min="-180"
                max="180"
                onChange={(value) => updateProps({ ...block.props, rotation: value === "" ? 0 : value })}
                placeholder="0"
                step="1"
                suffix="°"
                value={blockRotation(block.props)}
              />
            </div>
          </Field>
          {supportsAspectRatioLock ? (
            <Toggle
              className={`flex h-8 items-center justify-center gap-2 rounded-lg border text-[11px] font-semibold transition ${isAspectRatioLocked ? "border-violet-400/45 bg-violet-500/15 text-violet-100" : "border-white/[0.06] bg-black/30 text-neutral-400 hover:bg-white/[0.05] hover:text-white"}`}
              onPressedChange={(pressed) => updateProps(setBlockAspectRatioLocked(block.props, pressed))}
              pressed={isAspectRatioLocked}
              size="sm"
            >
              {isAspectRatioLocked ? <Link2 size={13} /> : <Unlink2 size={13} />}
              {tx(isAspectRatioLocked ? "Aspect ratio locked" : "Lock aspect ratio")}
            </Toggle>
          ) : null}
        </div>
      </AccordionSection>

      <AccordionSection title="Motion & Transition" defaultOpen={false}>
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
  if (type === "Card" || type === "Metric") return 16;

  return 0;
}
