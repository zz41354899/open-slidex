
import {
  PAPER_SHADER_COLOR_KEYS,
  type PaperShaderControl,
  type PaperShaderControlKey,
  getPaperShaderDefinition,
  paperShaderDefinitions,
  paperShaderPresetUpdates
} from "@/core/motion-doc/application/shaders/paperShaderCatalog";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { ColorControl, Field } from "@/features/pitch/ui/inspector/InspectorControls";
import { ShaderRangeControl } from "@/features/pitch/ui/inspector/shader/ShaderRangeControl";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import {
  NativeSelect,
  NativeSelectOption,
  Separator
} from "@/common/ui/shadcnPrimitives";

type ShaderBackgroundSectionProps = {
  accent: string;
  background: string;
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
  updateActiveSlideStyle: (updates: MotionDocProps) => void;
};

export function ShaderBackgroundSectionContent({
  accent,
  background,
  shader,
  shaderAngle,
  shaderColor1,
  shaderColor2,
  shaderColor3,
  shaderColor4,
  shaderColor5,
  shaderColor6,
  shaderDetail,
  shaderIntensity,
  shaderPreset,
  shaderScale,
  shaderSoftness,
  shaderSpeed,
  updateActiveSlideStyle
}: ShaderBackgroundSectionProps) {
  const { tx } = usePitchI18n();
  const definition = getPaperShaderDefinition(shader);
  const activeShaderId = definition?.id ?? "";
  const activePreset = definition?.presets.find((preset) => preset.name === shaderPreset) ?? definition?.presets[0];

  return (
    <div className="flex flex-col gap-4">
      <Field label="Paper Shader">
        <NativeSelect
          className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#08080a] px-3 text-[13px] font-medium text-neutral-200 outline-none transition focus:border-[#8ea5ff]/60"
          onChange={(event) => {
            const nextShader = event.target.value;
            updateActiveSlideStyle(nextShader ? paperShaderPresetUpdates(nextShader) : emptyShaderUpdates());
          }}
          value={activeShaderId}
        >
          <NativeSelectOption value="">{tx("None")}</NativeSelectOption>
          {paperShaderDefinitions.map((option) => (
            <NativeSelectOption key={option.id} value={option.id}>
              {tx(option.name)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      {definition ? (
        <>
          <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.025]">
            <div className="h-16" style={{ background: definition.thumbnail }} />
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="truncate text-[12px] font-semibold text-neutral-200">{tx(definition.name)}</span>
              <span className="shrink-0 rounded-md border border-white/[0.07] bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                {tx("Paper")}
              </span>
            </div>
          </div>

          <Field label="Paper Preset">
            <NativeSelect
              className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#08080a] px-3 text-[13px] font-medium text-neutral-200 outline-none transition focus:border-[#8ea5ff]/60"
              onChange={(event) => updateActiveSlideStyle(paperShaderPresetUpdates(definition.id, event.target.value))}
              value={activePreset?.name ?? definition.defaultPreset}
            >
              {definition.presets.map((preset) => (
                <NativeSelectOption key={preset.name} value={preset.name}>
                  {tx(preset.name === "Opening" ? "Paper preset Opening" : preset.name)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <PaperShaderControls
            accent={accent}
            background={background}
            controls={definition.controls}
            colorLabels={definition.colorLabels}
            visibleColorCount={definition.visibleColorCount}
            shaderAngle={shaderAngle}
            shaderColor1={shaderColor1}
            shaderColor2={shaderColor2}
            shaderColor3={shaderColor3}
            shaderColor4={shaderColor4}
            shaderColor5={shaderColor5}
            shaderColor6={shaderColor6}
            shaderDetail={shaderDetail}
            shaderIntensity={shaderIntensity}
            shaderScale={shaderScale}
            shaderSoftness={shaderSoftness}
            shaderSpeed={shaderSpeed}
            updateActiveSlideStyle={updateActiveSlideStyle}
          />
        </>
      ) : null}
    </div>
  );
}

function PaperShaderControls({
  accent,
  background,
  colorLabels,
  controls,
  shaderAngle,
  shaderColor1,
  shaderColor2,
  shaderColor3,
  shaderColor4,
  shaderColor5,
  shaderColor6,
  shaderDetail,
  shaderIntensity,
  shaderScale,
  shaderSoftness,
  shaderSpeed,
  updateActiveSlideStyle,
  visibleColorCount
}: Omit<ShaderBackgroundSectionProps, "shader" | "shaderEngine" | "shaderPreset"> & {
  colorLabels: readonly [string, string, string, string, string, string];
  controls: readonly PaperShaderControl[];
  visibleColorCount?: number;
}) {
  const { tx } = usePitchI18n();
  const shaderColors = {
    shaderColor1,
    shaderColor2,
    shaderColor3,
    shaderColor4,
    shaderColor5,
    shaderColor6
  };
  const controlValues: Record<PaperShaderControlKey, number> = {
    shaderAngle,
    shaderDetail,
    shaderIntensity,
    shaderScale,
    shaderSoftness,
    shaderSpeed
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <ColorRow
          fallback="#120f17"
          label="Canvas BG"
          onChange={(value) => updateActiveSlideStyle({ background: value })}
          value={background}
        />

        {PAPER_SHADER_COLOR_KEYS.slice(0, visibleColorCount ?? PAPER_SHADER_COLOR_KEYS.length).map((key, index) => (
          <ColorRow
            fallback={shaderColorFallback(key, accent, background)}
            key={key}
            label={colorLabels[index] === "Back"
              ? "Back color"
              : colorLabels[index] === "Fiber"
                ? "Fiber color"
                : colorLabels[index] === "Grain"
                  ? "Grain color"
                  : colorLabels[index]}
            onChange={(color) => updateActiveSlideStyle({ [key]: color })}
            value={shaderColors[key]}
          />
        ))}
      </div>

      <Separator className="bg-white/[0.06]" />

      <div className="grid grid-cols-1 gap-1">
        {controls.map((control) => {
          const value = clampNumber(controlValues[control.key], control.min, control.max, control.defaultValue);

          return (
            <ShaderRangeControl
              ariaLabel={tx("Shader {name} value", { name: tx(control.label) })}
              key={control.key}
              label={tx(control.label)}
              max={control.max}
              min={control.min}
              onChange={(nextValue) => updateActiveSlideStyle({ [control.key]: nextValue })}
              step={control.step}
              unit={control.key === "shaderAngle" ? "deg" : undefined}
              value={value}
            />
          );
        })}
      </div>
    </div>
  );
}

function ColorRow({
  fallback,
  label,
  onChange,
  value
}: {
  fallback: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const displayValue = value || fallback;

  return (
    <ColorControl
      displayValue={fallback}
      label={label}
      onChange={onChange}
      value={displayValue}
    />
  );
}

function emptyShaderUpdates(): MotionDocProps {
  return {
    shader: "",
    shaderAngle: "",
    shaderColor1: "",
    shaderColor2: "",
    shaderColor3: "",
    shaderColor4: "",
    shaderColor5: "",
    shaderColor6: "",
    shaderDetail: "",
    shaderEngine: "",
    shaderFrame: "",
    shaderIntensity: "",
    shaderPreset: "",
    shaderScale: "",
    shaderSoftness: "",
    shaderSpeed: ""
  };
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  const safeValue = Number.isFinite(value) ? value : fallback;

  return Math.min(Math.max(safeValue, min), max);
}

function shaderColorFallback(
  key: (typeof PAPER_SHADER_COLOR_KEYS)[number],
  accent: string,
  background: string
) {
  switch (key) {
    case "shaderColor1":
      return background || "#120f17";
    case "shaderColor2":
      return accent || "#7c3aed";
    case "shaderColor3":
      return "#06b6d4";
    case "shaderColor4":
      return "#00f5d4";
    case "shaderColor5":
      return "#090514";
    case "shaderColor6":
      return "#d0bcff";
  }
}
