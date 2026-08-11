"use client";

import {
  slideTransitionPresets,
  type SlideTransition
} from "@/features/pitch/application/motionPresets";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { applySlideTransitionProps, normalizeSlideMotion } from "@/features/pitch/application/motionModel";
import { Field, NumberInput } from "@/features/pitch/ui/inspector/InspectorControls";
import { AccordionSection } from "@/features/pitch/ui/inspector/controls/AccordionSection";
import { MotionThumbnailGrid } from "@/features/pitch/ui/inspector/controls/MotionThumbnailGrid";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type SlideTransitionSectionProps = {
  duration: number;
  slideTransition: string | number | undefined;
  transitionDuration: string | number | undefined;
  updateActiveSlideStyle: (updates: MotionDocProps) => void;
};

export function SlideTransitionSection({
  duration,
  slideTransition,
  transitionDuration,
  updateActiveSlideStyle
}: SlideTransitionSectionProps) {
  const { tx } = usePitchI18n();
  const selectedTransition = normalizeSlideMotion({ slideTransition, transitionDuration }).slideTransition;
  const localizedTransitionPresets = slideTransitionPresets.map((preset) => ({
    ...preset,
    description: tx(preset.description),
    label: tx(preset.label)
  }));

  function updateTransition(value: SlideTransition) {
    updateActiveSlideStyle(applySlideTransitionProps({ transitionDuration: transitionDuration ?? "" }, value));
  }

  return (
    <AccordionSection title={tx("Slide Animation & Timing")} defaultOpen>
      <Field label={tx("Slide Duration")}>
        <NumberInput
          min="0.5"
          onChange={(value) => updateActiveSlideStyle({ duration: value || 5 })}
          step="0.5"
          suffix="s"
          value={duration}
        />
      </Field>
      <MotionThumbnailGrid
        label={tx("Transition style")}
        onChange={updateTransition}
        options={localizedTransitionPresets}
        value={selectedTransition}
        variant="slide"
      />
      {selectedTransition !== "none" ? (
        <Field label={tx("Transition duration")}>
          <NumberInput
            min="0.1"
            onChange={(value) => updateActiveSlideStyle({ transitionDuration: value === "" ? "" : value })}
            placeholder="0.72"
            step="0.05"
            suffix="s"
            value={transitionDuration ?? ""}
          />
        </Field>
      ) : null}
    </AccordionSection>
  );
}
