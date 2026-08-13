import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import { updateMotionDocBlock } from "@/core/motion-doc/application/motionDocAutomation";
import { motionDocBlockFrame, type MotionDocFramePatch } from "@/core/motion-doc/domain/frame";
import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import type { MotionDocBlock } from "@/core/motion-doc/domain/motionDocTypes";
import {
  MOTION_DOC_CANVAS_HEIGHT,
  MOTION_DOC_CANVAS_WIDTH
} from "@/core/motion-doc/domain/viewport";

const coordinatePrecision = 3;

export function getMotionDocCanvasNodes(source: string, requestedSlideIndex?: number) {
  const document = parseMotionDoc(source);
  const slides = document.scenes.flatMap((slide, slideIndex) => {
    if (requestedSlideIndex !== undefined && requestedSlideIndex !== slideIndex) return [];

    return [{
      background: slide.props.background,
      nodes: slide.blocks.map((block, blockIndex) => formatCanvasNode(block, blockIndex)),
      slideIndex,
      theme: slide.props.theme
    }];
  });

  if (requestedSlideIndex !== undefined && slides.length === 0) {
    throw new Error(`slideIndex ${requestedSlideIndex} is outside the slide range.`);
  }

  return {
    canvas: {
      coordinateSystem: "percent",
      height: MOTION_DOC_CANVAS_HEIGHT,
      precision: coordinatePrecision,
      width: MOTION_DOC_CANVAS_WIDTH
    },
    slides
  };
}

export function updateMotionDocCanvasNodeFrame(
  source: string,
  slideIndex: number,
  nodeId: string,
  framePatch: MotionDocFramePatch
) {
  const document = parseMotionDoc(source);
  const slide = document.scenes[slideIndex];
  if (!slide) throw new Error(`slideIndex ${slideIndex} is outside the slide range.`);

  const blockIndex = slide.blocks.findIndex(
    (block, index) => motionDocBlockKey(block, index) === nodeId
  );
  const block = slide.blocks[blockIndex];
  if (!block || !("props" in block)) {
    throw new Error(`Canvas node ${nodeId} is not editable on slide ${slideIndex}.`);
  }

  const currentFrame = motionDocBlockFrame(block);
  const nextFrame = {
    h: framePatch.h ?? currentFrame.h,
    w: framePatch.w ?? currentFrame.w,
    x: framePatch.x ?? currentFrame.x,
    y: framePatch.y ?? currentFrame.y
  };
  assertCanvasFrame(nextFrame);

  const updated = updateMotionDocBlock(source, slideIndex, blockIndex, {
    props: roundFrame(nextFrame)
  });

  return {
    ...updated,
    node: formatCanvasNode(
      parseMotionDoc(updated.source).scenes[slideIndex]?.blocks[blockIndex] ?? block,
      blockIndex
    )
  };
}

function formatCanvasNode(block: MotionDocBlock, blockIndex: number) {
  const framePercent = roundFrame(motionDocBlockFrame(block));
  return {
    blockIndex,
    editableFrame: "props" in block,
    framePercent,
    framePixels: {
      h: round(framePercent.h / 100 * MOTION_DOC_CANVAS_HEIGHT),
      w: round(framePercent.w / 100 * MOTION_DOC_CANVAS_WIDTH),
      x: round(framePercent.x / 100 * MOTION_DOC_CANVAS_WIDTH),
      y: round(framePercent.y / 100 * MOTION_DOC_CANVAS_HEIGHT)
    },
    nodeId: motionDocBlockKey(block, blockIndex),
    text: "text" in block ? block.text.slice(0, 160) : undefined,
    type: block.type
  };
}

function assertCanvasFrame(frame: { h: number; w: number; x: number; y: number }) {
  for (const [field, value] of Object.entries(frame)) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`${field} must be a finite percentage from 0 to 100.`);
    }
  }
  if (frame.w <= 0 || frame.h <= 0) throw new Error("Canvas node width and height must be positive.");
  if (frame.x + frame.w > 100 || frame.y + frame.h > 100) {
    throw new Error("Canvas node frame must stay inside the slide bounds.");
  }
}

function roundFrame(frame: { h: number; w: number; x: number; y: number }) {
  return {
    h: round(frame.h),
    w: round(frame.w),
    x: round(frame.x),
    y: round(frame.y)
  };
}

function round(value: number) {
  const scale = 10 ** coordinatePrecision;
  return Math.round(value * scale) / scale;
}
