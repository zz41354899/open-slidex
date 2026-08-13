import { hexColorValue, type HexColor } from "@/features/pitch/application/colorPalettes";

type EyeDropperResult = {
  sRGBHex: string;
};

type EyeDropperInstance = {
  open: () => Promise<EyeDropperResult>;
};

type EyeDropperConstructor = new () => EyeDropperInstance;

type EyeDropperWindow = Window & {
  EyeDropper?: EyeDropperConstructor;
};

export function browserSupportsEyeDropper() {
  return typeof window !== "undefined" && typeof (window as EyeDropperWindow).EyeDropper === "function";
}

export async function pickColorFromScreen(): Promise<HexColor | null> {
  if (!browserSupportsEyeDropper()) return null;

  const EyeDropper = (window as EyeDropperWindow).EyeDropper;
  if (!EyeDropper) return null;

  try {
    const result = await new EyeDropper().open();
    return hexColorValue(result.sRGBHex);
  } catch {
    return null;
  }
}
