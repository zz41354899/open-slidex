import { escapeSvgAttribute, svgDataUri } from "@/core/motion-doc/application/svgDataUri";
import {
  continuousRoundedRectPath,
  normalizedContinuousCornerRadii,
  normalizedRelativeCornerRadii
} from "@/core/motion-doc/application/continuousRoundedRect";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";
import { normalizedImageScales } from "@/core/motion-doc/application/imageCrop";

type ShapeProps = MotionDocProps;

export function shapeVectorSvgDataUri(props: ShapeProps, id = "shape") {
  return svgDataUri(renderShapeVectorSvg(props, id));
}

export function shapeNeedsExactSvgExport(props: ShapeProps) {
  const shape = stringProp(props.shape) ?? "rectangle";
  const sides = clamp(Math.round(numberProp(props.sides, 3)), 3, 12);
  const points = clamp(Math.round(numberProp(props.points, 5)), 3, 12);

  return Boolean(
    (stringProp(props.mask) ?? "none") !== "none" ||
    (stringProp(props.operation) ?? "none") !== "none" ||
    Boolean(stringProp(props.shapeImageSrc)) ||
    (shape === "polygon" && (sides === 9 || sides === 11)) ||
    (shape === "star" && (points === 3 || points === 9 || points === 11)) ||
    (shape === "line" && (
      props.arrowStart === "bar" ||
      props.arrowEnd === "bar" ||
      numberProp(props.arrowStartSize, 100) !== 100 ||
      numberProp(props.arrowEndSize, 100) !== 100
    ))
  );
}

export function renderShapeVectorSvg(props: ShapeProps, id = "shape") {
  const fill = stringProp(props.fill) ?? "rgba(142,165,255,0.72)";
  const mask = stringProp(props.mask) ?? "none";
  const operation = stringProp(props.operation) ?? "none";
  const shape = stringProp(props.shape) ?? "rectangle";
  const stroke = stringProp(props.stroke) ?? "#ffffff";
  const strokeWidth = Math.max(numberProp(props.strokeWidth, 2), 0);
  const opacity = clamp(numberProp(props.opacity, 1), 0, 1);
  const sides = clamp(Math.round(numberProp(props.sides, 3)), 3, 12);
  const points = clamp(Math.round(numberProp(props.points, 5)), 3, 12);
  const radius = Math.max(numberProp(props.radius ?? props.borderRadius, 0), 0);
  const corner = Math.max(numberProp(props.corner, 0), 0);
  const frameWidth = clamp(numberProp(props.w, 28), 0, 100) / 100 * MOTION_DOC_CANVAS_WIDTH;
  const frameHeight = clamp(numberProp(props.h, 28), 0, 100) / 100 * MOTION_DOC_CANVAS_HEIGHT;
  const safeId = `${id}-${shape}-${mask}`.replace(/[^a-z0-9_-]+/gi, "-");
  const viewportWidth = shape === "line" ? 100 : Math.max(frameWidth, 1);
  const viewportHeight = shape === "line" ? 20 : Math.max(frameHeight, 1);
  const viewBox = `0 0 ${viewportWidth} ${viewportHeight}`;
  const geometryTransform = shape === "line"
    ? ""
    : ` transform="scale(${viewportWidth / 100} ${viewportHeight / 100})"`;
  const defs = renderMaskDefs(mask, safeId, viewportWidth, viewportHeight);
  const maskAttr = mask === "none" ? "" : ` mask="url(#${safeId})"`;
  const geometry = renderShapeGeometry({
    arrowEnd: stringProp(props.arrowEnd) ?? "none",
    arrowEndSize: numberProp(props.arrowEndSize, 100),
    arrowStart: stringProp(props.arrowStart) ?? "none",
    arrowStartSize: numberProp(props.arrowStartSize, 100),
    corner,
    fill: stringProp(props.shapeImageSrc) ? "transparent" : fill,
    frameHeight,
    frameWidth,
    lineStyle: stringProp(props.lineStyle) ?? "solid",
    points,
    radius,
    shape,
    sides,
    stroke,
    strokeWidth
  });
  const booleanLayer = renderBooleanLayer(operation, fill, stroke, strokeWidth);
  const shapeImageSrc = stringProp(props.shapeImageSrc);
  const imageMaskId = `${safeId}-image-mask`;
  const imageMask = shapeImageSrc && shape !== "line"
    ? `<mask id="${imageMaskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${viewportWidth}" height="${viewportHeight}"><g${geometryTransform}>${renderShapeGeometry({
        arrowEnd: "none",
        arrowEndSize: 100,
        arrowStart: "none",
        arrowStartSize: 100,
        corner,
        fill: "white",
        frameHeight,
        frameWidth,
        lineStyle: "solid",
        points,
        radius,
        shape,
        sides,
        stroke: "none",
        strokeWidth: 0
      })}</g></mask>`
    : "";
  const scales = normalizedImageScales("cover", props.shapeImageScaleX, props.shapeImageScaleY);
  const scale = Math.max(scales.scaleX, scales.scaleY);
  const cropX = numberProp(props.shapeImageCropX, 0);
  const cropY = numberProp(props.shapeImageCropY, 0);
  const fit = stringProp(props.shapeImageFit) ?? "cover";
  const imageWidth = viewportWidth * scale;
  const imageHeight = viewportHeight * scale;
  const imageX = (viewportWidth - imageWidth) / 2 + cropX / 100 * viewportWidth;
  const imageY = (viewportHeight - imageHeight) / 2 + cropY / 100 * viewportHeight;
  const imageLayer = shapeImageSrc && shape !== "line"
    ? `<image mask="url(#${imageMaskId})" href="${escapeSvgAttribute(shapeImageSrc)}" preserveAspectRatio="${fit === "contain" || fit === "scale-down" ? "xMidYMid meet" : "xMidYMid slice"}" x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}"/>`
    : "";
  const transformedGeometry = shape === "line" ? geometry : `<g${geometryTransform}>${geometry}${booleanLayer}</g>`;
  const resolvedBooleanLayer = shape === "line" ? booleanLayer : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" overflow="visible" preserveAspectRatio="none" shape-rendering="geometricPrecision" viewBox="${viewBox}" opacity="${opacity}"><defs>${defs}${imageMask}</defs><g${maskAttr}>${imageLayer}${transformedGeometry}${resolvedBooleanLayer}</g></svg>`;
}

