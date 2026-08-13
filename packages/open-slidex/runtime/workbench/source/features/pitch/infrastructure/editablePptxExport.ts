import type PptxGenJS from "pptxgenjs";
import { lucideIconSvgDataUri } from "@/core/motion-doc/application/lucideIconSvg";
import { shapeNeedsExactSvgExport, shapeVectorSvgDataUri } from "@/core/motion-doc/application/shapeVectorSvg";
import { objectShadowFromProps } from "@/core/motion-doc/application/objectShadow";
import { getPaperImageFilterDefinition } from "@/core/motion-doc/application/shaders/paperImageFilterCatalog";
import { resolveSlideThemeColors } from "@/core/motion-doc/application/slideTheme";
import {
  tableCellsFromProps,
  tableCellStyleOverride,
  tableColumnTrackValuesFromProps,
  tableSizeFromProps
} from "@/core/motion-doc/application/tableBlock";
import type { MotionDocBlock, MotionDocProps, ParsedMotionDoc } from "@/core/motion-doc/domain/motionDocTypes";
import { textStyleSegments } from "@/core/motion-doc/domain/textStyleRanges";
import { blockRotation } from "@/core/motion-doc/domain/blockTransform";
import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";
import {
  MOTION_DOC_FONT_SIZES,
  motionDocDefaultFontSize
} from "@/core/motion-doc/domain/typography";
import { blockFrame } from "@/features/pitch/application/previewCanvas";
import {
  portablePptxImageData,
  type PptxImageFit
} from "@/features/pitch/infrastructure/pptxImageExport";
import {
  motionDocFontPointsToPptPoints,
  SLIDEX_PPTX_HEIGHT_INCHES,
  SLIDEX_PPTX_WIDTH_INCHES
} from "@/features/pitch/infrastructure/pptxLayout";
import { addPptxVideo } from "@/features/pitch/infrastructure/pptxVideoExport";

const SLIDE_HEIGHT = SLIDEX_PPTX_HEIGHT_INCHES;
const SLIDE_WIDTH = SLIDEX_PPTX_WIDTH_INCHES;

type PptxSlide = ReturnType<PptxGenJS["addSlide"]>;
type PropsBlock = Extract<MotionDocBlock, { props: MotionDocProps }>;
type PreparedBlockAssets = Map<MotionDocBlock, string>;
type PortableBlockAssetJob = {
  block: MotionDocBlock;
  fit: PptxImageFit;
  frame: ReturnType<typeof pptxFrame>;
  source: string;
};
type PptxShapeFillProps = PptxGenJS.ShapeFillProps;
type PptxShapeLineProps = PptxGenJS.ShapeLineProps;
type PptxShapeName = PptxGenJS.SHAPE_NAME;

export type EditablePptxBlockAdapterContext = {
  block: MotionDocBlock;
  foreground: string;
  muted: string;
  pptx: PptxGenJS;
  slide: PptxSlide;
};

export type EditablePptxOptions = {
  additionalNativeBlockTypes?: readonly MotionDocBlock["type"][];
  renderBlock?: (context: EditablePptxBlockAdapterContext) => boolean | Promise<boolean>;
};

const NATIVE_PPTX_BLOCK_TYPES = new Set([
  "Title",
  "Text",
  "heading",
  "Icon",
  "ImageBlock",
  "Shape",
  "Table",
  "VideoBlock"
]);

const POLYGON_SHAPES: Record<number, PptxShapeName> = {
  3: "triangle",
  4: "diamond",
  5: "pentagon",
  6: "hexagon",
  7: "heptagon",
  8: "octagon",
  9: "decagon",
  10: "decagon",
  11: "dodecagon",
  12: "dodecagon"
};

const STAR_SHAPES: Record<number, PptxShapeName> = {
  3: "star4",
  4: "star4",
  5: "star5",
  6: "star6",
  7: "star7",
  8: "star8",
  9: "star10",
  10: "star10",
  11: "star12",
  12: "star12"
};

