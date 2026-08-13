
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { solidFillUpdates } from "@/features/pitch/application/themeColors";
import { SolidFillControl } from "@/features/pitch/ui/inspector/InspectorControls";

type SlideThemeSectionProps = {
  accent: string;
  background: string;
  mutedColor: string;
  textColor: string;
  theme: string;
  updateActiveSlideStyle: (updates: MotionDocProps) => void;
  updateAllSlidesStyle: (updates: MotionDocProps) => void;
};

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
