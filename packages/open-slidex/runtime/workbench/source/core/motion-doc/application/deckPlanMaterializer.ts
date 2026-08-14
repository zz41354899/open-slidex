import { generateSlideString } from "@/core/motion-doc/application/motionDocSerialize";
import { summarizeMotionDoc } from "@/core/motion-doc/application/motionDocAutomation";
import {
  parseDeckPlanV1,
  type DeckPlanAssetRef,
  type DeckPlanKind,
  type DeckPlanMetric,
  type DeckPlanSlideV1,
  type DeckPlanV1
} from "@/core/motion-doc/domain/deckPlanV1";
import {
  assertDeckPlanTemplateComposition,
  type DeckPlanSlideBlueprint,
  type DeckPlanTemplateComposition,
  type DeckPlanTemplateSlotKind
} from "@/core/motion-doc/domain/deckPlanTemplate";
import { sanitizeMotionDocMediaSource } from "@/core/motion-doc/domain/mediaSource";
import type {
  MotionDocBlock,
  MotionDocProps,
  MotionDocScene,
  MotionDocTextBlock
} from "@/core/motion-doc/domain/motionDocTypes";

export type ResolvedDeckPlanAsset = {
  alt?: string;
  credit?: {
    name: string;
    profileUrl: string;
    provider: "Unsplash";
  };
  src: string;
};

export type DeckPlanMaterializationWarning = {
  assetId?: string;
  code: "invalid-asset-source" | "unresolved-asset";
  message: string;
  slideId: string;
};

export type MaterializedDeckPlanSlide = {
  blueprintId: string;
  role: DeckPlanSlideV1["role"];
  slideId: string;
};

export type MaterializedDeckPlan = {
  planId: string;
  slides: MaterializedDeckPlanSlide[];
  source: string;
  templateId: string;
  title: string;
  warnings: DeckPlanMaterializationWarning[];
};

export type MaterializeDeckPlanOptions = {
  assets?: Readonly<Record<string, ResolvedDeckPlanAsset>>;
  blueprintIdBySlideId?: Readonly<Record<string, string>>;
};

type Tone = {
  accent: string;
  background: string;
  muted: string;
  surface: string;
  text: string;
  theme: "dark" | "light";
};

type DeckPlanAssetBinding = {
  asset?: ResolvedDeckPlanAsset;
  index: number;
  ref: DeckPlanAssetRef;
};

type RenderContext = {
  assetBindings: DeckPlanAssetBinding[];
  blueprint: DeckPlanSlideBlueprint;
  composition: DeckPlanTemplateComposition;
  plan: DeckPlanV1;
  slide: DeckPlanSlideV1;
  slideIndex: number;
  tone: Tone;
};

type MetricCardFrame = {
  background: string;
  color: string;
  h: number;
  radius: number;
  w: number;
  x: number;
  y: number;
};

const renderAssetFrame = (
  context: RenderContext,
  binding: DeckPlanAssetBinding,
  props: MotionDocProps
): MotionDocBlock => binding.asset
  ? imageBlock(context, binding, props)
  : imagePlaceholderBlock(context, binding, props);

export function materializeDeckPlan(
  value: DeckPlanV1 | unknown,
  composition: DeckPlanTemplateComposition,
  options: MaterializeDeckPlanOptions = {}
): MaterializedDeckPlan {
  const plan = parseDeckPlanV1(value);
  assertDeckPlanTemplateComposition(composition);

  if (!composition.supportedKinds.includes(plan.kind)) {
    throw new Error(
      `Template '${composition.templateId}' does not support deck kind '${plan.kind}'.`
    );
  }

  const warnings: DeckPlanMaterializationWarning[] = [];
  const usedBlueprints = new Map<string, number>();
  const slides = plan.slides.map((slide, slideIndex) => {
    const requestedBlueprintId = options.blueprintIdBySlideId?.[slide.id];
    const blueprint = requestedBlueprintId
      ? selectRequestedBlueprint(slide, composition, requestedBlueprintId, usedBlueprints)
      : selectDeckPlanBlueprint(slide, composition, usedBlueprints);
    usedBlueprints.set(
      blueprint.id,
      (usedBlueprints.get(blueprint.id) ?? 0) + 1
    );

    const assetBindings = slide.assetRefs.map((assetRef, index): DeckPlanAssetBinding => {
      const candidate = options.assets?.[assetRef.assetId];
      const safeSource = candidate
        ? sanitizeMotionDocMediaSource(candidate.src)
        : "";
      const asset = candidate && safeSource
        ? { ...candidate, src: safeSource }
        : undefined;

      if (!candidate) {
        warnings.push({
          assetId: assetRef.assetId,
          code: "unresolved-asset",
          message: `Asset '${assetRef.assetId}' was not resolved; its template slot remains empty.`,
          slideId: slide.id
        });
      } else if (!safeSource) {
        warnings.push({
          assetId: assetRef.assetId,
          code: "invalid-asset-source",
          message: `Asset '${assetRef.assetId}' did not resolve to a safe MotionDoc media source.`,
          slideId: slide.id
        });
      }

      return { asset, index, ref: assetRef };
    });

    const scene = renderBlueprint({
      assetBindings,
      blueprint,
      composition,
      plan,
      slide,
      slideIndex,
      tone: toneForBlueprint(composition, blueprint)
    });

    return {
      blueprint,
      scene,
      slide: {
        blueprintId: blueprint.id,
        role: slide.role,
        slideId: slide.id
      }
    };
  });

  const missingRequiredBlueprint = composition.blueprints.find(
    (blueprint) => blueprint.required && !plan.slides.some(
      (slide) => blueprint.roles.includes(slide.role)
    )
  );
  if (missingRequiredBlueprint) {
    throw new Error(
      `Template '${composition.templateId}' requires blueprint '${missingRequiredBlueprint.id}'.`
    );
  }

  const source = `# ${safeDeckTitle(plan.title)}\n\n${slides
    .map(({ scene }) => generateSlideString(scene))
    .join("\n\n")}`;
  const validation = summarizeMotionDoc(source).validation;
  const errors = validation.issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `Materialized MotionDoc is invalid: ${errors
        .map((issue) => issue.message)
        .join("; ")}`
    );
  }

  return {
    planId: plan.planId,
    slides: slides.map(({ slide }) => slide),
    source,
    templateId: composition.templateId,
    title: plan.title,
    warnings
  };
}

