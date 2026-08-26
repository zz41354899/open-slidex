import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_DOCUMENT_READ_RETRY_DELAYS_MS,
  LOCAL_DRAFT_DELAY_MS,
  canBeginExternalDocumentMutation,
  readInitialDocument,
  scheduleLocalDraftPersist,
  shouldValidateDeferredSource
} from "./useLocalDocument";

test("an external HTML mutation starts only from the current saved revision", () => {
  assert.equal(canBeginExternalDocumentMutation({
    externalMutationInFlight: false,
    saveInFlight: false,
    saveState: "saved",
    savedSource: "# Saved",
    source: "# Saved"
  }), true);
  assert.equal(canBeginExternalDocumentMutation({
    externalMutationInFlight: false,
    saveInFlight: false,
    saveState: "dirty",
    savedSource: "# Saved",
    source: "# Edited"
  }), false);
  assert.equal(canBeginExternalDocumentMutation({
    externalMutationInFlight: true,
    saveInFlight: false,
    saveState: "saved",
    savedSource: "# Saved",
    source: "# Saved"
  }), false);
});

test("deferred validation cannot replace loading before the first document opens", () => {
  assert.equal(shouldValidateDeferredSource("", "", ""), false);
  assert.equal(shouldValidateDeferredSource("deck", "# Current", "# Current"), true);
  assert.equal(shouldValidateDeferredSource("deck", "# Deferred", "# Current"), false);
});

test("draft persistence is debounced and can be cancelled by the next source change", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { clearTimeout, setTimeout }
  });
  try {
    const writes: string[] = [];
    const cancelFirst = scheduleLocalDraftPersist(() => writes.push("first"), 15);
    cancelFirst();
    scheduleLocalDraftPersist(() => writes.push("latest"), 15);
    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.deepEqual(writes, ["latest"]);
    assert.equal(LOCAL_DRAFT_DELAY_MS, 250);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("opening a document stays in loading while transient local reads retry", async () => {
  let attempts = 0;
  const delays: number[] = [];
  const result = await readInitialDocument(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("Workbench API is starting");
      return { projectId: "deck", revision: "r1", source: "# Ready", title: "Ready", validation: { isValid: true, issues: [] } };
    },
    async (delay) => { delays.push(delay); }
  );

  assert.equal(result.title, "Ready");
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [...INITIAL_DOCUMENT_READ_RETRY_DELAYS_MS.slice(0, 2)]);
});

test("opening reports an error only after every local startup retry is exhausted", async () => {
  let attempts = 0;
  const delays: number[] = [];

  await assert.rejects(
    readInitialDocument(
      async () => {
        attempts += 1;
        throw new Error("Workbench API is unavailable");
      },
      async (delay) => { delays.push(delay); }
    ),
    /Workbench API is unavailable/
  );

  assert.equal(attempts, INITIAL_DOCUMENT_READ_RETRY_DELAYS_MS.length + 1);
  assert.deepEqual(delays, [...INITIAL_DOCUMENT_READ_RETRY_DELAYS_MS]);
});
