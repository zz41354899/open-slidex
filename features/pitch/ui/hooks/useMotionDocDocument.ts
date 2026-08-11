import { useMemo } from "react";
import { stringValue } from "@/common/util/valueUtils";
import { getMotionDocStats } from "@/core/motion-doc/application/mdxStats";
import { materializeFreeformSource } from "@/core/motion-doc/application/motionDocFreeform";
import { numberValue } from "@/core/motion-doc/domain/frame";
import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import { buildSlideRows } from "@/features/pitch/application/slideRows";

export function useMotionDocDocument({
  activeSlideIndex,
  source
}: {
  activeSlideIndex: number;
  source: string;
}) {
  const canvasSource = useMemo(() => materializeFreeformSource(source), [source]);
  const stats = useMemo(() => getMotionDocStats(canvasSource), [canvasSource]);
  const sliderDocument = useMemo(() => parseMotionDoc(canvasSource), [canvasSource]);
  const activeSlide = sliderDocument.scenes[activeSlideIndex] ?? sliderDocument.scenes[0];
  const activeSlideBackground = stringValue(activeSlide?.props.background) ?? "#0f172a";
  const activeSlideAccent = stringValue(activeSlide?.props.accent) ?? "#7c3aed";
  const activeSlideTheme = stringValue(activeSlide?.props.theme) ?? "dark";
  const activeSlideLayoutPreset = stringValue(activeSlide?.props.layoutPreset) ?? "blank";
  const activeSlideTextColor = stringValue(activeSlide?.props.textColor ?? activeSlide?.props.foreground ?? activeSlide?.props.color) ?? "";
  const activeSlideMutedColor = stringValue(activeSlide?.props.mutedColor) ?? "";
  const activeSlideShader = stringValue(activeSlide?.props.shader) ?? "";
  const activeSlideShaderAngle = numberValue(activeSlide?.props.shaderAngle) ?? 0;
  const activeSlideShaderColor1 = stringValue(activeSlide?.props.shaderColor1) ?? "";
  const activeSlideShaderColor2 = stringValue(activeSlide?.props.shaderColor2) ?? "";
  const activeSlideShaderColor3 = stringValue(activeSlide?.props.shaderColor3) ?? "";
  const activeSlideShaderColor4 = stringValue(activeSlide?.props.shaderColor4) ?? "";
  const activeSlideShaderColor5 = stringValue(activeSlide?.props.shaderColor5) ?? "";
  const activeSlideShaderColor6 = stringValue(activeSlide?.props.shaderColor6) ?? "";
  const activeSlideShaderEngine = stringValue(activeSlide?.props.shaderEngine) ?? "three";
  const activeSlideShaderIntensity = numberValue(activeSlide?.props.shaderIntensity) ?? 0.5;
  const activeSlideShaderPreset = stringValue(activeSlide?.props.shaderPreset) ?? "";
  const activeSlideShaderSpeed = numberValue(activeSlide?.props.shaderSpeed) ?? 1;
  const activeSlideShaderSoftness = numberValue(activeSlide?.props.shaderSoftness) ?? 0.5;
  const activeSlideShaderScale = numberValue(activeSlide?.props.shaderScale) ?? 0.5;
  const activeSlideShaderDetail = numberValue(activeSlide?.props.shaderDetail) ?? 0.5;
  const slideRows = useMemo(() => buildSlideRows(sliderDocument.scenes), [sliderDocument.scenes]);

  return {
    activeSlide,
    activeSlideAccent,
    activeSlideBackground,
    activeSlideLayoutPreset,
    activeSlideMutedColor,
    activeSlideShader,
    activeSlideShaderAngle,
    activeSlideShaderColor1,
    activeSlideShaderColor2,
    activeSlideShaderColor3,
    activeSlideShaderColor4,
    activeSlideShaderColor5,
    activeSlideShaderColor6,
    activeSlideShaderDetail,
    activeSlideShaderEngine,
    activeSlideShaderIntensity,
    activeSlideShaderPreset,
    activeSlideShaderScale,
    activeSlideShaderSoftness,
    activeSlideShaderSpeed,
    activeSlideTextColor,
    activeSlideTheme,
    canvasSource,
    slideRows,
    sliderDocument,
    stats
  };
}
