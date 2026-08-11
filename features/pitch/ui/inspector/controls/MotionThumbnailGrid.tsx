"use client";

import type { SVGProps } from "react";
import type { MotionPreset } from "@/features/pitch/application/motionPresets";
import { Field } from "@/features/pitch/ui/inspector/InspectorControls";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type MotionThumbnailGridProps<TValue extends string> = {
  label: string;
  onChange: (value: TValue) => void;
  options: ReadonlyArray<MotionPreset<TValue>>;
  value: TValue;
  variant?: "element" | "slide";
};

export function MotionThumbnailGrid<TValue extends string>({
  label,
  onChange,
  options,
  value,
  variant = "element"
}: MotionThumbnailGridProps<TValue>) {
  const { locale, tx } = usePitchI18n();
  return (
    <Field label={label}>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isSelected = value === option.value;
          const optionLabel = locale === "zh-TW" && option.value === "slideLeft"
            ? "滑入"
            : tx(option.label);
          const optionDescription = tx(option.description);

          return (
            <button
              aria-pressed={isSelected}
              className={`group relative min-h-[74px] overflow-hidden rounded-xl border p-2.5 text-left transition-all duration-300 active:scale-[0.98] ${
                isSelected
                  ? "border-white/[0.3] bg-white/[0.04] text-white shadow-[0_4px_16px_rgba(0,0,0,0.2)] ring-1 ring-white/[0.3]"
                  : "border-white/[0.06] bg-transparent text-neutral-400 hover:border-white/[0.15] hover:bg-white/[0.02] hover:text-neutral-200"
              }`}
              key={option.value}
              onClick={() => onChange(option.value)}
              title={`${optionLabel}: ${optionDescription}`}
              type="button"
            >
              <span className="relative z-10 flex h-full flex-col justify-between gap-3">
                <MotionPreview active={isSelected} value={option.value} variant={variant} />
                <span className="flex min-w-0 flex-col gap-0.5 px-0.5">
                  <span className="truncate text-[11px] font-semibold leading-none">{optionLabel}</span>
                  <span className="truncate text-[9.5px] font-medium leading-none text-neutral-500 group-hover:text-neutral-400">
                    {optionDescription}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Field>
  );
}

function MotionPreview({
  active,
  value,
  variant
}: {
  active: boolean;
  value: string;
  variant: "element" | "slide";
}) {
  return (
    <span className="relative flex h-10 w-full items-center justify-center overflow-hidden rounded-[6px] border border-white/[0.04] bg-[#050505] shadow-inner">
      <span className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:6px_6px]" />

      {variant === "slide" ? (
        <SlideMotionSvg active={active} type={value} />
      ) : (
        <ElementMotionSvg active={active} type={value} />
      )}
    </span>
  );
}

function SlideA(props: SVGProps<SVGRectElement>) {
  return <rect fill="url(#slideDark)" height="22" rx="2" stroke="rgba(255,255,255,0.15)" strokeWidth="1" width="38" x="11" y="4" {...props} />;
}

function SlideB(props: SVGProps<SVGGElement>) {
  return (
    <g {...props}>
      <rect fill="url(#slideGrad)" height="22" rx="2" stroke="rgba(255,255,255,0.25)" strokeWidth="1" width="38" x="11" y="4" />
      <rect fill="rgba(255,255,255,0.8)" height="2" rx="1" width="10" x="15" y="10" />
      <rect fill="rgba(255,255,255,0.3)" height="2" rx="1" width="20" x="15" y="14" />
      <rect fill="rgba(255,255,255,0.3)" height="2" rx="1" width="16" x="15" y="18" />
    </g>
  );
}

function BackgroundUI() {
  return (
    <g>
      <rect fill="rgba(255,255,255,0.2)" height="3" rx="1.5" width="12" x="18" y="8" />
      <rect fill="rgba(255,255,255,0.06)" height="2" rx="1" width="24" x="18" y="14" />
      <rect fill="rgba(255,255,255,0.06)" height="2" rx="1" width="16" x="18" y="18" />
    </g>
  );
}

function AnimElement(props: SVGProps<SVGRectElement>) {
  return <rect fill="url(#elGrad)" height="5" rx="2" stroke="rgba(255,255,255,0.25)" strokeWidth="1" width="24" x="18" y="13" {...props} />;
}

