import type { ReactNode } from "react";
import {
  Image as ImageIcon,
  Shapes,
  Sparkles,
  Table2,
  Type,
  Video
} from "lucide-react";
import type { AddBlockType } from "@/core/motion-doc/application/motionDocBlockFactory";

export type { AddBlockType };

export type PitchToolGroupId = "icon" | "media" | "shape" | "table" | "text";

export type PitchBlockTool = {
  description?: string;
  icon: ReactNode;
  label: string;
  shortcut?: string;
  type: AddBlockType;
};

export type PitchToolGroup = {
  id: PitchToolGroupId;
  icon: ReactNode;
  label: string;
  modal?: boolean;
  tools: PitchBlockTool[];
};

export const textPresetTools = [
  { description: "Text layer with role and size controls in Properties", icon: <Type size={16} />, label: "Text", type: "Text" }
] satisfies PitchBlockTool[];

export const mediaTools = [
  { icon: <ImageIcon size={16} />, label: "Image", type: "Image" },
  { icon: <Video size={16} />, label: "Video", type: "Video" }
] satisfies PitchBlockTool[];

export const tableTools = [
  { description: "Editable grid with row and column controls", icon: <Table2 size={16} />, label: "Table", type: "Table" }
] satisfies PitchBlockTool[];

export const shapeTools = [
  { description: "Shapes, lines, labels, and process blocks", icon: <Shapes size={16} />, label: "Shape", type: "ShapeRectangle" }
] satisfies PitchBlockTool[];

export const iconTool: PitchBlockTool = {
  description: "Lucide symbol layer",
  icon: <Sparkles size={16} />,
  label: "Icon",
  type: "Icon"
};

export const toolGroups: PitchToolGroup[] = [
  { icon: <Type size={17} />, id: "text", label: "Text", tools: textPresetTools },
  { icon: <ImageIcon size={17} />, id: "media", label: "Media", tools: mediaTools },
  { icon: <Shapes size={17} />, id: "shape", label: "Shape", modal: true, tools: shapeTools },
  { icon: <Table2 size={17} />, id: "table", label: "Table", tools: tableTools },
  { icon: <Sparkles size={17} />, id: "icon", label: "Icon", tools: [iconTool] }
];

export const blockTools: PitchBlockTool[] = [
  ...textPresetTools,
  ...mediaTools,
  ...shapeTools,
  ...tableTools,
  iconTool
];

export const imageFitOptions = ["cover", "contain", "fill", "scale-down"] as const;

export const imageModeOptions = [
  { label: "Contained", value: "false" },
  { label: "Full slide", value: "true" }
] as const;

export const cardLayoutOptions = [
  { label: "Vertical", value: "vertical" },
  { label: "Horizontal", value: "horizontal" }
] as const;
