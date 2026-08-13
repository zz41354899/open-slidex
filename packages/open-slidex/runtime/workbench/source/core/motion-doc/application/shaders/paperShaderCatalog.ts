import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

export const PAPER_SHADER_COLOR_KEYS = [
  "shaderColor1",
  "shaderColor2",
  "shaderColor3",
  "shaderColor4",
  "shaderColor5",
  "shaderColor6"
] as const;

export const PAPER_SHADER_CONTROL_KEYS = [
  "shaderIntensity",
  "shaderSoftness",
  "shaderSpeed",
  "shaderScale",
  "shaderDetail",
  "shaderAngle"
] as const;

export type PaperShaderColorKey = (typeof PAPER_SHADER_COLOR_KEYS)[number];
export type PaperShaderControlKey = (typeof PAPER_SHADER_CONTROL_KEYS)[number];

export type PaperShaderControl = {
  defaultValue: number;
  format?: "decimal" | "integer";
  key: PaperShaderControlKey;
  label: string;
  max: number;
  min: number;
  step: number;
};

export type PaperShaderCategory = "geometric" | "gradient" | "organic" | "particle";

export type PaperShaderRuntimeParams = Record<string, number | string | readonly string[] | undefined>;

export type PaperShaderPreset = {
  name: string;
  params: PaperShaderRuntimeParams;
  props: MotionDocProps;
};

export type PaperShaderDefinition = {
  category: PaperShaderCategory;
  colorLabels: readonly [string, string, string, string, string, string];
  controls: readonly PaperShaderControl[];
  defaultPreset: string;
  id: PaperShaderId;
  name: string;
  presets: readonly PaperShaderPreset[];
  thumbnail: string;
  visibleColorCount?: number;
};

const paperShaderIds = [
  "mesh-gradient",
  "static-mesh-gradient",
  "swirl",
  "dot-orbit",
  "god-rays",
  "neuro-noise",
  "liquid-metal",
  "grain-gradient",
  "metaballs",
  "paper-texture",
  "water",
  "dithering"
] as const;

export type PaperShaderId = (typeof paperShaderIds)[number];

const colorLabels = {
  bands: ["Back", "Band 1", "Band 2", "Band 3", "Band 4", "Band 5"],
  gradient: ["Color 1", "Color 2", "Color 3", "Color 4", "Color 5", "Color 6"],
  ink: ["Back", "Ink", "Tone 1", "Tone 2", "Tone 3", "Tone 4"],
  light: ["Back", "Bloom", "Ray 1", "Ray 2", "Ray 3", "Ray 4"],
  material: ["Back", "Tint", "Edge", "Glow", "Shadow", "Accent"],
  paper: ["Back", "Fiber", "Fold", "Crumple", "Grain", "Highlight"]
} as const satisfies Record<string, readonly [string, string, string, string, string, string]>;

const control = (
  key: PaperShaderControlKey,
  label: string,
  min: number,
  max: number,
  step: number,
  defaultValue: number,
  format: PaperShaderControl["format"] = step >= 1 ? "integer" : "decimal"
) => ({ defaultValue, format, key, label, max, min, step });

const commonControls = {
  angle: control("shaderAngle", "Rotation", 0, 360, 1, 0, "integer"),
  scale: control("shaderScale", "Scale", 0.05, 4, 0.05, 1),
  speed: control("shaderSpeed", "Speed", 0, 5, 0.05, 1)
} as const;

const paperShaderAliasEntries = [
  ["aurora", "swirl"],
  ["balatro-swirl", "swirl"],
  ["reaction-diffusion", "swirl"],
  ["silk-gradient", "static-mesh-gradient"],
  ["mesh", "mesh-gradient"],
  ["geometric-grid", "dithering"],
  ["particle-field", "dot-orbit"],
  ["metaball-fields", "metaballs"],
  ["noise-fog", "grain-gradient"],
  ["wave-distortion", "liquid-metal"],
  ["caustic-water", "water"],
  ["waves", "water"],
  ["watercolor-classic", "paper-texture"],
  ["watercolor-wet", "swirl"],
  ["watercolor-rough", "paper-texture"],
  ["watercolor-salt", "dithering"],
  ["watercolor-ink", "grain-gradient"],
  ["watercolor-glaze", "mesh-gradient"],
  ["watercolor-metallic", "liquid-metal"],
  ["watercolor-gravity", "swirl"],
  ["watercolor-granulating", "grain-gradient"]
] as const satisfies ReadonlyArray<readonly [string, PaperShaderId]>;

const paperShaderAliases = Object.fromEntries(paperShaderAliasEntries) as Record<string, PaperShaderId>;