function selectRequestedBlueprint(
  slide: DeckPlanSlideV1,
  composition: DeckPlanTemplateComposition,
  blueprintId: string,
  usedBlueprints: ReadonlyMap<string, number>
) {
  const blueprint = composition.blueprints.find((candidate) => candidate.id === blueprintId);
  if (!blueprint) {
    throw new Error(`Template '${composition.templateId}' has no blueprint '${blueprintId}'.`);
  }
  if (!blueprint.repeatable && (usedBlueprints.get(blueprint.id) ?? 0) > 0) {
    throw new Error(`Template blueprint '${blueprint.id}' cannot be repeated.`);
  }
  if (
    blueprint.minimumAssets > slide.assetRefs.length ||
    blueprint.capacities.assets < slide.assetRefs.length ||
    blueprint.capacities.bullets < slide.bullets.length ||
    blueprint.capacities.metrics < slide.metrics.length
  ) {
    throw new Error(`Template blueprint '${blueprint.id}' cannot contain slide '${slide.id}'.`);
  }
  return blueprint;
}

export function selectDeckPlanBlueprint(
  slide: DeckPlanSlideV1,
  composition: DeckPlanTemplateComposition,
  usedBlueprints: ReadonlyMap<string, number> = new Map()
) {
  const candidates = composition.blueprints.filter((blueprint) => {
    if (!blueprint.roles.includes(slide.role)) return false;
    if (!blueprint.repeatable && (usedBlueprints.get(blueprint.id) ?? 0) > 0) {
      return false;
    }
    return (
      blueprint.minimumAssets <= slide.assetRefs.length &&
      blueprint.capacities.assets >= slide.assetRefs.length &&
      blueprint.capacities.bullets >= slide.bullets.length &&
      blueprint.capacities.metrics >= slide.metrics.length
    );
  });

  const selected = candidates
    .map((blueprint) => ({ blueprint, score: blueprintScore(blueprint, slide) }))
    .sort((left, right) => right.score - left.score)[0]?.blueprint;

  if (!selected) {
    throw new Error(
      `Template '${composition.templateId}' has no compatible blueprint for slide '${slide.id}' (${slide.role}).`
    );
  }

  return selected;
}

function blueprintScore(
  blueprint: DeckPlanSlideBlueprint,
  slide: DeckPlanSlideV1
) {
  let score = 0;
  if (blueprint.layout === "cover" && slide.role === "cover") score += 200;
  if (blueprint.layout === "closing" && slide.role === "closing") score += 200;
  if (blueprint.layout === "timeline" && (slide.role === "timeline" || slide.role === "process")) score += 160;
  if (blueprint.layout === "metrics-grid" && (slide.role === "metrics" || slide.metrics.length > 0)) score += 140;
  if (blueprint.layout === "image-gallery" && slide.assetRefs.length >= 2) score += 220;
  if (blueprint.layout === "image-split" && slide.assetRefs.length === 1) score += 180;
  if (blueprint.layout === "list-grid" && ["overview", "goals", "next-steps"].includes(slide.role)) score += 100;
  if (blueprint.layout === "editorial") score += 60;
  if (blueprint.layout === "image-split" && slide.assetRefs.length === 0) score -= 50;
  score -= Math.abs(blueprint.capacities.bullets - slide.bullets.length);
  return score;
}

function renderBlueprint(context: RenderContext): MotionDocScene {
  const blocks = (() => {
    switch (context.blueprint.layout) {
      case "cover":
        return renderCover(context);
      case "editorial":
        return renderEditorial(context);
      case "image-gallery":
        return renderImageGallery(context);
      case "image-split":
        return renderImageSplit(context);
      case "list-grid":
        return renderListGrid(context);
      case "metrics-grid":
        return renderMetricsGrid(context);
      case "timeline":
        return renderTimeline(context);
      case "closing":
        return renderClosing(context);
    }
  })();
  return {
    blocks,
    duration: 6,
    props: {
      accent: context.tone.accent,
      background: context.tone.background,
      duration: 6,
      fontSizeUnit: "pt",
      mutedColor: context.tone.muted,
      slideTransition: context.composition.motion.slideTransition,
      textColor: context.tone.text,
      theme: context.tone.theme,
      transitionDuration: context.composition.motion.transitionDuration
    }
  };
}

