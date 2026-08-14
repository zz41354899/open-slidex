
import { useId } from "react";
import { normalizedImageScales } from "@/core/motion-doc/application/imageCrop";
import {
  continuousRoundedRectPath,
  normalizedContinuousCornerRadii,
  normalizedRelativeCornerRadii
} from "@/core/motion-doc/application/continuousRoundedRect";
import { MotionBlock, type AnimationProps, type RadiusProps } from "@/features/pitch/ui/preview/motion/MotionBlock";
import { cssColor } from "@/features/pitch/ui/preview/motion/blockStyles";
import { usePreviewMediaSource } from "@/features/pitch/ui/preview/PreviewMediaPolicy";
import { shapePolygonPath } from "@/core/motion-doc/application/shapeVectorSvg";

export function ShapeBlock({
  arrowEnd = "none",
  arrowEndSize = 100,
  arrowStart = "none",
  arrowStartSize = 100,
  fill = "rgba(142,165,255,0.72)",
  frameHeight = 161.28,
  frameWidth = 286.72,
  lineStyle = "solid",
  mask = "none",
  operation = "none",
  opacity = 1,
  points,
  corner = 0,
  radius = 0,
  shape = "rectangle",
  shapeImageAlt = "",
  shapeImageCropX = 0,
  shapeImageCropY = 0,
  shapeImageFit = "cover",
  shapeImageScaleX = 1,
  shapeImageScaleY = 1,
  shapeImageSrc,
  sides,
  stroke = "#ffffff",
  strokeWidth = 2,
  ...animation
}: AnimationProps & {
  arrowEnd?: string;
  arrowEndSize?: number | string;
  arrowStart?: string;
  arrowStartSize?: number | string;
  fill?: string;
  frameHeight?: number;
  frameWidth?: number;
  lineStyle?: string;
  mask?: string;
  operation?: string;
  opacity?: number | string;
  points?: number | string;
  corner?: number | string;
  shape?: string;
  shapeImageAlt?: string;
  shapeImageCropX?: number | string;
  shapeImageCropY?: number | string;
  shapeImageFit?: string;
  shapeImageScaleX?: number | string;
  shapeImageScaleY?: number | string;
  shapeImageSrc?: string;
  sides?: number | string;
  stroke?: string;
  strokeWidth?: number | string;
} & RadiusProps) {
  const maskId = useId();
  const shapeImageMaskId = `${maskId}-shape-image`;
  const localShapeImageSource = usePreviewMediaSource(shapeImageSrc);
  const normalizedShape = normalizeShape(shape);
  const normalizedMask = normalizeMask(mask);
  const normalizedOperation = normalizeOperation(operation);
  const shapeFill = cssColor(fill) ?? "rgba(142,165,255,0.72)";
  const shapeStroke = cssColor(stroke) ?? "transparent";
  const lineWidth = normalizePixelValue(strokeWidth, normalizedShape === "line" ? 4 : 2);
  const normalizedSides = normalizeIntValue(sides, 3);
  const normalizedPoints = normalizeIntValue(points, 5);
  const normalizedCorner = Math.max(normalizePixelValue(corner, 0), 0);
  const normalizedRadius = Math.max(normalizePixelValue(radius, 0), 0);
  const viewportWidth = normalizedShape === "line" ? 100 : Math.max(frameWidth, 1);
  const viewportHeight = normalizedShape === "line" ? 20 : Math.max(frameHeight, 1);
  const shapeTransform = normalizedShape === "line"
    ? undefined
    : `scale(${viewportWidth / 100} ${viewportHeight / 100})`;
  const shapeImageScales = normalizedImageScales("cover", shapeImageScaleX, shapeImageScaleY);
  const shapeImageScale = Math.max(shapeImageScales.scaleX, shapeImageScales.scaleY);
  const shapeImageWidth = viewportWidth * shapeImageScale;
  const shapeImageHeight = viewportHeight * shapeImageScale;
  const shapeImageX = (viewportWidth - shapeImageWidth) / 2 + normalizeNumber(shapeImageCropX, 0) / 100 * viewportWidth;
  const shapeImageY = (viewportHeight - shapeImageHeight) / 2 + normalizeNumber(shapeImageCropY, 0) / 100 * viewportHeight;

  return (
    <MotionBlock className="relative h-full w-full" style={{ opacity: normalizeOpacity(opacity) }} {...animation}>
      <svg aria-hidden="true" className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}>
        <defs>
          {localShapeImageSource && normalizedShape !== "line" ? (
            <mask height={viewportHeight} id={shapeImageMaskId} maskUnits="userSpaceOnUse" width={viewportWidth} x="0" y="0">
              <g transform={shapeTransform}>
                {renderShape(
                  normalizedShape,
                  "white",
                  "none",
                  0,
                  normalizedSides,
                  normalizedPoints,
                  "solid",
                  "none",
                  "none",
                  normalizedCorner,
                  normalizedRadius,
                  frameWidth,
                  frameHeight
                )}
              </g>
            </mask>
          ) : null}
          <mask height={viewportHeight} id={maskId} maskUnits="userSpaceOnUse" width={viewportWidth} x="0" y="0">
            {normalizedMask === "alpha" ? (
              <linearGradient id={`${maskId}-fade`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="white" stopOpacity="0.15" />
                <stop offset="45%" stopColor="white" stopOpacity="1" />
                <stop offset="100%" stopColor="white" stopOpacity="0.2" />
              </linearGradient>
            ) : null}
            {normalizedMask === "luma" ? (
              <radialGradient id={`${maskId}-radial`} cx="50%" cy="45%" r="58%">
                <stop offset="0%" stopColor="white" stopOpacity="1" />
                <stop offset="100%" stopColor="white" stopOpacity="0.08" />
              </radialGradient>
            ) : null}
            {normalizedMask === "clip" ? (
              <rect fill="white" height={viewportHeight * 0.72} rx={Math.min(viewportWidth, viewportHeight) * 0.14} width={viewportWidth * 0.72} x={viewportWidth * 0.14} y={viewportHeight * 0.14} />
            ) : null}
            {normalizedMask === "alpha" ? <rect fill={`url(#${maskId}-fade)`} height={viewportHeight} width={viewportWidth} /> : null}
            {normalizedMask === "luma" ? <rect fill={`url(#${maskId}-radial)`} height={viewportHeight} width={viewportWidth} /> : null}
          </mask>
        </defs>
        <g mask={normalizedMask === "none" ? undefined : `url(#${maskId})`}>
          {localShapeImageSource && normalizedShape !== "line" ? (
            <image
              aria-label={shapeImageAlt || undefined}
              mask={`url(#${shapeImageMaskId})`}
              height={shapeImageHeight}
              href={localShapeImageSource}
              preserveAspectRatio={shapeImageFit === "contain" || shapeImageFit === "scale-down" ? "xMidYMid meet" : "xMidYMid slice"}
              width={shapeImageWidth}
              x={shapeImageX}
              y={shapeImageY}
            />
          ) : null}
          <g transform={shapeTransform}>
            {renderShape(
              normalizedShape,
              localShapeImageSource && normalizedShape !== "line" ? "transparent" : shapeFill,
              shapeStroke,
              lineWidth,
              normalizedSides,
              normalizedPoints,
              lineStyle,
              arrowStart,
              arrowEnd,
              normalizedCorner,
              normalizedRadius,
              frameWidth,
              frameHeight
            )}
            {normalizedOperation === "subtract" ? <circle cx="68" cy="34" fill="var(--slide-bg, #030303)" r="22" /> : null}
            {normalizedOperation === "intersect" ? <circle cx="62" cy="44" fill={shapeFill} opacity="0.45" r="30" stroke={shapeStroke} strokeWidth={lineWidth} /> : null}
            {normalizedOperation === "exclude" ? <circle cx="62" cy="44" fill="transparent" opacity="0.9" r="30" stroke={shapeStroke} strokeDasharray="7 7" strokeWidth={lineWidth} /> : null}
          </g>
        </g>
      </svg>
      {normalizedShape === "line" ? <>
        <LineEndpoint color={shapeStroke === "transparent" ? "#e5e7eb" : shapeStroke} endpoint={arrowStart} side="start" size={arrowStartSize} />
        <LineEndpoint color={shapeStroke === "transparent" ? "#e5e7eb" : shapeStroke} endpoint={arrowEnd} side="end" size={arrowEndSize} />
      </> : null}
    </MotionBlock>
  );
}