function renderMaskDefs(mask: string, id: string, width: number, height: number) {
  if (mask === "alpha") {
    return `<linearGradient id="${id}-fade" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="white" stop-opacity="0.15"/><stop offset="45%" stop-color="white"/><stop offset="100%" stop-color="white" stop-opacity="0.2"/></linearGradient><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="url(#${id}-fade)"/></mask>`;
  }
  if (mask === "luma") {
    return `<radialGradient id="${id}-radial" cx="50%" cy="45%" r="58%"><stop offset="0%" stop-color="white"/><stop offset="100%" stop-color="white" stop-opacity="0.08"/></radialGradient><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="url(#${id}-radial)"/></mask>`;
  }
  if (mask === "clip") {
    const radius = Math.min(width, height) * 0.14;
    return `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="${width * 0.72}" height="${height * 0.72}" x="${width * 0.14}" y="${height * 0.14}" rx="${radius}" fill="white"/></mask>`;
  }
  return "";
}

function renderShapeGeometry(options: {
  arrowEnd: string;
  arrowEndSize: number;
  arrowStart: string;
  arrowStartSize: number;
  corner: number;
  fill: string;
  frameHeight: number;
  frameWidth: number;
  lineStyle: string;
  points: number;
  radius: number;
  shape: string;
  sides: number;
  stroke: string;
  strokeWidth: number;
}) {
  const { corner, fill, frameHeight, frameWidth, points, radius, shape, sides, stroke, strokeWidth } = options;
  const common = `fill="${escapeSvgAttribute(fill)}" stroke="${escapeSvgAttribute(stroke)}" stroke-linejoin="round" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke"`;

  if (shape === "circle") return `<circle cx="50" cy="50" r="48" ${common}/>`;
  if (shape === "triangle" || shape === "polygon") return `<path d="${shapePolygonPath(shape === "triangle" ? 3 : sides)}" ${common}/>`;
  if (shape === "star") return `<path d="${starPath(points)}" ${common}/>`;
  if (shape === "line") return renderVectorLine(options);
  if (shape === "arrow") return `<path d="M2 22H58V2L98 50 58 98V78H2Z" ${common}/>`;

  const paths: Record<string, string> = {
    chevron: "M1 1H68L99 50 68 99H1L32 50Z",
    corner: "M1 1H72L99 28V99H1Z",
    diamond: "M50 1L99 50 50 99 1 50Z",
    hexagon: "M20 1H80L99 50 80 99H20L1 50Z",
    parallelogram: "M24 1H99L76 99H1Z"
  };

  if (paths[shape]) return `<path d="${paths[shape]}" ${common}/>`;
  if (radius <= 0 && corner <= 0) return `<rect width="100" height="100" x="0" y="0" ${common}/>`;

  const { radiusX, radiusY } = corner > 0
    ? normalizedRelativeCornerRadii(corner, frameWidth, frameHeight)
    : normalizedContinuousCornerRadii(radius, frameWidth, frameHeight);
  const path = continuousRoundedRectPath({ height: 100, radiusX, radiusY, width: 100 });
  return `<path d="${path}" ${common}/>`;
}

