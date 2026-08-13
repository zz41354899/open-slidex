import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

export const PAPER_IMAGE_FILTER_CONTROL_KEYS = [
  "filterDistortion",
  "filterSize",
  "filterAngle",
  "filterContrast",
  "filterSpeed",
  "filterDetail"
] as const;

export type PaperImageFilterControlKey = (typeof PAPER_IMAGE_FILTER_CONTROL_KEYS)[number];

export type PaperImageFilterRuntimeParams = Record<
  string,
  boolean | number | string | readonly string[] | undefined
>;

export type PaperImageFilterControl = {
  defaultValue: number;
  format?: "decimal" | "integer";
  key: PaperImageFilterControlKey;
  label: string;
  max: number;
  min: number;
  paramKey: string;
  step: number;
};

export type PaperImageFilterPreset = {
  name: string;
  params: PaperImageFilterRuntimeParams;
  props: MotionDocProps;
};

export type PaperImageFilterControlValues = Record<PaperImageFilterControlKey, number>;

export type PaperImageFilterDefinition = {
  controls: readonly PaperImageFilterControl[];
  defaultPreset: string;
  id: PaperImageFilterId;
  name: string;
  presets: readonly PaperImageFilterPreset[];
  thumbnail: string;
};

const paperImageFilterIds = [
  "paper-texture",
  "fluted-glass",
  "water",
  "dithering",
  "halftone-dots",
  "halftone-cmyk"
] as const;

export type PaperImageFilterId = (typeof paperImageFilterIds)[number];

const control = (
  key: PaperImageFilterControlKey,
  paramKey: string,
  label: string,
  min: number,
  max: number,
  step: number,
  defaultValue: number,
  format: PaperImageFilterControl["format"] = step >= 1 ? "integer" : "decimal"
) => ({ defaultValue, format, key, label, max, min, paramKey, step });

const paperTextureControls = [
  control("filterDistortion", "roughness", "Roughness", 0, 1, 0.01, 0.4),
  control("filterSize", "fiber", "Fiber", 0, 1, 0.01, 0.3),
  control("filterContrast", "contrast", "Contrast", 0, 2, 0.01, 0.3)
] as const;

const flutedGlassControls = [
  control("filterDistortion", "distortion", "Distortion", 0, 1, 0.01, 0.5),
  control("filterSize", "size", "Ribs", 0.01, 1, 0.01, 0.5),
  control("filterAngle", "angle", "Angle", 0, 180, 1, 0, "integer")
] as const;

const waterControls = [
  control("filterDistortion", "waves", "Waves", 0, 1, 0.01, 0.3),
  control("filterContrast", "caustic", "Caustic", 0, 2, 0.01, 0.1),
  control("filterSize", "size", "Size", 0.05, 2, 0.01, 1),
  control("filterSpeed", "speed", "Speed", 0, 3, 0.05, 1)
] as const;

const ditheringControls = [
  control("filterSize", "size", "Pixel Size", 0.5, 20, 0.5, 2),
  control("filterDetail", "colorSteps", "Color Steps", 1, 7, 1, 2, "integer"),
  control("filterDistortion", "originalColors", "Original Colors", 0, 1, 1, 0, "integer")
] as const;

const halftoneDotsControls = [
  control("filterSize", "size", "Grid", 0.01, 1, 0.01, 0.5),
  control("filterDistortion", "radius", "Radius", 0, 2, 0.01, 1.25),
  control("filterContrast", "contrast", "Contrast", 0, 1, 0.01, 0.4)
] as const;

const halftoneCmykControls = [
  control("filterSize", "size", "Grid", 0.01, 1, 0.01, 0.2),
  control("filterContrast", "contrast", "Contrast", 0, 2, 0.01, 1),
  control("filterSpeed", "softness", "Softness", 0, 1, 0.01, 1)
] as const;

