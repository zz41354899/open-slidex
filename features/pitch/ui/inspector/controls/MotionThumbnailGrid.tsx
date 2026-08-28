import type { SVGProps } from "react";
import type { MotionPreset } from "@/features/pitch/application/motionPresets";
import { Field } from "@/features/pitch/ui/inspector/InspectorControls";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { ToggleGroup, ToggleGroupItem } from "@/common/ui/shadcnPrimitives";

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
  const { tx } = usePitchI18n();
  return (
    <Field label={label}>
      <ToggleGroup
        aria-label={tx(label || "Action Style")}
        className="grid w-full grid-cols-2 gap-2"
        onValueChange={(nextValue) => {
          if (nextValue) onChange(nextValue as TValue);
        }}
        spacing={2}
        type="single"
        value={value}
      >
        {options.map((option) => {
          const isSelected = value === option.value;
          const optionLabel = tx(option.value === "slideLeft" && variant === "element" ? "Slide in" : option.label);
          const optionDescription = tx(option.description);

          return (
            <ToggleGroupItem
              className={`group relative overflow-hidden rounded-[14px] border p-2 text-left transition-all duration-200 active:scale-[0.98] ${variant === "slide" ? "min-h-[108px]" : "min-h-[126px]"} ${
                isSelected
                  ? "border-violet-300/65 bg-violet-500/[0.09] text-white shadow-[0_8px_22px_rgba(76,29,149,.2),inset_0_0_0_1px_rgba(196,181,253,.1)]"
                  : "border-white/[0.085] bg-[linear-gradient(150deg,rgba(255,255,255,.025),rgba(0,0,0,.14))] text-neutral-400 hover:border-white/[0.17] hover:bg-white/[0.045] hover:text-neutral-200"
              }`}
              key={option.value}
              title={`${optionLabel}: ${optionDescription}`}
              value={option.value}
            >
              <span className={`relative z-10 flex h-full flex-col justify-between ${variant === "slide" ? "gap-2" : "gap-2.5"}`}>
                <MotionPreview active={isSelected} value={option.value} variant={variant} />
                <span className={`flex min-w-0 flex-col px-1 pb-0.5 ${variant === "slide" ? "items-center" : "gap-1"}`}>
                  <span className={`truncate font-semibold leading-none ${variant === "slide" ? "text-[11px]" : "text-[13px]"}`}>{optionLabel}</span>
                  {variant === "slide" ? null : <span className="truncate text-[11px] font-medium leading-none text-neutral-500 group-hover:text-neutral-400">
                    {optionDescription}
                  </span>}
                </span>
              </span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
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
    <span
      className={`relative flex w-full items-center justify-center overflow-hidden rounded-[10px] border border-white/[0.07] bg-[#202020] shadow-inner ${variant === "slide" ? "min-h-[58px]" : "min-h-[62px]"}`}
      style={{ aspectRatio: "16 / 9" }}
    >
      <span className="absolute inset-0 bg-white/[0.015]" />

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
      @keyframes svg-morph-a { 0%, 20% { opacity: 1; } 40%, 80% { opacity: .28; } 100% { opacity: 1; } }
      @keyframes svg-morph-b { 0%, 20% { opacity: .2; } 40%, 80% { opacity: 1; } 100% { opacity: .2; } }
      @keyframes svg-morph-object { 0%, 20% { rx: 50%; transform: translate(0, 0) rotate(0deg) scale(1); } 40%, 80% { rx: 8%; transform: translate(18px, -5px) rotate(45deg) scale(1.35); } 100% { rx: 50%; transform: translate(0, 0) rotate(0deg) scale(1); } }
    `}</style>
  );

  switch (type) {
    case "none":
      return (
        <svg className="size-full overflow-visible" viewBox="0 0 60 30">
          {defs}
          <SlideB />
        </svg>
      );
    case "fade":
      return (
        <svg className="size-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <SlideA style={{ animation: getAnim("svg-fade-out") }} />
          <SlideB style={{ animation: getAnim("svg-fade-in") }} />
        </svg>
      );
    case "morph":
      return (
        <svg className="size-full overflow-hidden rounded-[6px]" viewBox="0 0 60 30">
          {defs}{styles}
          <SlideA style={{ animation: getAnim("svg-morph-a") }} />
          <SlideB style={{ animation: getAnim("svg-morph-b") }} />
          <rect fill="rgba(167,139,250,.92)" height="6" rx="2" style={{ animation: getAnim("svg-morph-object"), transformOrigin: "23px 17px" }} width="10" x="18" y="14" />
        </svg>
      );
    case "pushLeft":
      return (
        <svg className="size-full overflow-hidden rounded-[6px]" viewBox="0 0 60 30">
          {defs}{styles}
          <SlideA style={{ animation: getAnim("svg-push-a") }} />
          <SlideB style={{ animation: getAnim("svg-push-b") }} />
        </svg>
      );
    case "rise":
      return (
        <svg className="size-full overflow-hidden rounded-[6px]" style={{ transformOrigin: "center" }} viewBox="0 0 60 30">
          {defs}{styles}
          <SlideA style={{ animation: getAnim("svg-rise-a"), transformOrigin: "center" }} />
          <SlideB style={{ animation: getAnim("svg-rise-b") }} />
        </svg>
      );
    case "scale":
      return (
        <svg className="size-full overflow-hidden rounded-[6px]" style={{ transformOrigin: "center" }} viewBox="0 0 60 30">
          {defs}{styles}
          <SlideA style={{ animation: getAnim("svg-scale-a"), transformOrigin: "center" }} />
          <SlideB style={{ animation: getAnim("svg-scale-b"), transformOrigin: "center" }} />
        </svg>
      );
    case "wipe":
      return (
        <svg className="size-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <SlideA />
          <g style={{ clipPath: "url(#wipeClip)" }}>
            <SlideB />
          </g>
        </svg>
      );
    case "curtain":
      return (
        <svg className="size-full overflow-hidden rounded-[6px]" viewBox="0 0 60 30">
          {defs}{styles}
          <SlideB />
          <svg className="size-native" height="30" style={{ animation: getAnim("svg-curtain-l"), overflow: "hidden" }} width="30" x="0" y="0">
             <SlideA />
          </svg>
          <svg className="size-native" height="30" style={{ animation: getAnim("svg-curtain-r"), overflow: "hidden" }} width="30" x="30" y="0">
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
        <svg className="size-full overflow-visible" viewBox="0 0 60 30">
          {defs}
          <BackgroundUI />
          <AnimElement />
        </svg>
      );
    case "fadeIn":
      return (
        <svg className="size-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <BackgroundUI />
          <AnimElement style={{ animation: getAnim("svg-el-fade") }} />
        </svg>
      );
    case "fadeUp":
      return (
        <svg className="size-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <BackgroundUI />
          <AnimElement style={{ animation: getAnim("svg-el-fadeup") }} />
        </svg>
      );
    case "zoomIn":
      return (
        <svg className="size-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <BackgroundUI />
          <AnimElement style={{ animation: getAnim("svg-el-zoomin"), transformOrigin: "30px 15px" }} />
        </svg>
      );
    case "slideLeft":
      return (
        <svg className="size-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <BackgroundUI />
          <AnimElement style={{ animation: getAnim("svg-el-slideleft") }} />
        </svg>
      );
    case "rise":
      return (
        <svg className="size-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <BackgroundUI />
          <AnimElement style={{ animation: getAnim("svg-el-rise"), transformOrigin: "30px 15px" }} />
        </svg>
      );
    case "pop":
      return (
        <svg className="size-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <BackgroundUI />
          <AnimElement style={{ animation: getAnim("svg-el-pop"), transformOrigin: "30px 15px" }} />
        </svg>
      );
    case "reveal":
      return (
        <svg className="size-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <BackgroundUI />
          <g style={{ clipPath: "url(#elWipeClip)" }}>
            <AnimElement />
          </g>
        </svg>
      );
    case "blurIn":
      return (
        <svg className="size-full overflow-visible" viewBox="0 0 60 30">
          {defs}{styles}
          <BackgroundUI />
          <AnimElement style={{ animation: getAnim("svg-el-blur"), transformOrigin: "30px 15px" }} />
        </svg>
      );
    default:
      return null;
  }
}
