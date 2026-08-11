"use client";

import { TextAreaField, TextInput, type BlockFieldProps } from "@/features/pitch/ui/inspector/InspectorControls";

export function MetricFields({ block, selectedBlockIndex, updateBlock }: BlockFieldProps) {
  return (
    <>
      <TextInput label="Label" placeholder="Metric label" value={block.props.label ?? ""} onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, label: value })} />
      <TextInput label="Value" placeholder="72%" value={block.props.value ?? ""} onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, value })} />
      <TextAreaField label="Caption" placeholder="Short context" rows={3} value={block.props.caption ?? ""} onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, caption: value })} />
    </>
  );
}