export async function addEditableSlides(
  pptx: PptxGenJS,
  document: ParsedMotionDoc,
  renderedBackgrounds: readonly string[],
  filteredImagesBySlide: readonly (readonly string[])[] = [],
  options: EditablePptxOptions = {}
) {
  const preparedBlockAssets = await preparePortableBlockAssets(document);

  for (let sceneIndex = 0; sceneIndex < document.scenes.length; sceneIndex += 1) {
    const scene = document.scenes[sceneIndex];
    const slide = pptx.addSlide();
    const theme = resolveSlideThemeColors(scene.props);
    const renderedBackground = renderedBackgrounds[sceneIndex];
    const hasVisualFallback = Boolean(renderedBackground && needsVisualFallback(scene.blocks, scene.props, options.additionalNativeBlockTypes));

    slide.background = { color: pptxColor(theme.background, "0F172A") };
    if (scene.notes?.plainText) {
      slide.addNotes(scene.notes.plainText);
    }

    if (hasVisualFallback) {
      slide.background = { data: renderedBackground };
    }

    let filteredImageIndex = 0;
    for (const block of scene.blocks) {
      if (block.type === "Title" || block.type === "Text" || block.type === "heading") {
        addEditableText(slide, block, theme.foreground, theme.muted);
      } else if (block.type === "ImageBlock") {
        const needsFilterRasterization = imageNeedsPptxRasterization(block);
        const filteredImageData = needsFilterRasterization
          ? filteredImagesBySlide[sceneIndex]?.[filteredImageIndex++]
          : undefined;

        if (needsFilterRasterization && !filteredImageData) {
          throw new Error(`Filtered image ${filteredImageIndex} on slide ${sceneIndex + 1} could not be rendered`);
        }

        await addEditableImage(slide, block, filteredImageData ?? preparedBlockAssets.get(block));
      } else if (block.type === "Icon") {
        await addEditableIcon(slide, block, theme.isLight, preparedBlockAssets.get(block));
      } else if (block.type === "Shape") {
        await addEditableShape(slide, block, preparedBlockAssets.get(block));
      } else if (block.type === "Table") {
        if (Math.abs(blockRotation(block.props)) <= 0.001) {
          addEditableTable(slide, block, theme.foreground);
        }
      } else if (block.type === "VideoBlock") {
        await addPptxVideo(slide, block.props, pptxBlockFrame(block));
      } else if (options.renderBlock) {
        await options.renderBlock({ block, foreground: theme.foreground, muted: theme.muted, pptx, slide });
      }
    }
  }
}

async function preparePortableBlockAssets(document: ParsedMotionDoc): Promise<PreparedBlockAssets> {
  const jobs = document.scenes.flatMap((scene) => {
    const theme = resolveSlideThemeColors(scene.props);

    return scene.blocks.flatMap((block): PortableBlockAssetJob[] => {
      if (block.type === "ImageBlock" && !imageNeedsPptxRasterization(block)) {
        const source = stringProp(block.props.src);
        return source ? [{ block, fit: imageFit(block.props.fit), frame: pptxFrame(blockFrame(block)), source }] : [];
      }

      if (block.type === "Icon") {
        const iconName = stringProp(block.props.icon) ?? "Sparkles";
        const source = lucideIconSvgDataUri(iconName, {
          color: theme.isLight ? "#000000" : "#ffffff",
          strokeWidth: numericProp(block.props.strokeWidth, 2)
        });
        return source ? [{ block, fit: "contain", frame: pptxFrame(blockFrame(block)), source }] : [];
      }

      if (block.type === "Shape" && shapeNeedsExactSvgExport(block.props)) {
        const sourceShape = stringProp(block.props.shape) ?? "rectangle";
        return [{
          block,
          fit: "contain",
          frame: pptxFrame(blockFrame(block)),
          source: shapeVectorSvgDataUri(block.props, `pptx-${sourceShape}`)
        }];
      }

      return [];
    });
  });
  const preparedAssets: PreparedBlockAssets = new Map();
  const conversionCache = new Map<string, Promise<string>>();

  await mapWithConcurrency(jobs, pptxAssetConversionConcurrency(), async ({ block, fit, frame, source }) => {
    const cacheKey = `${fit}:${frame.w.toFixed(3)}x${frame.h.toFixed(3)}:${source}`;
    let conversion = conversionCache.get(cacheKey);
    if (!conversion) {
      conversion = portablePptxImageData(source, frame, fit);
      conversionCache.set(cacheKey, conversion);
    }
    preparedAssets.set(block, await conversion);
  });

  return preparedAssets;
}