function SlideMotionSvg({ active, type }: { active: boolean; type: string }) {
  const duration = "2s";
  const getAnim = (name: string) => (active ? `${name} ${duration} cubic-bezier(0.4, 0, 0.2, 1) infinite` : "none");

  const defs = (
    <defs>
      <linearGradient id="slideGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="rgba(99, 102, 241, 0.5)" />
        <stop offset="100%" stopColor="rgba(168, 85, 247, 0.5)" />
      </linearGradient>
      <linearGradient id="slideDark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="rgba(255, 255, 255, 0.12)" />
        <stop offset="100%" stopColor="rgba(255, 255, 255, 0.03)" />
      </linearGradient>
      <clipPath id="wipeClip">
        <rect height="22" style={{ animation: getAnim("svg-wipe-mask") }} width="0" x="11" y="4" />
      </clipPath>
    </defs>
  );

  const styles = (
    <style>{`
      @keyframes svg-fade-out { 0%, 20% { opacity: 1; } 40%, 80% { opacity: 0; } 100% { opacity: 1; } }
      @keyframes svg-fade-in { 0%, 20% { opacity: 0; } 40%, 80% { opacity: 1; } 100% { opacity: 0; } }
      @keyframes svg-push-a { 0%, 20% { transform: translateX(0); } 40%, 80% { transform: translateX(-45px); } 100% { transform: translateX(0); } }
      @keyframes svg-push-b { 0%, 20% { transform: translateX(45px); } 40%, 80% { transform: translateX(0); } 100% { transform: translateX(45px); } }
      @keyframes svg-rise-a { 0%, 20% { opacity: 1; transform: scale(1); } 40%, 80% { opacity: 0.5; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes svg-rise-b { 0%, 20% { transform: translateY(35px); opacity: 0; } 40%, 80% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(35px); opacity: 0; } }
      @keyframes svg-scale-a { 0%, 20% { transform: scale(1); opacity: 1; } 40%, 80% { transform: scale(1.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      @keyframes svg-scale-b { 0%, 20% { transform: scale(0.5); opacity: 0; } 40%, 80% { transform: scale(1); opacity: 1; } 100% { transform: scale(0.5); opacity: 0; } }
      @keyframes svg-wipe-mask { 0%, 20% { width: 0; } 40%, 80% { width: 38px; } 100% { width: 0; } }
      @keyframes svg-curtain-l { 0%, 20% { transform: translateX(0); } 40%, 80% { transform: translateX(-20px); opacity: 0; } 100% { transform: translateX(0); opacity: 1;} }
      @keyframes svg-curtain-r { 0%, 20% { transform: translateX(0); } 40%, 80% { transform: translateX(20px); opacity: 0; } 100% { transform: translateX(0); opacity: 1;} }
    `}</style>
  );

  switch (type) {
    case "none":
      return (
        <svg className="h-full w-full overflow-visible" viewBox="0 0 60 30">
          {defs}
          <SlideB />
        </svg>
      );
    case "fade":
      return (
        <svg className="h-full w-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <SlideA style={{ animation: getAnim("svg-fade-out") }} />
          <SlideB style={{ animation: getAnim("svg-fade-in") }} />
        </svg>
      );
    case "pushLeft":
      return (
        <svg className="h-full w-full overflow-hidden rounded-[6px]" viewBox="0 0 60 30">
          {defs}{styles}
          <SlideA style={{ animation: getAnim("svg-push-a") }} />
          <SlideB style={{ animation: getAnim("svg-push-b") }} />
        </svg>
      );
    case "rise":
      return (
        <svg className="h-full w-full overflow-hidden rounded-[6px]" style={{ transformOrigin: "center" }} viewBox="0 0 60 30">
          {defs}{styles}
          <SlideA style={{ animation: getAnim("svg-rise-a"), transformOrigin: "center" }} />
          <SlideB style={{ animation: getAnim("svg-rise-b") }} />
        </svg>
      );
    case "scale":
      return (
        <svg className="h-full w-full overflow-hidden rounded-[6px]" style={{ transformOrigin: "center" }} viewBox="0 0 60 30">
          {defs}{styles}
          <SlideA style={{ animation: getAnim("svg-scale-a"), transformOrigin: "center" }} />
          <SlideB style={{ animation: getAnim("svg-scale-b"), transformOrigin: "center" }} />
        </svg>
      );
    case "wipe":
      return (
        <svg className="h-full w-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <SlideA />
          <g style={{ clipPath: "url(#wipeClip)" }}>
            <SlideB />
          </g>
        </svg>
      );
    case "curtain":
      return (
        <svg className="h-full w-full overflow-hidden rounded-[6px]" viewBox="0 0 60 30">
          {defs}{styles}
          <SlideB />
          <svg height="30" style={{ animation: getAnim("svg-curtain-l"), overflow: "hidden" }} width="30" x="0" y="0">
             <SlideA />
          </svg>
          <svg height="30" style={{ animation: getAnim("svg-curtain-r"), overflow: "hidden" }} width="30" x="30" y="0">
             <SlideA transform="translate(-30, 0)" />
          </svg>
        </svg>
      );
    default:
      return null;
  }
}

