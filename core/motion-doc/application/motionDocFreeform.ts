import { generateSlideString } from "@/core/motion-doc/application/motionDocSerialize";
import {
  parseColOverrides,
  parseRowOverrides,
  serializeOverrides,
  type StyleOverrides
} from "@/core/motion-doc/application/tableBlock";
import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import type { MotionDocBlock, MotionDocProps, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import {
  fullHdFontPixelsToPoints,
  legacyFontPixelsToPoints,
  MOTION_DOC_CANVAS_PROPS,
  MOTION_DOC_FONT_SIZES,
  MOTION_DOC_FONT_SIZE_UNIT,
  motionDocDefaultFontSize
} from "@/core/motion-doc/domain/typography";

type PositionProps = {
  h: number;
  w: number;
  x: number;
  y: number;
};

export function materializeFreeformSource(source: string) {
  const document = parseMotionDoc(source);
  const title = source.match(/^#\s+(.+)$/m)?.[0] ?? `# ${document.title}`;
  const slides = document.scenes.map((scene) => generateSlideString(materializeFreeformScene(scene)));

  return `${title}\n\n${slides.join("\n\n")}`;
}

export function materializeFreeformScene(scene: MotionDocScene): MotionDocScene {
  const blocksWithProps = scene.blocks.filter((block) => "props" in block);
  const hasCenteredCopy = scene.props.alignX === "center" || scene.props.textAlign === "center";
  const isFullHdSource =
    Number(scene.props.canvasWidth) === MOTION_DOC_CANVAS_PROPS.canvasWidth &&
    Number(scene.props.canvasHeight) === MOTION_DOC_CANVAS_PROPS.canvasHeight;
  const usesPointFontSizes = scene.props.fontSizeUnit === MOTION_DOC_FONT_SIZE_UNIT;

  return {
    ...scene,
    props: {
      ...scene.props,
      ...MOTION_DOC_CANVAS_PROPS
    },
    blocks: scene.blocks.map((block, index) => {
      if (!("props" in block)) {
        return block;
      }

      const layout = layoutBlock(block, index, blocksWithProps, hasCenteredCopy);
      const props = usesPointFontSizes
        ? block.props
        : migrateFontSizeToPoints(block.props, isFullHdSource);

      return {
        ...block,
        props: {
          ...props,
          ...(defaultFontSize(block) === undefined || props.fontSize !== undefined ? {} : { fontSize: defaultFontSize(block) }),
          ...(props.radius !== undefined || props.borderRadius !== undefined ? {} : { radius: defaultRadius(block) }),
          x: props.x ?? layout.x,
          y: props.y ?? layout.y,
          w: props.w ?? layout.w,
          h: props.h ?? layout.h
        }
      } as MotionDocBlock;
    })
  };
}

export function defaultBlockFrame(block: MotionDocBlock): PositionProps {
  if (isTitleText(block)) return { x: 8, y: 12, w: 62, h: 18 };
  if (block.type === "Text") return { x: 8, y: 38, w: 52, h: 16 };
  if (block.type === "Shape") return { x: 34, y: 30, w: 28, h: 28 };
  if (block.type === "ImageBlock" || block.type === "VideoBlock") return { x: 8, y: 16, w: 72, h: 52 };

  return { x: 8, y: 12, w: 42, h: 18 };
}

function layoutBlock(
  block: MotionDocBlock,
  originalIndex: number,
  blocksWithProps: Extract<MotionDocBlock, { props: MotionDocProps }>[],
  hasCenteredCopy: boolean
): PositionProps {
  const defaults = defaultBlockFrame(block);
  const propIndex = blocksWithProps.findIndex((item) => item === block);
  const titleIndex = blocksWithProps.findIndex(isTitleText);
  const titleOffset = titleIndex >= 0 && propIndex > titleIndex ? 1 : 0;
  const contentIndex = Math.max(propIndex - titleOffset, 0);
  const contentBlocks = blocksWithProps.filter((item) => !isTitleText(item));

  if (isTitleText(block)) {
    return hasCenteredCopy
      ? { x: 18, y: contentBlocks.length > 0 ? 26 : 34, w: 64, h: 18 }
      : { x: 8, y: 12, w: 64, h: 18 };
  }

  if (hasCenteredCopy && block.type === "Text") {
    return { x: 22, y: 54, w: 56, h: 16 };
  }

  if (contentBlocks.length === 1) {
    return singleBlockFrame(block, defaults);
  }

  if (contentBlocks.length === 2) {
    const x = contentIndex === 0 ? 8 : 52;
    return { ...defaults, x, y: 38, w: 40 };
  }

  if (contentBlocks.length === 3) {
    return { ...defaults, x: 8 + contentIndex * 30, y: 38, w: 28 };
  }

  const column = contentIndex % 2;
  const row = Math.floor(contentIndex / 2);

  return {
    ...defaults,
    x: column === 0 ? 8 : 52,
    y: 34 + row * 28,
    w: 40,
    h: Math.min(defaults.h, 32)
  };
}

function singleBlockFrame(block: MotionDocBlock, defaults: PositionProps): PositionProps {
  if (block.type === "ImageBlock" || block.type === "VideoBlock") {
    return { x: 10, y: 20, w: 80, h: 54 };
  }

  return { ...defaults, x: 8, y: 38 };
}

function defaultFontSize(block: MotionDocBlock) {
  if (block.type === "Text") {
    return isTitleText(block) ? MOTION_DOC_FONT_SIZES.display : motionDocDefaultFontSize(block.type);
  }

  return undefined;
}

function migrateFontSizeToPoints(props: MotionDocProps, isFullHdSource: boolean): MotionDocProps {
  const convert = isFullHdSource
    ? fullHdFontPixelsToPoints
    : legacyFontPixelsToPoints;
  const fontSize = Number(props.fontSize);
  const nextProps = {
    ...props,
    ...(Number.isFinite(fontSize) ? { fontSize: convert(fontSize) } : {})
  };
  const rowOverrides = migrateOverrideFontSizes(parseRowOverrides(props), convert);
  const colOverrides = migrateOverrideFontSizes(parseColOverrides(props), convert);

  return {
    ...nextProps,
    ...(props.rowOverrides === undefined ? {} : { rowOverrides: serializeOverrides(rowOverrides) }),
    ...(props.colOverrides === undefined ? {} : { colOverrides: serializeOverrides(colOverrides) })
  };
}

function migrateOverrideFontSizes(overrides: StyleOverrides, convert: (pixels: number) => number): StyleOverrides {
  return Object.fromEntries(
    Object.entries(overrides).map(([index, override]) => {
      const fontSize = Number(override.fontSize);
      return [
        index,
        Number.isFinite(fontSize)
          ? { ...override, fontSize: convert(fontSize) }
          : override
      ];
    })
  );
}

function defaultRadius(block: MotionDocBlock) {
  if (block.type === "ImageBlock" || block.type === "Shape" || block.type === "VideoBlock") {
    return 16;
  }

  return 0;
}

function isTitleText(block: MotionDocBlock) {
  return block.type === "Text" && (block.props.role === "title" || Number(block.props.fontSize) >= MOTION_DOC_FONT_SIZES.slideTitle);
}
