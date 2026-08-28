import {
  formatMotionNumber,
  interpolateMotionNumber,
  interpolateMotionState,
  parseMotionSequence,
  type MotionAction,
  type MotionTweenState
} from "@/core/motion-doc/domain/motionSequence";
import {
  interpolateShapeMorphPath,
  shapeMorphPoints,
  type ShapeMorphDescriptor
} from "@/core/motion-doc/domain/shapeMorph";
import {
  defaultSharedMorphCurve,
  sharedMorphCssEasing,
  type SharedMorphCurve,
  type SharedMorphEasing
} from "@/core/motion-doc/domain/sharedMorph";

type PlaybackItem = {
  action: MotionAction;
  element: HTMLElement;
};

export type MotionPlaybackController = {
  cancel: () => void;
  consume: () => boolean;
  hasPendingCue: () => boolean;
  playAll: () => void;
  replay: () => void;
};

const motionCssEasing = {
  easeIn: "ease-in",
  easeInOut: "ease-in-out",
  easeOut: "ease-out",
  linear: "linear",
  smooth: "cubic-bezier(.45,0,.2,1)",
  spring: "cubic-bezier(.18,.9,.22,1.18)"
} as const;

export function createMotionPlaybackController(
  root: HTMLElement,
  options: { autoStartDelayMs?: number; deferMotionIds?: ReadonlySet<string> } = {}
): MotionPlaybackController {
  if (reducedMotion()) {
    return { cancel: () => undefined, consume: () => false, hasPendingCue: () => false, playAll: () => undefined, replay: () => undefined };
  }
  const animations = new Set<Animation>();
  const animationFrames = new Set<number>();
  const timers = new Set<number>();
  const originalStyles = new Map<HTMLElement, string | null>();
  const originalTextContents = new Map<HTMLElement, string>();
  const initializedElements = new Set<HTMLElement>();
  let batches: PlaybackItem[][] = [];
  let batchIndex = 0;

  function collect() {
    const items: PlaybackItem[] = [];
    root.querySelectorAll<HTMLElement>("[data-motion-sequence]").forEach((element) => {
      if (element.closest("[data-slidex-morph-overlay]")) return;
      const parsed = parseMotionSequence(element.dataset.motionSequence);
      if (!parsed.sequence) return;
      parsed.sequence.actions.forEach((action) => items.push({ action, element }));
    });
    items.sort((left, right) => left.action.order - right.action.order);
    return items;
  }

  function cancel() {
    animations.forEach((animation) => animation.cancel());
    animations.clear();
    animationFrames.forEach((frame) => window.cancelAnimationFrame(frame));
    animationFrames.clear();
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
    originalStyles.forEach((style, element) => {
      if (style === null) element.removeAttribute("style");
      else element.setAttribute("style", style);
    });
    originalStyles.clear();
    originalTextContents.forEach((value, element) => { element.innerHTML = value; });
    originalTextContents.clear();
    initializedElements.clear();
  }

  function resetElement(item: PlaybackItem) {
    const { action, element } = item;
    element.getAnimations().forEach((animation) => animation.cancel());
    if (action.type === "tween" && action.from) applyState(element, action.from);
    if (action.type === "tween" && action.preset === "numberRange" && action.numberRange) {
      const target = motionTextTarget(element);
      if (target) target.textContent = formatMotionNumber(action.numberRange.from, action.numberRange);
    }
    if (action.type === "enter") applyEnterInitialState(element, action.preset);
    initializedElements.add(element);
  }

  function ensureElementInitialized(item: PlaybackItem) {
    if (initializedElements.has(item.element)) return;
    resetElement(item);
  }

  function buildBatches(items: PlaybackItem[]) {
    const next: PlaybackItem[][] = [];
    items.forEach((item, itemIndex) => {
      if (itemIndex === 0 || item.action.start === "onClick") next.push([]);
      next[next.length - 1]?.push(item);
    });
    return next;
  }

  function playItem(item: PlaybackItem, delayMs: number) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      const { action, element } = item;
      ensureElementInitialized(item);
      if (action.type === "tween" && action.preset === "numberRange" && action.numberRange) {
        playNumberRange(element, action);
        return;
      }
      const keyframes = action.type === "tween"
        ? tweenKeyframes(action)
        : action.type === "exit"
          ? exitKeyframes(action.preset)
          : enterKeyframes(action.preset);
      const animation = element.animate(keyframes, {
        duration: reducedMotion() ? 0 : Math.max(0, action.duration) * 1000,
        easing: motionCssEasing[action.easing],
        fill: "forwards"
      });
      animations.add(animation);
      animation.finished.catch(() => undefined).finally(() => animations.delete(animation));
    }, Math.max(0, delayMs));
    timers.add(timer);
  }

  function playNumberRange(element: HTMLElement, action: Extract<MotionAction, { type: "tween" }>) {
    if (!action.numberRange) return;
    const target = motionTextTarget(element);
    if (!target) return;
    const startedAt = performance.now();
    const duration = Math.max(0, action.duration) * 1000;
    const tick = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      target.textContent = formatMotionNumber(interpolateMotionNumber(action.numberRange!, progress, action.easing), action.numberRange!);
      if (progress < 1) {
        const frame = window.requestAnimationFrame(tick);
        animationFrames.add(frame);
      } else {
        const original = originalTextContents.get(target);
        if (original !== undefined) target.innerHTML = original;
      }
    };
    const frame = window.requestAnimationFrame(tick);
    animationFrames.add(frame);
  }

  function playBatch(batch: PlaybackItem[]) {
    let previousStart = 0;
    let previousDuration = 0;
    batch.forEach((item, itemIndex) => {
      const start = itemIndex === 0
        ? 0
        : item.action.start === "withPrevious"
          ? previousStart
          : previousStart + previousDuration;
      playItem(item, start * 1000);
      previousStart = start;
      previousDuration = item.action.duration;
    });
  }

  function batchDuration(batch: PlaybackItem[]) {
    let previousStart = 0;
    let previousDuration = 0;
    let end = 0;
    batch.forEach((item, itemIndex) => {
      const start = itemIndex === 0
        ? 0
        : item.action.start === "withPrevious"
          ? previousStart
          : previousStart + previousDuration;
      end = Math.max(end, start + item.action.duration);
      previousStart = start;
      previousDuration = item.action.duration;
    });
    return end;
  }

  function consume() {
    const batch = batches[batchIndex];
    if (!batch) return false;
    batchIndex += 1;
    playBatch(batch);
    return true;
  }

  function replay() {
    cancel();
    const items = collect();
    items.forEach((item) => {
      if (!originalStyles.has(item.element)) originalStyles.set(item.element, item.element.getAttribute("style"));
      const textTarget = motionTextTarget(item.element);
      if (textTarget && !originalTextContents.has(textTarget)) originalTextContents.set(textTarget, textTarget.innerHTML);
    });
    const firstByElement = new Map<HTMLElement, PlaybackItem>();
    items.forEach((item) => {
      if (!firstByElement.has(item.element)) firstByElement.set(item.element, item);
    });
    firstByElement.forEach((item) => {
      const sharedId = item.element.dataset.sharedId?.trim();
      if (!sharedId || !options.deferMotionIds?.has(sharedId)) resetElement(item);
    });
    batches = buildBatches(items);
    batchIndex = 0;
    if (batches[0]?.[0]?.action.start === "afterPrevious") {
      const batch = batches[batchIndex];
      batchIndex += 1;
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (batch) playBatch(batch);
      }, Math.max(0, options.autoStartDelayMs ?? 0));
      timers.add(timer);
    }
  }

  function playAll() {
    replay();
    let delayMs = batchIndex > 0
      ? Math.max(0, options.autoStartDelayMs ?? 0) + batchDuration(batches[0] ?? []) * 1000
      : 0;
    const pending = batches.slice(batchIndex);
    batchIndex = batches.length;
    pending.forEach((batch) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        playBatch(batch);
      }, delayMs);
      timers.add(timer);
      delayMs += batchDuration(batch) * 1000;
    });
  }

  replay();
  return {
    cancel,
    consume,
    hasPendingCue: () => batchIndex < batches.length,
    playAll,
    replay
  };
}

