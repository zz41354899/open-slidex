export type HexColor = `#${string}`;
export type HsvColor = {
  h: number;
  s: number;
  v: number;
};
export type RgbColor = {
  b: number;
  g: number;
  r: number;
};

export function hexColorValue(value: string): HexColor | null {
  const trimmed = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed as HexColor;
  }

  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }

  return null;
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function uniqueColors(colors: readonly string[]) {
  const seen = new Set<string>();

  return colors.filter((color) => {
    const normalized = color.trim();
    const key = normalized.toLowerCase();

    if (!normalized || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function normalizeSwatches(colors: readonly string[]) {
  return uniqueColors(colors.map((color) => hexColorValue(color) ?? color).filter((color) => color.trim())).slice(0, 32);
}

export function hexToRgb(value: string, fallback = "#ffffff"): RgbColor {
  const hex = hexColorValue(value) ?? hexColorValue(fallback) ?? "#ffffff";

  return {
    b: parseInt(hex.slice(5, 7), 16),
    g: parseInt(hex.slice(3, 5), 16),
    r: parseInt(hex.slice(1, 3), 16)
  };
}

export function rgbToHex({ b, g, r }: RgbColor): HexColor {
  const channel = (value: number) => Math.min(Math.max(Math.round(value), 0), 255).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function hexToHsv(value: string, fallback = "#ffffff"): HsvColor {
  const { b, g, r } = hexToRgb(value, fallback);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta > 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  return {
    h: hue < 0 ? hue + 360 : hue,
    s: max === 0 ? 0 : delta / max,
    v: max
  };
}

export function hsvToHex({ h, s, v }: HsvColor): HexColor {
  const hue = ((h % 360) + 360) % 360;
  const saturation = Math.min(Math.max(s, 0), 1);
  const value = Math.min(Math.max(v, 0), 1);
  const chroma = value * saturation;
  const component = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const offset = value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) [red, green] = [chroma, component];
  else if (hue < 120) [red, green] = [component, chroma];
  else if (hue < 180) [green, blue] = [chroma, component];
  else if (hue < 240) [green, blue] = [component, chroma];
  else if (hue < 300) [red, blue] = [component, chroma];
  else [red, blue] = [chroma, component];

  return rgbToHex({
    b: (blue + offset) * 255,
    g: (green + offset) * 255,
    r: (red + offset) * 255
  });
}