function renderCover(context: RenderContext): MotionDocBlock[] {
  const { composition, plan, slide, tone } = context;
  const assetBinding = context.assetBindings[0];
  const hasImage = Boolean(assetBinding);
  const titleWidth = hasImage ? 49 : 78;
  const blocks: MotionDocBlock[] = [
    shapeBlock(context, "cover-accent", {
      fill: tone.accent,
      h: 2.2,
      radius: 3,
      w: 18,
      x: 5,
      y: 8
    }),
    textBlock(context, "Text", "eyebrow", coverEyebrow(plan), {
      color: tone.muted,
      fontFamily: composition.style.fontFamily,
      fontSize: 10.5,
      fontWeight: 720,
      h: 5,
      letterSpacing: 0.08,
      w: 50,
      x: 5,
      y: 13
    }),
    textBlock(context, "Text", "title", slide.title, {
      color: tone.text,
      fontFamily: composition.style.fontFamily,
      fontSize: fitTitleSize(slide.title, hasImage ? 49.5 : 57),
      fontWeight: 760,
      h: 37,
      lineHeight: 0.98,
      w: titleWidth,
      x: 5,
      y: 25
    })
  ];

  if (slide.summary) {
    blocks.push(textBlock(context, "Text", "summary", slide.summary, {
      color: tone.muted,
      fontFamily: composition.style.fontFamily,
      fontSize: fitBodySize(slide.summary, 14.25),
      h: 18,
      lineHeight: 1.4,
      w: hasImage ? 47 : 62,
      x: 5.2,
      y: 68
    }));
  }

  if (assetBinding) {
    blocks.push(renderAssetFrame(context, assetBinding, {
      h: 82,
      radius: composition.style.radius,
      w: 40,
      x: 57,
      y: 9
    }));
  } else {
    blocks.push(
      shapeBlock(context, "cover-orbit-large", {
        fill: composition.style.surface,
        h: 44,
        radius: 100,
        w: 24,
        x: 76,
        y: 48
      }),
      shapeBlock(context, "cover-orbit-small", {
        fill: tone.accent,
        h: 18,
        radius: 100,
        w: 10,
        x: 70,
        y: 36
      })
    );
  }

  blocks.push(...renderMetricStrip(context, 88));
  return blocks;
}

function renderEditorial(context: RenderContext): MotionDocBlock[] {
  const { composition, slide, tone } = context;
  const blocks = commonHeader(context, 72);
  const editorial = usesEditorialKnowledgeProfile(context);
  if (slide.summary) {
    blocks.push(textBlock(context, "Text", "summary", slide.summary, {
      color: tone.text,
      fontFamily: composition.style.fontFamily,
      fontSize: fitBodySize(slide.summary, editorial ? 22.5 : 16.5),
      ...(editorial ? { fontWeight: 620 } : {}),
      h: slide.bullets.length > 0 ? (editorial ? 38 : 24) : 44,
      lineHeight: editorial ? 1.28 : 1.48,
      w: editorial && slide.bullets.length > 0 ? 44 : 62,
      x: 7,
      y: 32
    }));
  }
  if (editorial && slide.summary && slide.bullets.length > 0) {
    blocks.push(shapeBlock(context, "editorial-divider", {
      fill: tone.accent,
      h: 50,
      radius: 1,
      w: 0.32,
      x: 53,
      y: 35
    }));
  }
  blocks.push(...verticalBullets(
    context,
    editorial && slide.summary ? 38 : slide.summary ? 61 : 36,
    editorial && slide.summary ? 37 : 82,
    editorial && slide.summary ? 58 : 7
  ));
  blocks.push(...renderMetricStrip(context, 87));
  blocks.push(...renderCornerImage(context));
  return blocks;
}

function renderImageSplit(context: RenderContext): MotionDocBlock[] {
  const { composition, slide, tone } = context;
  const assetBinding = context.assetBindings[0];
  const blocks = commonHeader(context, 48);
  if (slide.summary) {
    blocks.push(textBlock(context, "Text", "summary", slide.summary, {
      color: tone.muted,
      fontFamily: composition.style.fontFamily,
      fontSize: fitBodySize(slide.summary, 14.25),
      h: 24,
      lineHeight: 1.45,
      w: 42,
      x: 6,
      y: 33
    }));
  }
  blocks.push(...verticalBullets(context, slide.summary ? 62 : 38, 43));

  if (assetBinding) {
    blocks.push(renderAssetFrame(context, assetBinding, {
      h: 80,
      radius: composition.style.radius,
      w: 45,
      x: 52,
      y: 10
    }));
  } else {
    blocks.push(shapeBlock(context, "image-placeholder", {
      fill: composition.style.surface,
      h: 80,
      radius: composition.style.radius,
      w: 45,
      x: 52,
      y: 10
    }));
  }
  blocks.push(...renderMetricStrip(context, 90));
  return blocks;
}