function pptxAssetConversionConcurrency() {
  if (typeof navigator === "undefined") return 2;
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const isLowMemory = (navigatorWithMemory.deviceMemory ?? (isMobile ? 4 : 8)) <= 4;
  if (isMobile || isLowMemory) return 2;
  return Math.min(4, Math.max(2, Math.floor((navigator.hardwareConcurrency || 4) / 2)));
}

async function mapWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<void>
) {
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await mapper(items[currentIndex]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, () => worker())
  );
}

export function pptxRasterRequirements(
  document: ParsedMotionDoc,
  additionalNativeBlockTypes: readonly MotionDocBlock["type"][] = []
) {
  const captureFilteredImagesBySlide = document.scenes.map((scene) => (
    scene.blocks.some(imageNeedsPptxRasterization)
  ));
  const captureSlideBackgroundsBySlide = document.scenes.map((scene) => (
    needsVisualFallback(scene.blocks, scene.props, additionalNativeBlockTypes)
  ));
  const slideIndices = document.scenes.flatMap((_, slideIndex) => (
    captureFilteredImagesBySlide[slideIndex] ||
    captureSlideBackgroundsBySlide[slideIndex]
      ? [slideIndex]
      : []
  ));

  return {
    captureFilteredImagesBySlide,
    captureSlideBackgroundsBySlide,
    slideCount: document.scenes.length,
    slideIndices
  };
}

function addEditableText(
  slide: PptxSlide,
  block: Extract<MotionDocBlock, { text: string }>,
  foreground: string,
  muted: string
) {
  const frame = block.type === "heading" ? { x: 8, y: 18, w: 52, h: 10 } : blockFrame(block);
  const props = "props" in block ? block.props : {};
  const isTitle = block.type === "Title";
  const fontSize = numericProp(
    props.fontSize,
    block.type === "heading"
      ? MOTION_DOC_FONT_SIZES.heading
      : motionDocDefaultFontSize(isTitle ? "Title" : "Text")
  );
  const background = stringProp(props.background ?? props.backgroundColor ?? props.bg);
  const baseFontWeight = numericProp(props.fontWeight, isTitle ? 600 : 400);
  const baseItalic = props.fontStyle === "italic";
  const baseLetterSpacing = numericProp(props.letterSpacing, 0);
  const exactLineHeight = positiveNumericProp(props.lineHeightPt);
  const lineHeightMultiple = positiveNumericProp(props.lineHeight) ?? (isTitle ? 1.02 : 1.45);
  const baseFontFamily = stringProp(props.fontFamily) ?? "Aptos";
  const baseTextColor = stringProp(props.color ?? props.textColor) ?? (isTitle ? foreground : muted);
  const textSegments = textStyleSegments(block.text, props);
  const hasInlineStyles = textSegments.some(
    (segment) =>
      segment.color !== undefined ||
      segment.fontFamily !== undefined ||
      segment.fontSize !== undefined ||
      segment.fontWeight !== undefined ||
      segment.href !== undefined ||
      segment.italic !== undefined ||
      segment.letterSpacing !== undefined ||
      segment.underline !== undefined
  );
  const presentationSegments = readableListSegments(textSegments, props);
  const text: string | PptxGenJS.TextProps[] = hasInlineStyles
    ? presentationSegments.map((segment) => ({
        options: {
          bold: (segment.fontWeight ?? baseFontWeight) >= 600,
          color: pptxColor(segment.color ?? baseTextColor, "FFFFFF"),
          charSpacing: segment.letterSpacing ?? baseLetterSpacing,
          fontFace: segment.fontFamily ?? baseFontFamily,
          fontSize: Math.max(motionDocFontPointsToPptPoints(segment.fontSize ?? fontSize), 8),
          hyperlink: safePptxHref(segment.href)
            ? { url: safePptxHref(segment.href) }
            : undefined,
          italic: segment.italic ?? baseItalic,
          underline: segment.underline ? { color: pptxColor(segment.color ?? baseTextColor, "FFFFFF") } : undefined
        },
        text: segment.text
      }))
    : readableListText(block.text, props);

  slide.addText(text, {
    ...pptxFrame(frame),
    align: textAlign(props.textAlign),
    bold: baseFontWeight >= 600,
    breakLine: false,
    color: pptxColor(baseTextColor, "FFFFFF"),
    charSpacing: baseLetterSpacing,
    fill: background ? { color: pptxColor(background, "FFFFFF"), transparency: colorTransparency(background) } : undefined,
    fontFace: baseFontFamily,
    fontSize: Math.max(motionDocFontPointsToPptPoints(fontSize), 8),
    italic: baseItalic,
    ...(exactLineHeight === undefined
      ? { lineSpacingMultiple: lineHeightMultiple }
      : { lineSpacing: motionDocFontPointsToPptPoints(exactLineHeight) }),
    margin: background ? 0.1 : 0,
    rotate: blockRotation(props),
    shadow: pptxShadow(props),
    valign: verticalAlign(props.textVerticalAlign)
  });
}

