"use client";

import { stringValue } from "@/common/util/valueUtils";
import { iconFrameForSize } from "@/core/motion-doc/domain/iconSizing";
import { IconPicker } from "@/features/pitch/ui/IconPicker";
import { ColorControl, Field, NumberInput, type BlockFieldProps } from "@/features/pitch/ui/inspector/InspectorControls";

export function IconFields({ block, selectedBlockIndex, updateBlock }: BlockFieldProps) {
  return (
    <div className="flex flex-col gap-4">
      <IconPicker value={stringValue(block.props.icon) ?? ""} onChange={(icon) => updateBlock(selectedBlockIndex, { ...block.props, icon })} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Size">
          <NumberInput max="640" min="40" onChange={(value) => updateBlock(selectedBlockIndex, value === "" ? { ...block.props, size: "" } : iconFrameForSize(block.props, value))} placeholder="112" step="4" suffix="px" value={block.props.size ?? ""} />
        </Field>
        <Field label="Stroke">
          <NumberInput max="6" min="0.5" onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, strokeWidth: value === "" ? "" : value })} placeholder="2" step="0.25" value={block.props.strokeWidth ?? ""} />
        </Field>
      </div>
      <ColorControl label="Color" placeholder="#ffffff" value={block.props.color ?? ""} onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, color: value })} />
    </div>
  );
}
