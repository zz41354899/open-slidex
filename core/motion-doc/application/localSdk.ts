import {
  addMotionDocBlock,
  applyMotionDocTitle,
  deleteMotionDocBlock,
  deleteMotionDocSlide,
  duplicateMotionDocBlock,
  reorderMotionDocBlock,
  reorderMotionDocSlide,
  replaceMotionDocSlide,
  summarizeMotionDoc,
  updateMotionDocBlock,
  updateMotionDocSlideProps,
  type MotionDocAddBlockOptions,
  type MotionDocSupportedAddBlockType
} from "@/core/motion-doc/application/motionDocAutomation";
import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import {
  addMotionDocSlideFromLayout,
  replaceMotionDocSlideWithLayout,
  type MotionDocLayoutOptions
} from "@/core/motion-doc/application/motionDocLayoutAutomation";
import {
  appendMotionDocSlideSource,
  insertMotionDocSlideSource,
  motionDocSlideSourceRanges
} from "@/core/motion-doc/application/motionDocSourceEditor";
import {
  ensureMotionDocSourceBlockIds,
  generateSlideString
} from "@/core/motion-doc/application/motionDocSerialize";
import { getMotionDocCanvasNodes } from "@/core/motion-doc/application/motionDocCanvas";
import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import { MOTION_DOC_CANVAS_PROPS } from "@/core/motion-doc/domain/typography";
import { slideLayouts } from "@/core/motion-doc/domain/slideLayouts";
import { paperShaderDefinitions } from "@/core/motion-doc/application/shaders/paperShaderCatalog";

export type SlideXRevision = `sha256:${string}`;

export type SlideXDocument = {
  revision: SlideXRevision;
  source: string;
  title: string;
};

export type SlideXDocumentAdapter = {
  open(): Promise<SlideXDocument>;
  save(input: {
    expectedRevision: string;
    source: string;
    title: string;
  }): Promise<SlideXDocument>;
};

export type SlideXBlockSelector = {
  blockIndex?: number;
  nodeId?: string;
  slideIndex: number;
};

export type SlideXEditCommand =
  | { title: string; type: "document.setTitle" }
  | { from: string; to: string; type: "asset.repath" }
  | {
      afterSlideIndex?: number;
      options?: MotionDocLayoutOptions;
      slideSource?: string;
      type: "slide.add";
    }
  | { slideIndex: number; type: "slide.delete" }
  | { slideIndex: number; type: "slide.duplicate" }
  | { fromIndex: number; toIndex: number; type: "slide.reorder" }
  | { slideIndex: number; slideSource: string; type: "slide.replace" }
  | {
      layoutId: string;
      options?: MotionDocLayoutOptions;
      slideIndex?: number;
      type: "slide.applyLayout";
    }
  | { props: Record<string, unknown>; slideIndex: number; type: "slide.updateProps" }
  | {
      blockType: MotionDocSupportedAddBlockType;
      options?: MotionDocAddBlockOptions;
      slideIndex: number;
      type: "block.add";
    }
  | (SlideXBlockSelector & {
      props?: Record<string, unknown>;
      text?: string;
      type: "block.update";
    })
  | (SlideXBlockSelector & { type: "block.delete" })
  | (SlideXBlockSelector & { offset?: number; type: "block.duplicate" })
  | {
      fromIndex: number;
      slideIndex: number;
      toIndex: number;
      type: "block.reorder";
    };

export type SlideXBatchResult = {
  source: string;
  summary: ReturnType<typeof summarizeMotionDoc>;
};

export const blankPresentationMdx = `# Untitled Presentation

<Slide duration={5} width={1920} height={1080} fontSizeUnit="pt" background="#FFFFFF" theme="light">
</Slide>`;

const publicLayouts = slideLayouts.map(({ id, name, source }) => ({ id, name, source }));

/**
 * Applies every command against an in-memory source. The caller must persist
 * only the returned source, so a failed command cannot partially update disk.
 */