function renderImageGallery(context: RenderContext): MotionDocBlock[] {
  const { composition, slide, tone } = context;
  const blocks = commonHeader(context, 82);
  if (slide.summary) {
    blocks.push(textBlock(context, "Text", "summary", slide.summary, {
      color: tone.muted,
      fontFamily: composition.style.fontFamily,
      fontSize: fitBodySize(slide.summary, 11.25),
      h: 9,
      lineHeight: 1.3,
      w: 88,
      x: 6,
      y: 30
    }));
  }

  const hasFooter = slide.metrics.length > 0 || slide.bullets.length > 0;
  const galleryTop = slide.summary ? 41 : 33;
  const galleryBottom = hasFooter ? 82 : 93;
  const frames = galleryFrames(
    context.assetBindings.length,
    galleryTop,
    galleryBottom - galleryTop
  );
  context.assetBindings.forEach((assetBinding, index) => {
    const frame = frames[index];
    if (!frame) return;
    blocks.push(renderAssetFrame(context, assetBinding, {
      ...frame,
      radius: Math.min(14, composition.style.radius)
    }));
  });

  if (slide.metrics.length > 0) {
    blocks.push(...renderMetricStrip(context, 84));
  }
  if (slide.bullets.length > 0) {
    blocks.push(textBlock(
      context,
      "Text",
      "bullet",
      slide.bullets.map((bullet) => `• ${bullet}`).join("   "),
      {
        color: tone.muted,
        fontFamily: composition.style.fontFamily,
        fontSize: 8.25,
        h: slide.metrics.length > 0 ? 5 : 10,
        lineHeight: 1.2,
        w: 88,
        x: 6,
        y: slide.metrics.length > 0 ? 94 : 86
      }
    ));
  }
  return blocks;
}

function galleryFrames(count: number, y: number, height: number): MotionDocProps[] {
  if (count === 2) {
    return [
      { h: height, w: 43, x: 6, y },
      { h: height, w: 43, x: 51, y }
    ];
  }

  if (count === 3) {
    const secondaryHeight = (height - 2) / 2;
    return [
      { h: height, w: 55, x: 6, y },
      { h: secondaryHeight, w: 31, x: 63, y },
      { h: secondaryHeight, w: 31, x: 63, y: y + secondaryHeight + 2 }
    ];
  }

  const rowHeight = (height - 2) / 2;
  return [
    { h: rowHeight, w: 43, x: 6, y },
    { h: rowHeight, w: 43, x: 51, y },
    { h: rowHeight, w: 43, x: 6, y: y + rowHeight + 2 },
    { h: rowHeight, w: 43, x: 51, y: y + rowHeight + 2 }
  ].slice(0, count);
}

function renderListGrid(context: RenderContext): MotionDocBlock[] {
  const { composition, slide, tone } = context;
  const blocks = commonHeader(context, context.assetBindings.length > 0 ? 68 : 82);
  if (slide.summary) {
    blocks.push(textBlock(context, "Text", "summary", slide.summary, {
      color: tone.muted,
      fontFamily: composition.style.fontFamily,
      fontSize: fitBodySize(slide.summary, 12.75),
      h: 13,
      lineHeight: 1.42,
      w: 70,
      x: 6,
      y: 31
    }));
  }

  const columnCount = slide.bullets.length <= 3 ? Math.max(slide.bullets.length, 1) : 3;
  const rowCount = Math.max(1, Math.ceil(slide.bullets.length / columnCount));
  const gap = 2.5;
  const cardWidth = (88 - gap * (columnCount - 1)) / columnCount;
  const cardHeight = Math.min(25, (45 - gap * (rowCount - 1)) / rowCount);
  slide.bullets.forEach((bullet, index) => {
    const column = index % columnCount;
    const row = Math.floor(index / columnCount);
    const x = 6 + column * (cardWidth + gap);
    const y = 47 + row * (cardHeight + gap);
    const editorial = usesEditorialKnowledgeProfile(context);
    blocks.push(
      shapeBlock(context, `bullet-${editorial ? "rule" : "card"}-${index}`, editorial ? {
        fill: tone.accent,
        h: 0.28,
        radius: 1,
        w: cardWidth,
        x,
        y
      } : {
        fill: composition.style.surface,
        h: cardHeight,
        radius: composition.style.radius,
        w: cardWidth,
        x,
        y
      }),
      textBlock(context, "Text", "bullet", String(index + 1).padStart(2, "0"), {
        color: tone.accent,
        fontFamily: composition.style.fontFamily,
        fontSize: 9.75,
        fontWeight: 760,
        h: 4,
        w: cardWidth - (editorial ? 0 : 4),
        x: x + (editorial ? 0 : 2),
        y: y + (editorial ? 2.2 : 2.5)
      }, index, "index"),
      textBlock(context, "Text", "bullet", bullet, {
        color: tone.text,
        fontFamily: composition.style.fontFamily,
        fontSize: fitBodySize(bullet, editorial ? 14.25 : 12.75),
        fontWeight: editorial ? 650 : 600,
        h: cardHeight - (editorial ? 6 : 8),
        lineHeight: editorial ? 1.22 : 1.28,
        w: cardWidth - (editorial ? 0 : 4),
        x: x + (editorial ? 0 : 2),
        y: y + (editorial ? 7 : 8)
      }, index, "content")
    );
  });
  blocks.push(...renderMetricStrip(context, 89));
  blocks.push(...renderCornerImage(context));
  return blocks;
}

