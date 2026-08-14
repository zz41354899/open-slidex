import type { MotionDocBlock, MotionDocBlockType, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";

export type SelectedBlockColorItem = {
  blockIndex: number;
  color: string;
  generatedIndex?: number;
  generatedType?: MotionDocBlockType;
  label: string;
};

export function selectedBlockColorItems(
  slide: MotionDocScene | undefined,
  blockIndices: readonly number[]
): SelectedBlockColorItem[] {
  if (!slide) return [];
  return blockIndices.flatMap((blockIndex) => {
    const block = slide.blocks[blockIndex];
    if (!block) return [];
    const key = primaryColorKey(block);
    if (!key) return [];
    const value = block.props[key] ?? inheritedColor(slide, block, key);
    if (typeof value !== "string" || !value.trim()) return [];
    return [{
      blockIndex,
      color: value.trim(),
      ...blockColorLabel(block, blockIndex)
    }];
  });
}

export function updateSelectedBlockColor(
  slide: MotionDocScene,
  blockIndex: number,
  color: string
) {
  const block = slide.blocks[blockIndex];
  if (!block) return { didUpdate: false, slide };
  const key = primaryColorKey(block);
  if (!key || block.props[key] === color) return { didUpdate: false, slide };
  const blocks = [...slide.blocks];
  blocks[blockIndex] = { ...block, props: { ...block.props, [key]: color } } as MotionDocBlock;
  return { didUpdate: true, slide: { ...slide, blocks } };
}

function primaryColorKey(block: MotionDocBlock): "background" | "color" | "fill" | "stroke" | null {
  if (block.type === "Shape") return block.props.shape === "line" ? "stroke" : "fill";
  if (block.type === "Text" || block.type === "heading" || block.type === "Chart") return "color";
  if (block.type === "Table") return "background";
  return null;
}

function blockColorLabel(block: MotionDocBlock, blockIndex: number) {
  const layerName = typeof block.props.layerName === "string" ? block.props.layerName.trim() : "";
  if (layerName) return { label: layerName };
  const text = "text" in block ? block.text.trim().replace(/\s+/g, " ") : "";
  if (text) return { label: text.length > 24 ? `${text.slice(0, 24)}…` : text };
  return {
    generatedIndex: blockIndex + 1,
    generatedType: block.type,
    label: block.type
  };
}

function inheritedColor(slide: MotionDocScene, block: MotionDocBlock, key: string) {
  if (key === "background") return slide.props.background ?? "#111111";
  if (key === "fill") return "#a8b8ff";
  if (key === "stroke") return "#171717";
  if (block.type === "Chart") return slide.props.accent ?? "#8ea5ff";
  return slide.props.textColor ?? slide.props.foreground ?? slide.props.color ?? "#ffffff";
}
