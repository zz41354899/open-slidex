import type { MotionDocBlock } from "@/core/motion-doc/domain/motionDocTypes";
import { createTableCells, serializeTableCells } from "@/core/motion-doc/application/tableBlock";
import { withNewMotionDocBlockId } from "@/core/motion-doc/application/motionDocBlockIdentity";
import {
  MOTION_DOC_FONT_SIZES
} from "@/core/motion-doc/domain/typography";
import { defaultMotionDocChartData } from "@/core/motion-doc/domain/chart";
import { widthPercentForPhysicalAspectRatio } from "@/core/motion-doc/domain/frame";

export type AddBlockType =
  | "Text"
  | "Text96"
  | "Text60"
  | "Text48"
  | "Text36"
  | "Text32"
  | "Text24"
  | "Image"
  | "Video"
  | "Chart"
  | "Table"
  | "ShapeRectangle"
  | "ShapeCircle"
  | "ShapeTriangle"
  | "ShapeLine"
  | "ShapeArrow"
  | "ShapeStar";

export function createMotionDocBlock(type: AddBlockType): MotionDocBlock {
  return withNewMotionDocBlockId(createMotionDocBlockWithoutId(type));
}

function createMotionDocBlockWithoutId(type: AddBlockType): MotionDocBlock {
  switch (type) {
    case "Table":
      return {
        type: "Table",
        props: {
          background: "#ffffff",
          borderColor: "#d1d5db",
          borderWidth: 1,
          cellBackground: "#ffffff",
          cells: serializeTableCells(createTableCells(3, 4)),
          color: "#000000",
          columns: 4,
          enter: "none",
          fontSize: MOTION_DOC_FONT_SIZES.table,
          h: 30,
          headerHeight: 26,
          rowHeaderWidth: 34,
          rows: 3,
          stripeBackground: "#f8fafc",
          w: 56,
          x: 22,
          y: 34
        }
      } as MotionDocBlock;
    case "Text":
      return { type: "Text", props: { enter: "none", fontSize: MOTION_DOC_FONT_SIZES.body, x: 10, y: 45, w: 42, h: 9 }, text: "Add some descriptive text here." } as MotionDocBlock;
    case "Text96":
      return createTextPresetBlock(MOTION_DOC_FONT_SIZES.largeDisplay, "Display headline");
    case "Text60":
      return createTextPresetBlock(MOTION_DOC_FONT_SIZES.section, "Section headline");
    case "Text48":
      return createTextPresetBlock(MOTION_DOC_FONT_SIZES.heading, "Key message");
    case "Text36":
      return createTextPresetBlock(MOTION_DOC_FONT_SIZES.slideTitle, "Slide title");
    case "Text32":
      return createTextPresetBlock(MOTION_DOC_FONT_SIZES.supportingTitle, "Supporting title");
    case "Text24":
      return createTextPresetBlock(MOTION_DOC_FONT_SIZES.body, "Body copy");
    case "Image":
      return { type: "ImageBlock", props: { src: "", alt: "", fit: "cover", scaleX: 1, scaleY: 1, enter: "none", radius: 0, x: 10, y: 20, w: 80, h: 54 } } as MotionDocBlock;
    case "Video":
      return { type: "VideoBlock", props: { src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", fit: "cover", controls: "true", loop: "true", muted: "true", enter: "none", radius: 0, x: 10, y: 20, w: 80, h: 54 } } as MotionDocBlock;
    case "Chart":
      return {
        type: "Chart",
        props: {
          ariaLabel: "Quarterly performance",
          chartMotion: "auto",
          data: JSON.stringify(defaultMotionDocChartData),
          enter: "fadeUp",
          h: 52,
          palette: "aurora",
          showAxes: "true",
          showLabels: "true",
          type: "bar",
          w: 78,
          x: 11,
          y: 25
        }
      } as MotionDocBlock;
    case "ShapeRectangle":
      return createShapeBlock("rectangle");
    case "ShapeCircle":
      return createShapeBlock("circle");
    case "ShapeTriangle":
      return createShapeBlock("triangle");
    case "ShapeLine":
      return createShapeBlock("line");
    case "ShapeArrow":
      return createShapeBlock("arrow");
    case "ShapeStar":
      return createShapeBlock("star");
  }
}

function createTextPresetBlock(fontSize: number, text: string): MotionDocBlock {
  const isDisplay = fontSize >= MOTION_DOC_FONT_SIZES.heading;
  return {
    type: "Text",
    props: {
      enter: "none",
      fontSize,
      fontWeight: isDisplay ? 700 : 560,
      lineHeight: fontSize >= MOTION_DOC_FONT_SIZES.section ? 1 : 1.12,
      role: fontSize >= MOTION_DOC_FONT_SIZES.slideTitle ? "title" : "body",
      x: fontSize >= MOTION_DOC_FONT_SIZES.section ? 7 : 10,
      y: fontSize >= MOTION_DOC_FONT_SIZES.section ? 16 : fontSize >= MOTION_DOC_FONT_SIZES.slideTitle ? 24 : 44,
      w: fontSize >= MOTION_DOC_FONT_SIZES.section ? 76 : fontSize >= MOTION_DOC_FONT_SIZES.slideTitle ? 62 : 46,
      h: fontSize >= MOTION_DOC_FONT_SIZES.section ? 24 : fontSize >= MOTION_DOC_FONT_SIZES.slideTitle ? 18 : 9
    },
    text
  } as MotionDocBlock;
}

function createShapeBlock(shape: string): MotionDocBlock {
  const isLine = shape === "line";
  const isArrow = shape === "arrow";
  const isTriangle = shape === "triangle";
  const isStar = shape === "star";
  const closedShapeHeight = 28;
  const closedShapeWidth = widthPercentForPhysicalAspectRatio(closedShapeHeight);
  return {
    type: "Shape",
    props: {
      shape: isTriangle ? "polygon" : shape,
      ...(isTriangle ? { sides: 3 } : {}),
      ...(isStar ? { points: 5 } : {}),
      fill: isLine ? "transparent" : "#a8b8ff",
      stroke: isLine ? "#171717" : "transparent",
      strokeWidth: 2,
      operation: "none",
      mask: "none",
      enter: "none",
      radius: 0,
      x: isLine ? 16 : isArrow ? 32 : (100 - closedShapeWidth) / 2,
      y: isLine ? 50 : isArrow ? 36 : 30,
      w: isLine ? 68 : isArrow ? 36 : closedShapeWidth,
      h: isLine ? 2.5 : isArrow ? 20 : closedShapeHeight
    }
  } as MotionDocBlock;
}