export const paperShaderDefinitions = [
  {
    category: "gradient",
    colorLabels: colorLabels.gradient,
    controls: [
      control("shaderIntensity", "Distortion", 0, 1, 0.01, 0.8),
      control("shaderSoftness", "Swirl", 0, 1, 0.01, 0.1),
      control("shaderDetail", "Grain", 0, 1, 0.01, 0),
      commonControls.speed,
      commonControls.scale,
      commonControls.angle
    ],
    defaultPreset: "Default",
    id: "mesh-gradient",
    name: "MeshGradient",
    presets: [
      makePreset("Default", ["#e0eaff", "#241d9a", "#f75092", "#9f50d3"], {
        shaderAngle: 0,
        shaderDetail: 0,
        shaderIntensity: 0.8,
        shaderScale: 1,
        shaderSoftness: 0.1,
        shaderSpeed: 1
      }, { distortion: 0.8, grainMixer: 0, grainOverlay: 0, rotation: 0, scale: 1, speed: 1, swirl: 0.1 }),
      makePreset("Ink", ["#ffffff", "#000000"], {
        background: "#000000",
        shaderAngle: 90,
        shaderDetail: 0,
        shaderIntensity: 1,
        shaderScale: 1,
        shaderSoftness: 0.2,
        shaderSpeed: 1
      }, { distortion: 1, grainMixer: 0, grainOverlay: 0, rotation: 90, scale: 1, speed: 1, swirl: 0.2 }),
      makePreset("Purple", ["#aaa7d7", "#3c2b8e"], {
        shaderDetail: 0,
        shaderIntensity: 1,
        shaderScale: 1,
        shaderSoftness: 1,
        shaderSpeed: 0.6
      }, { distortion: 1, grainMixer: 0, grainOverlay: 0, rotation: 0, scale: 1, speed: 0.6, swirl: 1 }),
      makePreset("Beach", ["#bcecf6", "#00aaff", "#00f7ff", "#ffd447"], {
        shaderDetail: 0,
        shaderIntensity: 0.8,
        shaderScale: 1,
        shaderSoftness: 0.35,
        shaderSpeed: 0.1
      }, { distortion: 0.8, grainMixer: 0, grainOverlay: 0, rotation: 0, scale: 1, speed: 0.1, swirl: 0.35 })
    ],
    thumbnail: "radial-gradient(circle at 18% 24%, #e0eaff 0%, transparent 42%), radial-gradient(circle at 76% 72%, #f75092 0%, transparent 46%), linear-gradient(135deg, #241d9a 0%, #9f50d3 100%)"
  },
  {
    category: "gradient",
    colorLabels: colorLabels.gradient,
    controls: [
      control("shaderIntensity", "Wave", 0, 1, 0.01, 1),
      control("shaderSoftness", "Mixing", 0, 1, 0.01, 0.93),
      control("shaderDetail", "Grain", 0, 1, 0.01, 0),
      commonControls.scale,
      commonControls.angle
    ],
    defaultPreset: "Default",
    id: "static-mesh-gradient",
    name: "StaticMeshGradient",
    presets: [
      makePreset("Default", ["#ffad0a", "#6200ff", "#e2a3ff", "#ff99fd"], {
        shaderAngle: 270,
        shaderDetail: 0,
        shaderIntensity: 1,
        shaderScale: 1,
        shaderSoftness: 0.93,
        shaderSpeed: 0
      }, { grainMixer: 0, grainOverlay: 0, mixing: 0.93, positions: 2, rotation: 270, scale: 1, speed: 0, waveX: 1, waveXShift: 0.6, waveY: 1, waveYShift: 0.21 }),
      makePreset("1960s", ["#000000", "#082400", "#b1aa91", "#8e8c15"], {
        shaderDetail: 0.37,
        shaderIntensity: 0.45,
        shaderScale: 1,
        shaderSoftness: 0,
        shaderSpeed: 0
      }, { grainMixer: 0.37, grainOverlay: 0.78, mixing: 0, positions: 42, rotation: 0, scale: 1, speed: 0, waveX: 0.45, waveXShift: 0, waveY: 1, waveYShift: 0 }),
      makePreset("Sunset", ["#264653", "#9c2b2b", "#f4a261", "#ffffff"], {
        shaderDetail: 0,
        shaderIntensity: 0.6,
        shaderScale: 1,
        shaderSoftness: 0.5,
        shaderSpeed: 0
      }, { grainMixer: 0, grainOverlay: 0, mixing: 0.5, positions: 0, rotation: 0, scale: 1, speed: 0, waveX: 0.6, waveXShift: 0.7, waveY: 0.7, waveYShift: 0.7 }),
      makePreset("Sea", ["#013b65", "#03738c", "#a3d3ff", "#f2faef"], {
        shaderDetail: 0,
        shaderIntensity: 0.53,
        shaderScale: 1,
        shaderSoftness: 0.5,
        shaderSpeed: 0
      }, { grainMixer: 0, grainOverlay: 0, mixing: 0.5, positions: 0, rotation: 0, scale: 1, speed: 0, waveX: 0.53, waveXShift: 0, waveY: 0.95, waveYShift: 0.64 })
    ],
    thumbnail: "radial-gradient(circle at 15% 24%, #ffad0a 0%, transparent 48%), radial-gradient(circle at 76% 68%, #ff99fd 0%, transparent 52%), linear-gradient(135deg, #6200ff 0%, #e2a3ff 100%)"
  },
  {
    category: "organic",
    colorLabels: colorLabels.bands,
    controls: [
      control("shaderIntensity", "Twist", 0, 1, 0.01, 0.1),
      control("shaderSoftness", "Softness", 0, 1, 0.01, 0),
      control("shaderDetail", "Noise", 0, 1, 0.01, 0.2),
      commonControls.speed,
      commonControls.scale,
      commonControls.angle
    ],
    defaultPreset: "Default",
    id: "swirl",
    name: "Swirl",
    presets: [
      makePreset("Default", ["#330000", "#ffd1d1", "#ff8a8a", "#660000"], {
        background: "#330000",
        shaderDetail: 0.2,
        shaderIntensity: 0.1,
        shaderScale: 1,
        shaderSoftness: 0,
        shaderSpeed: 0.32
      }, { bandCount: 4, center: 0.2, colorBack: "#330000", noise: 0.2, noiseFrequency: 0.4, proportion: 0.5, rotation: 0, scale: 1, speed: 0.32, twist: 0.1 }),
      makePreset("007", ["#E9E7DA", "#000000"], {
        background: "#E9E7DA",
        shaderDetail: 0,
        shaderIntensity: 0.3,
        shaderScale: 1,
        shaderSoftness: 0,
        shaderSpeed: 1
      }, { bandCount: 5, center: 0, colorBack: "#E9E7DA", noise: 0, noiseFrequency: 0.5, proportion: 0, rotation: 0, scale: 1, speed: 1, twist: 0.3 }),
      makePreset("Opening", ["#ff8b61", "#fefff0", "#ffd8bd", "#ff8b61"], {
        shaderDetail: 0,
        shaderIntensity: 0.3,
        shaderScale: 1,
        shaderSoftness: 0,
        shaderSpeed: 0.5
      }, { bandCount: 2, center: 0.2, colorBack: "#ff8b61", noise: 0, noiseFrequency: 0, offsetX: -0.4, offsetY: 1, proportion: 0.5, rotation: 0, scale: 1, speed: 0.5, twist: 0.3 }),
      makePreset("Candy", ["#ffcd66", "#6bbceb", "#d7b3ff", "#ff9fff"], {
        shaderDetail: 0,
        shaderIntensity: 0.15,
        shaderScale: 1,
        shaderSoftness: 1,
        shaderSpeed: 1
      }, { bandCount: 2, center: 0.2, colorBack: "#ffcd66", noise: 0, noiseFrequency: 0.5, proportion: 0.5, rotation: 0, scale: 1, speed: 1, twist: 0.15 })
    ],
    thumbnail: "radial-gradient(circle at 48% 48%, #ffd1d1 0%, #ff8a8a 28%, #660000 56%, #330000 100%)"
  },
  {
    category: "particle",
    colorLabels: colorLabels.bands,
    controls: [
      control("shaderIntensity", "Spreading", 0, 1, 0.01, 1),
      control("shaderSoftness", "Size Range", 0, 1, 0.01, 0),
      control("shaderDetail", "Steps", 1, 4, 1, 4, "integer"),
      commonControls.speed,
      commonControls.scale,
      commonControls.angle
    ],
    defaultPreset: "Default",
    id: "dot-orbit",
    name: "DotOrbit",
    presets: [
      makePreset("Default", ["#000000", "#ffc96b", "#ff6200", "#ff2f00", "#421100", "#1a0000"], {
        shaderDetail: 4,
        shaderIntensity: 1,
        shaderScale: 1,
        shaderSoftness: 0,
        shaderSpeed: 1.5
      }, { colorBack: "#000000", rotation: 0, scale: 1, size: 1, sizeRange: 0, speed: 1.5, spreading: 1, stepsPerColor: 4 }),
      makePreset("Bubbles", ["#989CA4", "#D0D2D5"], {
        shaderDetail: 2,
        shaderIntensity: 1,
        shaderScale: 1.64,
        shaderSoftness: 0.7,
        shaderSpeed: 0.4
      }, { colorBack: "#989CA4", rotation: 0, scale: 1.64, size: 0.9, sizeRange: 0.7, speed: 0.4, spreading: 1, stepsPerColor: 2 }),
      makePreset("Shine", ["#000000", "#ffffff", "#006aff", "#fff675"], {
        shaderDetail: 4,
        shaderIntensity: 1,
        shaderScale: 0.4,
        shaderSoftness: 0.2,
        shaderSpeed: 0.1
      }, { colorBack: "#000000", rotation: 0, scale: 0.4, size: 0.3, sizeRange: 0.2, speed: 0.1, spreading: 1, stepsPerColor: 4 }),
      makePreset("Hallucinatory", ["#ffe500", "#000000"], {
        shaderDetail: 2,
        shaderIntensity: 0.3,
        shaderScale: 0.5,
        shaderSoftness: 0,
        shaderSpeed: 5
      }, { colorBack: "#ffe500", rotation: 0, scale: 0.5, size: 0.65, sizeRange: 0, speed: 5, spreading: 0.3, stepsPerColor: 2 })
    ],
    thumbnail: "radial-gradient(circle, #ffc96b 0 6%, transparent 7%), radial-gradient(circle at 68% 34%, #ff6200 0 5%, transparent 6%), #000000"
  },
  {
    category: "organic",
    colorLabels: colorLabels.light,
    controls: [
      control("shaderIntensity", "Intensity", 0, 1, 0.01, 0.8),
      control("shaderSoftness", "Spotty", 0, 1, 0.01, 0.3),
      control("shaderDetail", "Density", 0, 1, 0.01, 0.3),
      commonControls.speed,
      commonControls.scale,
      commonControls.angle
    ],
    defaultPreset: "Default",
    id: "god-rays",
    name: "GodRays",
    presets: [
      makePreset("Default", ["#000000", "#0000ff", "#a600ff", "#6200ff", "#ffffff", "#33fff5"], {
        shaderDetail: 0.3,
        shaderIntensity: 0.8,
        shaderScale: 1,
        shaderSoftness: 0.3,
        shaderSpeed: 0.75
      }, { bloom: 0.4, colorBack: "#000000", colorBloom: "#0000ff", density: 0.3, intensity: 0.8, midIntensity: 0.4, midSize: 0.2, offsetY: -0.55, rotation: 0, scale: 1, speed: 0.75, spotty: 0.3 }),
      makePreset("Warp", ["#000000", "#222288", "#ff47d4", "#ff8c00", "#ffffff"], {
        shaderDetail: 0.45,
        shaderIntensity: 0.79,
        shaderScale: 1,
        shaderSoftness: 0.15,
        shaderSpeed: 2
      }, { bloom: 0.4, colorBack: "#000000", colorBloom: "#222288", density: 0.45, intensity: 0.79, midIntensity: 0.4, midSize: 0.33, rotation: 0, scale: 1, speed: 2, spotty: 0.15 }),
      makePreset("Linear", ["#000000", "#eeeeee", "#ffffff", "#ffffff", "#ffffff"], {
        shaderDetail: 0.41,
        shaderIntensity: 0.79,
        shaderScale: 1,
        shaderSoftness: 0.25,
        shaderSpeed: 0.5
      }, { bloom: 1, colorBack: "#000000", colorBloom: "#eeeeee", density: 0.41, intensity: 0.79, midIntensity: 0.75, midSize: 0.1, offsetX: 0.2, offsetY: -0.8, rotation: 0, scale: 1, speed: 0.5, spotty: 0.25 }),
      makePreset("Ether", ["#090f1d", "#ffffff", "#148eff", "#c4dffe", "#232a47"], {
        shaderDetail: 0.03,
        shaderIntensity: 0.6,
        shaderScale: 1,
        shaderSoftness: 0.77,
        shaderSpeed: 1
      }, { bloom: 0.6, colorBack: "#090f1d", colorBloom: "#ffffff", density: 0.03, intensity: 0.6, midIntensity: 0.6, midSize: 0.1, offsetX: -0.6, rotation: 0, scale: 1, speed: 1, spotty: 0.77 })
    ],
    thumbnail: "radial-gradient(circle at 50% 34%, #ffffff 0%, transparent 12%), conic-gradient(from 170deg, #000000, #6200ff, #33fff5, #000000)"
  },
  {
    category: "organic",
    colorLabels: colorLabels.ink,
    controls: [
      control("shaderIntensity", "Brightness", 0, 0.3, 0.01, 0.05),
      control("shaderDetail", "Contrast", 0, 1, 0.01, 0.3),
      commonControls.speed,
      commonControls.scale,
      commonControls.angle
    ],
    defaultPreset: "Default",
    id: "neuro-noise",
    name: "NeuroNoise",
    presets: [
      makePreset("Default", ["#000000", "#47a6ff", "#ffffff"], {
        shaderDetail: 0.3,
        shaderIntensity: 0.05,
        shaderScale: 1,
        shaderSpeed: 1
      }, { brightness: 0.05, colorBack: "#000000", colorFront: "#ffffff", colorMid: "#47a6ff", contrast: 0.3, rotation: 0, scale: 1, speed: 1 }),
      makePreset("Sensation", ["#8b42ff", "#fbff00", "#00c8ff"], {
        shaderDetail: 0.12,
        shaderIntensity: 0.19,
        shaderScale: 3,
        shaderSpeed: 1
      }, { brightness: 0.19, colorBack: "#8b42ff", colorFront: "#00c8ff", colorMid: "#fbff00", contrast: 0.12, rotation: 0, scale: 3, speed: 1 }),
      makePreset("Bloodstream", ["#ffffff", "#ff0000", "#ff0000"], {
        shaderDetail: 0.17,
        shaderIntensity: 0.24,
        shaderScale: 0.7,
        shaderSpeed: 1
      }, { brightness: 0.24, colorBack: "#ffffff", colorFront: "#ff0000", colorMid: "#ff0000", contrast: 0.17, rotation: 0, scale: 0.7, speed: 1 }),
      makePreset("Ghost", ["#ffffff", "#000000", "#ffffff"], {
        shaderDetail: 1,
        shaderIntensity: 0,
        shaderScale: 0.55,
        shaderSpeed: 1
      }, { brightness: 0, colorBack: "#ffffff", colorFront: "#ffffff", colorMid: "#000000", contrast: 1, rotation: 0, scale: 0.55, speed: 1 })
    ],
    thumbnail: "radial-gradient(circle at 50% 50%, #ffffff 0%, #47a6ff 28%, #000000 70%)"
  },
  {
    category: "organic",
    colorLabels: colorLabels.material,
    controls: [
      control("shaderIntensity", "Distortion", 0, 1, 0.01, 0.07),
      control("shaderSoftness", "Softness", 0, 1, 0.01, 0.1),
      control("shaderDetail", "Contour", 0, 1, 0.01, 0.4),
      commonControls.speed,
      commonControls.scale,
      control("shaderAngle", "Pattern Angle", 0, 360, 1, 70, "integer")
    ],
    defaultPreset: "Default",
    id: "liquid-metal",
    name: "LiquidMetal",
    presets: [
      makePreset("Default", ["#AAAAAC", "#ffffff", "#e5e7eb", "#71717a"], {
        shaderAngle: 70,
        shaderDetail: 0.4,
        shaderIntensity: 0.07,
        shaderScale: 0.6,
        shaderSoftness: 0.1,
        shaderSpeed: 1
      }, { angle: 70, colorBack: "#AAAAAC", colorTint: "#ffffff", contour: 0.4, distortion: 0.07, repetition: 2, rotation: 0, scale: 0.6, shape: "diamond", shiftBlue: 0.3, shiftRed: 0.3, softness: 0.1, speed: 1 }),
      makePreset("Noir", ["#000000", "#606060", "#ffffff", "#1f2937"], {
        shaderAngle: 90,
        shaderDetail: 0,
        shaderIntensity: 0,
        shaderScale: 0.6,
        shaderSoftness: 0.45,
        shaderSpeed: 1
      }, { angle: 90, colorBack: "#000000", colorTint: "#606060", contour: 0, distortion: 0, repetition: 1.5, rotation: 0, scale: 0.6, shape: "diamond", shiftBlue: 0, shiftRed: 0, softness: 0.45, speed: 1 }),
      makePreset("Backdrop", ["#AAAAAC", "#ffffff", "#d4d4d8", "#52525b"], {
        shaderAngle: 90,
        shaderDetail: 0.4,
        shaderIntensity: 0.1,
        shaderScale: 1,
        shaderSoftness: 0.05,
        shaderSpeed: 1
      }, { angle: 90, colorBack: "#AAAAAC", colorTint: "#ffffff", contour: 0.4, distortion: 0.1, repetition: 1.5, rotation: 0, scale: 1, shape: "none", shiftBlue: 0.3, shiftRed: 0.3, softness: 0.05, speed: 1 }),
      makePreset("Stripes", ["#000000", "#2c5d72", "#cbd5e1", "#0f172a"], {
        shaderAngle: 0,
        shaderDetail: 0.4,
        shaderIntensity: 0.4,
        shaderScale: 0.6,
        shaderSoftness: 0.8,
        shaderSpeed: 1
      }, { angle: 0, colorBack: "#000000", colorTint: "#2c5d72", contour: 0.4, distortion: 0.4, repetition: 6, rotation: 0, scale: 0.6, shape: "circle", shiftBlue: -1, shiftRed: 1, softness: 0.8, speed: 1 })
    ],
    thumbnail: "linear-gradient(135deg, #000000 0%, #AAAAAC 40%, #ffffff 70%, #2c5d72 100%)"
  },
  {
    category: "gradient",
    colorLabels: colorLabels.gradient,
    controls: [
      control("shaderIntensity", "Distortion", 0, 1, 0.01, 0.5),
      control("shaderSoftness", "Softness", 0, 1, 0.01, 0.5),
      control("shaderDetail", "Noise", 0, 1, 0.01, 0.25),
      commonControls.speed,
      commonControls.scale,
      commonControls.angle
    ],
    defaultPreset: "Default",
    id: "grain-gradient",
    name: "GrainGradient",
    presets: [
      makePreset("Default", ["#000000", "#7300ff", "#eba8ff", "#00bfff", "#2a00ff"], {
        shaderDetail: 0.25,
        shaderIntensity: 0.5,
        shaderScale: 1,
        shaderSoftness: 0.5,
        shaderSpeed: 1
      }, { colorBack: "#000000", intensity: 0.5, noise: 0.25, rotation: 0, scale: 1, shape: "corners", softness: 0.5, speed: 1 }),
      makePreset("Wave", ["#000a0f", "#c4730b", "#bdad5f", "#d8ccc7"], {
        shaderDetail: 0.5,
        shaderIntensity: 0.15,
        shaderScale: 1,
        shaderSoftness: 0.7,
        shaderSpeed: 1
      }, { colorBack: "#000a0f", intensity: 0.15, noise: 0.5, rotation: 0, scale: 1, shape: "wave", softness: 0.7, speed: 1 }),
      makePreset("Dots", ["#0a0000", "#6f0000", "#0080ff", "#f2ebc9", "#33cc33"], {
        shaderDetail: 0.7,
        shaderIntensity: 1,
        shaderScale: 0.6,
        shaderSoftness: 1,
        shaderSpeed: 1
      }, { colorBack: "#0a0000", intensity: 1, noise: 0.7, rotation: 0, scale: 0.6, shape: "dots", softness: 1, speed: 1 }),
      makePreset("Ripple", ["#140a00", "#6f2d00", "#88ddae", "#2c0b1d"], {
        shaderDetail: 0.5,
        shaderIntensity: 0.5,
        shaderScale: 0.5,
        shaderSoftness: 0.5,
        shaderSpeed: 1
      }, { colorBack: "#140a00", intensity: 0.5, noise: 0.5, rotation: 0, scale: 0.5, shape: "ripple", softness: 0.5, speed: 1 })
    ],
    thumbnail: "radial-gradient(circle at 20% 20%, #7300ff 0%, transparent 42%), radial-gradient(circle at 80% 70%, #00bfff 0%, transparent 46%), #000000"
  },
  {
    category: "particle",
    colorLabels: colorLabels.bands,
    controls: [
      control("shaderIntensity", "Ball Size", 0.02, 1, 0.01, 0.83),
      control("shaderDetail", "Ball Count", 1, 20, 1, 10, "integer"),
      commonControls.speed,
      commonControls.scale,
      commonControls.angle
    ],
    defaultPreset: "Default",
    id: "metaballs",
    name: "Metaballs",
    presets: [
      makePreset("Default", ["#000000", "#6e33cc", "#ff5500", "#ffc105", "#ffc800", "#f585ff"], {
        shaderDetail: 10,
        shaderIntensity: 0.83,
        shaderScale: 1,
        shaderSpeed: 1
      }, { colorBack: "#000000", count: 10, rotation: 0, scale: 1, size: 0.83, speed: 1 }),
      makePreset("Ink Drops", ["#ffffff00", "#000000"], {
        background: "#ffffff",
        shaderDetail: 18,
        shaderIntensity: 0.1,
        shaderScale: 1,
        shaderSpeed: 2
      }, { colorBack: "#ffffff00", count: 18, rotation: 0, scale: 1, size: 0.1, speed: 2 }),
      makePreset("Solar", ["#102f84", "#ffc800", "#ff5500", "#ffc105"], {
        shaderDetail: 7,
        shaderIntensity: 0.75,
        shaderScale: 1,
        shaderSpeed: 1
      }, { colorBack: "#102f84", count: 7, rotation: 0, scale: 1, size: 0.75, speed: 1 }),
      makePreset("Background", ["#2a273f", "#ae00ff", "#00ff95", "#ffc105"], {
        shaderDetail: 13,
        shaderIntensity: 0.81,
        shaderScale: 4,
        shaderSpeed: 0.5
      }, { colorBack: "#2a273f", count: 13, offsetX: -0.3, rotation: 0, scale: 4, size: 0.81, speed: 0.5 })
    ],
    thumbnail: "radial-gradient(circle at 35% 45%, #6e33cc 0%, transparent 20%), radial-gradient(circle at 58% 50%, #ff5500 0%, transparent 22%), #000000"
  },
  {
    category: "organic",
    colorLabels: colorLabels.paper,
    controls: [
      control("shaderIntensity", "Roughness", 0, 1, 0.01, 0.4),
      control("shaderSoftness", "Fiber", 0, 1, 0.01, 0.3),
      control("shaderDetail", "Contrast", 0, 1, 0.01, 0.3),
      commonControls.scale,
      commonControls.angle
    ],
    defaultPreset: "Default",
    id: "paper-texture",
    name: "PaperTexture",
    presets: [
      makePreset("Default", ["#ffffff", "#9fadbc", "#f4f4f5", "#d4d4d8", "#71717a", "#ffffff"], {
        background: "#ffffff",
        shaderDetail: 0.3,
        shaderIntensity: 0.4,
        shaderScale: 0.6,
        shaderSoftness: 0.3,
        shaderSpeed: 0
      }, { contrast: 0.3, crumpleSize: 0.35, crumples: 0.3, drops: 0.2, fade: 0, fiber: 0.3, fiberSize: 0.2, foldCount: 5, folds: 0.65, roughness: 0.4, rotation: 0, scale: 0.6, seed: 5.8, speed: 0 }),
      makePreset("Cardboard", ["#999180", "#c7b89e", "#7a705f", "#d7cab5", "#5f574a", "#f1e6d2"], {
        background: "#999180",
        shaderDetail: 0.4,
        shaderIntensity: 0,
        shaderScale: 0.6,
        shaderSoftness: 0.35,
        shaderSpeed: 0
      }, { contrast: 0.4, crumpleSize: 0.1, crumples: 0.7, drops: 0.1, fade: 0, fiber: 0.35, fiberSize: 0.14, foldCount: 1, folds: 0, roughness: 0, rotation: 0, scale: 0.6, seed: 1.6, speed: 0 }),
      makePreset("Abstract", ["#ff0a81", "#00eeff", "#ffffff", "#7c3aed", "#111827", "#ffe4f1"], {
        background: "#ff0a81",
        shaderDetail: 0.85,
        shaderIntensity: 0,
        shaderScale: 0.6,
        shaderSoftness: 0.1,
        shaderSpeed: 0
      }, { contrast: 0.85, crumpleSize: 0.3, crumples: 0, drops: 0.2, fade: 0, fiber: 0.1, fiberSize: 0.2, foldCount: 3, folds: 1, roughness: 0, rotation: 0, scale: 0.6, seed: 2.2, speed: 0 }),
      makePreset("Details", ["#000000", "#ffffff", "#f8fafc", "#64748b", "#111827", "#e5e7eb"], {
        background: "#f8fafc",
        shaderDetail: 0,
        shaderIntensity: 1,
        shaderScale: 3,
        shaderSoftness: 0.27,
        shaderSpeed: 0
      }, { contrast: 0, crumpleSize: 0.5, crumples: 1, drops: 0, fade: 0, fiber: 0.27, fiberSize: 0.22, foldCount: 15, folds: 1, roughness: 1, rotation: 0, scale: 3, seed: 6, speed: 0 })
    ],
    thumbnail: "linear-gradient(135deg, #ffffff 0%, #d4d4d8 42%, #9fadbc 100%)"
  },
  {
    category: "organic",
    colorLabels: ["Back", "Highlight", "", "", "", ""],
    controls: [
      control("shaderIntensity", "Caustic", 0, 1, 0.01, 0.1),
      control("shaderSoftness", "Waves", 0, 1, 0.01, 0.3),
      control("shaderDetail", "Pattern Size", 0.01, 7, 0.01, 1),
      commonControls.speed,
      commonControls.scale,
      commonControls.angle
    ],
    defaultPreset: "Default",
    id: "water",
    name: "Water",
    presets: [
      makePreset("Default", ["#063b5c", "#e0f2fe", "#bae6fd", "#0ea5e9", "#082f49", "#e0f2fe"], {
        background: "#063b5c",
        shaderDetail: 1,
        shaderIntensity: 0.1,
        shaderScale: 0.8,
        shaderSoftness: 0.3,
        shaderSpeed: 1
      }, { caustic: 0.1, colorBack: "#063b5c", colorHighlight: "#e0f2fe", edges: 0.8, highlights: 0.07, layering: 0.5, rotation: 0, scale: 0.8, size: 1, speed: 1, waves: 0.3 }),
      makePreset("Slow-mo", ["#155e75", "#f0f9ff", "#dbeafe", "#67e8f9", "#155e75", "#f0f9ff"], {
        background: "#155e75",
        shaderDetail: 0.7,
        shaderIntensity: 0.2,
        shaderScale: 1,
        shaderSoftness: 0,
        shaderSpeed: 0.1
      }, { caustic: 0.2, colorBack: "#155e75", colorHighlight: "#f0f9ff", edges: 0, highlights: 0.4, layering: 0, rotation: 0, scale: 1, size: 0.7, speed: 0.1, waves: 0 }),
      makePreset("Abstract", ["#021923", "#67e8f9", "#cffafe", "#0f766e", "#021923", "#cffafe"], {
        background: "#021923",
        shaderDetail: 0.15,
        shaderIntensity: 0.4,
        shaderScale: 3,
        shaderSoftness: 1,
        shaderSpeed: 1
      }, { caustic: 0.4, colorBack: "#021923", colorHighlight: "#67e8f9", edges: 1, highlights: 0.28, layering: 0, rotation: 0, scale: 3, size: 0.15, speed: 1, waves: 1 }),
      makePreset("Streaming", ["#082f49", "#bae6fd", "#0ea5e9", "#bae6fd", "#082f49", "#f0f9ff"], {
        background: "#082f49",
        shaderDetail: 0.5,
        shaderIntensity: 0,
        shaderScale: 0.4,
        shaderSoftness: 0.5,
        shaderSpeed: 2
      }, { caustic: 0, colorBack: "#082f49", colorHighlight: "#bae6fd", edges: 0, highlights: 0.18, layering: 0, rotation: 0, scale: 0.4, size: 0.5, speed: 2, waves: 0.5 })
    ],
    thumbnail: "radial-gradient(circle at 30% 26%, #e0f2fe 0%, transparent 38%), linear-gradient(135deg, #063b5c 0%, #0ea5e9 52%, #cffafe 100%)",
    visibleColorCount: 2
  },
  {
    category: "geometric",
    colorLabels: colorLabels.ink,
    controls: [
      control("shaderDetail", "Pixel Size", 0.5, 20, 0.5, 2),
      commonControls.speed,
      commonControls.scale,
      commonControls.angle
    ],
    defaultPreset: "Default",
    id: "dithering",
    name: "Dithering",
    presets: [
      makePreset("Default", ["#000000", "#00b2ff", "#ffffff", "#0f172a", "#64748b", "#bae6fd"], {
        shaderDetail: 2,
        shaderScale: 0.6,
        shaderSpeed: 1
      }, { colorBack: "#000000", colorFront: "#00b2ff", rotation: 0, scale: 0.6, shape: "sphere", size: 2, speed: 1, type: "4x4" }),
      makePreset("Warp", ["#301c2a", "#56ae6c", "#f8fafc", "#0f172a", "#475569", "#dcfce7"], {
        shaderDetail: 2.5,
        shaderScale: 1,
        shaderSpeed: 1
      }, { colorBack: "#301c2a", colorFront: "#56ae6c", rotation: 0, scale: 1, shape: "warp", size: 2.5, speed: 1, type: "4x4" }),
      makePreset("Sine Wave", ["#730d54", "#00becc", "#fdf2f8", "#0f172a", "#64748b", "#cffafe"], {
        shaderDetail: 11,
        shaderScale: 1.2,
        shaderSpeed: 1
      }, { colorBack: "#730d54", colorFront: "#00becc", rotation: 0, scale: 1.2, shape: "wave", size: 11, speed: 1, type: "4x4" }),
      makePreset("Ripple", ["#603520", "#c67953", "#fff7ed", "#1c1917", "#78716c", "#fed7aa"], {
        shaderDetail: 3,
        shaderScale: 1,
        shaderSpeed: 1
      }, { colorBack: "#603520", colorFront: "#c67953", rotation: 0, scale: 1, shape: "ripple", size: 3, speed: 1, type: "2x2" }),
      makePreset("Bugs", ["#000000", "#008000", "#dcfce7", "#052e16", "#22c55e", "#f0fdf4"], {
        shaderDetail: 9,
        shaderScale: 1,
        shaderSpeed: 1
      }, { colorBack: "#000000", colorFront: "#008000", rotation: 0, scale: 1, shape: "dots", size: 9, speed: 1, type: "random" }),
      makePreset("Swirl", ["#00000000", "#47a8e1", "#e0f2fe", "#0c4a6e", "#082f49", "#f0f9ff"], {
        shaderDetail: 2,
        shaderScale: 1,
        shaderSpeed: 1
      }, { colorBack: "#00000000", colorFront: "#47a8e1", rotation: 0, scale: 1, shape: "swirl", size: 2, speed: 1, type: "8x8" })
    ],
    thumbnail: "repeating-linear-gradient(135deg, #000000 0 8px, #00b2ff 8px 16px)"
  }
] as const satisfies readonly PaperShaderDefinition[];

