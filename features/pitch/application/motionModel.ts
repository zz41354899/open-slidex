import type { MotionDocBlock, MotionDocPropInput, MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import {
  applyTweenState,
  createMotionActionId,
  migrateLegacyEnterMotion,
  motionSequenceFromProps,
  tweenStateFromProps,
  withMotionSequence,
  type MotionAction,
  type MotionExitPreset,
  type MotionSequenceV1,
  type MotionTweenAction,
  type MotionTweenPreset
} from "@/core/motion-doc/domain/motionSequence";
import {
  normalizeEnterAnimation,
  normalizeSlideTransition,
  type EnterAnimation,
  type SlideTransition
} from "@/features/pitch/application/motionPresets";

export type ElementMotionConfig = {
  delay?: number;
  duration?: number;
  enter: EnterAnimation;
};

export type SlideMotionConfig = {
  duration?: number;
  slideTransition: SlideTransition;
};

export function normalizeElementMotion(props: MotionDocPropInput): ElementMotionConfig {
  const enter = normalizeEnterAnimation(props.enter);

  if (enter === "none") {
    return { enter };
  }

  return {
    delay: numberProp(props.delay, 0),
    duration: numberProp(props.duration, 0.6),
    enter
  };
}

export function normalizeElementMotionProps(props: MotionDocProps): MotionDocProps {
  if (props.motion !== undefined) {
    const nextProps = { ...props };
    delete nextProps.enter;
    delete nextProps.delay;
    delete nextProps.duration;
    return nextProps;
  }

  const motion = normalizeElementMotion(props);
  const nextProps: MotionDocProps = {
    ...props,
    enter: motion.enter
  };

  if (motion.enter === "none") {
    delete nextProps.delay;
    delete nextProps.duration;
    return nextProps;
  }

  nextProps.delay = motion.delay ?? 0;
  nextProps.duration = motion.duration ?? 0.6;

  return nextProps;
}

export function hasElementMotion(props: MotionDocPropInput) {
  return normalizeElementMotion(props).enter !== "none";
}

export function applyElementAnimationProps(
  props: MotionDocProps,
  enter: EnterAnimation
): MotionDocProps {
  return normalizeElementMotionProps({
    ...props,
    enter
  });
}

export function editableMotionSequence(props: MotionDocProps): MotionSequenceV1 {
  const migrated = migrateLegacyEnterMotion(props);
  return motionSequenceFromProps(migrated) ?? { actions: [], version: 1 };
}

export function addTweenActionProps(props: MotionDocProps, nextOrder?: number, preset: MotionTweenPreset = "move") {
  const migratingLegacy = !motionSequenceFromProps(props) && normalizeEnterAnimation(props.enter) !== "none";
  const migrated = migrateLegacyEnterMotion(props);
  const currentSequence = editableMotionSequence(migrated);
  const sequence = migratingLegacy && nextOrder !== undefined
    ? { actions: currentSequence.actions.map((action, offset) => ({ ...action, order: nextOrder + offset })), version: 1 as const }
    : currentSequence;
  const finalState = tweenStateFromProps(migrated);
  const lastTween = sequence.actions.filter((action): action is MotionTweenAction => action.type === "tween").at(-1);
  const from = lastTween?.to ?? tweenPresetStart(finalState, preset);
  const action: MotionTweenAction = {
    duration: 0.6,
    easing: "easeInOut",
    from,
    id: createMotionActionId(),
    order: nextOrder === undefined
      ? Math.max(-1, ...sequence.actions.map((item) => item.order)) + 1
      : nextOrder + (migratingLegacy ? sequence.actions.length : 0),
    preset,
    start: "onClick",
    to: finalState,
    type: "tween"
  };
  const actions = orderActionsByStage([...sequence.actions, action]);
  return {
    action: actions.find((candidate): candidate is MotionTweenAction => candidate.id === action.id && candidate.type === "tween") ?? action,
    props: withMotionSequence(migrated, { actions, version: 1 })
  };
}

export function updateMotionActionProps(
  props: MotionDocProps,
  actionId: string,
  update: (action: MotionAction) => MotionAction
) {
  const sequence = editableMotionSequence(props);
  const actions = sequence.actions.map((action) => action.id === actionId ? update(action) : action);
  let nextProps = withMotionSequence(migrateLegacyEnterMotion(props), { actions, version: 1 });
  const finalTween = actions.filter((action): action is MotionTweenAction => action.type === "tween").at(-1);
  if (finalTween) nextProps = applyTweenState(nextProps, finalTween.to);
  return nextProps;
}

export function removeMotionActionProps(props: MotionDocProps, actionId: string) {
  const sequence = editableMotionSequence(props);
  const actions = sequence.actions.filter((action) => action.id !== actionId);
  let nextProps = withMotionSequence(migrateLegacyEnterMotion(props), actions.length ? { actions, version: 1 } : null);
  const finalTween = actions.filter((action): action is MotionTweenAction => action.type === "tween").at(-1);
  if (finalTween) nextProps = applyTweenState(nextProps, finalTween.to);
  return nextProps;
}

export function moveMotionActionProps(props: MotionDocProps, actionId: string, direction: -1 | 1) {
  const sequence = editableMotionSequence(props);
  const index = sequence.actions.findIndex((action) => action.id === actionId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= sequence.actions.length) return props;
  const actions = [...sequence.actions];
  const current = actions[index];
  const target = actions[nextIndex];
  if (!current || !target) return props;
  actions[index] = { ...target, order: current.order };
  actions[nextIndex] = { ...current, order: target.order };
  if (actions[0]?.start === "withPrevious") actions[0] = { ...actions[0], start: "onClick" };
  return withMotionSequence(migrateLegacyEnterMotion(props), { actions, version: 1 });
}

export function applySequenceEnterAnimationProps(props: MotionDocProps, enter: EnterAnimation, nextOrder?: number) {
  const hadSequence = Boolean(motionSequenceFromProps(props));
  const hadLegacyEnter = !hadSequence && normalizeEnterAnimation(props.enter) !== "none";
  const migrated = migrateLegacyEnterMotion(props);
  const sequence = editableMotionSequence(migrated);
  const existingEnter = sequence.actions.find((action) => action.type === "enter");
  const withoutEnter = sequence.actions.filter((action) => action.type !== "enter");
  const actions: MotionAction[] = enter === "none"
    ? withoutEnter
    : [{
        duration: 0.6,
        easing: "easeInOut",
        id: existingEnter?.id ?? createMotionActionId(),
        order: existingEnter && !(hadLegacyEnter && nextOrder !== undefined)
          ? existingEnter.order
          : nextOrder ?? Math.max(-1, ...sequence.actions.map((action) => action.order)) + 1,
        preset: enter,
        start: "afterPrevious",
        type: "enter"
      }, ...withoutEnter];
  const nextProps = { ...migrated };
  delete nextProps.enter;
  delete nextProps.delay;
  delete nextProps.duration;
  return withMotionSequence(nextProps, actions.length ? { actions: orderActionsByStage(actions), version: 1 } : null);
}

export function applyTweenPreset(action: MotionTweenAction, preset: MotionTweenPreset): MotionTweenAction {
  const from = tweenPresetStart(action.to, preset);
  const path = preset === "arcUp" || preset === "arcDown" || preset === "drift"
    ? {
        controlX: (from.x + from.w / 2 + action.to.x + action.to.w / 2) / 2,
        controlY: (from.y + from.h / 2 + action.to.y + action.to.h / 2) / 2 + (preset === "arcUp" ? -14 : preset === "arcDown" ? 14 : -7)
      }
    : undefined;
  const numberRange = preset === "numberRange"
    ? action.numberRange ?? { from: 100, step: 1, to: 0 }
    : undefined;
  return { ...action, from, numberRange, ...(path ? { path } : { path: undefined }), preset };
}

function tweenPresetStart(finalState: MotionTweenAction["to"], preset: MotionTweenPreset) {
  if (preset === "numberRange") return finalState;
  if (preset === "drift") {
    const w = finalState.w * 0.92;
    const h = finalState.h * 0.92;
    return {
      ...finalState,
      h,
      opacity: Math.min(finalState.opacity, 0.55),
      rotation: finalState.rotation - 4,
      w,
      x: finalState.x - 8 + (finalState.w - w) / 2,
      y: finalState.y + 6 + (finalState.h - h) / 2
    };
  }
  if (preset === "scale") {
    const w = finalState.w * 0.72;
    const h = finalState.h * 0.72;
    return { ...finalState, h, w, x: finalState.x + (finalState.w - w) / 2, y: finalState.y + (finalState.h - h) / 2 };
  }
  if (preset === "rotate") return { ...finalState, rotation: finalState.rotation - 24 };
  if (preset === "fade") return { ...finalState, opacity: 0 };
  return { ...finalState, x: finalState.x - Math.min(10, finalState.w * 0.75) };
}

export function applySequenceExitAnimationProps(props: MotionDocProps, preset: MotionExitPreset | "none", nextOrder?: number) {
  const migratingLegacy = !motionSequenceFromProps(props) && normalizeEnterAnimation(props.enter) !== "none";
  const migrated = migrateLegacyEnterMotion(props);
  const currentSequence = editableMotionSequence(migrated);
  const sequence = migratingLegacy && nextOrder !== undefined
    ? { actions: currentSequence.actions.map((action, offset) => ({ ...action, order: nextOrder + offset })), version: 1 as const }
    : currentSequence;
  const existingExit = sequence.actions.find((action) => action.type === "exit");
  const withoutExit = sequence.actions.filter((action) => action.type !== "exit");
  const actions: MotionAction[] = preset === "none"
    ? withoutExit
    : [...withoutExit, {
        duration: existingExit?.duration ?? 0.5,
        easing: existingExit?.easing ?? "easeInOut",
        id: existingExit?.id ?? createMotionActionId(),
        order: existingExit?.order ?? (migratingLegacy && nextOrder !== undefined
          ? nextOrder + sequence.actions.length
          : nextOrder ?? Math.max(-1, ...sequence.actions.map((action) => action.order)) + 1),
        preset,
        start: existingExit?.start ?? "onClick",
        type: "exit"
      }];
  return withMotionSequence(migrated, actions.length ? { actions: orderActionsByStage(actions), version: 1 } : null);
}

function orderActionsByStage(actions: MotionAction[]) {
  const orders = actions.map((action) => action.order).sort((left, right) => left - right);
  return [...actions]
    .sort((left, right) => stageRank(left) - stageRank(right) || left.order - right.order)
    .map((action, index) => ({ ...action, order: orders[index] ?? action.order }));
}

function stageRank(action: MotionAction) {
  return action.type === "enter" ? 0 : action.type === "tween" ? 1 : 2;
}

export function normalizeBlockMotion(block: MotionDocBlock): MotionDocBlock {
  if (!("props" in block)) {
    return block;
  }

  return {
    ...block,
    props: normalizeElementMotionProps(block.props)
  } as MotionDocBlock;
}

export function normalizeSlideMotion(props: MotionDocPropInput): SlideMotionConfig {
  const slideTransition = normalizeSlideTransition(props.slideTransition);

  if (slideTransition === "none") {
    return { slideTransition };
  }

  return {
    duration: numberProp(props.transitionDuration, 0.72),
    slideTransition
  };
}

export function applySlideTransitionProps(
  props: MotionDocProps,
  slideTransition: SlideTransition
): MotionDocProps {
  const nextProps: MotionDocProps = {
    ...props,
    slideTransition
  };

  if (slideTransition === "none") {
    nextProps.transitionDuration = "";
    return nextProps;
  }

  nextProps.transitionDuration = props.transitionDuration || 0.72;

  return nextProps;
}

function numberProp(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}
