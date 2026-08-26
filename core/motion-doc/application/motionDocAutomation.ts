import { getMotionDocStats } from "@/core/motion-doc/application/mdxStats";
import {
  createMotionDocBlock,
  type AddBlockType
} from "@/core/motion-doc/application/motionDocBlockFactory";
import {
  generateSlideString
} from "@/core/motion-doc/application/motionDocSerialize";
import { materializeFreeformSource } from "@/core/motion-doc/application/motionDocFreeform";
import {
  deleteMotionDocSlideSource,
  motionDocSlideSourceRanges,
  reorderMotionDocSlideSource,
  replaceMotionDocSlideSource
} from "@/core/motion-doc/application/motionDocSourceEditor";
import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import { validateMotionDocChartProps } from "@/core/motion-doc/domain/chart";
import type {
  MotionDocBlock,
  MotionDocProps,
  MotionDocScene,
  ParsedMotionDoc
} from "@/core/motion-doc/domain/motionDocTypes";
import {
  isMotionDocEnterAnimation,
  isMotionDocSlideTransition,
  motionDocEnterAnimations,
  motionDocSlideTransitions
} from "@/core/motion-doc/domain/motionVocabulary";
import {
  legacyFontPixelsToPoints,
  MOTION_DOC_CANVAS_PROPS
} from "@/core/motion-doc/domain/typography";

export const motionDocAddBlockTypes = [
  "Text",
  "Image",
  "Video",
  "Chart",
  "Table",
  "ShapeRectangle"
] as const satisfies readonly AddBlockType[];

export type MotionDocSupportedAddBlockType = (typeof motionDocAddBlockTypes)[number];

export type MotionDocValidationIssue = {
  code?: string;
  message: string;
  path?: string;
  severity: "error" | "warning";
};

export type MotionDocSummary = {
  document: ParsedMotionDoc;
  stats: {
    sceneCount: number;
    totalDuration: number;
  };
  validation: {
    isValid: boolean;
    issues: MotionDocValidationIssue[];
  };
};

export type MotionDocDeckSlideInput = {
  body?: string;
  bullets?: string[];
  title: string;
};

export type MotionDocDeckInput = {
  accent?: string;
  background?: string;
  slides: MotionDocDeckSlideInput[];
  subtitle?: string;
  theme?: "dark" | "light";
  title: string;
};

export type MotionDocAddBlockOptions = {
  afterBlockIndex?: number;
  position?: {
    h?: number;
    w?: number;
    x?: number;
    y?: number;
  };
  props?: Record<string, unknown>;
  text?: string;
};

const supportedComponentTags = new Set([
  "Chart",
  "HtmlEmbedBlock",
  "ImageBlock",
  "Scene",
  "Shape",
  "Slide",
  "Table",
  "Text",
  "SvgBlock",
  "VideoBlock"
]);

const nonCanonicalMotionDocPropAliases = {
  align: "textAlign",
  tracking: "letterSpacing",
  weight: "fontWeight"
} as const satisfies Readonly<Record<string, string>>;

export function summarizeMotionDoc(source: string): MotionDocSummary {
  const document = parseMotionDoc(source);
  const stats = getMotionDocStats(source);
  const issues = validateMotionDocSource(source, document);

  return {
    document,
    stats,
    validation: {
      isValid: !issues.some((issue) => issue.severity === "error"),
      issues
    }
  };
}

export function createMotionDocFromOutline(input: MotionDocDeckInput) {
  const theme = input.theme ?? "dark";
  const background = input.background ?? (theme === "light" ? "#f7f7f2" : "#050505");
  const accent = input.accent ?? (theme === "light" ? "#111111" : "#ffffff");
  const contentSlides = input.slides.length > 0 ? input.slides : [{ title: "Overview" }];
  const scenes = [
    createCoverScene(input.title, input.subtitle, { accent, background, theme }),
    ...contentSlides.map((slide, index) =>
      createContentScene(slide, index, { accent, background, theme })
    )
  ];

  const source = `# ${safeMdxText(input.title || "Untitled Deck")}\n\n${scenes
    .map((scene) => generateSlideString(scene))
    .join("\n\n")}`;

  return withSummary(source);
}