function renderMetricsGrid(context: RenderContext): MotionDocBlock[] {
  const { composition, slide, tone } = context;
  const blocks = commonHeader(context, context.assetBindings.length > 0 ? 68 : 82);
  if (slide.summary) {
    blocks.push(textBlock(context, "Text", "summary", slide.summary, {
      color: tone.muted,
      fontFamily: composition.style.fontFamily,
      fontSize: fitBodySize(slide.summary, 12.75),
      h: 11,
      lineHeight: 1.38,
      w: 70,
      x: 6,
      y: 31
    }));
  }

  const metrics = slide.metrics.length > 0
    ? slide.metrics
    : slide.bullets.slice(0, 4).map((bullet, index) => ({
        detail: "",
        label: `${index + 1}`,
        value: bullet
      }));
  const columnCount = metrics.length <= 2 ? Math.max(metrics.length, 1) : 2;
  const rowCount = Math.max(1, Math.ceil(metrics.length / columnCount));
  const cardWidth = columnCount === 1 ? 55 : 42.5;
  const cardHeight = rowCount === 1 ? 31 : 18;
  metrics.forEach((metric, index) => {
    const column = index % columnCount;
    const row = Math.floor(index / columnCount);
    const x = 6 + column * 45;
    const y = 45 + row * (cardHeight + 3);
    blocks.push(...(usesEditorialKnowledgeProfile(context)
      ? editorialMetricBlocks(context, metric, index, {
          h: cardHeight,
          w: cardWidth,
          x,
          y
        })
      : metricCardBlocks(context, metric, index, {
          background: composition.style.surface,
          color: tone.text,
          h: cardHeight,
          radius: composition.style.radius,
          w: cardWidth,
          x,
          y
        })));
  });

  if (slide.metrics.length > 0 && slide.bullets.length > 0) {
    blocks.push(textBlock(context, "Text", "bullet", slide.bullets.map((bullet) => `• ${bullet}`).join("   "), {
      color: tone.muted,
      fontFamily: composition.style.fontFamily,
      fontSize: 9.75,
      h: 10,
      lineHeight: 1.25,
      w: 88,
      x: 6,
      y: 88
    }));
  }
  blocks.push(...renderCornerImage(context));
  return blocks;
}

function renderTimeline(context: RenderContext): MotionDocBlock[] {
  const { composition, slide, tone } = context;
  const editorial = usesEditorialKnowledgeProfile(context);
  const blocks = commonHeader(context, context.assetBindings.length > 0 ? 68 : 82);
  if (slide.summary) {
    blocks.push(textBlock(context, "Text", "summary", slide.summary, {
      color: tone.muted,
      fontFamily: composition.style.fontFamily,
      fontSize: fitBodySize(slide.summary, 12.75),
      h: 12,
      lineHeight: 1.4,
      w: 72,
      x: 6,
      y: 31
    }));
  }

  const steps = slide.bullets.length > 0 ? slide.bullets : [slide.summary ?? slide.title];
  const columnCount = editorial ? Math.min(2, steps.length) : Math.min(3, steps.length);
  const rowCount = Math.ceil(steps.length / columnCount);
  const rowHeight = editorial
    ? rowCount === 1 ? 28 : rowCount === 2 ? 20 : 14
    : rowCount === 1 ? 36 : 24;
  const rowGap = editorial && rowCount >= 3 ? 3.5 : editorial ? 5 : 4;
  steps.forEach((step, index) => {
    const column = index % columnCount;
    const row = Math.floor(index / columnCount);
    const x = editorial ? 7 + column * 45 : 6 + column * 30;
    const y = (editorial ? 47 : 48) + row * (rowHeight + rowGap);
    blocks.push(
      shapeBlock(context, `timeline-node-${index}`, {
        fill: tone.accent,
        h: editorial ? 4.3 : 5,
        radius: 100,
        w: editorial ? 2.4 : 2.8,
        x,
        y
      }),
      textBlock(context, "Text", "bullet", String(index + 1).padStart(2, "0"), {
        color: tone.accent,
        fontFamily: composition.style.fontFamily,
        fontSize: editorial ? 10 : 10.5,
        fontWeight: 760,
        h: 5,
        w: 5,
        x: x + (editorial ? 3.5 : 4),
        y
      }, index, "index"),
      textBlock(context, "Text", "bullet", step, {
        color: tone.text,
        fontFamily: composition.style.fontFamily,
        fontSize: fitBodySize(step, editorial ? 13.25 : 12.75),
        fontWeight: 600,
        h: rowHeight - (editorial ? 6 : 7),
        lineHeight: 1.3,
        w: editorial ? 38 : 24,
        x: x + (editorial ? 3.5 : 4),
        y: y + (editorial ? 6 : 7)
      }, index, "content")
    );
  });
  blocks.push(...renderMetricStrip(context, 89));
  blocks.push(...renderCornerImage(context));
  return blocks;
}

