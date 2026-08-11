"use client";

import { useCallback, useReducer, useRef } from "react";
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

type CanvasSelectionSnapshot = {
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
  | { type: "finish-transform" }
  | { type: "select"; snapshot: CanvasSelectionSnapshot }
  | { type: "sync-selection"; snapshot: CanvasSelectionSnapshot }
  | { type: "update-marquee"; current: MarqueeSelection["current"]; pointerId: number };

const initialCanvasInteractionState: CanvasInteractionState = {
  marqueeSelection: null,
  mode: "idle",
  primaryIndex: null,
  selectedIndices: [],
  transform: null
};

export function useCanvasInteractionEngine() {
  const [state, dispatch] = useReducer(canvasInteractionReducer, initialCanvasInteractionState);
  const transformRef = useRef<CanvasInteraction | null>(null);

  return {
    ...state,
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
    isTransformingBlock: useCallback((blockId: string) => {
      return transformRef.current?.blockId === blockId;
    }, []),
    select: useCallback((snapshot: CanvasSelectionSnapshot) => {
      transformRef.current = null;
      dispatch({ snapshot, type: "select" });
    }, []),
    syncSelection: useCallback((snapshot: CanvasSelectionSnapshot) => {
      dispatch({ snapshot, type: "sync-selection" });
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

      return {
        ...state,
        marqueeSelection: null,
        mode: modeFromSelection(state),
        transform: null
      };
    case "finish-transform":
      return {
        ...state,
        mode: modeFromSelection(state),
        transform: null
      };
    case "select":
      return {
        marqueeSelection: null,
        mode: modeFromSnapshot(action.snapshot),
        primaryIndex: action.snapshot.primaryIndex,
        selectedIndices: action.snapshot.selectedIndices,
        transform: null
      };
    case "sync-selection":
      if (state.mode === "dragging" || state.mode === "resizing" || state.mode === "rotating" || state.mode === "marqueeSelecting") {
        return state;
      }

      if (state.mode === "editingText" && action.snapshot.selectedIndices.includes(state.primaryIndex ?? -1)) {
        return {
          ...state,
          primaryIndex: action.snapshot.primaryIndex,
          selectedIndices: action.snapshot.selectedIndices
        };
      }

      return {
        ...state,
        mode: modeFromSnapshot(action.snapshot),
        primaryIndex: action.snapshot.primaryIndex,
        selectedIndices: action.snapshot.selectedIndices
      };
    case "clear":
      return initialCanvasInteractionState;
    default:
      return state;
  }
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

function modeFromSelection(state: CanvasSelectionSnapshot): CanvasInteractionMode {
  return modeFromSnapshot(state);
}