export function applySlideXBatch(
  source: string,
  commands: readonly SlideXEditCommand[]
): SlideXBatchResult {
  if (commands.length === 0) {
    throw new Error("commands must contain at least one edit.");
  }

  let nextSource = source;

  for (const [commandIndex, command] of commands.entries()) {
    try {
      nextSource = applySlideXCommand(nextSource, command);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown command failure.";
      throw new Error(`commands[${commandIndex}] (${command.type}) failed: ${message}`);
    }
  }

  nextSource = ensureMotionDocSourceBlockIds(nextSource);
  const summary = summarizeMotionDoc(nextSource);
  if (!summary.validation.isValid) {
    const errors = summary.validation.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => issue.message)
      .join(" ");
    throw new Error(`The completed batch produced an invalid MotionDoc. ${errors}`);
  }

  return { source: nextSource, summary };
}

export function inspectSlideXDocument(
  source: string,
  input: {
    nodeId?: string;
    slideIndex?: number;
    sourceRange?: { end: number; start: number };
  } = {}
) {
  const document = parseMotionDoc(source);

  if (input.sourceRange) {
    const { end, start } = input.sourceRange;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end <= start ||
      end > source.length
    ) {
      throw new Error("sourceRange must be inside presentation.mdx.");
    }
    return {
      kind: "source-range" as const,
      range: { end, start },
      source: source.slice(start, end)
    };
  }

  if (input.nodeId) {
    for (const [slideIndex, slide] of document.scenes.entries()) {
      const blockIndex = slide.blocks.findIndex(
        (block, index) => motionDocBlockKey(block, index) === input.nodeId
      );
      if (blockIndex >= 0) {
        return {
          block: slide.blocks[blockIndex],
          blockIndex,
          kind: "node" as const,
          nodeId: input.nodeId,
          slideIndex
        };
      }
    }
    throw new Error(`Node ${input.nodeId} does not exist.`);
  }

  if (input.slideIndex !== undefined) {
    const slide = document.scenes[input.slideIndex];
    const range = motionDocSlideSourceRanges(source)[input.slideIndex];
    if (!slide || !range) {
      throw new Error(`slideIndex ${input.slideIndex} is outside the slide range.`);
    }
    return {
      canvas: getMotionDocCanvasNodes(source, input.slideIndex).slides[0],
      kind: "slide" as const,
      slide,
      slideIndex: input.slideIndex,
      source: range.source,
      sourceRange: { end: range.end, start: range.start }
    };
  }

  const summary = summarizeMotionDoc(source);
  return {
    kind: "document" as const,
    slides: summary.document.scenes.map((scene, slideIndex) => ({
      blockCount: scene.blocks.length,
      duration: scene.duration,
      slideIndex,
      title: scene.blocks.find((block) => "text" in block)?.text ?? `Slide ${slideIndex + 1}`
    })),
    stats: summary.stats,
    title: summary.document.title,
    validation: summary.validation
  };
}

export type SlideXAssetReference = {
  blockIndex?: number;
  prop: "backgroundImage" | "poster" | "shapeImageSrc" | "src";
  slideIndex: number;
  source: string;
};

export function listSlideXAssetReferences(source: string) {
  const document = parseMotionDoc(source);
  const references: SlideXAssetReference[] = [];

  document.scenes.forEach((scene, slideIndex) => {
    const backgroundImage = projectAssetPath(scene.props.backgroundImage);
    if (backgroundImage) {
      references.push({ prop: "backgroundImage", slideIndex, source: backgroundImage });
    }
    scene.blocks.forEach((block, blockIndex) => {
      for (const prop of ["src", "poster", "shapeImageSrc"] as const) {
        const assetPath = projectAssetPath(block.props[prop]);
        if (assetPath) {
          references.push({ blockIndex, prop, slideIndex, source: assetPath });
        }
      }
    });
  });

  return references;
}