function renderClosing(context: RenderContext): MotionDocBlock[] {
  const { composition, slide, tone } = context;
  const editorial = usesEditorialKnowledgeProfile(context);
  const blocks: MotionDocBlock[] = [
    textBlock(context, "Text", "eyebrow", deckKindLabel(context.plan.kind, context.plan.locale), {
      color: tone.muted,
      fontFamily: composition.style.fontFamily,
      fontSize: 10.5,
      fontWeight: 720,
      h: 5,
      textAlign: editorial ? "left" : "center",
      w: 50,
      x: editorial ? 7 : 25,
      y: editorial ? 12 : 18
    }),
    textBlock(context, "Text", "title", slide.title, {
      color: tone.text,
      fontFamily: composition.style.fontFamily,
      fontSize: fitTitleSize(slide.title, editorial ? 51 : 51),
      fontWeight: 760,
      h: 30,
      lineHeight: 1,
      textAlign: editorial ? "left" : "center",
      w: editorial ? 70 : 78,
      x: editorial ? 7 : 11,
      y: editorial ? 25 : 31
    })
  ];
  if (slide.summary) {
    blocks.push(textBlock(context, "Text", "summary", slide.summary, {
      color: tone.muted,
      fontFamily: composition.style.fontFamily,
      fontSize: fitBodySize(slide.summary, 14.25),
      h: 17,
      lineHeight: 1.4,
      textAlign: editorial ? "left" : "center",
      w: editorial ? 48 : 62,
      x: editorial ? 45 : 19,
      y: editorial ? 72 : 66
    }));
  }
  if (editorial) {
    blocks.push(shapeBlock(context, "closing-rule", {
      fill: tone.text,
      h: 0.35,
      radius: 1,
      w: 31,
      x: 7,
      y: 77
    }));
  }
  blocks.push(...renderMetricStrip(context, 87));
  blocks.push(...renderCornerImage(context));
  return blocks;
}

function commonHeader(context: RenderContext, width: number): MotionDocBlock[] {
  const { composition, slide, tone } = context;
  return [
    textBlock(context, "Text", "eyebrow", roleLabel(slide.role, context.plan.locale), {
      color: tone.accent,
      fontFamily: composition.style.fontFamily,
      fontSize: 9.75,
      fontWeight: 760,
      h: 4,
      w: 36,
      x: 6,
      y: 6
    }),
    textBlock(context, "Text", "title", slide.title, {
      color: tone.text,
      fontFamily: composition.style.fontFamily,
      fontSize: fitTitleSize(slide.title, 31.5),
      fontWeight: 730,
      h: 16,
      lineHeight: 1.05,
      w: width,
      x: 6,
      y: 13
    })
  ];
}

function verticalBullets(context: RenderContext, startY: number, width: number, startX = 7) {
  const { composition, slide, tone } = context;
  const bottomY = slide.metrics.length > 0 ? 84 : 90;
  const availableHeight = bottomY - startY;
  const rowHeight = Math.min(9, availableHeight / Math.max(slide.bullets.length, 1));
  const compactRows = rowHeight < 8;
  return slide.bullets.flatMap((bullet, index): MotionDocBlock[] => {
    const y = startY + index * rowHeight;
    return [
      shapeBlock(context, `bullet-dot-${index}`, {
        fill: tone.accent,
        h: 2.8,
        radius: 100,
        w: 1.6,
        x: startX,
        y: y + 1
      }),
      textBlock(context, "Text", "bullet", bullet, {
        color: tone.text,
        fontFamily: composition.style.fontFamily,
        fontSize: fitBodySize(bullet, compactRows ? 10.5 : 12.75),
        h: Math.max(5, rowHeight - (compactRows ? 0 : 1)),
        lineHeight: 1.28,
        w: width - 5,
        x: startX + 4,
        y
      }, index)
    ];
  });
}

function editorialMetricBlocks(
  context: RenderContext,
  metric: DeckPlanMetric,
  index: number,
  frame: Pick<MetricCardFrame, "h" | "w" | "x" | "y">
): MotionDocBlock[] {
  const metricSlotId = slotId(context.blueprint, "metric", index);
  return [
    shapeBlock(context, `metric-rule-${index}`, {
      fill: context.tone.accent,
      h: 0.32,
      radius: 1,
      slotId: `${metricSlotId}.rule`,
      w: frame.w,
      x: frame.x,
      y: frame.y
    }),
    textBlock(context, "Text", "metric", metric.value, {
      color: context.tone.text,
      fontFamily: context.composition.style.fontFamily,
      fontSize: frame.h >= 26 ? 36 : 27,
      fontWeight: 790,
      h: frame.h >= 26 ? 12 : 7.5,
      letterSpacing: -0.045,
      lineHeight: 0.95,
      slotId: `${metricSlotId}.value`,
      w: frame.w,
      x: frame.x,
      y: frame.y + 3
    }, index, "value"),
    textBlock(context, "Text", "metric", metric.label, {
      color: context.tone.text,
      fontFamily: context.composition.style.fontFamily,
      fontSize: 9.25,
      fontWeight: 700,
      h: frame.h >= 26 ? 3.5 : 3,
      slotId: `${metricSlotId}.label`,
      w: frame.w,
      x: frame.x,
      y: frame.y + (frame.h >= 26 ? 16 : 11)
    }, index, "label"),
    ...(metric.detail ? [textBlock(context, "Text", "metric", metric.detail, {
      color: context.tone.muted,
      fontFamily: context.composition.style.fontFamily,
      fontSize: 7.5,
      h: frame.h >= 26 ? 4 : 3,
      lineHeight: 1.2,
      slotId: `${metricSlotId}.detail`,
      w: frame.w,
      x: frame.x,
      y: frame.y + (frame.h >= 26 ? 20.5 : 14.5)
    }, index, "detail")] : [])
  ];
}

