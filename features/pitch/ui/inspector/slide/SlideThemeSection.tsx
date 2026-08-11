"use client";

import { Palette } from "lucide-react";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { solidFillUpdates } from "@/features/pitch/application/themeColors";
import { SolidFillControl } from "@/features/pitch/ui/inspector/InspectorControls";
import { AccordionSection } from "@/features/pitch/ui/inspector/controls/AccordionSection";

type SlideThemeSectionProps = {
  accent: string;
  background: string;
  mutedColor: string;
  textColor: string;
  theme: string;
  updateActiveSlideStyle: (updates: MotionDocProps) => void;
  updateAllSlidesStyle: (updates: MotionDocProps) => void;
};

export function SlideThemeSection(props: SlideThemeSectionProps) {
  return (
    <AccordionSection title="Solid Fill" icon={<Palette size={13} className="text-neutral-400" />} defaultOpen>
      <SlideThemeSectionContent {...props} />
    </AccordionSection>
  );
}

export function SlideThemeSectionContent({
  background,
  updateActiveSlideStyle
}: SlideThemeSectionProps) {
  return (
    <SolidFillControl
      onChange={(color) => updateActiveSlideStyle(solidFillUpdates(color))}
      value={background}
    />
  );
}