function motionTextTarget(element: HTMLElement) {
  return element.querySelector<HTMLElement>("[data-motion-text-content]");
}

function tweenKeyframes(action: Extract<MotionAction, { type: "tween" }>): Keyframe[] {
  if (!action.from || !action.to) return [];
  const frameCount = action.path ? 31 : 2;
  return Array.from({ length: frameCount }, (_, frameIndex) => {
    const progress = frameIndex / (frameCount - 1);
    return stateKeyframe(interpolateMotionState(action.from!, action.to!, progress, "linear", action.path));
  });
}

function stateKeyframe(state: MotionTweenState): Keyframe {
  return {
    height: `${state.h}%`,
    left: `${state.x}%`,
    opacity: state.opacity,
    rotate: `${state.rotation}deg`,
    top: `${state.y}%`,
    width: `${state.w}%`
  };
}

function applyState(element: HTMLElement, state: MotionTweenState) {
  element.style.left = `${state.x}%`;
  element.style.top = `${state.y}%`;
  element.style.width = `${state.w}%`;
  element.style.height = `${state.h}%`;
  element.style.rotate = `${state.rotation}deg`;
  element.style.opacity = String(state.opacity);
}

function applyEnterInitialState(element: HTMLElement, preset: string) {
  Object.assign(element.style, enterKeyframes(preset)[0]);
}

