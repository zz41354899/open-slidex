"use client";

import { useState } from "react";
import { Palette, Sparkles } from "lucide-react";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { AccordionSection } from "@/features/pitch/ui/inspector/controls/AccordionSection";
import { IconSegmentedControl } from "@/features/pitch/ui/inspector/InspectorControls";
import { SlideThemeSectionContent } from "@/features/pitch/ui/inspector/slide/SlideThemeSection";
import { ShaderBackgroundSectionContent } from "@/features/pitch/ui/inspector/shader/ShaderBackgroundSection";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type BackgroundSettingsSectionProps = {
  accent: string;
  background: string;
  mutedColor: string;
  shader: string;
  shaderAngle: number;
  shaderColor1: string;
  shaderColor2: string;
  shaderColor3: string;
  shaderColor4: string;
  shaderColor5: string;
  shaderColor6: string;
  shaderDetail: number;
  shaderEngine: string;
  shaderIntensity: number;
  shaderPreset: string;
  shaderScale: number;
  shaderSoftness: number;
  shaderSpeed: number;
  textColor: string;
  theme: string;
  updateActiveSlideStyle: (updates: MotionDocProps) => void;
  updateAllSlidesStyle: (updates: MotionDocProps) => void;
};

export function BackgroundSettingsSection({
  accent,
  background,
  mutedColor,
  shader,
  shaderAngle,
  shaderColor1,
  shaderColor2,
  shaderColor3,
  shaderColor4,
  shaderColor5,
  shaderColor6,
  shaderDetail,
  shaderEngine,
  shaderIntensity,
  shaderPreset,
  shaderScale,
  shaderSoftness,
  shaderSpeed,
  textColor,
  theme,
  updateActiveSlideStyle,
  updateAllSlidesStyle
}: BackgroundSettingsSectionProps) {
  const { tx } = usePitchI18n();
  const [activeTab, setActiveTab] = useState<"standard" | "dynamic">(shader ? "dynamic" : "standard");

  return (
    <AccordionSection title={tx("Background")} defaultOpen>
      <div className="mb-2">
        <IconSegmentedControl
          label={tx("Background Type")}
          onChange={(value) => setActiveTab(value as "standard" | "dynamic")}
          options={[
            { icon: <Palette size={14} />, label: tx("Static"), value: "standard" },
            { icon: <Sparkles size={14} />, label: tx("Dynamic"), value: "dynamic" }
          ]}
          value={activeTab}
        />
      </div>

      {activeTab === "standard" ? (
        <SlideThemeSectionContent
          accent={accent}
          background={background}
          mutedColor={mutedColor}
          textColor={textColor}
          theme={theme}
          updateActiveSlideStyle={updateActiveSlideStyle}
          updateAllSlidesStyle={updateAllSlidesStyle}
        />
      ) : (
        <ShaderBackgroundSectionContent
          accent={accent}
          background={background}
          shader={shader}
          shaderAngle={shaderAngle}
          shaderColor1={shaderColor1}
          shaderColor2={shaderColor2}
          shaderColor3={shaderColor3}
          shaderColor4={shaderColor4}
          shaderColor5={shaderColor5}
          shaderColor6={shaderColor6}
          shaderDetail={shaderDetail}
          shaderEngine={shaderEngine}
          shaderIntensity={shaderIntensity}
          shaderPreset={shaderPreset}
          shaderScale={shaderScale}
          shaderSoftness={shaderSoftness}
          shaderSpeed={shaderSpeed}
          updateActiveSlideStyle={updateActiveSlideStyle}
        />
      )}
    </AccordionSection>
  );
}
