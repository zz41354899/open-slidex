import assert from "node:assert/strict";
import test from "node:test";

import {
  controlledCanvasInteractionState,
  finishedCanvasTextEditingState,
  type CanvasInteractionState
} from "@/features/pitch/ui/preview/interaction/useCanvasInteractionEngine";

function state(overrides: Partial<CanvasInteractionState> = {}): CanvasInteractionState {
  return {
    marqueeSelection: null,
    mode: "selected",
    primaryIndex: 2,
    selectedIndices: [1, 2],
    transform: null,
    ...overrides
  };
}

test("controlled Canvas selection returns the same state for equal array values", () => {
  const current = state();
  const synchronized = controlledCanvasInteractionState(current, {
    primaryIndex: 2,
    selectedIndices: [1, 2]
  });

  assert.equal(synchronized, current);
});

test("controlled Canvas selection preserves text editing and applies real changes", () => {
  const editing = state({ mode: "editingText" });
  assert.equal(controlledCanvasInteractionState(editing, {
    primaryIndex: 2,
    selectedIndices: [1, 2]
  }), editing);

  const changed = controlledCanvasInteractionState(editing, {
    primaryIndex: 3,
    selectedIndices: [3]
  });
  assert.notEqual(changed, editing);
  assert.equal(changed.mode, "selected");
  assert.equal(changed.primaryIndex, 3);
  assert.deepEqual(changed.selectedIndices, [3]);
});

test("controlled Canvas selection never overwrites an active pointer interaction", () => {
  for (const mode of ["dragging", "marqueeSelecting", "resizing", "rotating"] as const) {
    const active = state({ mode });
    assert.equal(controlledCanvasInteractionState(active, {
      primaryIndex: 7,
      selectedIndices: [7]
    }), active);
  }
});

test("finishing text editing keeps the selected Text frame active", () => {
  const editing = state({ mode: "editingText", primaryIndex: 2, selectedIndices: [2] });
  const finished = finishedCanvasTextEditingState(editing);

  assert.equal(finished.mode, "selected");
  assert.equal(finished.primaryIndex, 2);
  assert.deepEqual(finished.selectedIndices, [2]);
  assert.equal(finishedCanvasTextEditingState(finished), finished);
});
