import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import {
  motionDocDefaultFontSize,
  motionDocFontPointsToCanvasPixels
} from "@/core/motion-doc/domain/typography";
import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import { blockFrame, isEditableTextBlock, isMovableBlock } from "@/features/pitch/application/previewCanvas";
import type { BlockFrameOverrides } from "@/features/pitch/application/pitchGeometry";

export function selectedCanvasIndices(
  slide: MotionDocScene | undefined,
  selectedBlockIndex: number | null,
  selectedBlockIndices: readonly number[]
) {
  const indices = new Set(selectedBlockIndices);
  if (selectedBlockIndex !== null) indices.add(selectedBlockIndex);

  return [...indices].filter((index) => {
    const block = slide?.blocks[index];
    return block ? isMovableBlock(block) : false;
  });
}

export function combinedSelectionFrame(
  slide: MotionDocScene | undefined,
  indices: readonly number[],
  frameOverrides: BlockFrameOverrides
) {
  const frames = indices.map((index) => {
    const block = slide?.blocks[index];
    return block
      ? frameOverrides.get(motionDocBlockKey(block, index)) ?? blockFrame(block)
      : blockFrame(undefined);
  });
  if (frames.length === 0) return null;

  const left = Math.min(...frames.map((frame) => frame.x));
  const top = Math.min(...frames.map((frame) => frame.y));
  const right = Math.max(...frames.map((frame) => frame.x + frame.w));
  const bottom = Math.max(...frames.map((frame) => frame.y + frame.h));

  return { h: bottom - top, w: right - left, x: left, y: top };
}

export function minimumCanvasFrameSize(block: MotionDocScene["blocks"][number], canvasScale: number) {
  if (isEditableTextBlock(block)) {
    const fontSize = motionDocFontPointsToCanvasPixels(
      numberFromProp(block.props.fontSize) ?? motionDocDefaultFontSize(block.type)
    );
    const lineHeight = numberFromProp(block.props.lineHeight) ?? (block.type === "Title" ? 1.02 : 1.45);

    return {
      height: Math.max(14, Math.round(fontSize * lineHeight * canvasScale)),
      width: Math.max(24, Math.round(fontSize * 1.4 * canvasScale))
    };
  }

  if (block.type === "Shape") return { height: 18, width: 18 };
  return { height: 36, width: 40 };
}

function numberFromProp(value: string | number | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
