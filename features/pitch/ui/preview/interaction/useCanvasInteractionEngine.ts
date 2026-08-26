
import { useCallback, useMemo, useReducer, useRef } from "react";
import {
  interactionFrameUpdates,
  type CanvasInteraction,
  type CanvasPoint,
  type MarqueeSelection
} from "@/features/pitch/application/previewCanvas";

export type CanvasInteractionMode =
  | "dragging"
  | "editingText"
  | "idle"
  | "marqueeSelecting"
  | "rotating"
  | "resizing"
  | "selected";

export type CanvasSelectionSnapshot = {
  primaryIndex: number | null;
  selectedIndices: readonly number[];
};

export type CanvasInteractionState = CanvasSelectionSnapshot & {
  mode: CanvasInteractionMode;
  marqueeSelection: MarqueeSelection | null;
  transform: CanvasInteraction | null;
};

type CanvasInteractionAction =
  | { type: "begin-dragging"; interaction: CanvasInteraction }
  | { type: "begin-editing-text"; blockIndex: number }
  | { type: "begin-marquee"; selection: MarqueeSelection }
  | { type: "begin-resizing"; interaction: CanvasInteraction }
  | { type: "begin-rotating"; interaction: CanvasInteraction }
  | { type: "cancel-marquee"; pointerId: number }
  | { type: "clear" }
  | { type: "finish-editing-text" }
  | { type: "finish-transform" }
  | { type: "update-marquee"; current: MarqueeSelection["current"]; pointerId: number };

const initialCanvasInteractionState: CanvasInteractionState = {
  marqueeSelection: null,
  mode: "idle",
  primaryIndex: null,
  selectedIndices: [],
  transform: null
};

export function useCanvasInteractionEngine(selection: CanvasSelectionSnapshot) {
  const [state, dispatch] = useReducer(canvasInteractionReducer, initialCanvasInteractionState);
  const transformRef = useRef<CanvasInteraction | null>(null);
  const controlledState = useMemo(
    () => controlledCanvasInteractionState(state, selection),
    [selection.primaryIndex, selection.selectedIndices, state]
  );

  return {
    ...controlledState,
    beginDragging: useCallback((interaction: CanvasInteraction) => {
      transformRef.current = interaction;
      dispatch({ interaction, type: "begin-dragging" });
    }, []),
    beginEditingText: useCallback((blockIndex: number) => {
      transformRef.current = null;
      dispatch({ blockIndex, type: "begin-editing-text" });
    }, []),
    beginMarquee: useCallback((selection: MarqueeSelection) => {
      transformRef.current = null;
      dispatch({ selection, type: "begin-marquee" });
    }, []),
    beginResizing: useCallback((interaction: CanvasInteraction) => {
      transformRef.current = interaction;
      dispatch({ interaction, type: "begin-resizing" });
    }, []),
    beginRotating: useCallback((interaction: CanvasInteraction) => {
      transformRef.current = interaction;
      dispatch({ interaction, type: "begin-rotating" });
    }, []),
    cancelMarquee: useCallback((pointerId: number) => {
      dispatch({ pointerId, type: "cancel-marquee" });
    }, []),
    clearInteraction: useCallback(() => {
      transformRef.current = null;
      dispatch({ type: "clear" });
    }, []),
    frameUpdatesForPointer: useCallback((pointer: CanvasPoint, options?: { preserveAspectRatio?: boolean }) => {
      const interaction = transformRef.current;

      return interaction ? interactionFrameUpdates(interaction, pointer, options) : null;
    }, []),
    finishTransform: useCallback(() => {
      transformRef.current = null;
      dispatch({ type: "finish-transform" });
    }, []),
    finishEditingText: useCallback(() => {
      transformRef.current = null;
      dispatch({ type: "finish-editing-text" });
    }, []),
    isTransformingBlock: useCallback((blockId: string) => {
      return transformRef.current?.blockId === blockId;
    }, []),
    updateMarquee: useCallback((pointerId: number, current: MarqueeSelection["current"]) => {
      dispatch({ current, pointerId, type: "update-marquee" });
    }, [])
  };
}