const paperShaderDefinitionsById = paperShaderDefinitions.reduce(
  (definitions, definition) => {
    definitions[definition.id] = definition;
    return definitions;
  },
  {} as Record<PaperShaderId, PaperShaderDefinition>
);

export function resolvePaperShaderId(id: string | undefined): PaperShaderId | undefined {
  if (!id) return undefined;
  if (paperShaderIds.includes(id as PaperShaderId)) return id as PaperShaderId;

  return paperShaderAliases[id];
}

export function getPaperShaderDefinition(id: string | undefined): PaperShaderDefinition | undefined {
  const resolvedId = resolvePaperShaderId(id);
  return resolvedId ? paperShaderDefinitionsById[resolvedId] : undefined;
}

export function getPaperShaderPreset(id: string | undefined, presetName: string | undefined) {
  const definition = getPaperShaderDefinition(id);

  if (!definition) {
    return undefined;
  }

  return (
    definition.presets.find((preset) => preset.name === presetName) ??
    definition.presets.find((preset) => preset.name === definition.defaultPreset) ??
    definition.presets[0]
  );
}

export function getPaperShaderPresetParams(id: string | undefined, presetName: string | undefined) {
  return getPaperShaderPreset(id, presetName)?.params ?? {};
}

export function paperShaderPresetUpdates(id: string, presetName?: string): MotionDocProps {
  const definition = getPaperShaderDefinition(id);

  if (!definition) {
    return { shader: "", shaderEngine: "" };
  }

  const preset = getPaperShaderPreset(definition.id, presetName);

  return {
    ...defaultControlProps(definition),
    ...(preset?.props ?? {}),
    shader: definition.id,
    shaderEngine: "three",
    shaderFrame: 0,
    shaderPreset: preset?.name ?? definition.defaultPreset
  };
}