function readableListText(text: string, props: MotionDocProps) {
  const listType = stringProp(props.listType);
  if (listType !== "bullet" && listType !== "ordered") return text;
  const start = Math.max(1, Math.round(numericProp(props.listStart, 1)));
  return text
    .split("\n")
    .map((line, index) => `${listType === "bullet" ? "•" : `${start + index}.`} ${line}`)
    .join("\n");
}

function readableListSegments(
  segments: ReturnType<typeof textStyleSegments>,
  props: MotionDocProps
) {
  const listType = stringProp(props.listType);
  if (listType !== "bullet" && listType !== "ordered") return segments;
  const start = Math.max(1, Math.round(numericProp(props.listStart, 1)));
  let lineIndex = 0;
  let atLineStart = true;

  return segments.map((segment) => {
    const parts = segment.text.split("\n");
    const text = parts.map((part, partIndex) => {
      const marker = atLineStart
        ? `${listType === "bullet" ? "•" : `${start + lineIndex}.`} `
        : "";
      if (atLineStart) lineIndex += 1;
      atLineStart = partIndex < parts.length - 1;
      return `${marker}${part}`;
    }).join("\n");
    return { ...segment, text };
  });
}

function safePptxHref(value: string | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  return /^(?:https?:|mailto:)/i.test(trimmed) ? trimmed : "";
}

async function addEditableImage(slide: PptxSlide, block: PropsBlock, renderedData?: string) {
  const src = stringProp(block.props.src);
  if (!src) return;

  const frame = pptxBlockFrame(block);
  const fit = imageFit(block.props.fit);
  const data = renderedData ?? await portablePptxImageData(src, frame, fit);

  slide.addImage({
    data,
    ...frame,
    shadow: pptxShadow(block.props),
    transparency: 0
  });
}

async function addEditableIcon(
  slide: PptxSlide,
  block: PropsBlock,
  isLightBackground: boolean,
  preparedData?: string
) {
  const iconName = stringProp(block.props.icon) ?? "Sparkles";
  const svgData = lucideIconSvgDataUri(
    iconName,
    {
      color: isLightBackground ? "#000000" : "#ffffff",
      strokeWidth: numericProp(block.props.strokeWidth, 2)
    }
  );

  if (!svgData) return;

  const frame = pptxBlockFrame(block);
  const data = preparedData ?? await portablePptxImageData(svgData, frame);

  slide.addImage({
    altText: `${iconName} icon`,
    data,
    ...frame,
    shadow: pptxShadow(block.props),
    transparency: 0
  });
}

