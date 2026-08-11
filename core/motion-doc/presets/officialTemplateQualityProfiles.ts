import type { TemplatePackageLocale } from "@/core/motion-doc/domain/templatePackageV1";
import { parseTemplateQualityProfileV1, type TemplateQualityProfileV1 } from "@/core/motion-doc/domain/templateQualityProfileV1";

export function getOfficialTemplateQualityProfile(id: string, locale: TemplatePackageLocale): TemplateQualityProfileV1 | undefined {
  if (id !== "open-slidex-starter") return undefined;
  return parseTemplateQualityProfileV1({
    schemaVersion: 1,
    locale,
    copy: {
      bodyMaxLines: 5,
      headlineMaxLines: 2,
      orphanMinCharacters: 3,
      rules: locale === "zh-TW"
        ? ["每頁只表達一個主張。", "先寫結論，再補證據與下一步。"]
        : ["Express one claim per slide.", "Lead with the conclusion, then add evidence and a next step."],
      voice: locale === "zh-TW" ? "精準、清楚、可行動。" : "Precise, clear, and actionable."
    },
    layout: {
      maxContentUnits: 5,
      minElementGapPercent: 2.5,
      outerMarginPercent: [6, 8],
      roleRecipes: ["cover", "next-steps"].map((role) => ({
        role,
        composition: "Use one dominant focal element and one concise supporting zone.",
        imagePolicy: "optional" as const,
        messagePattern: locale === "zh-TW" ? "主張 → 證據 → 下一步" : "Claim → evidence → next step"
      }))
    },
    rhythm: {
      maxRepeatedComposition: 2,
      minCompositionVariants: 2,
      rules: [locale === "zh-TW" ? "連續頁面使用不同的焦點位置。" : "Vary the focal position across consecutive slides."]
    },
    typography: { bodyPt: [14, 24], headingPt: [24, 38], titlePt: [42, 72] }
  });
}
