import { z } from "zod";

export const DECK_PLAN_SCHEMA_VERSION = 1 as const;
export const DECK_PLAN_MIN_SLIDES = 6;
export const DECK_PLAN_MAX_SLIDES = 16;

export const deckPlanKinds = [
  "progress-report",
  "proposal",
  "research-brief",
  "teaching-deck"
] as const;

export const deckPlanSlideRoles = [
  "cover",
  "overview",
  "context",
  "goals",
  "key-point",
  "evidence",
  "metrics",
  "comparison",
  "process",
  "timeline",
  "decisions-risks",
  "next-steps",
  "closing",
  "appendix"
] as const;

export type DeckPlanKind = (typeof deckPlanKinds)[number];
export type DeckPlanSlideRole = (typeof deckPlanSlideRoles)[number];
export type DeckPlanLocale = "en" | "zh-TW";

export const deckPlanDefaultSlideCounts = {
  "progress-report": 8,
  proposal: 10,
  "research-brief": 10,
  "teaching-deck": 12
} as const satisfies Record<DeckPlanKind, number>;

const stableIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const vaultRelativeMarkdownPathPattern =
  /^(?!\/)(?![A-Za-z]:[\\/])(?![A-Za-z][A-Za-z0-9+.-]*:)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)(?!.*\0)[^\r\n]+\.md$/i;
const sourceLabelPattern = /^[^<>\r\n]+$/;
const blockIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

const requiredText = (max: number) => z.string().trim().min(1).max(max);

export const deckPlanSourceRefSchema = z.strictObject({
  blockId: z.string().regex(blockIdPattern).optional(),
  heading: requiredText(240).regex(sourceLabelPattern).optional(),
  path: requiredText(1024).regex(
    vaultRelativeMarkdownPathPattern,
    "Source paths must be vault-relative Markdown paths without '..', URI schemes, drive letters, or backslashes."
  )
});

export const deckPlanAssetRefSchema = z.strictObject({
  alt: requiredText(240).optional(),
  assetId: z.string().regex(stableIdPattern)
});

export const deckPlanMetricSchema = z.strictObject({
  detail: requiredText(240).optional(),
  label: requiredText(80),
  value: requiredText(80)
});

export const deckPlanSlideV1Schema = z.strictObject({
  assetRefs: z.array(deckPlanAssetRefSchema).max(4),
  bullets: z.array(requiredText(220)).max(6),
  id: z.string().regex(stableIdPattern),
  metrics: z.array(deckPlanMetricSchema).max(4),
  role: z.enum(deckPlanSlideRoles),
  sourceRefs: z.array(deckPlanSourceRefSchema).min(1).max(32),
  summary: requiredText(700).optional(),
  title: requiredText(160)
});

export const deckPlanTemplateRecommendationSchema = z.strictObject({
  alternatives: z.array(z.string().regex(stableIdPattern)).max(5),
  reason: requiredText(500),
  styleTags: z.array(requiredText(40)).min(1).max(8),
  templateId: z.string().regex(stableIdPattern)
});