export function applyMotionDocTitle(source: string, title: string) {
  const nextTitle = safeMdxText(title || "Untitled Deck");
  const nextSource = source.match(/^#\s+.+$/m)
    ? source.replace(/^#\s+.+$/m, `# ${nextTitle}`)
    : `# ${nextTitle}\n\n${source.trimStart()}`;

  return withSummary(nextSource);
}

export function applyMotionDocTextReplacements(
  source: string,
  replacements: Record<string, string>
) {
  const nextSource = Object.entries(replacements).reduce((currentSource, [from, to]) => {
    if (!from) return currentSource;
    return currentSource.split(from).join(to);
  }, source);

  return withSummary(nextSource);
}

export function replaceMotionDocSlide(
  source: string,
  slideIndex: number,
  slideSource: string
) {
  assertSlideIndex(source, slideIndex);
  assertSingleSlideSource(slideSource);
  const normalizedSlide = parseMotionDoc(
    materializeFreeformSource(`# Replacement\n\n${slideSource}`)
  ).scenes[0];

  if (!normalizedSlide) {
    throw new Error("slideSource must contain exactly one <Slide> block.");
  }

  return withSummary(
    replaceMotionDocSlideSource(source, slideIndex, generateSlideString(normalizedSlide))
  );
}

export function updateMotionDocSlideProps(
  source: string,
  slideIndex: number,
  props: Record<string, unknown>
) {
  const slide = getSlideOrThrow(source, slideIndex);
  const nextSlide = {
    ...slide,
    props: {
      ...slide.props,
      ...coerceMotionProps(props)
    }
  };

  return withSummary(replaceMotionDocSlideSource(source, slideIndex, generateSlideString(nextSlide)));
}

export function addMotionDocBlock(
  source: string,
  slideIndex: number,
  type: MotionDocSupportedAddBlockType,
  options: MotionDocAddBlockOptions = {}
) {
  if (!motionDocAddBlockTypes.includes(type)) {
    throw new Error(`Unsupported block type: ${type}`);
  }

  const slide = getSlideOrThrow(source, slideIndex);
  const block = applyBlockOptions(createMotionDocBlock(type), options);
  const blocks = [...slide.blocks];
  const insertIndex = resolveBlockInsertIndex(blocks.length, options.afterBlockIndex);

  blocks.splice(insertIndex, 0, block);
  const nextSlide = {
    ...slide,
    blocks
  };

  return {
    ...withSummary(replaceMotionDocSlideSource(source, slideIndex, generateSlideString(nextSlide))),
    blockIndex: insertIndex
  };
}

export function updateMotionDocBlock(
  source: string,
  slideIndex: number,
  blockIndex: number,
  updates: {
    props?: Record<string, unknown>;
    text?: string;
  }
) {
  const slide = getSlideOrThrow(source, slideIndex);
  const block = getBlockOrThrow(slide, slideIndex, blockIndex);
  const nextBlock = {
    ...block,
    props: {
      ...block.props,
      ...coerceMotionProps(updates.props ?? {})
    }
  } as MotionDocBlock;

  if (updates.text !== undefined && "text" in nextBlock) {
    nextBlock.text = safeMdxText(updates.text);
  }

  return replaceBlockInSlide(source, slideIndex, slide, blockIndex, nextBlock);
}

export function deleteMotionDocBlock(
  source: string,
  slideIndex: number,
  blockIndex: number
) {
  const slide = getSlideOrThrow(source, slideIndex);

  getBlockOrThrow(slide, slideIndex, blockIndex);

  const blocks = [...slide.blocks];
  blocks.splice(blockIndex, 1);

  return withSummary(
    replaceMotionDocSlideSource(source, slideIndex, generateSlideString({ ...slide, blocks }))
  );
}

export function duplicateMotionDocBlock(
  source: string,
  slideIndex: number,
  blockIndex: number,
  offset = 2
) {
  const slide = getSlideOrThrow(source, slideIndex);
  const block = getBlockOrThrow(slide, slideIndex, blockIndex);
  const duplicate = cloneAutomationBlock(block, offset);
  const blocks = [...slide.blocks];
  const nextBlockIndex = blockIndex + 1;

  blocks.splice(nextBlockIndex, 0, duplicate);

  return {
    ...withSummary(
      replaceMotionDocSlideSource(source, slideIndex, generateSlideString({ ...slide, blocks }))
    ),
    blockIndex: nextBlockIndex
  };
}

export function reorderMotionDocBlock(
  source: string,
  slideIndex: number,
  fromIndex: number,
  toIndex: number
) {
  const slide = getSlideOrThrow(source, slideIndex);

  getBlockOrThrow(slide, slideIndex, fromIndex);
  getBlockOrThrow(slide, slideIndex, toIndex);

  if (fromIndex === toIndex) {
    return withSummary(source);
  }

  const blocks = [...slide.blocks];
  const [movedBlock] = blocks.splice(fromIndex, 1);
  blocks.splice(toIndex, 0, movedBlock);

  return withSummary(
    replaceMotionDocSlideSource(source, slideIndex, generateSlideString({ ...slide, blocks }))
  );
}

export function deleteMotionDocSlide(source: string, slideIndex: number) {
  assertSlideIndex(source, slideIndex);
  return withSummary(deleteMotionDocSlideSource(source, slideIndex));
}

export function reorderMotionDocSlide(
  source: string,
  fromIndex: number,
  toIndex: number
) {
  const document = parseMotionDoc(source);

  if (fromIndex < 0 || fromIndex >= document.scenes.length) {
    throw new Error(`fromIndex ${fromIndex} is outside the slide range.`);
  }

  if (toIndex < 0 || toIndex >= document.scenes.length) {
    throw new Error(`toIndex ${toIndex} is outside the slide range.`);
  }

  if (fromIndex === toIndex) {
    return withSummary(source);
  }

  return withSummary(reorderMotionDocSlideSource(source, fromIndex, toIndex));
}

function withSummary(source: string) {
  return {
    source,
    summary: summarizeMotionDoc(source)
  };
}

function replaceBlockInSlide(
  source: string,
  slideIndex: number,
  slide: MotionDocScene,
  blockIndex: number,
  block: MotionDocBlock
) {
  const blocks = [...slide.blocks];
  blocks[blockIndex] = block;

  return withSummary(
    replaceMotionDocSlideSource(source, slideIndex, generateSlideString({ ...slide, blocks }))
  );
}

function getBlockOrThrow(
  slide: MotionDocScene,
  slideIndex: number,
  blockIndex: number
) {
  const block = slide.blocks[blockIndex];

  if (!block) {
    throw new Error(
      `blockIndex ${blockIndex} is outside the block range for slide ${slideIndex}.`
    );
  }

  return block;
}

function resolveBlockInsertIndex(blockCount: number, afterBlockIndex: number | undefined) {
  if (afterBlockIndex === undefined) return blockCount;

  if (!Number.isInteger(afterBlockIndex) || afterBlockIndex < 0 || afterBlockIndex >= blockCount) {
    throw new Error(`afterBlockIndex ${afterBlockIndex} is outside the block range.`);
  }

  return afterBlockIndex + 1;
}

function cloneAutomationBlock(block: MotionDocBlock, offset: number): MotionDocBlock {
  const props = { ...block.props };

  for (const key of ["x", "y"] as const) {
    const value = props[key];
    if (typeof value === "number") {
      props[key] = Math.min(100, Math.max(0, value + offset));
    }
  }

  delete props.groupId;
  delete props.groupName;

  return {
    ...block,
    props
  } as MotionDocBlock;
}

function createCoverScene(
  title: string,
  subtitle: string | undefined,
  themeProps: Pick<MotionDocScene, "props">["props"]
): MotionDocScene {
  return {
    duration: 5,
    props: {
      ...themeProps,
      ...MOTION_DOC_CANVAS_PROPS,
      duration: 5,
      shader: "mesh-gradient",
      shaderPreset: "Default",
      shaderIntensity: 0.5
    },
    blocks: [
      {
        type: "Text",
        props: {
          enter: "fadeUp",
          fontSize: legacyFontPixelsToPoints(76),
          fontWeight: 800,
          h: 22,
          w: 82,
          x: 8,
          y: subtitle ? 20 : 30
        },
        text: safeMdxText(title || "Untitled Deck")
      },
      ...(subtitle
        ? [
            {
              type: "Text" as const,
              props: {
                delay: 0.2,
                enter: "fadeUp",
                fontSize: legacyFontPixelsToPoints(24),
                h: 18,
                lineHeight: 1.45,
                w: 66,
                x: 8,
                y: 51
              },
              text: safeMdxText(subtitle)
            }
          ]
        : [])
    ]
  };
}

function createContentScene(
  slide: MotionDocDeckSlideInput,
  index: number,
  themeProps: Pick<MotionDocScene, "props">["props"]
): MotionDocScene {
  const textBlocks: MotionDocBlock[] = [];
  const hasBullets = Boolean(slide.bullets?.length);

  if (slide.body) {
    textBlocks.push({
      type: "Text",
      props: {
        delay: 0.16,
        enter: "fadeUp",
        fontSize: legacyFontPixelsToPoints(23),
        h: hasBullets ? 15 : 30,
        lineHeight: 1.45,
        w: 62,
        x: 8,
        y: 33
      },
      text: safeMdxText(slide.body)
    });
  }

  if (hasBullets) {
    textBlocks.push({
      type: "Text",
      props: {
        delay: 0.24,
        enter: "fadeUp",
        fontSize: legacyFontPixelsToPoints(24),
        h: 30,
        lineHeight: 1.48,
        listType: "bullet",
        w: 64,
        x: 8,
        y: slide.body ? 52 : 38
      },
      text: (slide.bullets ?? []).map((bullet) => safeMdxText(bullet)).join("\n")
    });
  }

  return {
    duration: 5,
    props: {
      ...themeProps,
      ...MOTION_DOC_CANVAS_PROPS,
      duration: 5
    },
    blocks: [
      {
        type: "Text",
        props: {
          color: themeProps.theme === "light" ? "#111111" : "#ffffff",
          enter: index % 2 === 0 ? "slideLeft" : "fadeUp",
          fontSize: legacyFontPixelsToPoints(54),
          fontWeight: 760,
          h: 16,
          w: 82,
          x: 8,
          y: 12
        },
        text: safeMdxText(slide.title || `Slide ${index + 1}`)
      },
      ...textBlocks
    ]
  };
}

function applyBlockOptions(
  block: MotionDocBlock,
  options: MotionDocAddBlockOptions
): MotionDocBlock {
  if (!("props" in block)) {
    return block;
  }

  const nextProps = {
    ...block.props,
    ...coerceMotionProps(options.props ?? {}),
    ...coerceMotionProps(options.position ?? {})
  };

  if (block.type === "Text" && options.text !== undefined) {
    return {
      ...block,
      props: nextProps,
      text: safeMdxText(options.text)
    };
  }

  return {
    ...block,
    props: nextProps
  };
}

function validateMotionDocSource(
  source: string,
  document: ParsedMotionDoc
): MotionDocValidationIssue[] {
  const issues: MotionDocValidationIssue[] = [];
  const blockIds = new Set<string>();
  const sharedHtmlSources = new Map<string, string>();
  const sharedSvgSources = new Map<string, string>();
  const executableSource = stripMarkdownCode(source);
  const openingSlideCount = [...source.matchAll(/<(?:Slide|Scene)\b/g)].length;
  const closingSlideCount = [...source.matchAll(/<\/(?:Slide|Scene)>/g)].length;

  if (openingSlideCount !== closingSlideCount) {
    issues.push({
      message: `Slide tag count is unbalanced: ${openingSlideCount} opening tag(s), ${closingSlideCount} closing tag(s).`,
      severity: "error"
    });
  }

  if (document.scenes.length === 0) {
    issues.push({
      message: "No <Slide> blocks were found.",
      severity: "error"
    });
  }

  if (!document.title || document.title === "Slider Preview") {
    issues.push({
      message: "The deck is missing a top-level '# Title'.",
      path: "title",
      severity: "warning"
    });
  }

  if (/^\s*(?:import|export)\s/m.test(executableSource)) {
    issues.push({
      message: "MDX import and export statements are not allowed in SlideX documents.",
      severity: "error"
    });
  }

  if (containsMarkdownOutsideSlides(source)) {
    issues.push({
      message: "Markdown content must be inside a <Slide> block; only the deck '# Title' may appear outside slides.",
      severity: "error"
    });
  }

  if (/<\/?[a-z][A-Za-z0-9:-]*\b/.test(executableSource)) {
    issues.push({
      message: "Raw HTML and lowercase JSX elements are not allowed in SlideX documents.",
      severity: "error"
    });
  }

  if (containsUnsupportedJavaScriptExpression(executableSource)) {
    issues.push({
      message: "JavaScript expressions are not allowed; MotionDoc attributes only accept literal strings, numbers, and booleans.",
      severity: "error"
    });
  }

  for (const tag of findUnsupportedTags(executableSource)) {
    issues.push({
      message: `<${tag}> is not a supported SlideX MotionDoc component.`,
      severity: "error"
    });
  }

  document.scenes.forEach((scene, sceneIndex) => {
    const slideTransition = scene.props.slideTransition;
    if (
      slideTransition !== undefined &&
      slideTransition !== "" &&
      !isMotionDocSlideTransition(slideTransition)
    ) {
      issues.push({
        message: `slideTransition must be one of: ${motionDocSlideTransitions.join(", ")}.`,
        path: `scenes[${sceneIndex}].props.slideTransition`,
        severity: "error"
      });
    }

    if (!Number.isFinite(scene.duration) || scene.duration <= 0) {
      issues.push({
        message: "Slide duration should be a positive number.",
        path: `scenes[${sceneIndex}].duration`,
        severity: "warning"
      });
    }

    scene.blocks.forEach((block, blockIndex) => {
      if (!("props" in block)) return;

      const blockId = typeof block.props.id === "string" ? block.props.id.trim() : "";
      if (blockId) {
        if (blockIds.has(blockId)) {
          issues.push({
            message: `Block id must be unique across the deck: ${blockId}.`,
            path: `scenes[${sceneIndex}].blocks[${blockIndex}].props.id`,
            severity: "error"
          });
        }
        blockIds.add(blockId);
      }

      for (const [alias, canonical] of Object.entries(nonCanonicalMotionDocPropAliases)) {
        if (block.props[alias] === undefined) continue;
        issues.push({
          code: "non_canonical_prop",
          message: `${alias} is not a MotionDoc typography prop and is ignored; use ${canonical} instead.`,
          path: `scenes[${sceneIndex}].blocks[${blockIndex}].props.${alias}`,
          severity: "warning"
        });
      }

      const enter = block.props.enter;
      if (
        enter !== undefined &&
        enter !== "" &&
        !isMotionDocEnterAnimation(enter)
      ) {
        issues.push({
          message: `enter must be one of: ${motionDocEnterAnimations.join(", ")}.`,
          path: `scenes[${sceneIndex}].blocks[${blockIndex}].props.enter`,
          severity: "error"
        });
      }

      for (const key of ["x", "y", "w", "h"] as const) {
        const value = block.props[key];

        if (value === undefined) continue;

        if (typeof value !== "number" || !Number.isFinite(value)) {
          issues.push({
            message: `${key} should be a numeric percent value.`,
            path: `scenes[${sceneIndex}].blocks[${blockIndex}].props.${key}`,
            severity: "error"
          });
          continue;
        }

        if ((key === "w" || key === "h") && value <= 0) {
          issues.push({
            message: `${key} should be greater than 0.`,
            path: `scenes[${sceneIndex}].blocks[${blockIndex}].props.${key}`,
            severity: "error"
          });
        } else if (value < 0 || value > 100) {
          issues.push({
            message: `${key} is outside the usual 0-100 percent frame range.`,
            path: `scenes[${sceneIndex}].blocks[${blockIndex}].props.${key}`,
            severity: "warning"
          });
        }
      }

      if (
        (block.type === "ImageBlock" || block.type === "VideoBlock" || block.type === "SvgBlock" || block.type === "HtmlEmbedBlock") &&
        !block.props.src
      ) {
        issues.push({
          message: `${block.type} should include a src prop.`,
          path: `scenes[${sceneIndex}].blocks[${blockIndex}].props.src`,
          severity: "warning"
        });
      }

      if (block.type === "Chart") {
        for (const message of validateMotionDocChartProps(block.props)) {
          issues.push({
            message,
            path: `scenes[${sceneIndex}].blocks[${blockIndex}].props`,
            severity: "error"
          });
        }
      }

      if (block.type === "SvgBlock") {
        const sharedScene = typeof block.props.sharedScene === "string" ? block.props.sharedScene.trim() : "";
        const source = typeof block.props.src === "string" ? block.props.src.trim() : "";
        if (sharedScene) {
          const priorSource = sharedSvgSources.get(sharedScene);
          if (priorSource && priorSource !== source) {
            issues.push({
              message: `SvgBlock declarations using sharedScene="${sharedScene}" must use the same src.`,
              path: `scenes[${sceneIndex}].blocks[${blockIndex}].props.src`,
              severity: "error"
            });
          } else if (source) {
            sharedSvgSources.set(sharedScene, source);
          }
        }
        const stage = Number(block.props.stage ?? 0);
        if (!Number.isInteger(stage) || stage < 0) {
          issues.push({
            message: "SvgBlock stage must be a non-negative integer.",
            path: `scenes[${sceneIndex}].blocks[${blockIndex}].props.stage`,
            severity: "error"
          });
        }
        const stageDuration = Number(block.props.stageDuration ?? 0.6);
        if (!Number.isFinite(stageDuration) || stageDuration < 0 || stageDuration > 30) {
          issues.push({
            message: "SvgBlock stageDuration must be between 0 and 30 seconds.",
            path: `scenes[${sceneIndex}].blocks[${blockIndex}].props.stageDuration`,
            severity: "error"
          });
        }
      }

      if (block.type === "HtmlEmbedBlock") {
        const sharedScene = typeof block.props.sharedScene === "string" ? block.props.sharedScene.trim() : "";
        const source = typeof block.props.src === "string" ? block.props.src.trim() : "";
        if (sharedScene) {
          const priorSource = sharedHtmlSources.get(sharedScene);
          if (priorSource && priorSource !== source) {
            issues.push({
              message: `HtmlEmbedBlock declarations using sharedScene="${sharedScene}" must use the same src.`,
              path: `scenes[${sceneIndex}].blocks[${blockIndex}].props.src`,
              severity: "error"
            });
          } else if (source) {
            sharedHtmlSources.set(sharedScene, source);
          }
        }
        const page = Number(block.props.page ?? 1);
        if (!Number.isInteger(page) || page < 1) {
          issues.push({
            message: "HtmlEmbedBlock page must be a positive integer.",
            path: `scenes[${sceneIndex}].blocks[${blockIndex}].props.page`,
            severity: "error"
          });
        }
      }
    });
  });

  return issues;
}

function findUnsupportedTags(source: string) {
  const tags = new Set<string>();

  for (const match of source.matchAll(/<\/?([A-Z][A-Za-z0-9]*)\b/g)) {
    const tag = match[1];

    if (!supportedComponentTags.has(tag)) {
      tags.add(tag);
    }
  }

  return [...tags].sort();
}

function stripMarkdownCode(source: string) {
  return source
    .replace(/```[\s\S]*?```/g, "")
    .replace(/~~~[\s\S]*?~~~/g, "")
    .replace(/`[^`\n]*`/g, "");
}

function containsMarkdownOutsideSlides(source: string) {
  const outside = source.replace(
    /<(?:Slide|Scene)\b[^>]*>[\s\S]*?<\/(?:Slide|Scene)>/g,
    ""
  );
  const withoutDeckTitle = outside
    .replace(/^\s*#\s+[^\n]+(?:\n|$)/, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  return withoutDeckTitle.trim().length > 0;
}

function containsUnsupportedJavaScriptExpression(source: string) {
  const tagPattern = /<[^>]+>/g;
  const sourceWithoutTags = source.replace(tagPattern, "");
  if (/[{}]/.test(sourceWithoutTags)) return true;

  for (const tag of source.matchAll(tagPattern)) {
    for (const expression of tagExpressions(tag[0])) {
      if (/^(?:true|false|-?(?:\d+\.?\d*|\.\d+))$/.test(expression.value)) continue;
      if (expression.name === "data" && isSafeChartDataLiteral(expression.value)) continue;
      return true;
    }
  }

  return false;
}

function tagExpressions(tag: string) {
  const expressions: Array<{ name: string; value: string }> = [];
  const openingPattern = /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{/g;
  for (const match of tag.matchAll(openingPattern)) {
    const name = match[1];
    const start = (match.index ?? 0) + match[0].length;
    let cursor = start;
    let depth = 1;
    let quote: '"' | "'" | null = null;
    while (cursor < tag.length && depth > 0) {
      const character = tag[cursor];
      if (quote) {
        if (character === quote && tag[cursor - 1] !== "\\") quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
      }
      cursor += 1;
    }
    if (depth === 0) expressions.push({ name, value: tag.slice(start, cursor - 1).trim() });
  }
  return expressions;
}

function isSafeChartDataLiteral(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.length >= 1 && parsed.length <= 24 && parsed.every((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const record = item as Record<string, unknown>;
      if (Object.keys(record).some((key) => !["color", "label", "size", "value", "x"].includes(key))) return false;
      if (typeof record.label !== "string" || !Number.isFinite(Number(record.value))) return false;
      if (record.color !== undefined && (typeof record.color !== "string" || !/^#[0-9a-f]{6}$/i.test(record.color))) return false;
      if (record.x !== undefined && !Number.isFinite(Number(record.x))) return false;
      return record.size === undefined || Number.isFinite(Number(record.size));
    });
  } catch {
    return false;
  }
}

function getSlideOrThrow(source: string, slideIndex: number) {
  const document = parseMotionDoc(materializeFreeformSource(source));
  const slide = document.scenes[slideIndex];

  if (!slide) {
    throw new Error(`slideIndex ${slideIndex} is outside the slide range.`);
  }

  return slide;
}

function assertSlideIndex(source: string, slideIndex: number) {
  getSlideOrThrow(source, slideIndex);
}

function assertSingleSlideSource(slideSource: string) {
  const document = parseMotionDoc(`# Replacement\n\n${slideSource}`);

  if (document.scenes.length !== 1) {
    throw new Error("slideSource must contain exactly one <Slide> block.");
  }
}

function coerceMotionProps(props: Record<string, unknown>) {
  const nextProps: MotionDocProps = {};

  for (const [key, value] of Object.entries(props)) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) continue;

    if (typeof value === "number" && Number.isFinite(value)) {
      nextProps[key] = value;
    } else if (typeof value === "boolean") {
      nextProps[key] = value ? "true" : "false";
    } else if (typeof value === "string") {
      nextProps[key] = value;
    }
  }

  return nextProps;
}

function safeMdxText(value: string) {
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
