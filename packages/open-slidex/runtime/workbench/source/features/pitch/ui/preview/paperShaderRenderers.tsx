
import type { CSSProperties, ReactElement, Ref } from "react";
import type { PaperShaderElement } from "@paper-design/shaders";
import type {
  PaperShaderId,
  PaperShaderRuntimeParams
} from "@/core/motion-doc/application/shaders/paperShaderCatalog";
import {
  Dithering,
  DotOrbit,
  GodRays,
  GrainGradient,
  LiquidMetal,
  MeshGradient,
  Metaballs,
  NeuroNoise,
  PaperTexture,
  StaticMeshGradient,
  Swirl,
  Water
} from "@paper-design/shaders-react";

export type PaperShaderPreviewColors = {
  color1: string;
  color2: string;
  color3: string;
  color4: string;
  color5: string;
  color6: string;
};

export type PaperShaderPreviewControls = {
  angle: number;
  detail: number;
  intensity: number;
  scale: number;
  softness: number;
  speed: number;
};

export type PaperShaderSizingProps = {
  className?: string;
  fit?: "none" | "contain" | "cover";
  frame: number;
  maxPixelCount: number;
  minPixelRatio: number;
  offsetX?: number;
  offsetY?: number;
  originX?: number;
  originY?: number;
  rotation: number;
  scale: number;
  speed: number;
  style: CSSProperties;
  webGlContextAttributes: WebGLContextAttributes;
  worldHeight?: number;
  worldWidth?: number;
};

type PaperShaderRendererInput = {
  colors: PaperShaderPreviewColors;
  colorsArray: string[];
  colorsFrom2: string[];
  colorsFrom3: string[];
  controls: PaperShaderPreviewControls;
  image?: string;
  params: PaperShaderRuntimeParams;
  shaderRef: Ref<PaperShaderElement>;
  sizingProps: PaperShaderSizingProps;
};

type PaperShaderRenderer = (input: PaperShaderRendererInput) => ReactElement;

export const paperShaderPreviewWebGlContextAttributes = {
  alpha: true,
  antialias: false,
  premultipliedAlpha: false,
  preserveDrawingBuffer: false
} satisfies WebGLContextAttributes;

export const PAPER_SHADER_PREVIEW_MAX_PIXEL_COUNT = 1280 * 720;
export const PAPER_SHADER_PREVIEW_MIN_PIXEL_RATIO = 1;

