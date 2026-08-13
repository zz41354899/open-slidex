import { z } from "zod";

export const templatePackageLocales = ["en", "zh-TW"] as const;
export type TemplatePackageLocale = (typeof templatePackageLocales)[number];

const stableId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const semver = z.string().regex(/^\d+\.\d+\.\d+$/);

export const templateRefSchema = z.strictObject({
  id: stableId,
  locale: z.enum(templatePackageLocales),
  version: semver
});

const localizedMetadataSchema = z.strictObject({
  description: z.string().trim().min(1).max(500),
  name: z.string().trim().min(1).max(120),
  useCase: z.string().trim().min(1).max(300)
});

export const templateBlueprintV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  narrative: z.strictObject({
    objective: z.string().trim().min(1).max(500),
    slideRoles: z.array(z.string().trim().min(1).max(80)).min(1).max(30)
  }),
  design: z.strictObject({
    colorTokens: z.array(z.string().trim().min(1).max(80)).min(1).max(16),
    composition: z.string().trim().min(1).max(600),
    imageTreatment: z.string().trim().min(1).max(400),
    typography: z.string().trim().min(1).max(400)
  }),
  imageSlots: z.array(z.strictObject({
    aspectRatio: z.string().trim().min(1).max(40),
    required: z.boolean(),
    role: z.string().trim().min(1).max(80)
  })).max(20),
  layoutRoles: z.array(z.string().trim().min(1).max(80)).min(1).max(30),
  prohibitions: z.array(z.string().trim().min(1).max(300)).max(30),
  qaRules: z.array(z.string().trim().min(1).max(300)).min(1).max(30)
});

export const templatePackageV1Schema = z.strictObject({
  assets: z.array(z.strictObject({
    bytes: z.number().int().nonnegative(),
    mediaType: z.string().trim().min(1).max(120),
    path: z.string().regex(/^assets\/[A-Za-z0-9._-]+$/),
    sha256
  })).max(100),
  blueprint: templateBlueprintV1Schema,
  catalog: z.strictObject({
    author: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(80),
    featured: z.boolean(),
    slideCount: z.number().int().positive().max(100),
    sortOrder: z.number().int(),
    tags: z.array(z.string().trim().min(1).max(60)).max(20)
  }),
  compatibility: z.strictObject({
    motionDoc: semver,
    openSlideX: semver
  }),
  cover: z.strictObject({
    alt: z.record(z.enum(templatePackageLocales), z.string().trim().min(1).max(200)),
    source: z.string().trim().min(1).max(500)
  }),
  id: stableId,
  kind: z.literal("open-slidex-template"),
  locales: z.record(z.enum(templatePackageLocales), localizedMetadataSchema),
  schemaVersion: z.literal(1),
  sources: z.record(z.enum(templatePackageLocales), z.string().min(1)),
  starterSources: z.record(z.enum(templatePackageLocales), z.string().min(1)),
  version: semver
});

export type TemplateRef = z.infer<typeof templateRefSchema>;
export type TemplateBlueprintV1 = z.infer<typeof templateBlueprintV1Schema>;
export type TemplatePackageV1 = z.infer<typeof templatePackageV1Schema>;

export function parseTemplateRef(value: unknown): TemplateRef {
  return templateRefSchema.parse(value);
}

export function parseTemplatePackageV1(value: unknown): TemplatePackageV1 {
  return templatePackageV1Schema.parse(value);
}
