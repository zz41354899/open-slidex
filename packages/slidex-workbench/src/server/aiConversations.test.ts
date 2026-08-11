import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { AiConversationStore } from "./aiConversations";

test("conversation storage switches threads, deletes them, and writes versioned JSON", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-conversations-"));
  const stateRoot = path.join(root, ".open-slidex");
  const store = new AiConversationStore(root, stateRoot);
  try {
    const first = await store.create("codex", "Deck QA");
    const second = await store.create("claude", "Alternate draft");
    await store.append(first.id, { content: "Inspect slide 2", role: "user" });
    assert.equal((await store.list()).threads[0]?.id, first.id);
    assert.equal(await store.delete(second.id), true);
    const parsed = JSON.parse(await readFile(store.filePath, "utf8")) as { threads: unknown[]; version: number };
    assert.equal(parsed.version, 1);
    assert.equal(parsed.threads.length, 1);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("conversation storage recovers from corrupt JSON and strips sensitive payloads", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "open-slidex-conversations-corrupt-"));
  const stateRoot = path.join(root, ".open-slidex");
  await mkdir(stateRoot);
  const store = new AiConversationStore(root, stateRoot);
  try {
    await writeFile(store.filePath, "{broken", "utf8");
    const thread = await store.create("codex");
    await store.append(thread.id, {
      activities: [{
        details: [`TOKEN=secret ${root}/presentation.mdx`],
        id: "tool-1",
        status: "completed",
        summary: "Updated",
        targets: [{ kind: "slide", slideIndex: 0 }],
        tool: "open_slidex_edit"
      }],
      content: `<OPENSLIDEX_MDX>full source</OPENSLIDEX_MDX> api_key=secret data:image/png;base64,AAAA`,
      role: "assistant"
    });
    const stored = await readFile(store.filePath, "utf8");
    assert.doesNotMatch(stored, /full source|base64,AAAA|TOKEN=secret|api_key=secret/);
    assert.match(stored, /presentation source omitted/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
