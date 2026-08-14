import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { startWorkbenchServer } from "./http";
import { SlideXProject } from "./project";

test("Workbench API can use a hidden operating-system-assigned port", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-workbench-http-"));
  let close: (() => Promise<void>) | undefined;

  try {
    await writeFile(
      path.join(root, "presentation.mdx"),
      "# Local deck\n\n<Slide><Text role=\"title\">Hidden API</Text></Slide>\n",
      "utf8"
    );
    const project = new SlideXProject(root);
    await project.prepare();

    const running = await startWorkbenchServer({ clientRoot: root, port: 0, project });
    close = running.close;

    assert.ok(Number.isInteger(running.port));
    assert.ok(running.port > 0);

    const response = await fetch(`http://127.0.0.1:${running.port}/api/v1/document`);
    assert.equal(response.status, 200);
    assert.match((await response.json()).source, /Hidden API/);
  } finally {
    await close?.();
    await rm(root, { force: true, recursive: true });
  }
});
