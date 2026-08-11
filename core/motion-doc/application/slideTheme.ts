import { defaultShaderPaletteForBackground } from "@/core/motion-doc/application/shaders/shaderDefaults";
import type { MotionDocPropInput } from "@/core/motion-doc/domain/motionDocTypes";

export type SlideThemeTone = "dark" | "light";
export type ShaderEngine = "three";

export type SlideThemeColors = {
  accent: string;
  background: string;
  borderColor: string;
  cardBackground: string;
  foreground: string;
  isLight: boolean;
  muted: string;
  shaderColor1: string;
  shaderColor2: string;
  shaderColor3: string;
  shaderColor4: string;
  shaderColor5: string;
  shaderColor6: string;
  shaderEngine: ShaderEngine;
  theme: string;
  tone: SlideThemeTone;
};

type ResolveSlideThemeOptions = {
  accentFallback?: string;
  backgroundFallback?: string;
  themeFallback?: string;
};

const DARK_TEXT = "#f8fafc";
const LIGHT_TEXT = "#111827";
const DARK_MUTED = "#cbd5e1";
const LIGHT_MUTED = "#475569";
const SHADER_COLOR_LIGHTNESS_WEIGHTS = [0.5, 0.35, 0.15];

export function resolveSlideThemeColors(
  props: MotionDocPropInput,
  options: ResolveSlideThemeOptions = {}
): SlideThemeColors {
  const theme = stringProp(props.theme) ?? options.themeFallback ?? "dark";
  const declaredLight = isDeclaredLightTheme(theme);
  const background =
    stringProp(props.background) ?? options.backgroundFallback ?? defaultSlideBackground(theme);
  const backgroundLightness = colorLightness(background) ?? (declaredLight ? 0.94 : 0.08);
  const accent =
    stringProp(props.accent) ?? options.accentFallback ?? (backgroundLightness > 0.62 ? LIGHT_TEXT : DARK_TEXT);
  const shader = stringProp(props.shader);
  const shaderColor1 = stringProp(props.shaderColor1) ?? accent;
  const shaderColor2 = stringProp(props.shaderColor2) ?? background;
  const shaderColor3 = stringProp(props.shaderColor3) ?? (backgroundLightness > 0.62 ? "#64748b" : "#06b6d4");

  const defaultPalette = defaultShaderPaletteForBackground(backgroundLightness, background);
  const shaderColor4 = stringProp(props.shaderColor4) ?? defaultPalette.color4;
  const shaderColor5 = stringProp(props.shaderColor5) ?? defaultPalette.color5;
  const shaderColor6 = stringProp(props.shaderColor6) ?? defaultPalette.color6;

  const visualLightness = shader
    ? estimateShaderLightness(backgroundLightness, [shaderColor1, shaderColor2, shaderColor3], numberProp(props.shaderIntensity, 0.5))
    : backgroundLightness;
  const isLight = visualLightness > 0.24;
  const explicitForeground = autoStringProp(props.textColor ?? props.foreground ?? props.color);
  const explicitMuted = autoStringProp(props.mutedColor);
  const foreground = explicitForeground ?? (isLight ? LIGHT_TEXT : DARK_TEXT);
  const muted = explicitMuted ?? (isLight ? LIGHT_MUTED : DARK_MUTED);

  return {
    accent,
    background,
    borderColor: isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.12)",
    cardBackground: isLight ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.075)",
    foreground,
    isLight,
    muted,
    shaderColor1,
    shaderColor2,
    shaderColor3,
    shaderColor4,
    shaderColor5,
    shaderColor6,
    shaderEngine: shaderEngineProp(props.shaderEngine),
    theme,
    tone: isLight ? "light" : "dark"
  };
}

export function defaultSlideBackground(theme: string) {
  if (theme === "light") return "#f8fafc";
  if (theme === "paper") return "#f3eadf";
  if (theme === "blue") return "#0b1f3a";

  return "#0f172a";
}

export function shaderEngineProp(value: string | number | undefined): ShaderEngine {
  void value;

  return "three";
}

function estimateShaderLightness(backgroundLightness: number, colors: string[], intensity: number) {
  const colorLightnesses = colors
    .map((color, index) => {
      const lightness = colorLightness(color);

      return lightness === undefined
        ? undefined
        : { lightness, weight: SHADER_COLOR_LIGHTNESS_WEIGHTS[index] ?? 0.15 };
    })
    .filter((value): value is { lightness: number; weight: number } => value !== undefined);

  if (colorLightnesses.length === 0) {
    return backgroundLightness;
  }

  const totalWeight = colorLightnesses.reduce((total, value) => total + value.weight, 0);
  const shaderLightness =
    colorLightnesses.reduce((total, value) => total + value.lightness * value.weight, 0) / totalWeight;
  const shaderWeight = Math.min(Math.max(intensity, 0.05), 1) * 0.88;

  return backgroundLightness * (1 - shaderWeight) + shaderLightness * shaderWeight;
}

function colorLightness(value: string) {
  const rgb = parseRgb(value);

  if (!rgb) {
    return undefined;
  }

  const [r, g, b] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseRgb(value: string): [number, number, number] | null {
  const hex = value.trim().replace("#", "");

  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16)
    ];
  }

  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16)
    ];
  }

  const rgbMatch = value.match(/^rgba?\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})/i);

  if (!rgbMatch) {
    return null;
  }

  return [
    clampRgb(Number(rgbMatch[1])),
    clampRgb(Number(rgbMatch[2])),
    clampRgb(Number(rgbMatch[3]))
  ];
}

function clampRgb(value: number) {
  return Math.min(Math.max(value, 0), 255);
}

function isDeclaredLightTheme(theme: string) {
  return theme === "light" || theme === "paper";
}

function numberProp(value: string | number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringProp(value: string | number | undefined) {
  const stringValue = typeof value === "string" ? value.trim() : "";
  return stringValue || undefined;
}

function autoStringProp(value: string | number | undefined) {
  const stringValue = stringProp(value);
  return stringValue === "auto" ? undefined : stringValue;
}