async function addEditableShape(slide: PptxSlide, block: PropsBlock, preparedData?: string) {
  const props = block.props;
  const sourceShape = stringProp(props.shape) ?? "rectangle";
  const opacity = clamp(numericProp(props.opacity, 1), 0, 1);
  const frame = pptxBlockFrame(block);

  if (shapeNeedsExactSvgExport(props)) {
    const data = preparedData ?? await portablePptxImageData(
        shapeVectorSvgDataUri(props, `pptx-${sourceShape}`),
        frame
      );
    slide.addImage({
      altText: `${sourceShape} vector shape`,
      data,
      ...frame,
      shadow: pptxShadow(props),
      transparency: 0
    });
    return;
  }

  if (sourceShape === "line") {
    slide.addShape("line", {
      ...frame,
      h: 0,
      y: frame.y + frame.h / 2,
      line: shapeLineOptions(props, opacity),
      shadow: pptxShadow(props)
    });
    return;
  }

  const fillSource = stringProp(props.fill) ?? "rgba(142,165,255,0.72)";
  const sourceStroke = stringProp(props.stroke) ?? "#FFFFFF";
  const shapeName = shapeNameForPptx(sourceShape, props);
  const radius = Math.max(numericProp(props.radius ?? props.borderRadius, 0), 0);
  const corner = clamp(numericProp(props.corner, 0), 0, 50);
  const sourceFrame = blockFrame(block);
  const maxRadius = Math.min(
    sourceFrame.w / 100 * MOTION_DOC_CANVAS_WIDTH,
    sourceFrame.h / 100 * MOTION_DOC_CANVAS_HEIGHT
  ) / 2;

  slide.addShape(shapeName, {
    ...frame,
    fill: shapeFillOptions(fillSource, opacity, "8EA5FF"),
    line: shapeLineOptions(props, opacity, sourceStroke),
    shadow: pptxShadow(props),
    ...(shapeName === "roundRect" ? { rectRadius: corner > 0 ? corner / 50 : maxRadius > 0 ? clamp(radius / maxRadius, 0, 1) : 0 } : {})
  });
}

function addEditableTable(
  slide: PptxSlide,
  block: PropsBlock,
  foreground: string
) {
  const { columns, rows } = tableSizeFromProps(block.props);
  const cells = tableCellsFromProps(block.props, rows, columns);
  const columnTracks = tableColumnTrackValuesFromProps(block.props, columns);
  const frame = blockFrame(block);
  const totalTrack = columnTracks.reduce((sum, value) => sum + value, 0) || columns;
  const fontSize = Math.max(
    motionDocFontPointsToPptPoints(numericProp(block.props.fontSize, MOTION_DOC_FONT_SIZES.table)),
    8
  );
  const textColor = pptxColor(stringProp(block.props.color ?? block.props.textColor) ?? foreground, "111827");
  const fillColor = pptxColor(stringProp(block.props.cellBackground ?? block.props.background) ?? "FFFFFF", "FFFFFF");
  const borderColor = pptxColor(stringProp(block.props.borderColor) ?? "D1D5DB", "D1D5DB");
  const shadow = pptxShadow(block.props);

  // PowerPoint tables cannot carry a native shadow. Keep the table editable
  // and place a fully transparent shadow host immediately behind it instead.
  if (shadow) {
    slide.addShape("rect", {
      ...pptxFrame(frame),
      fill: { color: fillColor, transparency: 100 },
      line: { color: fillColor, transparency: 100 },
      shadow
    });
  }

  slide.addTable(
    cells.map((row, rowIndex) => row.map((text, columnIndex) => {
      const override = tableCellStyleOverride(block.props, rowIndex, columnIndex);
      const resolvedTextColor = pptxColor(override.textColor ?? textColor, textColor);
      const resolvedFillColor = pptxColor(override.background ?? fillColor, fillColor);
      const resolvedBorderColor = pptxColor(override.borderColor ?? borderColor, borderColor);
      return {
        text,
        options: {
          border: { color: resolvedBorderColor, pt: Math.max(numericProp(block.props.borderWidth, 1) * 0.75, 0.5) },
          color: resolvedTextColor,
          fill: { color: resolvedFillColor },
          fontFace: override.fontFamily ?? stringProp(block.props.fontFamily) ?? "Aptos",
          fontSize: override.fontSize === undefined
            ? fontSize
            : Math.max(motionDocFontPointsToPptPoints(override.fontSize), 8)
        }
      };
    })),
    {
      ...pptxFrame(frame),
      border: { color: borderColor, pt: Math.max(numericProp(block.props.borderWidth, 1) * 0.75, 0.5) },
      colW: columnTracks.map((value) => (frame.w / 100 * SLIDE_WIDTH * value) / totalTrack),
      margin: 0.06,
      valign: verticalAlign(block.props.textVerticalAlign)
    }
  );
}

