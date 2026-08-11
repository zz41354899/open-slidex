"use client";

import type { CSSProperties, ReactElement } from "react";
import {
  FlutedGlass,
  HalftoneCmyk,
  HalftoneDots,
  ImageDithering,
  PaperTexture,
  Water,
  type FlutedGlassProps,
  type HalftoneCmykProps,
  type HalftoneDotsProps,
  type ImageDitheringProps
} from "@paper-design/shaders-react";
import {
  getPaperImageFilterDefinition,
  getPaperImageFilterPresetParams,
  resolvePaperImageFilterControls,
  type PaperImageFilterControlValues,
  type PaperImageFilterDefinition,
  type PaperImageFilterId,
  type PaperImageFilterRuntimeParams
} from "@/core/motion-doc/application/shaders/paperImageFilterCatalog";
import { useCachedShaderImage } from "@/features/pitch/ui/preview/useCachedShaderImage";

type PaperImageFilterLayerProps = {
  filter: string | undefined;
  filterAngle?: number;
  filterContrast?: number;
  filterDetail?: number;
  filterDistortion?: number;
  filterPreset?: string;
  filterSize?: number;
  filterSpeed?: number;
  fit?: string;
  src: string;
};

type PaperImageFilterRendererInput = {
  controls: PaperImageFilterControlValues;
  image: HTMLImageElement;
  params: PaperImageFilterRuntimeParams;
  sizingProps: PaperImageFilterSizingProps;
};

type PaperImageFilterRenderer = (input: PaperImageFilterRendererInput) => ReactElement;

type PaperImageFilterSizingProps = {
  className: string;
  fit: "contain" | "cover";
  maxPixelCount: number;
  minPixelRatio: number;
  rotation: number;
  scale: number;
  speed: number;
  style: CSSProperties;
  webGlContextAttributes: WebGLContextAttributes;
};

const paperImageFilterWebGlContextAttributes = {
  alpha: true,
  antialias: false,
  premultipliedAlpha: false,
  preserveDrawingBuffer: false
} satisfies WebGLContextAttributes;

const PAPER_IMAGE_FILTER_MAX_PIXEL_COUNT = 1024 * 768;
const PAPER_IMAGE_FILTER_MIN_PIXEL_RATIO = 1;

export function PaperImageFilterLayer({
  filter,
  filterAngle,
  filterContrast,
  filterDetail,
  filterDistortion,
  filterPreset,
  filterSize,
  filterSpeed,
  fit,
  src
}: PaperImageFilterLayerProps) {
  const definition = getPaperImageFilterDefinition(filter);

  if (!definition || !src) {
    return null;
  }

  return (
    <LoadedPaperImageFilterLayer
      definition={definition}
      filterAngle={filterAngle}
      filterContrast={filterContrast}
      filterDetail={filterDetail}
      filterDistortion={filterDistortion}
      filterPreset={filterPreset}
      filterSize={filterSize}
      filterSpeed={filterSpeed}
      fit={fit}
      src={src}
    />
  );
}

function LoadedPaperImageFilterLayer({
  definition,
  filterAngle,
  filterContrast,
  filterDetail,
  filterDistortion,
  filterPreset,
  filterSize,
  filterSpeed,
  fit,
  src
}: Omit<PaperImageFilterLayerProps, "filter"> & { definition: PaperImageFilterDefinition }) {
  const image = useCachedShaderImage(src);

  if (!image) {
    return null;
  }

  const params = getPaperImageFilterPresetParams(definition.id, filterPreset);
  const controls = resolvePaperImageFilterControls(definition, params, {
    filterAngle,
    filterContrast,
    filterDetail,
    filterDistortion,
    filterSize,
    filterSpeed
  });
  const renderer = paperImageFilterRenderers[definition.id];
  const sizingProps = {
    className: "pointer-events-none absolute inset-0 h-full w-full",
    fit: normalizePaperImageFit(fit),
    maxPixelCount: PAPER_IMAGE_FILTER_MAX_PIXEL_COUNT,
    minPixelRatio: PAPER_IMAGE_FILTER_MIN_PIXEL_RATIO,
    rotation: numberParam(params, "rotation", 0),
    scale: Math.max(0.05, numberParam(params, "scale", 1)),
    speed: controls.filterSpeed,
    style: {
      borderRadius: "inherit",
      height: "100%",
      inset: 0,
      overflow: "hidden",
      position: "absolute",
      width: "100%"
    },
    webGlContextAttributes: paperImageFilterWebGlContextAttributes
  } satisfies PaperImageFilterSizingProps;

  return renderer({ controls, image, params, sizingProps });
}

