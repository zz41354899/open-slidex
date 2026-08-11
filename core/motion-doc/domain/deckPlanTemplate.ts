import {
  deckPlanSlideRoles,
  type DeckPlanKind,
  type DeckPlanSlideRole
} from "@/core/motion-doc/domain/deckPlanV1";

export const deckPlanBlueprintLayouts = [
  "cover",
  "editorial",
  "image-gallery",
  "image-split",
  "list-grid",
  "metrics-grid",
  "timeline",
  "closing"
] as const;

export const deckPlanTemplateSlotKinds = [
  "eyebrow",
  "title",
  "summary",
  "bullet",
  "metric",
  "image",
  "source-notes"
] as const;

export type DeckPlanBlueprintLayout = (typeof deckPlanBlueprintLayouts)[number];
export type DeckPlanTemplateSlotKind = (typeof deckPlanTemplateSlotKinds)[number];
export type DeckPlanBlueprintTone = "accent" | "dark" | "light";

export type DeckPlanTemplateSlot = {
  id: string;
  kind: DeckPlanTemplateSlotKind;
  maxItems: number;
  required: boolean;
};

export type DeckPlanSlideBlueprint = {
  capacities: {
    assets: number;
    bullets: number;
    metrics: number;
  };
  id: string;
  layout: DeckPlanBlueprintLayout;
  minimumAssets: number;
  required: boolean;
  repeatable: boolean;
  roles: readonly DeckPlanSlideRole[];
  slots: readonly DeckPlanTemplateSlot[];
  tone: DeckPlanBlueprintTone;
};

export type DeckPlanTemplateStyle = {
  accent: string;
  background: string;
  darkBackground: string;
  darkMuted: string;
  darkText: string;
  fontFamily: string;
  muted: string;
  radius: number;
  surface: string;
  text: string;
};

export type DeckPlanTemplateMotion = {
  contentEnter: string;
  imageEnter: string;
  slideTransition: string;
  titleEnter: string;
  transitionDuration: number;
};

export type DeckPlanTemplateComposition = {
  blueprints: readonly DeckPlanSlideBlueprint[];
  name: string;
  style: DeckPlanTemplateStyle;
  supportedKinds: readonly DeckPlanKind[];
  templateId: string;
  version: 1;
  visualProfile?: "classic" | "editorial-knowledge";
  motion: DeckPlanTemplateMotion;
};

export type DeckPlanTemplateCompositionIssue = {
  message: string;
  path: string;
};

export function validateDeckPlanTemplateComposition(
  composition: DeckPlanTemplateComposition
): DeckPlanTemplateCompositionIssue[] {
  const issues: DeckPlanTemplateCompositionIssue[] = [];
  const blueprintIds = new Set<string>();
  const coveredRoles = new Set<DeckPlanSlideRole>();

  if (!composition.templateId.trim()) {
    issues.push({ message: "templateId is required.", path: "templateId" });
  }

  if (composition.blueprints.length === 0) {
    issues.push({ message: "At least one blueprint is required.", path: "blueprints" });
  }

  composition.blueprints.forEach((blueprint, blueprintIndex) => {
    const path = `blueprints[${blueprintIndex}]`;
    if (blueprintIds.has(blueprint.id)) {
      issues.push({ message: `Duplicate blueprint id: ${blueprint.id}`, path: `${path}.id` });
    }
    blueprintIds.add(blueprint.id);
    blueprint.roles.forEach((role) => coveredRoles.add(role));

    if (blueprint.roles.length === 0) {
      issues.push({ message: "Blueprint roles cannot be empty.", path: `${path}.roles` });
    }

    const slotIds = new Set<string>();
    blueprint.slots.forEach((slot, slotIndex) => {
      if (slotIds.has(slot.id)) {
        issues.push({
          message: `Duplicate slot id within blueprint: ${slot.id}`,
          path: `${path}.slots[${slotIndex}].id`
        });
      }
      slotIds.add(slot.id);
    });

    if (!blueprint.slots.some((slot) => slot.kind === "title" && slot.required)) {
      issues.push({
        message: "Every blueprint requires a title slot.",
        path: `${path}.slots`
      });
    }

    for (const [capacityName, capacity] of Object.entries(blueprint.capacities)) {
      if (!Number.isInteger(capacity) || capacity < 0) {
        issues.push({
          message: `${capacityName} capacity must be a non-negative integer.`,
          path: `${path}.capacities.${capacityName}`
        });
      }
    }
    if (
      !Number.isInteger(blueprint.minimumAssets) ||
      blueprint.minimumAssets < 0 ||
      blueprint.minimumAssets > blueprint.capacities.assets
    ) {
      issues.push({
        message: "minimumAssets must be an integer between zero and the asset capacity.",
        path: `${path}.minimumAssets`
      });
    }
  });

  for (const role of deckPlanSlideRoles) {
    if (!coveredRoles.has(role)) {
      issues.push({
        message: `No blueprint supports the ${role} role.`,
        path: "blueprints"
      });
    }
  }

  return issues;
}

export function assertDeckPlanTemplateComposition(
  composition: DeckPlanTemplateComposition
) {
  const issues = validateDeckPlanTemplateComposition(composition);
  if (issues.length > 0) {
    throw new Error(
      `Invalid deck-plan template composition '${composition.templateId}': ${issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`
    );
  }
  return composition;
}

export function publicDeckPlanTemplateMetadata(
  composition: DeckPlanTemplateComposition
) {
  return {
    blueprints: composition.blueprints.map((blueprint) => ({
      capacities: blueprint.capacities,
      id: blueprint.id,
      layout: blueprint.layout,
      minimumAssets: blueprint.minimumAssets,
      required: blueprint.required,
      repeatable: blueprint.repeatable,
      roles: blueprint.roles,
      slots: blueprint.slots,
      tone: blueprint.tone
    })),
    name: composition.name,
    supportedKinds: composition.supportedKinds,
    templateId: composition.templateId,
    visualProfile: composition.visualProfile ?? "classic",
    version: composition.version
  };
}