export const paperImageFilterDefinitions = [
  {
    controls: paperTextureControls,
    defaultPreset: "Default",
    id: "paper-texture",
    name: "PaperTexture",
    presets: [
      makePreset("Default", paperTextureControls, {
        colorBack: "#ffffff",
        colorFront: "#9fadbc",
        contrast: 0.3,
        crumpleSize: 0.35,
        crumples: 0.3,
        drops: 0.2,
        fade: 0,
        fiber: 0.3,
        fiberSize: 0.2,
        fit: "cover",
        foldCount: 5,
        folds: 0.65,
        frame: 0,
        roughness: 0.4,
        scale: 0.6,
        seed: 5.8,
        speed: 0
      }),
      makePreset("Cardboard", paperTextureControls, {
        colorBack: "#999180",
        colorFront: "#c7b89e",
        contrast: 0.4,
        crumpleSize: 0.1,
        crumples: 0.7,
        drops: 0.1,
        fade: 0,
        fiber: 0.35,
        fiberSize: 0.14,
        fit: "cover",
        foldCount: 1,
        folds: 0,
        frame: 0,
        roughness: 0,
        scale: 0.6,
        seed: 1.6,
        speed: 0
      }),
      makePreset("Abstract", paperTextureControls, {
        colorBack: "#ff0a81",
        colorFront: "#00eeff",
        contrast: 0.85,
        crumpleSize: 0.3,
        crumples: 0,
        drops: 0.2,
        fade: 0,
        fiber: 0.1,
        fiberSize: 0.2,
        fit: "cover",
        foldCount: 3,
        folds: 1,
        frame: 0,
        roughness: 0,
        scale: 0.6,
        seed: 2.2,
        speed: 0
      }),
      makePreset("Details", paperTextureControls, {
        colorBack: "#00000000",
        colorFront: "#00000000",
        contrast: 0,
        crumpleSize: 0.5,
        crumples: 1,
        drops: 0,
        fade: 0,
        fiber: 0.27,
        fiberSize: 0.22,
        fit: "cover",
        foldCount: 15,
        folds: 1,
        frame: 0,
        roughness: 1,
        scale: 3,
        seed: 6,
        speed: 0
      })
    ],
    thumbnail: "linear-gradient(135deg, #fbfaf5 0%, #d8d0c2 42%, #9fadbc 100%)"
  },
  {
    controls: flutedGlassControls,
    defaultPreset: "Default",
    id: "fluted-glass",
    name: "FlutedGlass",
    presets: [
      makePreset("Default", flutedGlassControls, {
        angle: 0,
        blur: 0,
        colorBack: "#00000000",
        colorHighlight: "#ffffff",
        colorShadow: "#000000",
        distortion: 0.5,
        distortionShape: "prism",
        edges: 0.25,
        fit: "cover",
        frame: 0,
        grainMixer: 0,
        grainOverlay: 0,
        highlights: 0.1,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
        marginTop: 0,
        scale: 1,
        shadows: 0.25,
        shape: "lines",
        shift: 0,
        size: 0.5,
        speed: 0,
        stretch: 0
      }),
      makePreset("Abstract", flutedGlassControls, {
        angle: 30,
        blur: 1,
        colorBack: "#00000000",
        colorHighlight: "#ffffff",
        colorShadow: "#000000",
        distortion: 1,
        distortionShape: "flat",
        edges: 0.5,
        fit: "cover",
        frame: 0,
        grainMixer: 0.1,
        grainOverlay: 0.1,
        highlights: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
        marginTop: 0,
        scale: 4,
        shadows: 0,
        shape: "linesIrregular",
        shift: 0,
        size: 0.7,
        speed: 0,
        stretch: 1
      }),
      makePreset("Waves", flutedGlassControls, {
        angle: 0,
        blur: 0.1,
        colorBack: "#00000000",
        colorHighlight: "#ffffff",
        colorShadow: "#000000",
        distortion: 0.5,
        distortionShape: "contour",
        edges: 0.5,
        fit: "cover",
        frame: 0,
        grainMixer: 0,
        grainOverlay: 0.05,
        highlights: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
        marginTop: 0,
        scale: 1.2,
        shadows: 0,
        shape: "wave",
        shift: 0,
        size: 0.9,
        speed: 0,
        stretch: 1
      }),
      makePreset("Folds", flutedGlassControls, {
        angle: 0,
        blur: 0.25,
        colorBack: "#00000000",
        colorHighlight: "#ffffff",
        colorShadow: "#000000",
        distortion: 0.75,
        distortionShape: "cascade",
        edges: 0.5,
        fit: "cover",
        frame: 0,
        grainMixer: 0,
        grainOverlay: 0,
        highlights: 0,
        marginBottom: 0.1,
        marginLeft: 0.1,
        marginRight: 0.1,
        marginTop: 0.1,
        scale: 1,
        shadows: 0.4,
        shape: "lines",
        shift: 0,
        size: 0.4,
        speed: 0,
        stretch: 0
      })
    ],
    thumbnail: "repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0 10px, rgba(255,255,255,0.02) 10px 22px), linear-gradient(135deg, #0b0b0d, #6f7684)"
  },
  {
    controls: waterControls,
    defaultPreset: "Default",
    id: "water",
    name: "Water",
    presets: [
      makePreset("Default", waterControls, {
        caustic: 0.1,
        colorBack: "#909090",
        colorHighlight: "#ffffff",
        edges: 0.8,
        fit: "cover",
        frame: 0,
        highlights: 0.07,
        layering: 0.5,
        scale: 0.8,
        size: 1,
        speed: 1,
        waves: 0.3
      }),
      makePreset("Slow-mo", waterControls, {
        caustic: 0.2,
        colorBack: "#909090",
        colorHighlight: "#ffffff",
        edges: 0,
        fit: "cover",
        frame: 0,
        highlights: 0.4,
        layering: 0,
        scale: 1,
        size: 0.7,
        speed: 0.1,
        waves: 0
      }),
      makePreset("Abstract", waterControls, {
        caustic: 0.4,
        colorBack: "#909090",
        colorHighlight: "#ffffff",
        edges: 1,
        fit: "cover",
        frame: 0,
        highlights: 0,
        layering: 0,
        scale: 3,
        size: 0.15,
        speed: 1,
        waves: 1
      }),
      makePreset("Streaming", waterControls, {
        caustic: 0,
        colorBack: "#909090",
        colorHighlight: "#ffffff",
        edges: 0,
        fit: "contain",
        frame: 0,
        highlights: 0,
        layering: 0,
        scale: 0.4,
        size: 0.5,
        speed: 2,
        waves: 0.5
      })
    ],
    thumbnail: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.9), transparent 22%), linear-gradient(135deg, #0d4b63, #83d4f2)"
  },
  {
    controls: ditheringControls,
    defaultPreset: "Default",
    id: "dithering",
    name: "ImageDithering",
    presets: [
      makePreset("Default", ditheringControls, {
        colorBack: "#000c38",
        colorFront: "#94ffaf",
        colorHighlight: "#eaff94",
        colorSteps: 2,
        fit: "cover",
        frame: 0,
        inverted: false,
        originalColors: false,
        scale: 1,
        size: 2,
        speed: 0,
        type: "8x8"
      }),
      makePreset("Noise", ditheringControls, {
        colorBack: "#000000",
        colorFront: "#a2997c",
        colorHighlight: "#ededed",
        colorSteps: 1,
        fit: "cover",
        frame: 0,
        inverted: false,
        originalColors: false,
        scale: 1,
        size: 1,
        speed: 0,
        type: "random"
      }),
      makePreset("Retro", ditheringControls, {
        colorBack: "#5452ff",
        colorFront: "#eeeeee",
        colorHighlight: "#eeeeee",
        colorSteps: 1,
        fit: "cover",
        frame: 0,
        inverted: false,
        originalColors: true,
        scale: 1,
        size: 3,
        speed: 0,
        type: "2x2"
      }),
      makePreset("Natural", ditheringControls, {
        colorBack: "#000000",
        colorFront: "#ffffff",
        colorHighlight: "#ffffff",
        colorSteps: 5,
        fit: "cover",
        frame: 0,
        inverted: false,
        originalColors: true,
        scale: 1,
        size: 2,
        speed: 0,
        type: "8x8"
      })
    ],
    thumbnail: "repeating-linear-gradient(45deg, #94ffaf 0 3px, #000c38 3px 7px)"
  },
  {
    controls: halftoneDotsControls,
    defaultPreset: "Default",
    id: "halftone-dots",
    name: "HalftoneDots",
    presets: [
      makePreset("Default", halftoneDotsControls, {
        colorBack: "#f2f1e8",
        colorFront: "#2b2b2b",
        contrast: 0.4,
        fit: "cover",
        frame: 0,
        grainMixer: 0.2,
        grainOverlay: 0.2,
        grainSize: 0.5,
        grid: "hex",
        inverted: false,
        originalColors: false,
        radius: 1.25,
        scale: 1,
        size: 0.5,
        speed: 0,
        type: "gooey"
      }),
      makePreset("LED screen", halftoneDotsControls, {
        colorBack: "#000000",
        colorFront: "#29ff7b",
        contrast: 0.3,
        fit: "cover",
        frame: 0,
        grainMixer: 0,
        grainOverlay: 0,
        grainSize: 0.5,
        grid: "square",
        inverted: false,
        originalColors: false,
        radius: 1.5,
        scale: 1,
        size: 0.5,
        speed: 0,
        type: "soft"
      }),
      makePreset("Mosaic", halftoneDotsControls, {
        colorBack: "#000000",
        colorFront: "#b2aeae",
        contrast: 0.01,
        fit: "cover",
        frame: 0,
        grainMixer: 0,
        grainOverlay: 0,
        grainSize: 0.5,
        grid: "hex",
        inverted: false,
        originalColors: true,
        radius: 2,
        scale: 1,
        size: 0.6,
        speed: 0,
        type: "classic"
      }),
      makePreset("Round and square", halftoneDotsControls, {
        colorBack: "#141414",
        colorFront: "#ff8000",
        contrast: 1,
        fit: "cover",
        frame: 0,
        grainMixer: 0.05,
        grainOverlay: 0.3,
        grainSize: 0.5,
        grid: "square",
        inverted: true,
        originalColors: false,
        radius: 1,
        scale: 1,
        size: 0.8,
        speed: 0,
        type: "holes"
      })
    ],
    thumbnail: "radial-gradient(circle, #2b2b2b 0 26%, transparent 28%), radial-gradient(circle, #2b2b2b 0 18%, transparent 20%), #f2f1e8"
  },
  {
    controls: halftoneCmykControls,
    defaultPreset: "Default",
    id: "halftone-cmyk",
    name: "HalftoneCmyk",
    presets: [
      makePreset("Default", halftoneCmykControls, {
        colorBack: "#fbfaf5",
        colorC: "#00b4ff",
        colorK: "#231f20",
        colorM: "#fc519f",
        colorY: "#ffd800",
        contrast: 1,
        fit: "cover",
        floodC: 0.15,
        floodK: 0,
        floodM: 0,
        floodY: 0,
        frame: 0,
        gainC: 0.3,
        gainK: 0,
        gainM: 0,
        gainY: 0.2,
        grainMixer: 0,
        grainOverlay: 0,
        grainSize: 0.5,
        gridNoise: 0.2,
        scale: 1,
        size: 0.2,
        softness: 1,
        speed: 0,
        type: "ink"
      }),
      makePreset("Drops", halftoneCmykControls, {
        colorBack: "#eeefd7",
        colorC: "#00b2ff",
        colorK: "#231f20",
        colorM: "#fc4f4f",
        colorY: "#ffd900",
        contrast: 1.15,
        fit: "cover",
        floodC: 0.15,
        floodK: 0,
        floodM: 0,
        floodY: 0,
        frame: 0,
        gainC: 1,
        gainK: 0,
        gainM: 0.44,
        gainY: -1,
        grainMixer: 0.05,
        grainOverlay: 0.25,
        grainSize: 0.01,
        gridNoise: 0.5,
        scale: 1,
        size: 0.88,
        softness: 0,
        speed: 0,
        type: "ink"
      }),
      makePreset("Newspaper", halftoneCmykControls, {
        colorBack: "#f2f1e8",
        colorC: "#7a7a75",
        colorK: "#231f20",
        colorM: "#7a7a75",
        colorY: "#7a7a75",
        contrast: 2,
        fit: "cover",
        floodC: 0,
        floodK: 0.1,
        floodM: 0,
        floodY: 0,
        frame: 0,
        gainC: -0.17,
        gainK: 0,
        gainM: -0.45,
        gainY: -0.45,
        grainMixer: 0,
        grainOverlay: 0.2,
        grainSize: 0,
        gridNoise: 0.6,
        scale: 1,
        size: 0.01,
        softness: 0.2,
        speed: 0,
        type: "dots"
      }),
      makePreset("Vintage", halftoneCmykControls, {
        colorBack: "#fffaf0",
        colorC: "#59afc5",
        colorK: "#2d2824",
        colorM: "#d8697c",
        colorY: "#fad85c",
        contrast: 1.25,
        fit: "cover",
        floodC: 0.15,
        floodK: 0,
        floodM: 0,
        floodY: 0,
        frame: 0,
        gainC: 0.3,
        gainK: 0,
        gainM: 0,
        gainY: 0.2,
        grainMixer: 0.15,
        grainOverlay: 0.1,
        grainSize: 0.5,
        gridNoise: 0.45,
        scale: 1,
        size: 0.2,
        softness: 0.4,
        speed: 0,
        type: "sharp"
      })
    ],
    thumbnail: "linear-gradient(135deg, rgba(0,180,255,0.76), rgba(252,81,159,0.72) 42%, rgba(255,216,0,0.82) 72%, #231f20)"
  }
] as const satisfies readonly PaperImageFilterDefinition[];

