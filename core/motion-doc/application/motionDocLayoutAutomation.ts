import {
  generateSlideString
} from "@/core/motion-doc/application/motionDocSerialize";
import {
  appendMotionDocSlideSource,
  insertMotionDocSlideSource,
  replaceMotionDocSlideSource
} from "@/core/motion-doc/application/motionDocSourceEditor";
import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import type { MotionDocProps, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { MOTION_DOC_CANVAS_PROPS } from "@/core/motion-doc/domain/typography";

export type MotionDocLayoutOptions = {
  accent?: string;
  background?: string;
  duration?: number;
  layoutId?: string;
  replacements?: Record<string, string>;
  textColor?: string;
  theme?: "dark" | "light";
};

export function createMotionDocSlideFromLayout(
  layoutSource: string,
  options: MotionDocLayoutOptions = {},
  referenceSlide?: MotionDocScene
) {
  const parsedLayout = parseMotionDoc(
    `# Layout\n\n<Slide duration={5}>\n${applyLayoutReplacements(
      layoutSource,
      options.replacements
    )}\n</Slide>`
  );
  const layoutSlide = parsedLayout.scenes[0];

  if (!layoutSlide) {
    throw new Error("The layout source could not be parsed into a SlideX slide.");
  }

  const props = buildLayoutSlideProps(referenceSlide, options);

  return generateSlideString({
    ...layoutSlide,
    duration: numberProp(props.duration) ?? 5,
    props
  });
}

export function addMotionDocSlideFromLayout(
  source: string,
  layoutSource: string,
  afterSlideIndex: number | undefined,
  options: MotionDocLayoutOptions = {}
) {
  const document = parseMotionDoc(source);
  const referenceIndex = afterSlideIndex ?? document.scenes.length - 1;
  const referenceSlide = document.scenes[referenceIndex];
  const slideSource = createMotionDocSlideFromLayout(layoutSource, options, referenceSlide);
  const normalizedSource = source.trim() || "# Untitled Deck";

  if (afterSlideIndex === undefined) {
    return appendMotionDocSlideSource(normalizedSource, slideSource);
  }

  assertSlideIndex(document.scenes, afterSlideIndex, "afterSlideIndex");
  return insertMotionDocSlideSource(normalizedSource, afterSlideIndex, slideSource, "after");
}

export function replaceMotionDocSlideWithLayout(
  source: string,
  slideIndex: number,
  layoutSource: string,
  options: MotionDocLayoutOptions = {}
) {
  const document = parseMotionDoc(source);
  const referenceSlide = assertSlideIndex(document.scenes, slideIndex, "slideIndex");
  const slideSource = createMotionDocSlideFromLayout(layoutSource, options, referenceSlide);

  return replaceMotionDocSlideSource(source, slideIndex, slideSource);
}

function buildLayoutSlideProps(
  referenceSlide: MotionDocScene | undefined,
  options: MotionDocLayoutOptions
) {
  const referenceProps = referenceSlide?.props ?? {};
  const referenceTheme = stringProp(referenceProps.theme);
  const theme = options.theme ?? (referenceTheme === "light" ? "light" : "dark");
  const duration = options.duration ?? referenceSlide?.duration ?? 5;

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("duration must be a positive number.");
  }

  return {
    ...referenceProps,
    ...MOTION_DOC_CANVAS_PROPS,
    duration,
    theme,
    background:
      options.background ??
      stringProp(referenceProps.background) ??
      (theme === "light" ? "#ffffff" : "#000000"),
    accent:
      options.accent ??
      stringProp(referenceProps.accent) ??
      (theme === "light" ? "#111111" : "#ffffff"),
    ...(options.textColor
      ? { textColor: options.textColor }
      : stringProp(referenceProps.textColor)
        ? { textColor: stringProp(referenceProps.textColor) }
        : {}),
    ...(options.layoutId ? { layoutPreset: options.layoutId } : {})
  } satisfies MotionDocProps;
}

function assertSlideIndex(
  slides: MotionDocScene[],
  slideIndex: number,
  fieldName: "afterSlideIndex" | "slideIndex"
) {
  const slide = slides[slideIndex];

  if (!slide) {
    throw new Error(`${fieldName} ${slideIndex} is outside the slide range.`);
  }

  return slide;
}

function applyLayoutReplacements(
  source: string,
  replacements: Record<string, string> | undefined
) {
  if (!replacements) return source;

  return Object.entries(replacements).reduce((currentSource, [from, to]) => {
    if (!from) return currentSource;
    return currentSource.split(from).join(safeMdxText(to));
  }, source);
}

function stringProp(value: string | number | undefined) {
  return typeof value === "string" && value ? value : undefined;
}

function numberProp(value: string | number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function safeMdxText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("{", "&#123;")
    .replaceAll("}", "&#125;");
}