function renderVectorLine(options: {
  arrowEnd: string;
  arrowEndSize: number;
  arrowStart: string;
  arrowStartSize: number;
  lineStyle: string;
  stroke: string;
  strokeWidth: number;
}) {
  const color = options.stroke === "transparent" ? "#e5e7eb" : options.stroke;
  const startScale = clamp(options.arrowStartSize, 25, 300) / 100;
  const endScale = clamp(options.arrowEndSize, 25, 300) / 100;
  const startInset = endpointInset(options.arrowStart, startScale);
  const endInset = endpointInset(options.arrowEnd, endScale);
  const dash = options.lineStyle === "dashed" ? "8 6" : options.lineStyle === "dotted" ? "1 6" : undefined;
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";
  const line = `<path d="M${startInset} 10H${100 - endInset}" fill="none" stroke="${escapeSvgAttribute(color)}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${options.strokeWidth}"${dashAttr} vector-effect="non-scaling-stroke"/>`;

  return `${line}${renderEndpoint(options.arrowStart, "start", color, startScale)}${renderEndpoint(options.arrowEnd, "end", color, endScale)}`;
}

function endpointInset(endpoint: string, scale: number) {
  if (endpoint === "arrow") return 1 + 9 * scale;
  if (endpoint === "circle") return 1 + 3.5 * scale;
  if (endpoint === "bar") return 1 + scale;
  return 1;
}

function renderEndpoint(endpoint: string, side: "end" | "start", color: string, scale: number) {
  const escapedColor = escapeSvgAttribute(color);
  const start = side === "start";
  if (endpoint === "arrow") {
    const tip = start ? 1 : 99;
    const base = start ? 1 + 9 * scale : 99 - 9 * scale;
    return `<path d="M${tip} 10L${base} ${10 - 6 * scale}V${10 + 6 * scale}Z" fill="${escapedColor}"/>`;
  }
  if (endpoint === "circle") {
    return `<circle cx="${start ? 1 + 3.5 * scale : 99 - 3.5 * scale}" cy="10" r="${3.5 * scale}" fill="${escapedColor}"/>`;
  }
  if (endpoint === "bar") {
    const x = start ? 1 + scale : 99 - scale;
    return `<path d="M${x} ${10 - 7 * scale}V${10 + 7 * scale}" fill="none" stroke="${escapedColor}" stroke-linecap="round" stroke-width="${Math.max(1.5 * scale, 1)}" vector-effect="non-scaling-stroke"/>`;
  }
  return "";
}

function renderBooleanLayer(operation: string, fill: string, stroke: string, strokeWidth: number) {
  if (operation === "subtract") return `<circle cx="68" cy="34" r="22" fill="var(--slide-bg, #030303)"/>`;
  if (operation === "intersect") return `<circle cx="62" cy="44" r="30" fill="${escapeSvgAttribute(fill)}" fill-opacity="0.45" stroke="${escapeSvgAttribute(stroke)}" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke"/>`;
  if (operation === "exclude") return `<circle cx="62" cy="44" r="30" fill="none" stroke="${escapeSvgAttribute(stroke)}" stroke-dasharray="7 7" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke"/>`;
  return "";
}

export function shapePolygonPath(sides: number, cx = 50, cy = 50, radius = 48) {
  if (sides === 3 && cx === 50 && cy === 50 && radius === 48) {
    return "M50,1 L99,99 L1,99 Z";
  }
  const vertices = Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + 2 * Math.PI * index / sides;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${vertices.join(" L")} Z`;
}

function starPath(points: number, cx = 50, cy = 50, outerRadius = 48) {
  const innerRadius = outerRadius * 0.42;
  const vertices = Array.from({ length: points * 2 }, (_, index) => {
    const angle = -Math.PI / 2 + 2 * Math.PI * index / (points * 2);
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${vertices.join(" L")} Z`;
}

function stringProp(value: string | number | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberProp(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