const paperImageFilterRenderers = {
  "paper-texture": ({ controls, image, params, sizingProps }) => (
    <PaperTexture
      colorBack={stringParam(params, "colorBack", "#ffffff")}
      colorFront={stringParam(params, "colorFront", "#9fadbc")}
      contrast={controls.filterContrast}
      crumples={numberParam(params, "crumples", 0.3)}
      crumpleSize={numberParam(params, "crumpleSize", 0.35)}
      drops={numberParam(params, "drops", 0.2)}
      fade={numberParam(params, "fade", 0)}
      fiber={controls.filterSize}
      fiberSize={numberParam(params, "fiberSize", 0.2)}
      foldCount={numberParam(params, "foldCount", 5)}
      folds={numberParam(params, "folds", 0.65)}
      image={image}
      roughness={controls.filterDistortion}
      seed={numberParam(params, "seed", 5.8)}
      {...sizingProps}
    />
  ),

  "fluted-glass": ({ controls, image, params, sizingProps }) => (
    <FlutedGlass
      angle={controls.filterAngle}
      blur={numberParam(params, "blur", 0)}
      colorBack={stringParam(params, "colorBack", "#00000000")}
      colorHighlight={stringParam(params, "colorHighlight", "#ffffff")}
      colorShadow={stringParam(params, "colorShadow", "#000000")}
      distortion={controls.filterDistortion}
      distortionShape={stringParam(params, "distortionShape", "prism") as FlutedGlassProps["distortionShape"]}
      edges={numberParam(params, "edges", 0.25)}
      grainMixer={numberParam(params, "grainMixer", 0)}
      grainOverlay={numberParam(params, "grainOverlay", 0)}
      highlights={numberParam(params, "highlights", 0.1)}
      image={image}
      marginBottom={numberParam(params, "marginBottom", 0)}
      marginLeft={numberParam(params, "marginLeft", 0)}
      marginRight={numberParam(params, "marginRight", 0)}
      marginTop={numberParam(params, "marginTop", 0)}
      shadows={numberParam(params, "shadows", 0.25)}
      shape={stringParam(params, "shape", "lines") as FlutedGlassProps["shape"]}
      shift={numberParam(params, "shift", 0)}
      size={controls.filterSize}
      stretch={numberParam(params, "stretch", 0)}
      {...sizingProps}
    />
  ),

  water: ({ controls, image, params, sizingProps }) => (
    <Water
      caustic={controls.filterContrast}
      colorBack={stringParam(params, "colorBack", "#909090")}
      colorHighlight={stringParam(params, "colorHighlight", "#ffffff")}
      edges={numberParam(params, "edges", 0.8)}
      highlights={numberParam(params, "highlights", 0.07)}
      image={image}
      layering={numberParam(params, "layering", 0.5)}
      size={controls.filterSize}
      waves={controls.filterDistortion}
      {...sizingProps}
    />
  ),

  dithering: ({ controls, image, params, sizingProps }) => (
    <ImageDithering
      colorBack={stringParam(params, "colorBack", "#000000")}
      colorFront={stringParam(params, "colorFront", "#ffffff")}
      colorHighlight={stringParam(params, "colorHighlight", "#ffffff")}
      colorSteps={Math.max(1, Math.round(controls.filterDetail))}
      image={image}
      inverted={booleanParam(params, "inverted", false)}
      originalColors={controls.filterDistortion > 0.5}
      size={controls.filterSize}
      type={stringParam(params, "type", "8x8") as ImageDitheringProps["type"]}
      {...sizingProps}
    />
  ),

  "halftone-dots": ({ controls, image, params, sizingProps }) => (
    <HalftoneDots
      colorBack={stringParam(params, "colorBack", "#f2f1e8")}
      colorFront={stringParam(params, "colorFront", "#2b2b2b")}
      contrast={controls.filterContrast}
      grainMixer={numberParam(params, "grainMixer", 0.2)}
      grainOverlay={numberParam(params, "grainOverlay", 0.2)}
      grainSize={numberParam(params, "grainSize", 0.5)}
      grid={stringParam(params, "grid", "hex") as HalftoneDotsProps["grid"]}
      image={image}
      inverted={booleanParam(params, "inverted", false)}
      originalColors={booleanParam(params, "originalColors", false)}
      radius={controls.filterDistortion}
      size={controls.filterSize}
      type={stringParam(params, "type", "gooey") as HalftoneDotsProps["type"]}
      {...sizingProps}
    />
  ),

  "halftone-cmyk": ({ controls, image, params, sizingProps }) => (
    <HalftoneCmyk
      colorBack={stringParam(params, "colorBack", "#fbfaf5")}
      colorC={stringParam(params, "colorC", "#00b4ff")}
      colorK={stringParam(params, "colorK", "#231f20")}
      colorM={stringParam(params, "colorM", "#fc519f")}
      colorY={stringParam(params, "colorY", "#ffd800")}
      contrast={controls.filterContrast}
      floodC={numberParam(params, "floodC", 0.15)}
      floodK={numberParam(params, "floodK", 0)}
      floodM={numberParam(params, "floodM", 0)}
      floodY={numberParam(params, "floodY", 0)}
      gainC={numberParam(params, "gainC", 0.3)}
      gainK={numberParam(params, "gainK", 0)}
      gainM={numberParam(params, "gainM", 0)}
      gainY={numberParam(params, "gainY", 0.2)}
      grainMixer={numberParam(params, "grainMixer", 0)}
      grainOverlay={numberParam(params, "grainOverlay", 0)}
      grainSize={numberParam(params, "grainSize", 0.5)}
      gridNoise={numberParam(params, "gridNoise", 0.2)}
      image={image}
      size={controls.filterSize}
      softness={controls.filterSpeed}
      type={stringParam(params, "type", "ink") as HalftoneCmykProps["type"]}
      {...sizingProps}
    />
  )
} satisfies Record<PaperImageFilterId, PaperImageFilterRenderer>;

function normalizePaperImageFit(value: string | undefined): "contain" | "cover" {
  if (value === "contain" || value === "scale-down") {
    return "contain";
  }

  return "cover";
}

function numberParam(params: PaperImageFilterRuntimeParams, key: string, fallback: number) {
  const value = params[key];

  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringParam(params: PaperImageFilterRuntimeParams, key: string, fallback: string) {
  const value = params[key];

  return typeof value === "string" && value ? value : fallback;
}

function booleanParam(params: PaperImageFilterRuntimeParams, key: string, fallback: boolean) {
  const value = params[key];

  return typeof value === "boolean" ? value : fallback;
}
