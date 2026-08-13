
import { memo, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import type { PaperShaderElement } from "@paper-design/shaders";
import { didPauseShader, normalizeShaderFrame } from "@/core/motion-doc/application/shaderFrame";
import { DEFAULT_DARK_SHADER_PALETTE, DEFAULT_SHADER_CONTROLS } from "@/core/motion-doc/application/shaders/shaderDefaults";
import {
  getPaperShaderPresetParams,
  resolvePaperShaderId
} from "@/core/motion-doc/application/shaders/paperShaderCatalog";
import {
  PAPER_SHADER_PREVIEW_MAX_PIXEL_COUNT,
  PAPER_SHADER_PREVIEW_MIN_PIXEL_RATIO,
  paperShaderPreviewWebGlContextAttributes,
  paperShaderRenderers,
  type PaperShaderPreviewColors,
  type PaperShaderPreviewControls
} from "@/features/pitch/ui/preview/paperShaderRenderers";

type ThreeShaderCanvasProps = {
  angle?: number;
  className?: string;
  color1?: string;
  color2?: string;
  color3?: string;
  color4?: string;
  color5?: string;
  color6?: string;
  detail?: number;
  frame?: number;
  image?: string;
  intensity?: number;
  onFrameCapture?: (frame: number) => void;
  presetId: string;
  scale?: number;
  shaderPreset?: string;
  softness?: number;
  speed?: number;
  style?: CSSProperties;
};

function ThreeShaderCanvasImpl({
  angle = DEFAULT_SHADER_CONTROLS.angle,
  className,
  color1 = DEFAULT_DARK_SHADER_PALETTE.color1,
  color2 = DEFAULT_DARK_SHADER_PALETTE.color2,
  color3 = DEFAULT_DARK_SHADER_PALETTE.color3,
  color4 = DEFAULT_DARK_SHADER_PALETTE.color4,
  color5 = DEFAULT_DARK_SHADER_PALETTE.color5,
  color6 = DEFAULT_DARK_SHADER_PALETTE.color6,
  detail = DEFAULT_SHADER_CONTROLS.detail,
  frame = DEFAULT_SHADER_CONTROLS.frame,
  image,
  intensity = DEFAULT_SHADER_CONTROLS.intensity,
  onFrameCapture,
  presetId,
  scale = DEFAULT_SHADER_CONTROLS.scale,
  shaderPreset,
  softness = DEFAULT_SHADER_CONTROLS.softness,
  speed = DEFAULT_SHADER_CONTROLS.speed,
  style
}: ThreeShaderCanvasProps) {
  const shaderElementRef = useRef<PaperShaderElement | null>(null);
  const previousSpeedRef = useRef(speed);
  const paperShaderId = resolvePaperShaderId(presetId) ?? "mesh-gradient";
  const presetParams = useMemo(
    () => getPaperShaderPresetParams(paperShaderId, shaderPreset),
    [paperShaderId, shaderPreset]
  );

  const colors = useMemo<PaperShaderPreviewColors>(() => ({
    color1,
    color2,
    color3,
    color4,
    color5,
    color6
  }), [color1, color2, color3, color4, color5, color6]);
  const controls = useMemo<PaperShaderPreviewControls>(() => ({
    angle,
    detail,
    intensity,
    scale,
    softness,
    speed
  }), [angle, detail, intensity, scale, softness, speed]);
  const colorsArray = useMemo(
    () => [color1, color2, color3, color4, color5, color6].filter(Boolean) as string[],
    [color1, color2, color3, color4, color5, color6]
  );
  const colorsFrom2 = useMemo(
    () => [color2, color3, color4, color5, color6].filter(Boolean) as string[],
    [color2, color3, color4, color5, color6]
  );
  const colorsFrom3 = useMemo(
    () => [color3, color4, color5, color6].filter(Boolean) as string[],
    [color3, color4, color5, color6]
  );

  const sizingProps = useMemo(() => ({
    className,
    fit: shaderFitParam(presetParams, "fit", "contain"),
    frame,
    maxPixelCount: PAPER_SHADER_PREVIEW_MAX_PIXEL_COUNT,
    minPixelRatio: PAPER_SHADER_PREVIEW_MIN_PIXEL_RATIO,
    offsetX: numberParam(presetParams, "offsetX", 0),
    offsetY: numberParam(presetParams, "offsetY", 0),
    originX: numberParam(presetParams, "originX", 0.5),
    originY: numberParam(presetParams, "originY", 0.5),
    rotation: angle,
    scale: Math.max(0.01, scale),
    speed,
    style: {
      backfaceVisibility: "hidden" as const,
      contain: "strict" as const,
      display: "block" as const,
      height: "100%",
      inset: 0,
      pointerEvents: "none" as const,
      position: "absolute" as const,
      transform: "translateZ(0)",
      width: "100%",
      willChange: "transform",
      ...style
    },
    webGlContextAttributes: paperShaderPreviewWebGlContextAttributes,
    worldHeight: numberParam(presetParams, "worldHeight", 0),
    worldWidth: numberParam(presetParams, "worldWidth", 0)
  }), [angle, className, frame, presetParams, scale, speed, style]);

  useEffect(() => {
    const previousSpeed = previousSpeedRef.current;
    previousSpeedRef.current = speed;

    if (!didPauseShader(previousSpeed, speed)) {
      return;
    }

    const currentFrame = shaderElementRef.current?.paperShaderMount?.getCurrentFrame();
    if (currentFrame === undefined) {
      return;
    }

    const capturedFrame = normalizeShaderFrame(currentFrame);
    if (capturedFrame !== normalizeShaderFrame(frame)) {
      onFrameCapture?.(capturedFrame);
    }
  }, [frame, onFrameCapture, speed]);

  const Renderer = paperShaderRenderers[paperShaderId];
  return (
    <Renderer
      colors={colors}
      colorsArray={colorsArray}
      colorsFrom2={colorsFrom2}
      colorsFrom3={colorsFrom3}
      controls={controls}
      image={image}
      params={presetParams}
      shaderRef={shaderElementRef}
      sizingProps={sizingProps}
    />
  );
}

function areThreeShaderCanvasPropsEqual(previous: ThreeShaderCanvasProps, next: ThreeShaderCanvasProps) {
  return (
    previous.angle === next.angle &&
    previous.className === next.className &&
    previous.color1 === next.color1 &&
    previous.color2 === next.color2 &&
    previous.color3 === next.color3 &&
    previous.color4 === next.color4 &&
    previous.color5 === next.color5 &&
    previous.color6 === next.color6 &&
    previous.detail === next.detail &&
    previous.frame === next.frame &&
    previous.image === next.image &&
    previous.intensity === next.intensity &&
    previous.presetId === next.presetId &&
    previous.scale === next.scale &&
    previous.shaderPreset === next.shaderPreset &&
    previous.softness === next.softness &&
    previous.speed === next.speed &&
    shallowStyleEqual(previous.style, next.style)
  );
}

function shallowStyleEqual(previous: CSSProperties | undefined, next: CSSProperties | undefined) {
  if (previous === next) return true;
  if (!previous || !next) return false;

  const previousKeys = Object.keys(previous) as Array<keyof CSSProperties>;
  const nextKeys = Object.keys(next) as Array<keyof CSSProperties>;

  if (previousKeys.length !== nextKeys.length) {
    return false;
  }

  return previousKeys.every((key) => previous[key] === next[key]);
}

function numberParam(params: Record<string, unknown>, key: string, fallback: number) {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function shaderFitParam(params: Record<string, unknown>, key: string, fallback: "none" | "contain" | "cover") {
  const value = params[key];
  return value === "none" || value === "contain" || value === "cover" ? value : fallback;
}

export const ThreeShaderCanvas = memo(ThreeShaderCanvasImpl, areThreeShaderCanvasPropsEqual);