export const paperShaderRenderers = {
  "mesh-gradient": ({ colorsArray, controls, params, shaderRef, sizingProps }) => (
    <MeshGradient
      colors={colorsArray}
      distortion={controls.intensity}
      grainMixer={controls.detail}
      grainOverlay={numberParam(params, "grainOverlay", 0)}
      ref={shaderRef}
      swirl={controls.softness}
      {...sizingProps}
    />
  ),

  "static-mesh-gradient": ({ colorsArray, controls, params, shaderRef, sizingProps }) => (
    <StaticMeshGradient
      colors={colorsArray}
      grainMixer={controls.detail}
      grainOverlay={numberParam(params, "grainOverlay", 0)}
      mixing={controls.softness}
      positions={numberParam(params, "positions", 0)}
      ref={shaderRef}
      waveX={controls.intensity}
      waveXShift={numberParam(params, "waveXShift", 0)}
      waveY={controls.intensity}
      waveYShift={numberParam(params, "waveYShift", 0)}
      {...sizingProps}
      speed={0}
    />
  ),

  swirl: ({ colors, colorsFrom2, controls, params, shaderRef, sizingProps }) => (
    <Swirl
      bandCount={numberParam(params, "bandCount", 4)}
      center={numberParam(params, "center", 0.2)}
      colorBack={colors.color1}
      colors={colorsFrom2}
      noise={controls.detail}
      noiseFrequency={numberParam(params, "noiseFrequency", 0.4)}
      proportion={numberParam(params, "proportion", 0.5)}
      ref={shaderRef}
      softness={controls.softness}
      twist={controls.intensity}
      {...sizingProps}
    />
  ),

  "dot-orbit": ({ colors, colorsFrom2, controls, params, shaderRef, sizingProps }) => (
    <DotOrbit
      colorBack={colors.color1}
      colors={colorsFrom2}
      ref={shaderRef}
      size={numberParam(params, "size", 0.8)}
      sizeRange={controls.softness}
      spreading={controls.intensity}
      stepsPerColor={Math.max(1, Math.round(controls.detail))}
      {...sizingProps}
    />
  ),

  "god-rays": ({ colors, colorsFrom3, controls, params, shaderRef, sizingProps }) => (
    <GodRays
      bloom={numberParam(params, "bloom", 0.4)}
      colorBack={colors.color1}
      colorBloom={colors.color2}
      colors={colorsFrom3}
      density={controls.detail}
      intensity={controls.intensity}
      midIntensity={numberParam(params, "midIntensity", 0.4)}
      midSize={numberParam(params, "midSize", 0.2)}
      ref={shaderRef}
      spotty={controls.softness}
      {...sizingProps}
    />
  ),

  "neuro-noise": ({ colors, controls, shaderRef, sizingProps }) => (
    <NeuroNoise
      brightness={controls.intensity}
      colorBack={colors.color1}
      colorFront={colors.color3}
      colorMid={colors.color2}
      contrast={controls.detail}
      ref={shaderRef}
      {...sizingProps}
    />
  ),

  "liquid-metal": ({ colors, controls, image, params, shaderRef, sizingProps }) => (
    <LiquidMetal
      angle={controls.angle}
      colorBack={colors.color1}
      colorTint={colors.color2}
      contour={controls.detail}
      distortion={controls.intensity}
      image={image}
      repetition={numberParam(params, "repetition", 2)}
      ref={shaderRef}
      shape={stringParam(params, "shape", "diamond") as "none" | "circle" | "daisy" | "diamond" | "metaballs"}
      shiftBlue={numberParam(params, "shiftBlue", 0.3)}
      shiftRed={numberParam(params, "shiftRed", 0.3)}
      softness={controls.softness}
      {...sizingProps}
    />
  ),

  "grain-gradient": ({ colors, colorsFrom2, controls, params, shaderRef, sizingProps }) => (
    <GrainGradient
      colorBack={colors.color1}
      colors={colorsFrom2}
      intensity={controls.intensity}
      noise={controls.detail}
      ref={shaderRef}
      shape={stringParam(params, "shape", "corners") as "wave" | "dots" | "truchet" | "corners" | "ripple" | "blob" | "sphere"}
      softness={controls.softness}
      {...sizingProps}
    />
  ),

  metaballs: ({ colors, colorsFrom2, controls, shaderRef, sizingProps }) => (
    <Metaballs
      colorBack={colors.color1}
      colors={colorsFrom2}
      count={Math.max(1, Math.round(controls.detail))}
      ref={shaderRef}
      size={controls.intensity}
      {...sizingProps}
    />
  ),

  "paper-texture": ({ colors, controls, image, params, shaderRef, sizingProps }) => (
    <PaperTexture
      colorBack={colors.color1}
      colorFront={colors.color2}
      contrast={controls.detail}
      crumples={numberParam(params, "crumples", 0.3)}
      crumpleSize={numberParam(params, "crumpleSize", 0.35)}
      drops={numberParam(params, "drops", 0.2)}
      fade={numberParam(params, "fade", 0)}
      fiber={controls.softness}
      fiberSize={numberParam(params, "fiberSize", 0.2)}
      foldCount={numberParam(params, "foldCount", 5)}
      folds={numberParam(params, "folds", 0.65)}
      image={image}
      roughness={controls.intensity}
      seed={numberParam(params, "seed", 5.8)}
      ref={shaderRef}
      {...sizingProps}
      speed={0}
    />
  ),

  water: ({ colors, controls, image, params, shaderRef, sizingProps }) => (
    <Water
      caustic={controls.intensity}
      colorBack={colors.color1}
      colorHighlight={colors.color2}
      edges={numberParam(params, "edges", 0.8)}
      highlights={numberParam(params, "highlights", 0.07)}
      image={image}
      layering={numberParam(params, "layering", 0.5)}
      ref={shaderRef}
      size={Math.max(0.01, controls.detail)}
      waves={controls.softness}
      {...sizingProps}
    />
  ),

  dithering: ({ colors, controls, params, shaderRef, sizingProps }) => (
    <Dithering
      colorBack={colors.color1}
      colorFront={colors.color2}
      ref={shaderRef}
      shape={stringParam(params, "shape", "sphere") as "simplex" | "warp" | "dots" | "wave" | "ripple" | "swirl" | "sphere"}
      size={Math.max(0.5, controls.detail)}
      type={stringParam(params, "type", "4x4") as "random" | "2x2" | "4x4" | "8x8"}
      {...sizingProps}
    />
  )
} satisfies Record<PaperShaderId, PaperShaderRenderer>;

function numberParam(params: PaperShaderRuntimeParams, key: string, fallback: number) {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringParam(params: PaperShaderRuntimeParams, key: string, fallback: string) {
  const value = params[key];
  return typeof value === "string" && value ? value : fallback;
}
