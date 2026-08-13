import assert from "node:assert/strict";
import test from "node:test";

import { paperImageFilterDefinitions } from "@/core/motion-doc/application/shaders/paperImageFilterCatalog";
import { paperShaderDefinitions } from "@/core/motion-doc/application/shaders/paperShaderCatalog";
import { lucideIconLabels } from "@/core/motion-doc/domain/lucideIconRegistry";
import {
  inspectorCoreTranslationKeys,
  inspectorTechnicalLabelExemptions,
  pitchDictionaries,
  pitchHasTranslation,
  pitchTranslate,
  type PitchTranslationKey
} from "@/features/pitch/ui/pitchI18n";

test("right inspector dictionaries keep exact en and zh-TW key parity", () => {
  const enKeys = Object.keys(pitchDictionaries.en).sort();
  const zhTwKeys = Object.keys(pitchDictionaries["zh-TW"]).sort();

  assert.deepEqual(enKeys, zhTwKeys);
  assert.ok(inspectorCoreTranslationKeys.every((key) => enKeys.includes(key)));

  for (const key of inspectorCoreTranslationKeys) {
    assert.notEqual(pitchDictionaries.en[key], "", `missing en copy for ${key}`);
    assert.notEqual(pitchDictionaries["zh-TW"][key], "", `missing zh-TW copy for ${key}`);
  }
});

test("right inspector translation supports parameterized accessible copy", () => {
  assert.equal(pitchTranslate("en", "Row {index} label", { index: 2 }), "Row 2 label");
  assert.equal(pitchTranslate("zh-TW", "Row {index} label", { index: 2 }), "第 2 列標籤");
  assert.equal(
    pitchTranslate("zh-TW", "Saturation {saturation}%, brightness {brightness}%", {
      brightness: 75,
      saturation: 50
    }),
    "飽和度 50%，亮度 75%"
  );
  assert.equal(pitchTranslate("zh-TW", "Unknown inspector copy"), "Unknown inspector copy");
});

test("paper shader and image-filter catalog labels have inspector translations", () => {
  const labels = new Set<string>([
    ...paperImageFilterDefinitions.flatMap((definition) => [
      definition.name,
      ...definition.controls.map((control) => control.label),
      ...definition.presets.map((preset) => preset.name)
    ]),
    ...paperShaderDefinitions.flatMap((definition) => [
      definition.name,
      ...definition.colorLabels.filter(Boolean).map((label) => catalogColorTranslationKey(label)),
      ...definition.controls.map((control) => control.label),
      ...definition.presets.map((preset) => preset.name === "Opening" ? "Paper preset Opening" : preset.name)
    ])
  ]);

  assert.deepEqual(
    [...labels].filter((label) => !pitchHasTranslation(label)),
    [],
    "catalog metadata must not silently fall back to English in zh-TW"
  );
});

test("icon picker labels are localized and technical labels are explicitly exempt", () => {
  assert.deepEqual(
    [...new Set(Object.values(lucideIconLabels))].filter((label) => !pitchHasTranslation(label)),
    []
  );
  assert.deepEqual(inspectorTechnicalLabelExemptions, [
    "HEX",
    "X",
    "Y",
    "W",
    "H",
    "px",
    "pt",
    "s",
    "deg",
    "MP4",
    "WebM",
    "PPTX",
    "URL",
    "MDX"
  ]);
});

function catalogColorTranslationKey(label: string): PitchTranslationKey | string {
  if (label === "Back") return "Back color";
  if (label === "Fiber") return "Fiber color";
  if (label === "Grain") return "Grain color";
  return label;
}