export const deckPlanV1Schema = z.strictObject({
  audience: requiredText(300).optional(),
  kind: z.enum(deckPlanKinds),
  locale: z.enum(["zh-TW", "en"]),
  objective: requiredText(500).optional(),
  period: requiredText(120).optional(),
  planId: z.string().regex(stableIdPattern),
  schemaVersion: z.literal(DECK_PLAN_SCHEMA_VERSION),
  slides: z
    .array(deckPlanSlideV1Schema)
    .min(DECK_PLAN_MIN_SLIDES)
    .max(DECK_PLAN_MAX_SLIDES),
  templateRecommendation: deckPlanTemplateRecommendationSchema.optional(),
  title: requiredText(160)
}).superRefine((plan, context) => {
  if (plan.slides[0]?.role !== "cover") {
    context.addIssue({
      code: "custom",
      message: "The first slide must use the cover role.",
      path: ["slides", 0, "role"]
    });
  }

  const slideIds = new Set<string>();
  plan.slides.forEach((slide, index) => {
    if (slideIds.has(slide.id)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate slide id: ${slide.id}`,
        path: ["slides", index, "id"]
      });
    }
    slideIds.add(slide.id);

    if (index > 0 && slide.role === "cover") {
      context.addIssue({
        code: "custom",
        message: "Only the first slide may use the cover role.",
        path: ["slides", index, "role"]
      });
    }

    const sourceKeys = new Set<string>();
    slide.sourceRefs.forEach((sourceRef, sourceIndex) => {
      const sourceKey = [sourceRef.path, sourceRef.heading ?? "", sourceRef.blockId ?? ""].join("\u0000");
      if (sourceKeys.has(sourceKey)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate source reference on the same slide.",
          path: ["slides", index, "sourceRefs", sourceIndex]
        });
      }
      sourceKeys.add(sourceKey);
    });
  });

  const recommendation = plan.templateRecommendation;
  if (recommendation) {
    const templateIds = new Set([recommendation.templateId]);
    recommendation.alternatives.forEach((templateId, index) => {
      if (templateIds.has(templateId)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate recommended template id: ${templateId}`,
          path: ["templateRecommendation", "alternatives", index]
        });
      }
      templateIds.add(templateId);
    });
  }
});

export type DeckPlanSourceRef = z.infer<typeof deckPlanSourceRefSchema>;
export type DeckPlanAssetRef = z.infer<typeof deckPlanAssetRefSchema>;
export type DeckPlanMetric = z.infer<typeof deckPlanMetricSchema>;
export type DeckPlanSlideV1 = z.infer<typeof deckPlanSlideV1Schema>;
export type DeckPlanTemplateRecommendation = z.infer<
  typeof deckPlanTemplateRecommendationSchema
>;
export type DeckPlanV1 = z.infer<typeof deckPlanV1Schema>;

export type DeckPlanValidationIssue = {
  code: string;
  message: string;
  path: string;
};

export type DeckPlanValidationResult =
  | { data: DeckPlanV1; issues: []; success: true }
  | { issues: DeckPlanValidationIssue[]; success: false };

/**
 * Public JSON Schema used by MCP resources, uploads, and non-TypeScript agents.
 * Runtime callers must still use `validateDeckPlanV1` because semantic rules
 * such as unique slide ids are intentionally enforced by the parser.
 */
export const deckPlanV1JsonSchema = z.toJSONSchema(deckPlanV1Schema, {
  target: "draft-7"
});

export class DeckPlanValidationError extends Error {
  readonly issues: DeckPlanValidationIssue[];

  constructor(issues: DeckPlanValidationIssue[]) {
    super(issues[0]?.message ?? "DeckPlanV1 validation failed.");
    this.name = "DeckPlanValidationError";
    this.issues = issues;
  }
}

export function validateDeckPlanV1(value: unknown): DeckPlanValidationResult {
  const result = deckPlanV1Schema.safeParse(value);
  if (result.success) {
    return { data: result.data, issues: [], success: true };
  }

  return {
    issues: result.error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: formatValidationPath(issue.path)
    })),
    success: false
  };
}

export function parseDeckPlanV1(value: string | unknown): DeckPlanV1 {
  let candidate = value;

  if (typeof value === "string") {
    try {
      candidate = JSON.parse(value) as unknown;
    } catch (error) {
      throw new DeckPlanValidationError([
        {
          code: "invalid_json",
          message: error instanceof Error ? error.message : "Deck plan is not valid JSON.",
          path: "$"
        }
      ]);
    }
  }

  const result = validateDeckPlanV1(candidate);
  if (!result.success) throw new DeckPlanValidationError(result.issues);
  return result.data;
}

export function isVaultRelativeMarkdownPath(value: string) {
  return vaultRelativeMarkdownPathPattern.test(value);
}

function formatValidationPath(path: PropertyKey[]) {
  if (path.length === 0) return "$";

  return path.reduce<string>((result, segment) => {
    if (typeof segment === "number") return `${result}[${segment}]`;
    const value = String(segment);
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)
      ? `${result}.${value}`
      : `${result}[${JSON.stringify(value)}]`;
  }, "$");
}