function needsVisualFallback(
  blocks: readonly MotionDocBlock[],
  props: MotionDocProps,
  additionalNativeBlockTypes: readonly MotionDocBlock["type"][] = []
) {
  const background = stringProp(props.background);
  return Boolean(
    props.shader ||
    props.backgroundImage ||
    (background && !isSimpleColor(background)) ||
    blocks.some((block) => !isNativePptxBlock(block, additionalNativeBlockTypes))
  );
}

function imageNeedsPptxRasterization(block: MotionDocBlock) {
  if (block.type !== "ImageBlock") return false;

  return Boolean(getPaperImageFilterDefinition(stringProp(block.props.filter))) ||
    Math.abs(numericProp(block.props.cropX, 0)) > 0.001 ||
    Math.abs(numericProp(block.props.cropY, 0)) > 0.001 ||
    Math.abs(numericProp(block.props.scaleX, 1) - 1) > 0.001 ||
    Math.abs(numericProp(block.props.scaleY, 1) - 1) > 0.001;
}

function isNativePptxBlock(block: MotionDocBlock, additionalNativeBlockTypes: readonly MotionDocBlock["type"][] = []) {
  if (block.type === "Table" && Math.abs(blockRotation(block.props)) > 0.001) {
    return false;
  }
  return NATIVE_PPTX_BLOCK_TYPES.has(block.type) || additionalNativeBlockTypes.includes(block.type);
}

function shapeNameForPptx(shape: string, props: MotionDocProps): PptxShapeName {
  if (shape === "circle") return "ellipse";
  if (shape === "triangle") return "triangle";
  if (shape === "diamond") return "diamond";
  if (shape === "arrow") return "rightArrow";
  if (shape === "chevron") return "chevron";
  if (shape === "corner") return "corner";
  if (shape === "hexagon") return "hexagon";
  if (shape === "parallelogram") return "parallelogram";
  if (shape === "polygon") return POLYGON_SHAPES[clamp(Math.round(numericProp(props.sides, 3)), 3, 12)];
  if (shape === "star") return STAR_SHAPES[clamp(Math.round(numericProp(props.points, 5)), 3, 12)];

  const radius = numericProp(props.radius ?? props.borderRadius, 0);
  const corner = numericProp(props.corner, 0);
  return radius > 0 || corner > 0 ? "roundRect" : "rect";
}

function shapeFillOptions(
  value: string | undefined,
  opacity: number,
  fallback: string
): PptxShapeFillProps {
  if (isTransparentColor(value)) return { type: "none" };

  return {
    color: pptxColor(value ?? fallback, fallback),
    transparency: combinedTransparency(value, opacity)
  };
}

function shapeLineOptions(
  props: MotionDocProps,
  opacity: number,
  colorOverride?: string
): PptxShapeLineProps {
  const stroke = colorOverride ?? stringProp(props.stroke) ?? "#FFFFFF";
  const width = numericProp(props.strokeWidth, 2);

  if (width <= 0 || isTransparentColor(stroke)) return { type: "none" };

  return {
    beginArrowType: lineArrowType(props.arrowStart),
    color: pptxColor(stroke, "FFFFFF"),
    dashType: lineDashType(props.lineStyle),
    endArrowType: lineArrowType(props.arrowEnd),
    transparency: combinedTransparency(stroke, opacity),
    width: Math.max(width * 0.75, 0.25)
  };
}

