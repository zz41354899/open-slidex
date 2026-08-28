
import type { MotionDocProps, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { BackgroundSettingsSection } from "@/features/pitch/ui/inspector/BackgroundSettingsSection";
import { SlideLayoutSection } from "@/features/pitch/ui/inspector/slide/SlideLayoutSection";
import { SlideTransitionSection } from "@/features/pitch/ui/inspector/slide/SlideTransitionSection";

type SlideSettingsProps = {
  activeSlide: MotionDocScene | undefined;
  activeSlideIndex: number;
  accent: string;
  background: string;
  duration: number;
  extendSharedMorphGroup: (endIndex: number) => void;
  isGridVisible: boolean;
  isSafeAreaVisible: boolean;
  isSnapEnabled: boolean;
  mutedColor: string;
  nextSlide: MotionDocScene | undefined;
  scenes: MotionDocScene[];
  setIsGridVisible: (value: boolean) => void;
  setIsSafeAreaVisible: (value: boolean) => void;
  setIsSnapEnabled: (value: boolean) => void;
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
  slideTransition?: string | number;
  transitionDuration?: string | number;
  selectSingleBlock: (index: number | null) => void;
  selectSlide: (index: number) => void;
  setSharedMorphReturnLink: (groupStartIndex: number, detailSlideIndex: number, enabled: boolean) => void;
  updateActiveSlideStyle: (updates: MotionDocProps) => void;
  updateAllSlidesStyle: (updates: MotionDocProps) => void;
  updateSlideStyle: (slideIndex: number, updates: MotionDocProps) => void;
};

export function SlideSettings({
  activeSlide,
  activeSlideIndex,
  accent,
  background,
  duration,
  extendSharedMorphGroup,
  isGridVisible,
  isSafeAreaVisible,
  isSnapEnabled,
  mutedColor,
  nextSlide,
  scenes,
  setIsGridVisible,
  setIsSafeAreaVisible,
  setIsSnapEnabled,
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
  slideTransition,
  transitionDuration,
  selectSingleBlock,
  selectSlide,
  setSharedMorphReturnLink,
  updateActiveSlideStyle,
  updateAllSlidesStyle,
  updateSlideStyle
}: SlideSettingsProps) {
  return (
    <div className="flex flex-col gap-0 animate-[bubble-appear_0.2s_ease-out]">
      <BackgroundSettingsSection
        accent={accent}
        background={background}
        mutedColor={mutedColor}
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
        textColor={textColor}
        theme={theme}
        updateActiveSlideStyle={updateActiveSlideStyle}
        updateAllSlidesStyle={updateAllSlidesStyle}
      />

      <SlideLayoutSection
        isGridVisible={isGridVisible}
        isSafeAreaVisible={isSafeAreaVisible}
        isSnapEnabled={isSnapEnabled}
        setIsGridVisible={setIsGridVisible}
        setIsSafeAreaVisible={setIsSafeAreaVisible}
        setIsSnapEnabled={setIsSnapEnabled}
      />

      <SlideTransitionSection
        activeSlide={activeSlide}
        activeSlideIndex={activeSlideIndex}
        duration={duration}
        extendSharedMorphGroup={extendSharedMorphGroup}
        nextSlide={nextSlide}
        scenes={scenes}
        onSelectBlock={selectSingleBlock}
        onSelectSlide={selectSlide}
        setSharedMorphReturnLink={setSharedMorphReturnLink}
        slideTransition={slideTransition}
        transitionDuration={transitionDuration}
        updateActiveSlideStyle={updateActiveSlideStyle}
        updateSlideStyle={updateSlideStyle}
      />
    </div>
  );
}
