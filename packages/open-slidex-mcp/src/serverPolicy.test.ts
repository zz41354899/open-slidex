import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveAuthoringGuidanceRoot } from "./serverPolicy";

test("workspace guidance never falls back to skills outside the configured root", async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "open-slidex-guidance-boundary-"));
  const workspace = path.join(parent, "workspace");
  const deck = path.join(workspace, "deck");
  try {
    await mkdir(path.join(parent, ".agents", "skills"), { recursive: true });
    await writeFile(path.join(parent, ".agents", "skills", "outside.txt"), "outside", "utf8");
    await mkdir(deck, { recursive: true });

    assert.equal(await resolveAuthoringGuidanceRoot(deck, workspace), deck);

    await mkdir(path.join(workspace, ".agents", "skills"), { recursive: true });
    assert.equal(await resolveAuthoringGuidanceRoot(deck, workspace), workspace);

    await mkdir(path.join(deck, ".agents", "skills"), { recursive: true });
    assert.equal(await resolveAuthoringGuidanceRoot(deck, workspace), deck);
  } finally {
    await rm(parent, { force: true, recursive: true });
  }
});
