const DEFAULT_CORNER_SMOOTHING = 0.72;

type ContinuousRoundedRectOptions = {
  height: number;
  radiusX: number;
  radiusY?: number;
  smoothing?: number;
  width: number;
};

export function continuousRoundedRectPath({
  height,
  radiusX,
  radiusY = radiusX,
  smoothing = DEFAULT_CORNER_SMOOTHING,
  width
}: ContinuousRoundedRectOptions) {
  const safeWidth = Math.max(width, 0);
  const safeHeight = Math.max(height, 0);
  const rx = clamp(radiusX, 0, safeWidth / 2);
  const ry = clamp(radiusY, 0, safeHeight / 2);

  if (rx === 0 || ry === 0) {
    return `M0 0H${format(safeWidth)}V${format(safeHeight)}H0Z`;
  }

  // A larger control ratio holds the curve against each edge longer than a
  // circular quarter arc. The result is a continuous, superelliptic corner
  // without changing the persisted radius value or requiring browser-specific CSS.
  const controlRatio = 0.5523 + clamp(smoothing, 0, 1) * 0.32;
  const cx = rx * controlRatio;
  const cy = ry * controlRatio;
  const right = safeWidth;
  const bottom = safeHeight;

  return [
    `M${format(rx)} 0`,
    `H${format(right - rx)}`,
    `C${format(right - rx + cx)} 0 ${format(right)} ${format(ry - cy)} ${format(right)} ${format(ry)}`,
    `V${format(bottom - ry)}`,
    `C${format(right)} ${format(bottom - ry + cy)} ${format(right - rx + cx)} ${format(bottom)} ${format(right - rx)} ${format(bottom)}`,
    `H${format(rx)}`,
    `C${format(rx - cx)} ${format(bottom)} 0 ${format(bottom - ry + cy)} 0 ${format(bottom - ry)}`,
    `V${format(ry)}`,
    `C0 ${format(ry - cy)} ${format(rx - cx)} 0 ${format(rx)} 0`,
    "Z"
  ].join("");
}

export function normalizedContinuousCornerRadii(
  radius: number,
  frameWidth: number,
  frameHeight: number
) {
  const safeRadius = Math.max(radius, 0);

  return {
    radiusX: frameWidth > 0 ? safeRadius / frameWidth * 100 : 0,
    radiusY: frameHeight > 0 ? safeRadius / frameHeight * 100 : 0
  };
}

function format(value: number) {
  return Number(value.toFixed(3));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