export function getSlideXCatalog(input: {
  includeLayoutSource?: boolean;
  section?: "all" | "blocks" | "design-rules" | "exports" | "layouts" | "schema" | "shaders";
} = {}) {
  const section = input.section ?? "all";
  const catalog = {
    blocks: {
      addable: ["Text", "Image", "Video", "Chart", "Table", "ShapeRectangle"],
      authorableTags: ["Text", "ImageBlock", "VideoBlock", "SvgBlock", "Chart", "Table", "Shape"],
      nodeIdentity: "Every editable block has a stable id prop exposed as nodeId.",
      rule: "MCP authoring exactly matches the Workspace toolbar. Removed component tags are rejected during parsing."
    },
    designRules: {
      canvas: { height: 1080, unit: "percent", width: 1920 },
      guidance: [
        "Keep text inside its x/y/w/h frame.",
        "Use a clear type hierarchy and consistent margins.",
        "Use one atomic batch for one coherent design change.",
        "Render after material visual changes."
      ],
      media: "Use project assets or verified HTTPS URLs. Do not invent asset URLs."
    },
    exports: ["html", "mdx", "pptx"],
    layouts: publicLayouts.map((layout) => ({
      id: layout.id,
      name: layout.name,
      ...(input.includeLayoutSource ? { source: layout.source } : {})
    })),
    schema: {
      document: "# Title followed by one or more <Slide> blocks.",
      slide:
        '<Slide duration={5} width={1920} height={1080} fontSizeUnit="pt" background="#fff" theme="light">...</Slide>',
      authorableElements: [
        "Text",
        "ImageBlock",
        "VideoBlock",
        "Chart",
        "Table",
        "Shape"
      ]
    },
    shaders: paperShaderDefinitions.map((shader) => ({
      category: shader.category,
      controls: shader.controls,
      defaultPreset: shader.defaultPreset,
      id: shader.id,
      name: shader.name,
      presets: shader.presets.map((preset) => preset.name)
    }))
  };

  if (section === "all") return catalog;
  if (section === "design-rules") return catalog.designRules;
  return catalog[section];
}

function applySlideXCommand(
  source: string,
  command: SlideXEditCommand
) {
  switch (command.type) {
    case "document.setTitle":
      return applyMotionDocTitle(source, command.title).source;
    case "asset.repath":
      return repathProjectAsset(source, command.from, command.to);
    case "slide.add":
      return addSlide(source, command);
    case "slide.delete":
      return deleteMotionDocSlide(source, command.slideIndex).source;
    case "slide.duplicate":
      return duplicateSlide(source, command.slideIndex);
    case "slide.reorder":
      return reorderMotionDocSlide(source, command.fromIndex, command.toIndex).source;
    case "slide.replace":
      return replaceMotionDocSlide(source, command.slideIndex, command.slideSource).source;
    case "slide.applyLayout":
      return applyLayout(source, command);
    case "slide.updateProps":
      return updateMotionDocSlideProps(source, command.slideIndex, command.props).source;
    case "block.add":
      return addMotionDocBlock(
        source,
        command.slideIndex,
        command.blockType,
        command.options
      ).source;
    case "block.update": {
      const blockIndex = resolveBlockIndex(source, command);
      return updateMotionDocBlock(source, command.slideIndex, blockIndex, {
        props: command.props,
        text: command.text
      }).source;
    }
    case "block.delete": {
      const blockIndex = resolveBlockIndex(source, command);
      return deleteMotionDocBlock(source, command.slideIndex, blockIndex).source;
    }
    case "block.duplicate": {
      const blockIndex = resolveBlockIndex(source, command);
      return duplicateMotionDocBlock(
        source,
        command.slideIndex,
        blockIndex,
        command.offset
      ).source;
    }
    case "block.reorder":
      return reorderMotionDocBlock(
        source,
        command.slideIndex,
        command.fromIndex,
        command.toIndex
      ).source;
    default:
      throw new Error(
        `Unknown command type: ${String((command as { type?: unknown }).type ?? "missing")}.`
      );
  }
}