function canvasInteractionReducer(
  state: CanvasInteractionState,
  action: CanvasInteractionAction
): CanvasInteractionState {
  switch (action.type) {
    case "begin-dragging":
      return {
        ...state,
        marqueeSelection: null,
        mode: "dragging",
        primaryIndex: action.interaction.blockIndex,
        selectedIndices: blockIndicesFromTransform(action.interaction),
        transform: action.interaction
      };
    case "begin-resizing":
      return {
        ...state,
        marqueeSelection: null,
        mode: "resizing",
        primaryIndex: action.interaction.blockIndex,
        selectedIndices: [action.interaction.blockIndex],
        transform: action.interaction
      };
    case "begin-rotating":
      return {
        ...state,
        marqueeSelection: null,
        mode: "rotating",
        primaryIndex: action.interaction.blockIndex,
        selectedIndices: [action.interaction.blockIndex],
        transform: action.interaction
      };
    case "begin-editing-text":
      return {
        ...state,
        marqueeSelection: null,
        mode: "editingText",
        primaryIndex: action.blockIndex,
        selectedIndices: [action.blockIndex],
        transform: null
      };
    case "begin-marquee":
      return {
        ...state,
        marqueeSelection: action.selection,
        mode: "marqueeSelecting",
        transform: null
      };
    case "update-marquee":
      if (!state.marqueeSelection || state.marqueeSelection.pointerId !== action.pointerId) {
        return state;
      }

      return {
        ...state,
        marqueeSelection: {
          ...state.marqueeSelection,
          current: action.current
        }
      };
    case "cancel-marquee":
      if (!state.marqueeSelection || state.marqueeSelection.pointerId !== action.pointerId) {
        return state;
      }

      return initialCanvasInteractionState;
    case "finish-transform":
      return initialCanvasInteractionState;
    case "finish-editing-text":
      return finishedCanvasTextEditingState(state);
    case "clear":
      return initialCanvasInteractionState;
    default:
      return state;
  }
}

export function finishedCanvasTextEditingState(
  state: CanvasInteractionState
): CanvasInteractionState {
  if (state.mode !== "editingText") return state;
  return {
    ...state,
    marqueeSelection: null,
    mode: modeFromSnapshot(state),
    transform: null
  };
}

/** Derives ordinary selection from the parent without dispatching from an effect. */
export function controlledCanvasInteractionState(
  state: CanvasInteractionState,
  snapshot: CanvasSelectionSnapshot
): CanvasInteractionState {
  if (state.mode === "dragging" || state.mode === "resizing" || state.mode === "rotating" || state.mode === "marqueeSelecting") {
    return state;
  }

  if (state.mode === "editingText" && snapshot.selectedIndices.includes(state.primaryIndex ?? -1)) {
    if (sameSelectionSnapshot(state, snapshot)) return state;
    return {
      ...state,
      primaryIndex: snapshot.primaryIndex,
      selectedIndices: snapshot.selectedIndices
    };
  }

  const mode = modeFromSnapshot(snapshot);
  if (
    state.mode === mode
    && state.marqueeSelection === null
    && state.transform === null
    && sameSelectionSnapshot(state, snapshot)
  ) return state;
  return {
    marqueeSelection: null,
    mode,
    primaryIndex: snapshot.primaryIndex,
    selectedIndices: snapshot.selectedIndices,
    transform: null
  };
}

function sameSelectionSnapshot(left: CanvasSelectionSnapshot, right: CanvasSelectionSnapshot) {
  return left.primaryIndex === right.primaryIndex
    && left.selectedIndices.length === right.selectedIndices.length
    && left.selectedIndices.every((index, offset) => index === right.selectedIndices[offset]);
}

function blockIndicesFromTransform(interaction: CanvasInteraction) {
  const indices = interaction.startFrames.map(({ blockIndex }) => blockIndex);

  if (!indices.includes(interaction.blockIndex)) {
    indices.unshift(interaction.blockIndex);
  }

  return indices;
}

function modeFromSnapshot(snapshot: CanvasSelectionSnapshot): CanvasInteractionMode {
  return snapshot.primaryIndex === null && snapshot.selectedIndices.length === 0 ? "idle" : "selected";
}
