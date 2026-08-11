"use client";

import { Field, NumberInput, type BlockFieldProps } from "@/features/pitch/ui/inspector/InspectorControls";

// Stack Layout options removed for simplicity

export function StackFields({ block, selectedBlockIndex, updateBlock }: BlockFieldProps) {
  return (
    <>
      <Field label="Gap">
        <NumberInput
          max="80"
          min="0"
          onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, gap: value === "" ? "" : value })}
          placeholder="16"
          step="1"
          suffix="px"
          value={block.props.gap ?? ""}
        />
      </Field>
    </>
  );
}