const paperImageFilterAliases = Object.fromEntries(
  paperImageFilterIds.map((id) => [`image-filter-${id}`, id])
) as Record<string, PaperImageFilterId>;

export function getPaperImageFilterDefinition(id: string | undefined) {
  if (!id || id === "none") {
    return undefined;
  }

  const normalized = (paperImageFilterAliases[id] ?? id) as PaperImageFilterId;

  return paperImageFilterDefinitions.find((definition) => definition.id === normalized);
}

export function getPaperImageFilterPreset(id: string | undefined, presetName: string | undefined) {
  const definition = getPaperImageFilterDefinition(id);

  if (!definition) {
    return undefined;
  }

  return (
    definition.presets.find((preset) => preset.name === presetName) ??
    definition.presets.find((preset) => preset.name === definition.defaultPreset) ??
    definition.presets[0]
  );
}

export function getPaperImageFilterPresetParams(id: string | undefined, presetName: string | undefined) {
  return getPaperImageFilterPreset(id, presetName)?.params ?? {};
}

export function resolvePaperImageFilterControls(
  definition: PaperImageFilterDefinition,
  params: PaperImageFilterRuntimeParams,
  overrides: Partial<Record<PaperImageFilterControlKey, number | string | undefined>> = {}
): PaperImageFilterControlValues {
  return Object.fromEntries(
    PAPER_IMAGE_FILTER_CONTROL_KEYS.map((key) => [
      key,
      resolvePaperImageFilterControlValue(definition, params, key, overrides[key])
    ])
  ) as PaperImageFilterControlValues;
}