function usesEditorialKnowledgeProfile(context: RenderContext) {
  return context.composition.visualProfile === "editorial-knowledge";
}

function renderMetricStrip(context: RenderContext, y: number): MotionDocBlock[] {
  if (context.slide.metrics.length === 0 || context.blueprint.layout === "metrics-grid") {
    return [];
  }

  const metrics = context.slide.metrics;
  const width = Math.min(21, 88 / metrics.length - 2);
  return metrics.flatMap((metric, index) => metricCardBlocks(context, metric, index, {
    background: context.composition.style.surface,
    color: context.tone.text,
    h: 9,
    radius: 8,
    w: width,
    x: 6 + index * (width + 2),
    y
  }));
}

function renderCornerImage(context: RenderContext): MotionDocBlock[] {
  const assetBinding = context.assetBindings[0];
  if (!assetBinding || ["image-gallery", "image-split"].includes(context.blueprint.layout)) return [];
  return [renderAssetFrame(context, assetBinding, {
    h: 18,
    radius: Math.min(12, context.composition.style.radius),
    w: 16,
    x: 80,
    y: 5
  })];
}

function textBlock(
  context: RenderContext,
  type: Extract<MotionDocTextBlock["type"], "Text">,
  slotKind: DeckPlanTemplateSlotKind,
  text: string,
  props: MotionDocProps,
  itemIndex?: number,
  instance?: string
): MotionDocBlock {
  return {
    props: {
      delay: contentDelay(context, itemIndex),
      enter: slotKind === "title"
        ? context.composition.motion.titleEnter
        : context.composition.motion.contentEnter,
      id: blockId(context, instance ? `${slotKind}-${instance}` : slotKind, itemIndex),
      ...(slotKind === "title" ? { role: "title" } : {}),
      slotId: slotId(context.blueprint, slotKind, itemIndex),
      ...props
    },
    text,
    type
  };
}

function shapeBlock(
  context: RenderContext,
  suffix: string,
  props: MotionDocProps
): MotionDocBlock {
  return {
    props: {
      enter: context.composition.motion.contentEnter,
      id: blockId(context, `shape-${suffix}`),
      operation: "none",
      shape: "rectangle",
      slotId: `${context.blueprint.id}.decoration.${suffix}`,
      ...(usesEditorialKnowledgeProfile(context)
        ? { stroke: "transparent", strokeWidth: 0 }
        : {}),
      ...props
    },
    type: "Shape"
  };
}

function metricCardBlocks(
  context: RenderContext,
  metric: DeckPlanMetric,
  index: number,
  frame: MetricCardFrame
): MotionDocBlock[] {
  const metricSlotId = slotId(context.blueprint, "metric", index);
  const compact = frame.h <= 10;
  const labelY = compact ? frame.y + 5.2 : frame.y + 2;
  const valueY = compact ? frame.y + 0.7 : frame.y + 5;
  const valueHeight = compact ? 4.6 : frame.h >= 26 ? 10 : 7;
  const blocks: MotionDocBlock[] = [
    shapeBlock(context, `metric-card-${index}`, {
      fill: frame.background,
      h: frame.h,
      radius: frame.radius,
      slotId: `${metricSlotId}.card`,
      w: frame.w,
      x: frame.x,
      y: frame.y
    }),
    textBlock(context, "Text", "metric", metric.value, {
      color: frame.color,
      fontFamily: context.composition.style.fontFamily,
      fontSize: compact ? 13.5 : frame.h >= 26 ? 30 : 22.5,
      fontWeight: 760,
      h: valueHeight,
      lineHeight: 1,
      slotId: `${metricSlotId}.value`,
      w: frame.w - 3,
      x: frame.x + 1.5,
      y: valueY
    }, index, "value"),
    textBlock(context, "Text", "metric", metric.label, {
      color: compact ? context.tone.muted : frame.color,
      fontFamily: context.composition.style.fontFamily,
      fontSize: compact ? 7.5 : 8.25,
      fontWeight: 700,
      h: compact ? 2.8 : 3,
      letterSpacing: compact ? 0 : 0.06,
      slotId: `${metricSlotId}.label`,
      w: frame.w - 3,
      x: frame.x + 1.5,
      y: labelY
    }, index, "label")
  ];

  if (!compact && metric.detail) {
    blocks.push(textBlock(context, "Text", "metric", metric.detail, {
      color: context.tone.muted,
      fontFamily: context.composition.style.fontFamily,
      fontSize: 7.5,
      h: 3.5,
      lineHeight: 1.15,
      slotId: `${metricSlotId}.detail`,
      w: frame.w - 3,
      x: frame.x + 1.5,
      y: frame.y + frame.h - 4.5
    }, index, "detail"));
  }

  return blocks;
}

