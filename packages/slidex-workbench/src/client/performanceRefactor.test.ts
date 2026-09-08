import assert from "node:assert/strict";
import test from "node:test";
import { latestRequest } from "./latestRequest";
import { createFreeformMaterializer, materializeFreeformDocument } from "../../../../core/motion-doc/application/motionDocFreeform";
import { parseMotionDoc } from "../../../../core/motion-doc/domain/motionDocParser";
import { summarizeMotionDoc } from "../../../../core/motion-doc/application/motionDocAutomation";
import { popSourceHistory, pushSourceHistory, type SourceHistoryEntry } from "../../../../features/pitch/application/sourceHistory";
import { BoundedCache } from "../../../../common/util/boundedCache";
import { createSourceValidator } from "./sourceValidation";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const source = '# Sample\n<Slide id="a"><Text id="one">One</Text></Slide>\n<Slide id="b"><Text id="two">Two</Text></Slide>';

test("context bursts send only the latest value and never overlap requests", async () => {
  const sent: number[] = [];
  let release!: () => void;
  const first = new Promise<void>((resolve) => { release = resolve; });
  const queue = latestRequest(async (value: number) => { sent.push(value); if (sent.length === 1) await first; }, 5);
  try {
    for (let i = 0; i < 20; i++) queue.schedule(i);
    await wait(20);
    assert.deepEqual(sent, [19]);
    for (let i = 20; i < 40; i++) queue.schedule(i);
    await wait(20);
    assert.deepEqual(sent, [19]);
    release(); await wait(20);
    assert.deepEqual(sent, [19, 39]);
    queue.schedule(40); queue.dispose(); await wait(20);
    assert.deepEqual(sent, [19, 39]);
  } finally { release(); queue.dispose(); }
});

test("incremental materialization preserves unchanged slides and matches the complete path", () => {
  const materialize = createFreeformMaterializer();
  const first = materialize(source);
  const changed = source.replace('>Two<', '>Changed<');
  const second = materialize(changed);
  assert.deepEqual(second, materializeFreeformDocument(changed));
  assert.equal(second.document.scenes[0], first.document.scenes[0]);
  assert.notEqual(second.document.scenes[1], first.document.scenes[1]);
  assert.equal(materialize(changed.replace('# Sample', '# Renamed')).document.title, 'Renamed');
  assert.throws(() => materialize(source + '<Card />'), /Unsupported/);
});

test("cached parsed and validated documents cannot be poisoned by callers", () => {
  const parsed = parseMotionDoc(source);
  parsed.scenes[0].blocks[0].props.id = 'changed';
  assert.equal(parseMotionDoc(source).scenes[0].blocks[0].props.id, 'one');
  const summary = summarizeMotionDoc(source);
  summary.validation.isValid = false;
  summary.document.scenes.length = 0;
  assert.equal(summarizeMotionDoc(source).document.scenes.length, 2);
  assert.equal(summarizeMotionDoc(source).validation.isValid, true);
});

test("compressed undo restores every byte through replacements, deletions, and Unicode edits", () => {
  const versions = ['中文😀 alpha', '中文😀 beta', '', 'x', 'x\n下一行', '完全替换'];
  let history: SourceHistoryEntry[] = [];
  for (const version of versions) history = pushSourceHistory(history, version);
  for (const version of versions.toReversed()) assert.equal(popSourceHistory(history), version);
  assert.equal(popSourceHistory(history), undefined);
});

test("undo uses deltas for large documents and applies both history limits", () => {
  const base = 'x'.repeat(100_000);
  let history: SourceHistoryEntry[] = [];
  for (let i = 0; i < 100; i++) history = pushSourceHistory(history, base + i);
  assert.equal(history.length, 80);
  assert.ok(JSON.stringify(history).length < 110_000);
  for (let i = 99; i >= 20; i--) assert.equal(popSourceHistory(history), base + i);
  assert.deepEqual(pushSourceHistory([], base, 100), []);
});

test("bounded caches evict least recently used and oversized entries", () => {
  const cache = new BoundedCache<string, number>(2, 10);
  cache.set('a', 1, 4); cache.set('b', 2, 4); cache.get('a'); cache.set('c', 3, 4);
  assert.equal(cache.get('b'), undefined); assert.equal(cache.get('a'), 1);
  cache.set('large', 4, 11); assert.equal(cache.get('large'), undefined);
});

test("source validation remains correct when workers are unavailable", async () => {
  const validator = createSourceValidator();
  try {
    assert.equal((await validator.validate(source)).validation.isValid, true);
    assert.equal((await validator.validate(source + '<Card />')).validation.isValid, false);
  } finally { validator.dispose(); }
});