function lineDashType(value: string | number | undefined): PptxShapeLineProps["dashType"] {
  if (value === "dashed") return "dash";
  if (value === "dotted") return "sysDot";
  return "solid";
}

function lineArrowType(value: string | number | undefined): PptxShapeLineProps["beginArrowType"] {
  if (value === "arrow") return "arrow";
  if (value === "circle") return "oval";
  return "none";
}

function pptxFrame(frame: { h: number; w: number; x: number; y: number }) {
  return {
    x: frame.x / 100 * SLIDE_WIDTH,
    y: frame.y / 100 * SLIDE_HEIGHT,
    w: frame.w / 100 * SLIDE_WIDTH,
    h: frame.h / 100 * SLIDE_HEIGHT
  };
}

function pptxBlockFrame(block: PropsBlock) {
  return {
    ...pptxFrame(blockFrame(block)),
    rotate: blockRotation(block.props)
  };
}

function pptxShadow(props: MotionDocProps): PptxGenJS.ShadowProps | undefined {
  const shadow = objectShadowFromProps(props);
  if (!shadow) return undefined;
  const distance = Math.hypot(shadow.offsetX, shadow.offsetY);
  const angle = distance <= 0
    ? 0
    : (Math.atan2(shadow.offsetY, shadow.offsetX) * 180 / Math.PI + 360) % 360;
  return {
    angle,
    blur: clamp(shadow.blur * 0.5, 0, 100),
    color: pptxColor(shadow.color, "000000"),
    offset: clamp(distance * 0.5, 0, 200),
    opacity: shadow.opacity,
    rotateWithShape: false,
    type: "outer"
  };
}

function stringProp(value: string | number | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numericProp(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveNumericProp(value: string | number | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function imageFit(value: string | number | undefined): PptxImageFit {
  if (value === "contain" || value === "scale-down") return "contain";
  if (value === "fill") return "fill";
  return "cover";
}

function textAlign(value: string | number | undefined): "center" | "left" | "right" {
  return value === "center" || value === "right" ? value : "left";
}

function verticalAlign(value: string | number | undefined): "bottom" | "middle" | "top" {
  if (value === "bottom") return "bottom";
  if (value === "middle" || value === "center") return "middle";
  return "top";
}

function isSimpleColor(value: string) {
  return /^#?[0-9a-f]{3,8}$/i.test(value.trim()) || /^rgba?\(/i.test(value.trim());
}

function colorTransparency(value: string) {
  return combinedTransparency(value, 1);
}

function combinedTransparency(value: string | undefined, opacity: number) {
  return Math.round((1 - colorAlpha(value) * opacity) * 100);
}

function colorAlpha(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "transparent") return 0;

  const rgbaAlpha = normalized.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/i)?.[1];
  if (rgbaAlpha !== undefined) return clamp(Number(rgbaAlpha), 0, 1);

  const hexAlpha = normalized.match(/^#?[0-9a-f]{6}([0-9a-f]{2})$/i)?.[1];
  if (hexAlpha) return parseInt(hexAlpha, 16) / 255;

  return 1;
}

function isTransparentColor(value: string | undefined) {
  return colorAlpha(value) === 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function pptxColor(value: string, fallback: string) {
  const normalized = value.trim();
  const hex = normalized.match(/^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i)?.[1];
  if (hex) return hex.toUpperCase();

  const shortHex = normalized.match(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (shortHex) return `${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}${shortHex[3]}${shortHex[3]}`.toUpperCase();

  const rgb = normalized.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return rgb.slice(1, 4).map((channel) => Math.min(Number(channel), 255).toString(16).padStart(2, "0")).join("").toUpperCase();

  return fallback;
}
