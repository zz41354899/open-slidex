
import type { CSSProperties, ReactNode } from "react";
import { motion } from "framer-motion";
import { resolveSlideThemeColors, slideCanvasBackground } from "@/core/motion-doc/application/slideTheme";
import { normalizeSlideMotion } from "@/features/pitch/application/motionModel";
import { ThreeShaderCanvas } from "@/features/pitch/ui/preview/ThreeShaderCanvas";
import { usePreviewMediaSource } from "@/features/pitch/ui/preview/PreviewMediaPolicy";
import { alignXToFlex, alignYToFlex } from "@/features/pitch/ui/preview/motion/blockStyles";
import { slideMotionProps } from "@/features/pitch/ui/preview/motion/framerMotionProps";

type SceneProps = {
  accent?: string;
  alignX?: "left" | "center" | "right" | "stretch";
  alignY?: "top" | "center" | "bottom";
  allowOverflow?: boolean;
  autoHeight?: boolean;
  background?: string;
  backgroundFit?: string;
  backgroundImage?: string;
  children: ReactNode;
  duration: number;
  freeform?: boolean;
  layout?: "default" | "split-left" | "split-right";
  mutedColor?: string;
  onShaderFrameCapture?: (frame: number) => void;
  shader?: string;
  shaderAngle?: number;
  shaderColor1?: string;
  shaderColor2?: string;
  shaderColor3?: string;
  shaderColor4?: string;
  shaderColor5?: string;
  shaderColor6?: string;
  shaderDetail?: number;
  shaderEngine?: string;
  shaderFrame?: number;
  shaderIntensity?: number;
  shaderMaxPixelCount?: number;
  shaderMinPixelRatio?: number;
  shaderPlaybackActive?: boolean;
  shaderPreset?: string;
  shaderScale?: number;
  shaderSoftness?: number;
  shaderSpeed?: number;
  slideTransition?: string;
  textAlign?: "left" | "center" | "right";
  textColor?: string;
  theme?: string;
  transitionDuration?: number;
};

export function Scene({
  accent = "#7c3aed",
  alignX = "left",
  alignY = "center",
  allowOverflow = false,
  autoHeight = false,
  background,
  backgroundFit,
  backgroundImage,
  children,
  duration,
  freeform = false,
  layout = "default",
  mutedColor,
  onShaderFrameCapture,
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
  shaderFrame,
  shaderIntensity,
  shaderMaxPixelCount,
  shaderMinPixelRatio,
  shaderPlaybackActive = true,
  shaderPreset,
  shaderScale,
  shaderSoftness,
  shaderSpeed,
  slideTransition,
  textAlign = "left",
  textColor,
  theme = "dark",
  transitionDuration
}: SceneProps) {
  const localBackgroundImage = usePreviewMediaSource(backgroundImage);
  const slideMotion = normalizeSlideMotion({ slideTransition, transitionDuration });
  const themeColors = resolveSlideThemeColors(
    {
      accent,
      background,
      mutedColor,
      shader,
      shaderColor1,
      shaderColor2,
      shaderColor3,
      shaderColor4,
      shaderColor5,
      shaderColor6,
      shaderEngine,
      shaderIntensity,
      textColor,
      theme
    },
    { accentFallback: accent }
  );

  return (
    <motion.section
      data-duration={duration}
      data-motion-scene
      data-theme-tone={themeColors.tone}
      style={
        {
          "--slide-accent": themeColors.accent,
          "--slide-bg": themeColors.background,
          "--slide-border": themeColors.borderColor,
          "--slide-card": themeColors.cardBackground,
          "--slide-fg": themeColors.foreground,
          "--slide-muted": themeColors.muted,
          "--slide-text-align": textAlign,
          background: slideCanvasBackground(themeColors),
          borderRadius: 0,
          display: "flex",
          flexDirection: "column",
          height: autoHeight ? "auto" : undefined,
          inset: autoHeight ? undefined : 0,
          minHeight: autoHeight ? "100%" : undefined,
          overflow: allowOverflow ? "visible" : "hidden",
          padding: freeform ? 0 : "clamp(16px, 3%, 32px)",
          position: autoHeight ? "relative" : "absolute"
        } as CSSProperties
      }
      {...slideMotionProps({
        duration: slideMotion.duration,
        slideTransition: slideMotion.slideTransition
      })}
    >
      {localBackgroundImage ? (
        <div
          aria-hidden="true"
          style={{
            backgroundImage: cssImageUrl(localBackgroundImage),
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundSize: backgroundSizeFromFit(backgroundFit),
            inset: 0,
            pointerEvents: "none",
            position: "absolute",
            zIndex: 0
          }}
        />
      ) : null}
      {shader ? (
        <ThreeShaderCanvas
          color1={themeColors.shaderColor1}
          color2={themeColors.shaderColor2}
          color3={themeColors.shaderColor3}
          color4={themeColors.shaderColor4}
          color5={themeColors.shaderColor5}
          color6={themeColors.shaderColor6}
          detail={shaderDetail ?? 0.5}
          frame={shaderFrame ?? 0}
          intensity={shaderIntensity ?? 0.5}
          maxPixelCount={shaderMaxPixelCount}
          minPixelRatio={shaderMinPixelRatio}
          onFrameCapture={onShaderFrameCapture}
          playbackActive={shaderPlaybackActive}
          presetId={shader}
          shaderPreset={shaderPreset}
          scale={shaderScale ?? 0.5}
          softness={shaderSoftness ?? 0.5}
          speed={shaderSpeed ?? 1}
          angle={shaderAngle ?? 0}
          style={{ borderRadius: 0, inset: 0, position: "absolute", zIndex: 0 }}
        />
      ) : null}
      {shader ? (
        <div
          style={{
            background: `radial-gradient(circle at 20% 10%, ${themeColors.accent}38, transparent 28rem), radial-gradient(circle at 90% 70%, ${themeColors.accent}24, transparent 24rem)`,
            inset: 0,
            opacity: 0.3,
            pointerEvents: "none",
            position: "absolute"
          }}
        />
      ) : null}
      <div
        style={{
          alignItems: layout === "default" ? alignXToFlex(alignX) : "stretch",
          display: "flex",
          flex: autoHeight ? "0 0 auto" : 1,
          flexDirection: layout === "default" ? "column" : "row",
          gap: layout === "default" ? 20 : 48,
          height: freeform ? "100%" : undefined,
          justifyContent: alignYToFlex(alignY),
          minHeight: autoHeight ? "calc(100% - clamp(32px, 6%, 64px))" : 0,
          overflow: "visible",
          position: "relative",
          textAlign,
          width: "100%",
          zIndex: 10
        }}
      >
        {children}
      </div>
    </motion.section>
  );
}

function backgroundSizeFromFit(value: string | undefined): CSSProperties["backgroundSize"] {
  if (value === "contain" || value === "scale-down") {
    return "contain";
  }

  if (value === "fill") {
    return "100% 100%";
  }

  return "cover";
}

function cssImageUrl(value: string) {
  return `url("${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}
