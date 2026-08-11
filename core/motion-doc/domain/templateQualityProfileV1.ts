import { z } from "zod";

import { templatePackageLocales } from "@/core/motion-doc/domain/templatePackageV1";

export const templateQualityProfileV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  locale: z.enum(templatePackageLocales),
  copy: z.strictObject({
    bodyMaxLines: z.number().int().min(1).max(12),
    headlineMaxLines: z.number().int().min(1).max(4),
    orphanMinCharacters: z.number().int().min(2).max(8),
    rules: z.array(z.string().trim().min(1).max(240)).min(1).max(12),
    voice: z.string().trim().min(1).max(300)
  }),
  layout: z.strictObject({
    maxContentUnits: z.number().int().min(1).max(12),
    minElementGapPercent: z.number().min(0.5).max(20),
    outerMarginPercent: z.tuple([z.number().min(0).max(20), z.number().min(0).max(20)]),
    roleRecipes: z.array(z.strictObject({
      composition: z.string().trim().min(1).max(400),
      imagePolicy: z.enum(["none", "optional", "required"]),
      messagePattern: z.string().trim().min(1).max(240),
      role: z.string().trim().min(1).max(80)
    })).min(1).max(30)
  }),
  rhythm: z.strictObject({
    maxRepeatedComposition: z.number().int().min(1).max(5),
    minCompositionVariants: z.number().int().min(1).max(12),
    rules: z.array(z.string().trim().min(1).max(240)).min(1).max(12)
  }),
  typography: z.strictObject({
    bodyPt: z.tuple([z.number().min(8).max(80), z.number().min(8).max(80)]),
    headingPt: z.tuple([z.number().min(8).max(120), z.number().min(8).max(120)]),
    titlePt: z.tuple([z.number().min(8).max(180), z.number().min(8).max(180)])
  })
});

export type TemplateQualityProfileV1 = z.infer<typeof templateQualityProfileV1Schema>;

export function parseTemplateQualityProfileV1(value: unknown): TemplateQualityProfileV1 {
  return templateQualityProfileV1Schema.parse(value);
}