function imageBlock(
  context: RenderContext,
  binding: DeckPlanAssetBinding,
  props: MotionDocProps
): MotionDocBlock {
  const asset = binding.asset;
  if (!asset) return imagePlaceholderBlock(context, binding, props);
  return {
    props: {
      alt: binding.ref.alt ?? asset.alt ?? context.slide.title,
      enter: context.composition.motion.imageEnter,
      fit: "cover",
      id: blockId(context, "image", binding.index),
      scaleX: 1,
      scaleY: 1,
      slotId: slotId(context.blueprint, "image", binding.index),
      src: asset.src,
      ...props
    },
    type: "ImageBlock"
  };
}

function imagePlaceholderBlock(
  context: RenderContext,
  binding: DeckPlanAssetBinding,
  props: MotionDocProps
): MotionDocBlock {
  return {
    props: {
      alt: binding.ref.alt ?? context.slide.title,
      enter: context.composition.motion.contentEnter,
      fill: context.composition.style.surface,
      id: blockId(context, "image-placeholder", binding.index),
      operation: "none",
      shape: "rectangle",
      slotId: slotId(context.blueprint, "image", binding.index),
      ...props
    },
    type: "Shape"
  };
}

function blockId(
  context: RenderContext,
  kind: string,
  itemIndex?: number
) {
  const raw = [
    "deck",
    context.composition.templateId,
    context.slide.id,
    context.slideIndex,
    kind,
    itemIndex
  ].filter((value) => value !== undefined).join("-");
  return raw.replace(/[^A-Za-z0-9._:-]+/g, "-").slice(0, 180);
}

function slotId(
  blueprint: DeckPlanSlideBlueprint,
  kind: DeckPlanTemplateSlotKind,
  itemIndex?: number
) {
  const base = blueprint.slots.find((slot) => slot.kind === kind)?.id ?? `${blueprint.id}.${kind}`;
  return itemIndex === undefined ? base : `${base}.${itemIndex}`;
}

function contentDelay(context: RenderContext, itemIndex?: number) {
  if (itemIndex === undefined) return 0.08;
  return Math.min(0.52, 0.12 + itemIndex * 0.07);
}

function toneForBlueprint(
  composition: DeckPlanTemplateComposition,
  blueprint: DeckPlanSlideBlueprint
): Tone {
  if (blueprint.tone === "dark") {
    return {
      accent: composition.style.accent,
      background: composition.style.darkBackground,
      muted: composition.style.darkMuted,
      surface: composition.style.surface,
      text: composition.style.darkText,
      theme: "dark"
    };
  }

  if (blueprint.tone === "accent") {
    return {
      accent: composition.style.darkText,
      background: composition.style.accent,
      muted: composition.style.darkMuted,
      surface: composition.style.background,
      text: composition.style.darkText,
      theme: "dark"
    };
  }

  return {
    accent: composition.style.accent,
    background: composition.style.background,
    muted: composition.style.muted,
    surface: composition.style.surface,
    text: composition.style.text,
    theme: "light"
  };
}

function safeDeckTitle(value: string) {
  return value
    .replace(/[\r\n]+/g, " ")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .trim();
}

function fitTitleSize(value: string, preferred: number) {
  const length = visualTextLength(value);
  if (length > 100) return Math.max(20.25, preferred * 0.52);
  if (length > 70) return Math.max(22.5, preferred * 0.64);
  if (length > 45) return Math.max(24.75, preferred * 0.78);
  return preferred;
}

function fitBodySize(value: string, preferred: number) {
  const length = visualTextLength(value);
  if (length > 500) return Math.max(9.75, preferred * 0.68);
  if (length > 300) return Math.max(10.5, preferred * 0.78);
  if (length > 160) return Math.max(11.25, preferred * 0.88);
  return preferred;
}

function visualTextLength(value: string) {
  return Array.from(value).reduce(
    (total, character) => total + (/[^\u0000-\u00ff]/.test(character) ? 1.6 : 1),
    0
  );
}

function coverEyebrow(plan: DeckPlanV1) {
  return [deckKindLabel(plan.kind, plan.locale), plan.period]
    .filter(Boolean)
    .join(" / ");
}

function deckKindLabel(kind: DeckPlanKind, locale: DeckPlanV1["locale"]) {
  const labels: Record<DeckPlanKind, Record<DeckPlanV1["locale"], string>> = {
    "progress-report": { en: "PROGRESS REPORT", "zh-TW": "階段進度報告" },
    proposal: { en: "PROPOSAL", "zh-TW": "提案簡報" },
    "research-brief": { en: "RESEARCH BRIEF", "zh-TW": "研究摘要" },
    "teaching-deck": { en: "TEACHING DECK", "zh-TW": "教學簡報" }
  };
  return labels[kind][locale];
}

function roleLabel(role: DeckPlanSlideV1["role"], locale: DeckPlanV1["locale"]) {
  const normalized = role.replaceAll("-", " ").toUpperCase();
  if (locale === "en") return normalized;
  const labels: Partial<Record<DeckPlanSlideV1["role"], string>> = {
    appendix: "補充資料",
    closing: "結語",
    comparison: "比較",
    context: "背景",
    "decisions-risks": "決策與風險",
    evidence: "證據",
    goals: "目標",
    "key-point": "重點",
    metrics: "關鍵指標",
    "next-steps": "下一步",
    overview: "總覽",
    process: "流程",
    timeline: "時間軸"
  };
  return labels[role] ?? normalized;
}
