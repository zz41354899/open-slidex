import assert from "node:assert/strict";
import test from "node:test";

import {
  LOCAL_DRAFT_SCHEMA_VERSION,
  inferSourceFormat,
  legacyLocalDraftKey,
  localDraftKey,
  parseLegacyStoredDraft,
  parseStoredDraft
} from "./draftStorage";

test("draft keys and records are versioned by source schema", () => {
  assert.equal(localDraftKey("deck"), "slidex-workbench:draft:v2:deck");
  assert.equal(legacyLocalDraftKey("deck"), "slidex-workbench:draft:deck");
  assert.deepEqual(parseStoredDraft({
    baseRevision: "sha256:one",
    schemaVersion: LOCAL_DRAFT_SCHEMA_VERSION,
    source: "export default <Presentation />",
    sourceFormat: "tsx",
    updatedAt: "2026-09-07T00:00:00.000Z"
  }, "tsx"), {
    baseRevision: "sha256:one",
    schemaVersion: 2,
    source: "export default <Presentation />",
    sourceFormat: "tsx",
    updatedAt: "2026-09-07T00:00:00.000Z"
  });
  assert.equal(parseStoredDraft({
    baseRevision: "sha256:one",
    schemaVersion: 1,
    source: "# Legacy",
    sourceFormat: "mdx",
    updatedAt: "2026-09-07T00:00:00.000Z"
  }, "mdx"), null);
});

test("legacy drafts migrate only when their source format matches", () => {
  const legacy = {
    baseRevision: "sha256:legacy",
    source: "# Legacy\n\n<Slide><Text>Old</Text></Slide>",
    updatedAt: "2026-09-07T00:00:00.000Z"
  };
  assert.equal(inferSourceFormat(legacy.source), "mdx");
  assert.equal(parseLegacyStoredDraft(legacy, "tsx"), null);
  assert.deepEqual(parseLegacyStoredDraft(legacy, "mdx"), {
    ...legacy,
    schemaVersion: 2,
    sourceFormat: "mdx"
  });
  assert.equal(inferSourceFormat("import React from \"react\";\nexport default <Presentation />;"), "tsx");
});
