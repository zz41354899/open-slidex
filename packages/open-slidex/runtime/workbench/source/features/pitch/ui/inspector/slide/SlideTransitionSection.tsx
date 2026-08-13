
import {
  slideTransitionPresets,
  type SlideTransition
} from "@/features/pitch/application/motionPresets";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { applySlideTransitionProps, normalizeSlideMotion } from "@/features/pitch/application/motionModel";
import { Field, NumberInput } from "@/features/pitch/ui/inspector/InspectorControls";
import { AccordionSection } from "@/features/pitch/ui/inspector/controls/AccordionSection";
import { MotionThumbnailGrid } from "@/features/pitch/ui/inspector/controls/MotionThumbnailGrid";

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
  const selectedTransition = normalizeSlideMotion({ slideTransition, transitionDuration }).slideTransition;
  function updateTransition(value: SlideTransition) {
    updateActiveSlideStyle(applySlideTransitionProps({ transitionDuration: transitionDuration ?? "" }, value));
  }

  return (
    <AccordionSection title="Slide Animation & Timing" defaultOpen>
      <Field label="Slide Duration">
        <NumberInput
          min="0.5"
          onChange={(value) => updateActiveSlideStyle({ duration: value || 5 })}
          step="0.5"
          suffix="s"
          value={duration}
        />
      </Field>
      <MotionThumbnailGrid
        label="Transition style"
        onChange={updateTransition}
        options={slideTransitionPresets}
        value={selectedTransition}
        variant="slide"
      />
      {selectedTransition !== "none" ? (
        <Field label="Transition duration">
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