function normalizeNumber(value: number | string | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function generateStarPath(numPoints: number, cx = 50, cy = 50, outerR = 48, innerR?: number) {
  const resolvedInnerR = innerR ?? outerR * 0.42;
  const angleOffset = -Math.PI / 2;
  const points: string[] = [];
  const totalVertices = numPoints * 2;

  for (let i = 0; i < totalVertices; i++) {
    const angle = angleOffset + (2 * Math.PI * i) / totalVertices;
    const r = i % 2 === 0 ? outerR : resolvedInnerR;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return `M${points.join(" L")} Z`;
}

function renderShape(
  shape: ReturnType<typeof normalizeShape>,
  fill: string,
  stroke: string,
  strokeWidth: number,
  sides: number,
  starPoints: number,
  lineStyle: string,
  arrowStart: string,
  arrowEnd: string,
  corner: number,
  radius: number,
  frameWidth: number,
  frameHeight: number
) {
  const shapeStyle = { vectorEffect: "non-scaling-stroke" as const };

  if (shape === "circle") {
    return <circle cx="50" cy="50" fill={fill} r="48" stroke={stroke} strokeWidth={strokeWidth} style={shapeStyle} />;
  }

  if (shape === "triangle") {
    return <path d={shapePolygonPath(3)} fill={fill} stroke={stroke} strokeLinejoin="round" strokeWidth={strokeWidth} style={shapeStyle} />;
  }

  if (shape === "polygon") {
    return <path d={shapePolygonPath(sides)} fill={fill} stroke={stroke} strokeLinejoin="round" strokeWidth={strokeWidth} style={shapeStyle} />;
  }

  if (shape === "line") {
    const resolvedStroke = stroke === "transparent" ? "#e5e7eb" : stroke;
    const dashArray = lineStyle === "dashed" ? "8 6" : lineStyle === "dotted" ? "1 6" : undefined;
    const vectorStyle = { vectorEffect: "non-scaling-stroke" as const };
    const isPlainLine = arrowStart === "none" && arrowEnd === "none";
    return <g stroke={resolvedStroke} strokeLinecap={isPlainLine && lineStyle === "solid" ? "butt" : "round"} strokeLinejoin="round" strokeWidth={strokeWidth}><path d="M0 10H100" fill="none" strokeDasharray={dashArray} style={vectorStyle} /></g>;
  }

  if (shape === "arrow") {
    const resolvedStroke = stroke === "transparent" ? fill : stroke;
    return <path d="M2 22H58V2L98 50 58 98V78H2Z" fill={fill} stroke={resolvedStroke} strokeLinejoin="round" strokeWidth={strokeWidth} style={shapeStyle} />;
  }

  if (shape === "star") {
    return <path d={generateStarPath(starPoints)} fill={fill} stroke={stroke} strokeLinejoin="round" strokeWidth={strokeWidth} style={shapeStyle} />;
  }

  const customPaths: Partial<Record<ReturnType<typeof normalizeShape>, string>> = {
    chevron: "M1 1H68L99 50 68 99H1L32 50Z",
    corner: "M1 1H72L99 28V99H1Z",
    diamond: "M50 1L99 50 50 99 1 50Z",
    hexagon: "M20 1H80L99 50 80 99H20L1 50Z",
    parallelogram: "M24 1H99L76 99H1Z"
  };
  if (customPaths[shape]) return <path d={customPaths[shape]} fill={fill} stroke={stroke} strokeLinejoin="round" strokeWidth={strokeWidth} style={shapeStyle} />;

  if (radius <= 0 && corner <= 0) {
    return <rect fill={fill} height="100" stroke={stroke} strokeWidth={strokeWidth} style={shapeStyle} width="100" x="0" y="0" />;
  }

  const { radiusX, radiusY } = corner > 0
    ? normalizedRelativeCornerRadii(corner, frameWidth, frameHeight)
    : normalizedContinuousCornerRadii(radius, frameWidth, frameHeight);
  return (
    <path
      d={continuousRoundedRectPath({ height: 100, radiusX, radiusY, width: 100 })}
      fill={fill}
      stroke={stroke}
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      style={shapeStyle}
    />
  );
}

function LineEndpoint({ color, endpoint, side, size }: { color: string; endpoint: string; side: "end" | "start"; size: number | string }) {
  if (endpoint === "none" || !endpoint) return null;
  const scale = Math.min(Math.max(Number(size) || 100, 25), 300) / 100;
  const sidePosition = side === "start" ? { left: 0 } : { right: 0 };
  const width = endpoint === "bar" ? 4 * scale : endpoint === "circle" ? 10 * scale : 11 * scale;
  const height = endpoint === "bar" ? 16 * scale : endpoint === "circle" ? 10 * scale : 12 * scale;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 overflow-visible"
      preserveAspectRatio="none"
      style={{ ...sidePosition, height, width, transform: `translate(${side === "start" ? "-50%" : "50%"}, -50%)` }}
      viewBox="0 0 20 20"
    >
      {endpoint === "circle" ? <circle cx="10" cy="10" fill={color} r="9" /> : null}
      {endpoint === "bar" ? <path d="M10 1V19" fill="none" stroke={color} strokeLinecap="round" strokeWidth="3" vectorEffect="non-scaling-stroke" /> : null}
      {endpoint === "arrow" ? <path d={side === "start" ? "M19 1L1 10 19 19Z" : "M1 1L19 10 1 19Z"} fill={color} /> : null}
    </svg>
  );
}

function normalizePixelValue(value: number | string | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? Math.max(parsed, 0) : fallback;
}

function normalizeIntValue(value: number | string | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : parseInt(String(value), 10);

  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 3), 12) : fallback;
}

function normalizeOpacity(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return 1;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 1;
}

function normalizeShape(value: string): "arrow" | "chevron" | "circle" | "corner" | "diamond" | "hexagon" | "line" | "parallelogram" | "polygon" | "rectangle" | "star" | "triangle" {
  if (value === "arrow" || value === "chevron" || value === "circle" || value === "corner" || value === "diamond" || value === "hexagon" || value === "triangle" || value === "line" || value === "parallelogram" || value === "star" || value === "polygon") {
    return value;
  }

  return "rectangle";
}

function normalizeMask(value: string) {
  if (value === "alpha" || value === "luma" || value === "clip") {
    return value;
  }

  return "none";
}

function normalizeOperation(value: string) {
  if (value === "subtract" || value === "intersect" || value === "exclude") {
    return value;
  }

  return "none";
}
