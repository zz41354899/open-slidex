"use client";

import { IconPicker } from "@/features/pitch/ui/IconPicker";
import { OptionButtons, TextAreaField, TextInput, type BlockFieldProps } from "@/features/pitch/ui/inspector/InspectorControls";
import { cardLayoutOptions } from "@/features/pitch/ui/pitchOptions";
import { stringValue } from "@/common/util/valueUtils";

export function CardFields({ block, selectedBlockIndex, updateBlock }: BlockFieldProps) {
  return (
    <>
      <OptionButtons label="Card layout" options={cardLayoutOptions} value={String(block.props.layout ?? "vertical")} onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, layout: value })} />
      <IconPicker value={stringValue(block.props.icon) ?? ""} onChange={(icon) => updateBlock(selectedBlockIndex, { ...block.props, icon })} />
      <TextInput label="Title" placeholder="Card title" value={block.props.title ?? ""} onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, title: value })} />
      <TextAreaField label="Content" placeholder="Card content" rows={4} value={block.props.text ?? ""} onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, text: value })} />
    </>
  );
}