function enterKeyframes(preset: string): Keyframe[] {
  if (preset === "fadeIn") return [{ opacity: 0 }, { opacity: 1 }];
  if (preset === "fadeUp" || preset === "rise") return [{ opacity: 0, transform: "translateY(28px)" }, { opacity: 1, transform: "translateY(0)" }];
  if (preset === "slideLeft") return [{ opacity: 0, transform: "translateX(52px)" }, { opacity: 1, transform: "translateX(0)" }];
  if (preset === "zoomIn") return [{ opacity: 0, transform: "scale(.86)" }, { opacity: 1, transform: "scale(1)" }];
  if (preset === "pop") return [{ opacity: 0, transform: "scale(.72)" }, { opacity: 1, transform: "scale(1)" }];
  if (preset === "blurIn") return [{ filter: "blur(16px)", opacity: 0 }, { filter: "blur(0)", opacity: 1 }];
  if (preset === "reveal") return [{ clipPath: "inset(0 100% 0 0)", opacity: 0 }, { clipPath: "inset(0 0 0 0)", opacity: 1 }];
  return [{ opacity: 0 }, { opacity: 1 }];
}

function exitKeyframes(preset: string): Keyframe[] {
  if (preset === "fadeDown") return [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(28px)" }];
  if (preset === "slideRight") return [{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: "translateX(52px)" }];
  if (preset === "zoomOut") return [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.16)" }];
  if (preset === "shrink") return [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.72)" }];
  return [{ opacity: 1 }, { opacity: 0 }];
}

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

type MorphSnapshotItem = {
  element: HTMLElement;
  frame: { height: number; left: number; top: number; width: number };
  opacity: number;
  rotation: string;
  sharedId: string | null;
  style: {
    backgroundColor: string;
    borderRadius: string;
    color: string;
    fontFamily: string;
    fontSize: string;
    fontStyle: string;
    fontWeight: string;
    letterSpacing: string;
    lineHeight: string;
    textAlign: string;
  };
  textFrame: { height: number; left: number; top: number; width: number } | null;
  textLineCount: number;
  shape: ShapeMorphDescriptor | null;
  type: string;
};

export type SharedMorphSnapshot = Map<string, MorphSnapshotItem>;

export function sharedMorphMotionIds(root: HTMLElement, source: SharedMorphSnapshot) {
  const matched = new Set<string>();
  root.querySelectorAll<HTMLElement>("[data-motion-sequence][data-shared-id]").forEach((element) => {
    const sharedId = element.dataset.sharedId?.trim();
    if (!sharedId) return;
    const sourceItem = source.get(`shared:${sharedId}`);
    if (sourceItem?.type === element.dataset.slidexBlockType) matched.add(sharedId);
  });
  return matched;
}

export function captureSharedMorph(root: HTMLElement, options: { includeUnmatched?: boolean } = {}): SharedMorphSnapshot {
  const includeUnmatched = options.includeUnmatched ?? true;
  const rootRect = root.getBoundingClientRect();
  const scaleX = rootRect.width / Math.max(root.offsetWidth, 1);
  const scaleY = rootRect.height / Math.max(root.offsetHeight, 1);
  const snapshot: SharedMorphSnapshot = new Map();
  root.querySelectorAll<HTMLElement>("[data-slidex-block-type]").forEach((element, index) => {
    const candidateSharedId = element.dataset.sharedId?.trim() || null;
    const type = element.dataset.slidexBlockType ?? "";
    const sharedId = candidateSharedId && ["Text", "ImageBlock", "Shape", "SvgBlock"].includes(type)
      ? candidateSharedId
      : null;
    const nodeId = element.dataset.motionDocNodeId?.trim() || `${type}-${index}`;
    if (!sharedId && !includeUnmatched) return;
    const snapshotKey = sharedId ? `shared:${sharedId}` : `unmatched:${nodeId}`;
    if (snapshot.has(snapshotKey)) return;
    const rect = element.getBoundingClientRect();
    const styleTarget = type === "Text"
      ? element.querySelector<HTMLElement>("[data-motion-text-content]") ?? element
      : element;
    const style = window.getComputedStyle(styleTarget);
    const textLayout = type === "Text"
      ? captureRenderedTextLayout(styleTarget, rootRect, scaleX, scaleY)
      : null;
    snapshot.set(snapshotKey, {
      element,
      frame: {
        height: rect.height / scaleY,
        left: (rect.left - rootRect.left) / scaleX,
        top: (rect.top - rootRect.top) / scaleY,
        width: rect.width / scaleX
      },
      opacity: Number.isFinite(Number(style.opacity)) ? Number(style.opacity) : 1,
      rotation: style.rotate === "none" ? "0deg" : style.rotate,
      sharedId,
      style: {
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius,
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontStyle: style.fontStyle,
        fontWeight: style.fontWeight,
        letterSpacing: style.letterSpacing,
        lineHeight: style.lineHeight,
        textAlign: style.textAlign
      },
      textFrame: textLayout?.frame ?? null,
      textLineCount: textLayout?.lineCount ?? 0,
      shape: type === "Shape" ? {
        points: Number(element.dataset.shapePoints) || 5,
        shape: element.dataset.shapeKind || "rectangle",
        sides: Number(element.dataset.shapeSides) || 3
      } : null,
      type
    });
  });
  return snapshot;
}

export function playSharedMorph(
  root: HTMLElement,
  from: SharedMorphSnapshot,
  options: {
    curve?: SharedMorphCurve;
    duration: number;
    easing: SharedMorphEasing;
    fadeUnmatched: boolean;
    shapePrecision?: number;
    shapeSoftness?: number;
  }
) {
  if (reducedMotion() || from.size === 0) return () => undefined;
  // The destination is only used to pair shared layers. Skipping unrelated
  // blocks avoids synchronously measuring every target layer at click time.
  const destination = captureSharedMorph(root, { includeUnmatched: false });
  const overlay = document.createElement("div");
  overlay.dataset.slidexMorphOverlay = "true";
  Object.assign(overlay.style, {
    inset: "0",
    overflow: "hidden",
    pointerEvents: "none",
    position: "absolute",
    zIndex: "9999"
  });
  root.appendChild(overlay);
  const hidden: HTMLElement[] = [];
  const animations: Animation[] = [];
  const shapeFrames = new Set<number>();
  const duration = Math.max(0, options.duration) * 1000;
  const easing = sharedMorphCssEasing(options.easing, options.curve);
  const activeScene = root.querySelector<HTMLElement>("[data-motion-scene]");
  if (options.fadeUnmatched && activeScene) {
    animations.push(activeScene.animate(morphUnmatchedEnterKeyframes(), {
      duration,
      easing: "linear",
      fill: "both"
    }));
  }

  destination.forEach((target, snapshotKey) => {
    const source = from.get(snapshotKey);
    if (!source?.sharedId || !target.sharedId || source.type !== target.type) return;
    const liveTarget = root.querySelector<HTMLElement>(`[data-shared-id="${CSS.escape(target.sharedId)}"]`);
    if (liveTarget) {
      liveTarget.style.visibility = "hidden";
      hidden.push(liveTarget);
    }
    if (source.type === "Text") {
      source.element.style.visibility = "hidden";
      hidden.push(source.element);
      animateMorphTextLayer(overlay, source, target, duration, easing, animations);
      return;
    }
    const clone = source.element.cloneNode(true) as HTMLElement;
    positionMorphClone(clone, source.frame, source.opacity, source.rotation);
    overlay.appendChild(clone);
    if (source.type === "Shape" && source.shape && target.shape && source.shape.shape !== target.shape.shape) {
      animateShapeGeometry(clone, source.shape, target.shape, {
        curve: options.curve ?? defaultSharedMorphCurve,
        duration,
        easing: options.easing,
        frames: shapeFrames,
        precision: options.shapePrecision ?? 48,
        softness: options.shapeSoftness ?? 0.32
      });
    }
    const animation = clone.animate([
      morphFrame(source.frame, source.frame, source.opacity, source.rotation, source.style, source.type),
      morphFrame(source.frame, target.frame, target.opacity, target.rotation, target.style, source.type)
    ], { duration, easing, fill: "forwards" });
    animations.push(animation);
  });

  if (options.fadeUnmatched) {
    from.forEach((source, snapshotKey) => {
      const target = destination.get(snapshotKey);
      if (source.sharedId && target?.sharedId && source.type === target.type) return;
      const clone = source.element.cloneNode(true) as HTMLElement;
      positionMorphClone(clone, source.frame, source.opacity, source.rotation);
      overlay.appendChild(clone);
      animations.push(clone.animate(morphUnmatchedExitKeyframes(source.opacity), {
        duration,
        easing: "linear",
        fill: "forwards"
      }));
    });
  }

  const cleanup = () => {
    animations.forEach((animation) => animation.cancel());
    shapeFrames.forEach((frame) => window.cancelAnimationFrame(frame));
    shapeFrames.clear();
    hidden.forEach((element) => element.style.removeProperty("visibility"));
    overlay.remove();
  };
  window.setTimeout(cleanup, duration + 40);
  return cleanup;
}

function morphUnmatchedEnterKeyframes(): Keyframe[] {
  return [
    { offset: 0, opacity: 0 },
    { offset: 0.28, opacity: 0 },
    { offset: 0.78, opacity: 1 },
    { offset: 1, opacity: 1 }
  ];
}

function morphUnmatchedExitKeyframes(opacity: number): Keyframe[] {
  return [
    { offset: 0, opacity },
    { offset: 0.42, opacity: 0 },
    { offset: 1, opacity: 0 }
  ];
}

function animateShapeGeometry(
  clone: HTMLElement,
  from: ShapeMorphDescriptor,
  to: ShapeMorphDescriptor,
  options: { curve: SharedMorphCurve; duration: number; easing: SharedMorphEasing; frames: Set<number>; precision: number; softness: number }
) {
  const fromPoints = shapeMorphPoints(from, options.precision);
  const toPoints = shapeMorphPoints(to, options.precision);
  if (!fromPoints || !toPoints) return;
  const geometry = Array.from(clone.querySelectorAll<SVGElement>("svg path, svg circle, svg rect, svg polygon"))
    .find((candidate) => !candidate.closest("defs, mask"));
  if (!geometry) return;
  const path = geometry.tagName.toLowerCase() === "path"
    ? geometry as SVGPathElement
    : document.createElementNS("http://www.w3.org/2000/svg", "path");
  if (path !== geometry) {
    ["fill", "stroke", "stroke-width", "stroke-linejoin", "vector-effect", "style"].forEach((name) => {
      const value = geometry.getAttribute(name);
      if (value !== null) path.setAttribute(name, value);
    });
    geometry.replaceWith(path);
  }
  const startedAt = performance.now();
  const tick = (now: number) => {
    const raw = options.duration === 0 ? 1 : Math.min(1, (now - startedAt) / options.duration);
    path.setAttribute("d", interpolateShapeMorphPath(fromPoints, toPoints, morphProgress(raw, options.easing, options.curve), options.softness));
    if (raw < 1) {
      const frame = window.requestAnimationFrame(tick);
      options.frames.add(frame);
    }
  };
  const frame = window.requestAnimationFrame(tick);
  options.frames.add(frame);
}

function morphProgress(value: number, easing: SharedMorphEasing, curve: SharedMorphCurve) {
  if (easing === "linear") return value;
  if (easing === "easeIn") return value * value;
  if (easing === "easeOut") return 1 - (1 - value) * (1 - value);
  if (easing === "smooth") return value * value * value * (value * (value * 6 - 15) + 10);
  if (easing === "emphasized") return cubicBezierProgress(value, { x1: .2, x2: 0, y1: 0, y2: 1 });
  if (easing === "spring") return Math.min(1, Math.max(0, 1 - Math.cos(value * Math.PI * 2.5) * Math.exp(-5 * value)));
  if (easing === "backOut") return cubicBezierProgress(value, { x1: .34, x2: .64, y1: 1.56, y2: 1 });
  if (easing === "custom") return cubicBezierProgress(value, curve);
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function cubicBezierProgress(progress: number, curve: SharedMorphCurve) {
  let lower = 0;
  let upper = 1;
  let t = progress;
  for (let index = 0; index < 12; index += 1) {
    const x = cubicCoordinate(t, curve.x1, curve.x2);
    if (Math.abs(x - progress) < 0.0001) break;
    if (x < progress) lower = t;
    else upper = t;
    t = (lower + upper) / 2;
  }
  return cubicCoordinate(t, curve.y1, curve.y2);
}

function cubicCoordinate(t: number, first: number, second: number) {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * first + 3 * inverse * t * t * second + t * t * t;
}

function positionMorphClone(element: HTMLElement, frame: MorphSnapshotItem["frame"], opacity: number, rotation: string) {
  Object.assign(element.style, {
    height: `${frame.height}px`,
    left: `${frame.left}px`,
    margin: "0",
    opacity: String(opacity),
    position: "absolute",
    rotate: "none",
    top: `${frame.top}px`,
    transform: morphTransform(frame, frame, rotation),
    transformOrigin: "center center",
    width: `${frame.width}px`
  });
}

function morphFrame(
  origin: MorphSnapshotItem["frame"],
  frame: MorphSnapshotItem["frame"],
  opacity: number,
  rotation: string,
  style: MorphSnapshotItem["style"],
  type: string
): Keyframe {
  return {
    backgroundColor: style.backgroundColor,
    borderRadius: style.borderRadius,
    color: style.color,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    opacity,
    rotate: "none",
    transform: morphTransform(origin, frame, rotation)
  };
}

function animateMorphTextLayer(
  overlay: HTMLElement,
  from: MorphSnapshotItem,
  to: MorphSnapshotItem,
  duration: number,
  easing: string,
  animations: Animation[]
) {
  const sourceText = from.element.querySelector<HTMLElement>("[data-motion-text-content]");
  const targetText = to.element.querySelector<HTMLElement>("[data-motion-text-content]");
  if (!sourceText || !targetText) return;
  const sameSingleLine = sourceText.textContent === targetText.textContent
    && from.textLineCount === 1
    && to.textLineCount === 1
    && from.textFrame
    && to.textFrame;

  if (sameSingleLine && from.textFrame && to.textFrame) {
    const clone = sourceText.cloneNode(true) as HTMLElement;
    prepareMorphTextClone(clone, from.textFrame, true);
    overlay.appendChild(clone);
    animations.push(clone.animate([
      morphTextFrame(from.textFrame, from.style, from.opacity),
      morphTextFrame(to.textFrame, to.style, to.opacity)
    ], { duration, easing, fill: "forwards" }));
    return;
  }

  const sourceClone = sourceText.cloneNode(true) as HTMLElement;
  prepareMorphTextClone(sourceClone, from.frame, false);
  overlay.appendChild(sourceClone);
  animations.push(sourceClone.animate([
    { ...morphTextFrame(from.frame, from.style, from.opacity), offset: 0 },
    { ...morphTextFrame(from.frame, from.style, 0), offset: 0.46 },
    { ...morphTextFrame(from.frame, from.style, 0), offset: 1 }
  ], { duration, easing: "linear", fill: "forwards" }));

  const targetClone = targetText.cloneNode(true) as HTMLElement;
  prepareMorphTextClone(targetClone, to.frame, false);
  overlay.appendChild(targetClone);
  animations.push(targetClone.animate([
    { ...morphTextFrame(to.frame, to.style, 0), offset: 0 },
    { ...morphTextFrame(to.frame, to.style, 0), offset: 0.38 },
    { ...morphTextFrame(to.frame, to.style, to.opacity), offset: 0.82 },
    { ...morphTextFrame(to.frame, to.style, to.opacity), offset: 1 }
  ], { duration, easing: "linear", fill: "forwards" }));
}

function prepareMorphTextClone(element: HTMLElement, frame: MorphSnapshotItem["frame"], singleLine: boolean) {
  Object.assign(element.style, {
    height: `${frame.height}px`,
    left: `${frame.left}px`,
    margin: "0",
    maxWidth: "none",
    overflow: "visible",
    position: "absolute",
    textAlign: singleLine ? "left" : element.style.textAlign,
    top: `${frame.top}px`,
    transform: "none",
    transformOrigin: "left top",
    width: `${frame.width}px`
  });
  if (singleLine) {
    element.querySelectorAll<HTMLElement>(".block-line").forEach((line) => { line.style.whiteSpace = "nowrap"; });
  }
}

function morphTextFrame(frame: MorphSnapshotItem["frame"], style: MorphSnapshotItem["style"], opacity: number): Keyframe {
  return {
    color: style.color,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontStyle: style.fontStyle,
    fontWeight: style.fontWeight,
    height: `${frame.height}px`,
    left: `${frame.left}px`,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    opacity,
    textAlign: style.textAlign,
    top: `${frame.top}px`,
    transform: "none",
    width: `${frame.width}px`
  };
}

function captureRenderedTextLayout(
  element: HTMLElement,
  rootRect: DOMRect,
  scaleX: number,
  scaleY: number
) {
  const rects: DOMRect[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      rects.push(...Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0));
    }
    node = walker.nextNode();
  }
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  const lineTops = rects.map((rect) => Math.round(rect.top * 2) / 2);
  return {
    frame: {
      height: (bottom - top) / scaleY,
      left: (left - rootRect.left) / scaleX,
      top: (top - rootRect.top) / scaleY,
      width: (right - left) / scaleX
    },
    lineCount: new Set(lineTops).size
  };
}

/**
 * Keep the clone at its source geometry and move it with a compositor-friendly
 * transform. Animating left/top/width/height repaints the whole canvas on
 * every frame, which was visible as a hitch when an interactive Morph began.
 */
function morphTransform(origin: MorphSnapshotItem["frame"], frame: MorphSnapshotItem["frame"], rotation: string) {
  const sourceWidth = Math.max(origin.width, 0.001);
  const sourceHeight = Math.max(origin.height, 0.001);
  const translateX = frame.left - origin.left + (frame.width - origin.width) / 2;
  const translateY = frame.top - origin.top + (frame.height - origin.height) / 2;
  const scaleX = frame.width / sourceWidth;
  const scaleY = frame.height / sourceHeight;
  return `translate(${translateX}px, ${translateY}px) rotate(${rotation}) scale(${scaleX}, ${scaleY})`;
}
