import {
  applySlideXBatch,
  motionDocBlockKey,
  parseMotionDoc,
  type SlideXEditCommand
} from "@open-slidex/sdk";

import type { AssistantCanvasTarget, AssistantCanvasTrace } from "@/core/motion-doc/domain/assistantCanvasActivity";
import { generateSlideString } from "@/core/motion-doc/application/motionDocSerialize";
import type { MotionDocFrame } from "@/core/motion-doc/domain/frame";
import type { MotionDocBlock, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { blockFrame } from "@/features/pitch/application/previewCanvas";
import type { CanvasEditPreviewPlan } from "../shared/aiEvents";

export const maxAiCanvasPreviewSteps = 18;
export const minAiCanvasPreviewDurationMs = 2_400;
export const maxAiCanvasPreviewDurationMs = 7_600;

export type AiCanvasPreviewStep = {
  source: string;
  trace: AssistantCanvasTrace;
};

export type AiCanvasPreviewSequence = {
  intervalMs: number;
  steps: AiCanvasPreviewStep[];
};

export function buildAiCanvasPreviewSequence(
  source: string,
  revision: string,
  plan: CanvasEditPreviewPlan,
  toolCallId: string
): AiCanvasPreviewSequence | undefined {
  if (plan.expectedRevision !== revision || plan.kind !== "edit-commands") return undefined;
  const commands = plan.commands.filter(isPreviewCommand);
  if (commands.length !== plan.commands.length || commands.length === 0) return undefined;

  let workingSource = source;
  const actions = commands.flatMap((command) => {
    try {
      const beforeSource = workingSource;
      const nextSource = applySlideXBatch(beforeSource, [command]).source;
      workingSource = nextSource;
      return semanticPreviewActions(command, beforeSource, nextSource, toolCallId);
    } catch {
      return [];
    }
  });

  if (actions.length === 0) return undefined;
  const sampledActions = samplePreviewActions(actions, Math.floor(maxAiCanvasPreviewSteps / 2));
  const steps = sampledActions.flatMap((action, index) => {
    const priorSource = index === 0 ? source : sampledActions[index - 1]?.source ?? source;
    return [
      {
        source: priorSource,
        trace: {
          ...action.trace,
          gesture: "move" as const,
          label: movementLabel(action.trace.label)
        }
      },
      {
        ...action,
        trace: { ...action.trace, gesture: "press" as const }
      }
    ];
  });
  const targetDuration = Math.min(
    maxAiCanvasPreviewDurationMs,
    Math.max(minAiCanvasPreviewDurationMs, sampledActions.length * 950)
  );
  return {
    intervalMs: Math.floor(targetDuration / Math.max(steps.length - 1, 1)),
    steps
  };
}

export function compactAiCanvasPreviewForReducedMotion(sequence: AiCanvasPreviewSequence): AiCanvasPreviewSequence {
  const finalStep = sequence.steps.at(-1);
  return finalStep ? { intervalMs: 0, steps: [{ ...finalStep, trace: { ...finalStep.trace, gesture: "settle" } }] } : sequence;
}

function samplePreviewActions(actions: AiCanvasPreviewStep[], maximum: number) {
  if (actions.length <= maximum) return actions;
  const indices = [...new Set(Array.from(
    { length: maximum },
    (_, index) => Math.ceil(((index + 1) * actions.length) / maximum) - 1
  ))];
  return indices.flatMap((index) => actions[index] ? [actions[index]] : []);
}

function isPreviewCommand(value: Record<string, unknown>): value is SlideXEditCommand & Record<string, unknown> {
  return typeof value.type === "string" && previewCommandTypes.has(value.type);
}

function semanticPreviewActions(
  command: SlideXEditCommand,
  beforeSource: string,
  nextSource: string,
  toolCallId: string
): AiCanvasPreviewStep[] {
  const construction = slideConstruction(command, beforeSource, nextSource);
  if (construction) {
    const { afterSlide, mode, slideIndex } = construction;
    const states = constructionStates(afterSlide);
    const sceneSteps = states.map((state, stateIndex) => {
      const progressiveScene = { ...afterSlide, blocks: state.blocks };
      const progressiveSource = stateIndex === states.length - 1
        ? nextSource
        : progressiveSlideSource(beforeSource, command, mode, slideIndex, progressiveScene);
      const { block, blockIndex } = state;
      const target = block
        ? blockTarget(block, blockIndex, slideIndex)
        : { kind: "slide" as const, slideIndex };
      return {
        source: progressiveSource,
        trace: {
          ...(block ? { frame: blockFrame(block) } : {}),
          id: toolCallId,
          label: state.label ?? (mode === "add" ? "Creating slide" : "Preparing slide"),
          status: "running" as const,
          target
        }
      };
    });
    return sceneSteps;
  }

  const { frame, target } = previewTarget(command, beforeSource, nextSource);
  return [{
    source: nextSource,
    trace: {
      ...(frame ? { frame } : {}),
      id: toolCallId,
      label: previewCommandLabel(command),
      status: "running",
      target
    }
  }];
}

function constructionStates(scene: MotionDocScene) {
  const states: Array<{ block?: MotionDocBlock; blockIndex: number; blocks: MotionDocBlock[]; label?: string }> = [
    { blockIndex: -1, blocks: [] }
  ];
  for (const [blockIndex, block] of scene.blocks.entries()) {
    const partial = partialTextBlock(block);
    if (partial) {
      states.push({
        block: partial,
        blockIndex,
        blocks: [...scene.blocks.slice(0, blockIndex), partial],
        label: block.type === "Title" || block.type === "heading" ? "Typing title" : "Typing text"
      });
    }
    states.push({
      block,
      blockIndex,
      blocks: scene.blocks.slice(0, blockIndex + 1),
      label: blockActionLabel(block)
    });
  }
  return states;
}

function partialTextBlock(block: MotionDocBlock): MotionDocBlock | undefined {
  if (!(block.type === "Title" || block.type === "Text" || block.type === "heading")) return undefined;
  const text = block.text.trim();
  if (text.length < 8) return undefined;
  const boundary = Math.max(4, Math.floor(text.length * 0.46));
  const partialText = text.slice(0, boundary).replace(/\s+\S*$/, "").trim() || text.slice(0, boundary).trim();
  return { ...block, text: `${partialText}…` };
}

function slideConstruction(command: SlideXEditCommand, beforeSource: string, nextSource: string) {
  const before = parseMotionDoc(beforeSource);
  const next = parseMotionDoc(nextSource);
  if (command.type === "slide.replace") {
    const afterSlide = next.scenes[command.slideIndex];
    return afterSlide ? { afterSlide, mode: "replace" as const, slideIndex: command.slideIndex } : undefined;
  }
  if (command.type === "slide.add") {
    const slideIndex = command.afterSlideIndex === undefined
      ? Math.max(next.scenes.length - 1, 0)
      : Math.min(command.afterSlideIndex + 1, Math.max(next.scenes.length - 1, 0));
    const afterSlide = next.scenes[slideIndex];
    return afterSlide ? { afterSlide, mode: "add" as const, slideIndex } : undefined;
  }
  if (command.type === "slide.applyLayout") {
    const addsSlide = command.slideIndex === undefined || next.scenes.length > before.scenes.length;
    const slideIndex = addsSlide ? Math.max(next.scenes.length - 1, 0) : command.slideIndex ?? 0;
    const afterSlide = next.scenes[slideIndex];
    return afterSlide ? { afterSlide, mode: addsSlide ? "add" as const : "replace" as const, slideIndex } : undefined;
  }
  return undefined;
}

function progressiveSlideSource(
  beforeSource: string,
  command: SlideXEditCommand,
  mode: "add" | "replace",
  slideIndex: number,
  scene: MotionDocScene
) {
  const slideSource = generateSlideString(scene);
  if (mode === "replace") {
    return applySlideXBatch(beforeSource, [{ slideIndex, slideSource, type: "slide.replace" }]).source;
  }
  const afterSlideIndex = command.type === "slide.add" ? command.afterSlideIndex : undefined;
  return applySlideXBatch(beforeSource, [{
    ...(afterSlideIndex === undefined ? {} : { afterSlideIndex }),
    slideSource,
    type: "slide.add"
  }]).source;
}

function blockTarget(block: MotionDocBlock, blockIndex: number, slideIndex: number): AssistantCanvasTarget {
  return {
    blockIndex,
    kind: "block",
    nodeId: motionDocBlockKey(block, blockIndex),
    slideIndex
  };
}

function blockActionLabel(block: MotionDocBlock) {
  if (block.type === "Title" || block.type === "heading") return "Adding title";
  if (block.type === "Text") return "Writing text";
  if (block.type === "Chart") return "Building chart";
  if (block.type === "ImageBlock") return "Placing image";
  if (block.type === "Shape") return "Drawing shape";
  if (block.type === "Table") return "Building table";
  if (block.type === "Metric") return "Adding metric";
  return `Adding ${block.type.toLowerCase()}`;
}

function movementLabel(label: string) {
  return label.startsWith("Creating") || label.startsWith("Preparing") ? "Moving to slide" : `Moving · ${label}`;
}

function previewTarget(
  command: SlideXEditCommand,
  beforeSource: string,
  nextSource: string
): { frame?: MotionDocFrame; target: AssistantCanvasTarget } {
  const before = parseMotionDoc(beforeSource);
  const next = parseMotionDoc(nextSource);
  if (command.type === "document.setTitle" || command.type === "asset.repath") {
    return { target: { kind: "presentation" } };
  }
  if (command.type === "slide.add") {
    const slideIndex = command.afterSlideIndex === undefined
      ? Math.max(next.scenes.length - 1, 0)
      : Math.min(command.afterSlideIndex + 1, Math.max(next.scenes.length - 1, 0));
    return { target: { kind: "slide", slideIndex } };
  }
  if (command.type === "slide.reorder") {
    return { target: { kind: "slide", slideIndex: command.toIndex } };
  }
  if (command.type === "slide.applyLayout") {
    return { target: { kind: "slide", slideIndex: command.slideIndex ?? 0 } };
  }
  if (command.type.startsWith("slide.")) {
    const slideIndex = "slideIndex" in command && typeof command.slideIndex === "number"
      ? Math.min(command.slideIndex, Math.max(next.scenes.length - 1, 0))
      : 0;
    return { target: { kind: "slide", slideIndex } };
  }

  const slideIndex = "slideIndex" in command && typeof command.slideIndex === "number" ? command.slideIndex : 0;
  const beforeScene = before.scenes[slideIndex];
  const nextScene = next.scenes[slideIndex];
  const blockIndex = previewBlockIndex(command, beforeScene, nextScene);
  const frameScene = command.type === "block.delete" ? beforeScene : nextScene;
  const block = blockIndex === undefined ? undefined : frameScene?.blocks[blockIndex];
  const nodeId = block && blockIndex !== undefined ? motionDocBlockKey(block, blockIndex) : commandNodeId(command);
  return {
    ...(block ? { frame: blockFrame(block) } : {}),
    target: {
      ...(blockIndex === undefined ? {} : { blockIndex }),
      kind: "block",
      ...(nodeId ? { nodeId } : {}),
      slideIndex
    }
  };
}

function previewBlockIndex(
  command: SlideXEditCommand,
  beforeScene: MotionDocScene | undefined,
  nextScene: MotionDocScene | undefined
) {
  if (command.type === "block.add") return Math.max((nextScene?.blocks.length ?? 1) - 1, 0);
  if (command.type === "block.reorder") return command.toIndex;
  if (!("blockIndex" in command) && !("nodeId" in command)) return undefined;
  if (typeof command.blockIndex === "number") return command.blockIndex;
  if (typeof command.nodeId !== "string") return undefined;
  const scene = command.type === "block.delete" ? beforeScene : nextScene;
  const index = scene?.blocks.findIndex((block, blockIndex) => motionDocBlockKey(block, blockIndex) === command.nodeId) ?? -1;
  return index >= 0 ? index : undefined;
}

function commandNodeId(command: SlideXEditCommand) {
  return "nodeId" in command && typeof command.nodeId === "string" ? command.nodeId : undefined;
}

function previewCommandLabel(command: SlideXEditCommand) {
  return ({
    "asset.repath": "Updating asset",
    "block.add": "Adding element",
    "block.delete": "Removing element",
    "block.duplicate": "Duplicating element",
    "block.reorder": "Reordering element",
    "block.update": "Editing element",
    "document.setTitle": "Renaming presentation",
    "slide.add": "Adding slide",
    "slide.applyLayout": "Applying layout",
    "slide.delete": "Removing slide",
    "slide.duplicate": "Duplicating slide",
    "slide.reorder": "Reordering slide",
    "slide.replace": "Replacing slide",
    "slide.updateProps": "Styling slide"
  } satisfies Record<SlideXEditCommand["type"], string>)[command.type];
}

const previewCommandTypes: ReadonlySet<string> = new Set<SlideXEditCommand["type"]>([
  "asset.repath",
  "block.add",
  "block.delete",
  "block.duplicate",
  "block.reorder",
  "block.update",
  "document.setTitle",
  "slide.add",
  "slide.applyLayout",
  "slide.delete",
  "slide.duplicate",
  "slide.reorder",
  "slide.replace",
  "slide.updateProps"
]);