function defaultControlProps(definition: PaperShaderDefinition): MotionDocProps {
  return Object.fromEntries(
    PAPER_SHADER_CONTROL_KEYS.map((key) => [
      key,
      definition.controls.find((control) => control.key === key)?.defaultValue ?? ""
    ])
  ) as MotionDocProps;
}

export function paperShaderRuntimePresetTable() {
  return Object.fromEntries(
    paperShaderDefinitions.map((definition) => [
      definition.id,
      Object.fromEntries(definition.presets.map((preset) => [preset.name, preset.params]))
    ])
  ) as Record<PaperShaderId, Record<string, PaperShaderRuntimeParams>>;
}

function makePreset(
  name: string,
  colors: readonly string[],
  controls: MotionDocProps,
  params: PaperShaderRuntimeParams
): PaperShaderPreset;
function makePreset(
  name: string,
  colors: readonly string[],
  controls: MotionDocProps,
  params: PaperShaderRuntimeParams
) {
  return {
    name,
    params: {
      ...params,
      colors: colors.slice(1)
    },
    props: {
      background: colors[0] ?? "#0f172a",
      mutedColor: "auto",
      textColor: "auto",
      ...sixColorProps(colors),
      ...controls
    }
  };
}

function sixColorProps(colors: readonly string[]): MotionDocProps {
  const fallback = colors[colors.length - 1] ?? "#ffffff";

  return Object.fromEntries(
    PAPER_SHADER_COLOR_KEYS.map((key, index) => [key, colors[index] ?? fallback])
  ) as MotionDocProps;
}
