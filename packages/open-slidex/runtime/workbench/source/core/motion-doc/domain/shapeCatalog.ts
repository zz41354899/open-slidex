import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";

export const shapeCategories = ["essential", "lines", "process"] as const;

export type ShapeCategory = (typeof shapeCategories)[number];

export type ShapePreset = {
  category: ShapeCategory;
  id: string;
  label: string;
  props: MotionDocProps;
};

export const shapeCategoryLabels: Record<ShapeCategory, string> = {
  essential: "Essential",
  lines: "Lines",
  process: "Process and flow"
};

const solid = { fill: "#a8b8ff", stroke: "rgba(255,255,255,0.24)", strokeWidth: 1 };
const outline = { fill: "transparent", stroke: "#e4e4e7", strokeWidth: 1.5 };
const line = { fill: "transparent", h: 2.5, stroke: "#e4e4e7", strokeWidth: 2.25, w: 68, x: 16, y: 49 };

export const shapePresets = [
  { category: "essential", id: "rectangle", label: "Soft rectangle", props: { ...solid, shape: "rectangle", radius: 14 } },
  { category: "essential", id: "circle", label: "Circle", props: { ...solid, shape: "circle" } },
  { category: "essential", id: "triangle", label: "Triangle", props: { ...solid, shape: "triangle" } },
  { category: "essential", id: "diamond", label: "Diamond", props: { ...solid, shape: "diamond" } },
  { category: "essential", id: "star", label: "Star", props: { ...solid, points: 5, shape: "star" } },
  { category: "essential", id: "outline-rectangle", label: "Outline rectangle", props: { ...outline, shape: "rectangle", radius: 14 } },
  { category: "essential", id: "outline-circle", label: "Outline circle", props: { ...outline, shape: "circle" } },
  { category: "essential", id: "outline-triangle", label: "Outline triangle", props: { ...outline, shape: "triangle" } },
  { category: "essential", id: "outline-diamond", label: "Outline diamond", props: { ...outline, shape: "diamond" } },
  { category: "essential", id: "outline-star", label: "Outline star", props: { ...outline, points: 5, shape: "star" } },
  { category: "lines", id: "line", label: "Line", props: { ...line, shape: "line" } },
  { category: "lines", id: "arrow-end", label: "Arrow", props: { ...line, arrowEnd: "arrow", shape: "line" } },
  { category: "lines", id: "arrow-both", label: "Double arrow", props: { ...line, arrowEnd: "arrow", arrowStart: "arrow", shape: "line" } },
  { category: "lines", id: "circle-arrow", label: "Circle arrow", props: { ...line, arrowEnd: "arrow", arrowStart: "circle", shape: "line" } },
  { category: "lines", id: "bar-arrow", label: "Bar arrow", props: { ...line, arrowEnd: "arrow", arrowStart: "bar", shape: "line" } },
  { category: "lines", id: "dash", label: "Dashed line", props: { ...line, lineStyle: "dashed", shape: "line" } },
  { category: "lines", id: "dash-arrow", label: "Dashed arrow", props: { ...line, arrowEnd: "arrow", lineStyle: "dashed", shape: "line" } },
  { category: "lines", id: "dash-arrow-both", label: "Dashed double arrow", props: { ...line, arrowEnd: "arrow", arrowStart: "arrow", lineStyle: "dashed", shape: "line" } },
  { category: "lines", id: "dash-circle-arrow", label: "Dashed circle arrow", props: { ...line, arrowEnd: "arrow", arrowStart: "circle", lineStyle: "dashed", shape: "line" } },
  { category: "lines", id: "dash-bar-arrow", label: "Dashed bar arrow", props: { ...line, arrowEnd: "arrow", arrowStart: "bar", lineStyle: "dashed", shape: "line" } },
  { category: "lines", id: "dot", label: "Dotted line", props: { ...line, lineStyle: "dotted", shape: "line" } },
  { category: "lines", id: "dot-arrow", label: "Dotted arrow", props: { ...line, arrowEnd: "arrow", lineStyle: "dotted", shape: "line" } },
  { category: "lines", id: "dot-arrow-both", label: "Dotted double arrow", props: { ...line, arrowEnd: "arrow", arrowStart: "arrow", lineStyle: "dotted", shape: "line" } },
  { category: "lines", id: "dot-circle-arrow", label: "Dotted circle arrow", props: { ...line, arrowEnd: "arrow", arrowStart: "circle", lineStyle: "dotted", shape: "line" } },
  { category: "lines", id: "dot-bar-arrow", label: "Dotted bar arrow", props: { ...line, arrowEnd: "arrow", arrowStart: "bar", lineStyle: "dotted", shape: "line" } },
  { category: "process", id: "arrow", label: "Flow arrow", props: { ...solid, shape: "arrow" } },
  { category: "process", id: "chevron", label: "Chevron", props: { ...solid, shape: "chevron" } },
  { category: "process", id: "hexagon", label: "Hexagon", props: { ...solid, shape: "hexagon" } },
  { category: "process", id: "parallelogram", label: "Parallelogram", props: { ...solid, shape: "parallelogram" } },
  { category: "process", id: "outline-arrow", label: "Outline arrow", props: { ...outline, shape: "arrow" } },
  { category: "process", id: "outline-chevron", label: "Outline chevron", props: { ...outline, shape: "chevron" } },
  { category: "process", id: "outline-hexagon", label: "Outline hexagon", props: { ...outline, shape: "hexagon" } },
  { category: "process", id: "outline-parallelogram", label: "Outline parallelogram", props: { ...outline, shape: "parallelogram" } }
] as const satisfies readonly ShapePreset[];

export function shapePreset(id: string) {
  return shapePresets.find((preset) => preset.id === id) ?? shapePresets[0];
}
