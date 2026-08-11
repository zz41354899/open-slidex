import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { hexColorValue } from "@/features/pitch/application/colorPalettes";

/**
 * Pitch uses one solid fill per slide. Supporting colors are derived from that
 * decision so copy and controls retain readable contrast.
 */
export function solidFillUpdates(value: string): MotionDocProps {
  const background = hexColorValue(value) ?? "#050505";
  const light = isLightTheme(background);
  const foreground = light ? "#111111" : "#f7f7f5";

  return {
    accent: foreground,
    background,
    mutedColor: light ? "#656565" : "#b8b8b4",
    textColor: foreground,
    theme: light ? "light" : "dark",
    shader: "",
    shaderAngle: "",
    shaderColor1: "",
    shaderColor2: "",
    shaderColor3: "",
    shaderColor4: "",
    shaderColor5: "",
    shaderColor6: "",
    shaderDetail: "",
    shaderEngine: "",
    shaderFrame: "",
    shaderIntensity: "",
    shaderPreset: "",
    shaderScale: "",
    shaderSoftness: "",
    shaderSpeed: ""
  };
}

export function isLightTheme(background: string) {
  const hex = background.replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return false;
  }

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.62;
}