export function resolvePaperImageFilterControlValue(
  definition: PaperImageFilterDefinition,
  params: PaperImageFilterRuntimeParams,
  key: PaperImageFilterControlKey,
  override?: number | string
) {
  const control = definition.controls.find((item) => item.key === key);
  const fallback = key === "filterSpeed" ? numberParam(params, "speed", 0) : 0;

  if (!control) {
    return fallback;
  }

  if (override !== "" && override !== undefined) {
    const parsedOverride = typeof override === "number" ? override : Number(override);

    if (Number.isFinite(parsedOverride)) {
      return clampNumber(parsedOverride, control.min, control.max);
    }
  }

  const paramValue = params[control.paramKey];

  if (typeof paramValue === "number" && Number.isFinite(paramValue)) {
    return clampNumber(paramValue, control.min, control.max);
  }

  if (typeof paramValue === "boolean") {
    return paramValue ? 1 : 0;
  }

  return control.defaultValue;
}

export function paperImageFilterPresetUpdates(id: string, presetName?: string): MotionDocProps {
  const definition = getPaperImageFilterDefinition(id);

  if (!definition) {
    return emptyImageFilterUpdates();
  }

  const preset = getPaperImageFilterPreset(definition.id, presetName);

  return {
    ...emptyImageFilterControlProps(),
    ...(preset?.props ?? {}),
    filter: definition.id,
    filterPreset: preset?.name ?? definition.defaultPreset
  };
}

