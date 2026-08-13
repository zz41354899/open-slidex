import type { TemplatePackageLocale } from "@/core/motion-doc/domain/templatePackageV1";
import { parseTemplateQualityProfileV1, type TemplateQualityProfileV1 } from "@/core/motion-doc/domain/templateQualityProfileV1";

export function getOfficialTemplateQualityProfile(id: string, locale: TemplatePackageLocale): TemplateQualityProfileV1 | undefined {
  if (id === "summer-time-report") {
    return parseTemplateQualityProfileV1({
      schemaVersion: 1,
      locale,
      copy: {
        bodyMaxLines: 5,
        headlineMaxLines: 2,
        orphanMinCharacters: 3,
        rules: locale === "zh-TW"
          ? ["每頁只說明一個季節回顧訊息。", "指標搭配簡短解讀，並以明確下一步收尾。"]
          : ["Express one seasonal-reporting message per slide.", "Pair metrics with a concise interpretation and close with a clear next step."],
        voice: locale === "zh-TW" ? "明亮、具體、面向行動。" : "Bright, specific, and action-oriented."
      },
      layout: {
        maxContentUnits: 5,
        minElementGapPercent: 2.5,
        outerMarginPercent: [6, 8],
        roleRecipes: [
          ["cover", "Use a generous blue cover field with one dominant title and a short supporting line."],
          ["about", "Pair a concise left text zone with editable geometric accents on the right."],
          ["highlights", "Use up to three evenly spaced highlight cards with one simple icon each."],
          ["metrics", "Use up to four consistent metric cards with short labels and interpretations."],
          ["timeline", "Use a single horizontal timeline with evenly spaced milestones."],
          ["next-steps", "Use a dark action list with one owner-ready action per line."],
          ["closing", "Return to the blue cover treatment with a concise closing message."]
        ].map(([role, composition]) => ({
          role,
          composition,
          imagePolicy: "optional" as const,
          messagePattern: locale === "zh-TW" ? "結論 → 證據 → 下一步" : "Conclusion → evidence → next step"
        }))
      },
      rhythm: {
        maxRepeatedComposition: 2,
        minCompositionVariants: 4,
        rules: [locale === "zh-TW" ? "連續頁面在文字、卡片、時間軸與清單之間切換焦點。" : "Vary the focal treatment across text, cards, timeline, and action-list slides."]
      },
      typography: { bodyPt: [13, 24], headingPt: [22, 40], titlePt: [48, 72] }
    });
  }
  return undefined;
}
