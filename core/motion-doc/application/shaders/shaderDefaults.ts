export type ShaderPalette = {
  color1: string;
  color2: string;
  color3: string;
  color4: string;
  color5: string;
  color6: string;
};

export const DEFAULT_DARK_SHADER_PALETTE = {
  color1: "#9b51e0",
  color2: "#2d00f7",
  color3: "#f15bb5",
  color4: "#00f5d4",
  color5: "#090514",
  color6: "#d0bcff"
} satisfies ShaderPalette;

export const DEFAULT_LIGHT_SHADER_PALETTE = {
  color1: "#8a2be2",
  color2: "#ff9a9e",
  color3: "#fecfef",
  color4: "#4facfe",
  color5: "#fdfcfd",
  color6: "#ffffff"
} satisfies ShaderPalette;

export const DEFAULT_SHADER_CONTROLS = {
  angle: 0.0,
  detail: 0.72,
  frame: 0,
  intensity: 0.68,
  scale: 0.66,
  softness: 0.76,
  speed: 0.42
} as const;

export function defaultShaderPaletteForBackground(
  backgroundLightness: number,
  background?: string
): ShaderPalette {
  const isGradient = background?.includes("gradient") || false;

  if (backgroundLightness > 0.62) {
    return {
      ...DEFAULT_LIGHT_SHADER_PALETTE,
      color5: background && !isGradient ? background : DEFAULT_LIGHT_SHADER_PALETTE.color5
    };
  }

  return {
    ...DEFAULT_DARK_SHADER_PALETTE,
    color5: background && !isGradient ? background : DEFAULT_DARK_SHADER_PALETTE.color5
  };
}