export function emptyImageFilterUpdates(): MotionDocProps {
  return {
    ...emptyImageFilterControlProps(),
    filter: "none",
    filterPreset: ""
  };
}

export function paperImageFilterRuntimePresetTable() {
  return Object.fromEntries(
    paperImageFilterDefinitions.map((definition) => [
      definition.id,
      Object.fromEntries(definition.presets.map((preset) => [preset.name, preset.params]))
    ])
  ) as Record<PaperImageFilterId, Record<string, PaperImageFilterRuntimeParams>>;
}

function emptyImageFilterControlProps(): MotionDocProps {
  return Object.fromEntries(PAPER_IMAGE_FILTER_CONTROL_KEYS.map((key) => [key, ""])) as MotionDocProps;
}

function makePreset(
  name: string,
  controls: readonly PaperImageFilterControl[],
  params: PaperImageFilterRuntimeParams
): PaperImageFilterPreset {
  return {
    name,
    params,
    props: filterControlPropsFromParams(controls, params)
  };
}

function filterControlPropsFromParams(
  controls: readonly PaperImageFilterControl[],
  params: PaperImageFilterRuntimeParams
): MotionDocProps {
  const entries = controls.flatMap((item) => {
    const value = params[item.paramKey];

    if (typeof value === "number" && Number.isFinite(value)) {
      return [[item.key, value] as const];
    }

    if (typeof value === "boolean") {
      return [[item.key, value ? 1 : 0] as const];
    }

    return [];
  });

  return Object.fromEntries(entries) as MotionDocProps;
}

function numberParam(params: PaperImageFilterRuntimeParams, key: string, fallback: number) {
  const value = params[key];

  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
