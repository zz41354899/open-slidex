import { getSlideTitle } from "@/core/motion-doc/application/motionDocSerialize";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";

export type SlideRow = {
  duration: number;
  index: number;
  layers: number;
  title: string;
};

export function buildSlideRows(scenes: readonly MotionDocScene[]): SlideRow[] {
  return scenes.map((slide, index) => ({
    duration: slide.duration,
    index,
    layers: slide.blocks.length,
    title: getSlideTitle(slide.blocks, index)
  }));
}