function repathProjectAsset(source: string, from: string, to: string) {
  if (!isProjectAssetPath(from) || !isProjectAssetPath(to)) {
    throw new Error("Asset paths must be relative paths inside assets/.");
  }
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(\\b(?:src|poster|backgroundImage|shapeImageSrc)\\s*=\\s*["'])${escaped}(["'])`,
    "g"
  );
  const expressionPattern = new RegExp(
    `(\\b(?:src|poster|backgroundImage|shapeImageSrc)\\s*=\\s*\\{\\s*["'])${escaped}(["']\\s*\\})`,
    "g"
  );
  const nextSource = source.replace(pattern, `$1${to}$2`).replace(expressionPattern, `$1${to}$2`);
  if (nextSource === source) {
    throw new Error(`Asset ${from} is not referenced by presentation.mdx.`);
  }
  return nextSource;
}

function isProjectAssetPath(value: string) {
  if (!value.startsWith("assets/") || value.includes("\\") || value.includes("\0")) {
    return false;
  }
  return value
    .slice("assets/".length)
    .split("/")
    .every((part) => part.length > 0 && part !== "." && part !== "..");
}

function projectAssetPath(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  const unwrapped = trimmed.length >= 2 && (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) ? trimmed.slice(1, -1) : trimmed;
  return isProjectAssetPath(unwrapped) ? unwrapped : undefined;
}

function addSlide(
  source: string,
  command: Extract<SlideXEditCommand, { type: "slide.add" }>
) {
  if (command.slideSource) {
    const wrapped = `# Slide\n\n${command.slideSource}`;
    if (parseMotionDoc(wrapped).scenes.length !== 1) {
      throw new Error("slideSource must contain exactly one <Slide> block.");
    }
    return command.afterSlideIndex === undefined
      ? appendMotionDocSlideSource(source, command.slideSource)
      : insertMotionDocSlideSource(source, command.afterSlideIndex, command.slideSource, "after");
  }

  const blankLayout = publicLayouts.find((layout) => layout.id === "blank");
  if (!blankLayout) throw new Error("The built-in blank layout is unavailable.");
  return addMotionDocSlideFromLayout(
    source,
    blankLayout.source,
    command.afterSlideIndex,
    command.options
  );
}

function duplicateSlide(source: string, slideIndex: number) {
  const range = motionDocSlideSourceRanges(source)[slideIndex];
  if (!range) throw new Error(`slideIndex ${slideIndex} is outside the slide range.`);
  return insertMotionDocSlideSource(source, slideIndex, range.source, "after");
}

function applyLayout(
  source: string,
  command: Extract<SlideXEditCommand, { type: "slide.applyLayout" }>
) {
  const layout = publicLayouts.find((candidate) => candidate.id === command.layoutId);
  if (!layout) throw new Error(`Unknown layoutId: ${command.layoutId}.`);
  const options = { ...command.options, layoutId: command.layoutId };
  return command.slideIndex === undefined
    ? addMotionDocSlideFromLayout(source, layout.source, undefined, options)
    : replaceMotionDocSlideWithLayout(
        source,
        command.slideIndex,
        layout.source,
        options
      );
}

function resolveBlockIndex(source: string, selector: SlideXBlockSelector) {
  const slide = parseMotionDoc(source).scenes[selector.slideIndex];
  if (!slide) {
    throw new Error(`slideIndex ${selector.slideIndex} is outside the slide range.`);
  }
  if (selector.nodeId) {
    const blockIndex = slide.blocks.findIndex(
      (block, index) => motionDocBlockKey(block, index) === selector.nodeId
    );
    if (blockIndex < 0) {
      throw new Error(`Node ${selector.nodeId} does not exist on slide ${selector.slideIndex}.`);
    }
    return blockIndex;
  }
  if (selector.blockIndex === undefined) {
    throw new Error("Provide nodeId or blockIndex.");
  }
  return selector.blockIndex;
}

export function createBlankSlideSource(
  props: Record<string, string | number> = {}
) {
  return generateSlideString({
    blocks: [],
    duration: typeof props.duration === "number" ? props.duration : 5,
    props: {
      ...MOTION_DOC_CANVAS_PROPS,
      background: "#FFFFFF",
      duration: 5,
      theme: "light",
      ...props
    }
  });
}