function ElementMotionSvg({ active, type }: { active: boolean; type: string }) {
  const duration = "2s";
  const getAnim = (name: string) => (active ? `${name} ${duration} cubic-bezier(0.4, 0, 0.2, 1) infinite` : "none");

  const defs = (
    <defs>
      <linearGradient id="elGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="rgba(99, 102, 241, 0.7)" />
        <stop offset="100%" stopColor="rgba(168, 85, 247, 0.7)" />
      </linearGradient>
      <clipPath id="elWipeClip">
        <rect height="8" style={{ animation: getAnim("svg-el-reveal-mask") }} width="0" x="18" y="14" />
      </clipPath>
    </defs>
  );

  const styles = (
    <style>{`
      @keyframes svg-el-fade { 0%, 20% { opacity: 0; } 40%, 80% { opacity: 1; } 100% { opacity: 0; } }
      @keyframes svg-el-fadeup { 0%, 20% { opacity: 0; transform: translateY(10px); } 40%, 80% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(10px); } }
      @keyframes svg-el-zoomin { 0%, 20% { opacity: 0; transform: scale(0.5); } 40%, 80% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(0.5); } }
      @keyframes svg-el-slideleft { 0%, 20% { opacity: 0; transform: translateX(15px); } 40%, 80% { opacity: 1; transform: translateX(0); } 100% { opacity: 0; transform: translateX(15px); } }
      @keyframes svg-el-rise { 0%, 20% { opacity: 0; transform: translateY(15px) rotate(-5deg); } 40%, 80% { opacity: 1; transform: translateY(0) rotate(0deg); } 100% { opacity: 0; transform: translateY(15px) rotate(-5deg); } }
      @keyframes svg-el-pop { 0%, 20% { opacity: 0; transform: scale(0.5); } 30% { opacity: 1; transform: scale(1.1); } 40%, 80% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(0.5); } }
      @keyframes svg-el-reveal-mask { 0%, 20% { width: 0; } 40%, 80% { width: 24px; } 100% { width: 0; } }
      @keyframes svg-el-blur { 0%, 20% { opacity: 0; filter: blur(4px); transform: scale(1.1); } 40%, 80% { opacity: 1; filter: blur(0); transform: scale(1); } 100% { opacity: 0; filter: blur(4px); transform: scale(1.1); } }
    `}</style>
  );

  switch (type) {
    case "none":
      return (
        <svg className="h-full w-full overflow-visible" viewBox="0 0 60 30">
          {defs}
          <BackgroundUI />
          <AnimElement />
        </svg>
      );
    case "fadeIn":
      return (
        <svg className="h-full w-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <BackgroundUI />
          <AnimElement style={{ animation: getAnim("svg-el-fade") }} />
        </svg>
      );
    case "fadeUp":
      return (
        <svg className="h-full w-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <BackgroundUI />
          <AnimElement style={{ animation: getAnim("svg-el-fadeup") }} />
        </svg>
      );
    case "zoomIn":
      return (
        <svg className="h-full w-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <BackgroundUI />
          <AnimElement style={{ animation: getAnim("svg-el-zoomin"), transformOrigin: "30px 15px" }} />
        </svg>
      );
    case "slideLeft":
      return (
        <svg className="h-full w-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <BackgroundUI />
          <AnimElement style={{ animation: getAnim("svg-el-slideleft") }} />
        </svg>
      );
    case "rise":
      return (
        <svg className="h-full w-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <BackgroundUI />
          <AnimElement style={{ animation: getAnim("svg-el-rise"), transformOrigin: "30px 15px" }} />
        </svg>
      );
    case "pop":
      return (
        <svg className="h-full w-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <BackgroundUI />
          <AnimElement style={{ animation: getAnim("svg-el-pop"), transformOrigin: "30px 15px" }} />
        </svg>
      );
    case "reveal":
      return (
        <svg className="h-full w-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <BackgroundUI />
          <g style={{ clipPath: "url(#elWipeClip)" }}>
            <AnimElement />
          </g>
        </svg>
      );
    case "blurIn":
      return (
        <svg className="h-full w-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <BackgroundUI />
          <AnimElement style={{ animation: getAnim("svg-el-blur"), transformOrigin: "30px 15px" }} />
        </svg>
      );
    default:
      return null;
  }
}
