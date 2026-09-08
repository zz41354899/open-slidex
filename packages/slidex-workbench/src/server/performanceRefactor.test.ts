import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SlideXProject } from "./project";
import { OpenSlideXWorkspace } from "./workspace";
import { createWorkbenchRouter, startWorkbenchServer, type WorkbenchRouter } from "./http";
import { evictIdleEditorRouters } from "./workspaceHttp";
import { parseByteRange } from "./streamAsset";
import sharp from "sharp";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "slidex-perf-"));
  await writeFile(path.join(root, "presentation.mdx"), '# Test\n<Slide><Text id="a">One</Text></Slide>');
  const project = new SlideXProject(root);
  await project.prepare();
  return { root, project, dispose: () => rm(root, { recursive: true, force: true }) };
}

test("unchanged documents reuse snapshots but edits and caller mutations invalidate correctly", async () => {
  const { project, root, dispose } = await fixture();
  const original = project.adapter.open.bind(project.adapter);
  let reads = 0;
  project.adapter.open = async () => { reads++; return original(); };
  try {
    const first = await project.open(); first.validation.isValid = false;
    assert.equal((await project.open()).validation.isValid, true);
    assert.equal(reads, 1);
    await writeFile(path.join(root, 'presentation.mdx'), first.source.replace('One', 'Two'));
    assert.match((await project.open()).source, /Two/);
    assert.equal(reads, 2);
  } finally { await dispose(); }
});

test("context updates avoid duplicate writes and serialize the final selection", async () => {
  const { project, dispose } = await fixture();
  try {
    const document = await project.open();
    const selection = { revision: document.revision, slideIndex: 0, blockIndex: 0 };
    await project.writeCurrent(selection);
    const file = path.join(project.stateRoot, 'current.json');
    const before = await stat(file, { bigint: true });
    await project.writeCurrent(selection);
    assert.equal((await stat(file, { bigint: true })).mtimeNs, before.mtimeNs);
    await Promise.all([project.writeCurrent({ ...selection, nodeId: 'a' }), project.writeCurrent({ revision: document.revision, slideIndex: 0 })]);
    assert.equal(JSON.parse(await readFile(file, 'utf8')).blockType, undefined);
  } finally { await dispose(); }
});

test("workspace summaries refresh changed files without reopening unchanged decks", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'slidex-summary-'));
  const original = SlideXProject.prototype.open;
  let reads = 0;
  SlideXProject.prototype.open = async function () { reads++; return original.call(this); };
  try {
    await mkdir(path.join(root, 'one'));
    const file = path.join(root, 'one', 'presentation.mdx');
    await writeFile(file, '# First\n<Slide><Text>Hello</Text></Slide>');
    const workspace = new OpenSlideXWorkspace({ root, templateRoot: root });
    assert.equal((await workspace.listPresentations())[0].title, 'First');
    assert.equal((await workspace.listPresentations())[0].title, 'First');
    assert.equal(reads, 1);
    await writeFile(file, '# Next\n<Slide><Text>Hello</Text></Slide>');
    assert.equal((await workspace.listPresentations())[0].title, 'Next');
    assert.equal(reads, 2);
  } finally { SlideXProject.prototype.open = original; await rm(root, { recursive: true, force: true }); }
});

test("assets stream correct ranges, HEAD and conditional responses without stale content", async () => {
  const { project, dispose } = await fixture();
  const file = path.join(project.assetsRoot, 'video.mp4');
  await writeFile(file, '0123456789');
  const server = await startWorkbenchServer({ project, port: 0, clientRoot: project.root });
  const url = `http://127.0.0.1:${server.port}/assets/video.mp4`;
  try {
    const partial = await fetch(url, { headers: { range: 'bytes=2-5' } });
    assert.equal(partial.status, 206); assert.equal(await partial.text(), '2345');
    assert.equal(partial.headers.get('content-range'), 'bytes 2-5/10');
    const full = await fetch(url); const etag = full.headers.get('etag')!;
    assert.equal(await full.text(), '0123456789');
    assert.equal((await fetch(url, { headers: { 'if-none-match': etag } })).status, 304);
    assert.equal((await fetch(url, { headers: { range: 'bytes=99-' } })).status, 416);
    assert.equal(await (await fetch(url, { headers: { range: 'bytes=-3' } })).text(), '789');
    const head = await fetch(url, { method: 'HEAD' });
    assert.equal(head.headers.get('content-length'), '10'); assert.equal(await head.text(), '');
    await writeFile(file, 'abcdefghij');
    const changed = await fetch(url, { headers: { 'if-none-match': etag, range: 'bytes=2-5', 'if-range': etag } });
    assert.equal(changed.status, 200); assert.equal(await changed.text(), 'abcdefghij');
  } finally { await server.close(); await dispose(); }
});

test("range parsing rejects invalid, empty and overflowing intervals", () => {
  for (const value of ['bytes=-0', 'bytes=5-2', 'bytes=999999999999999999-', 'bytes=0-1,5-6', 'garbage']) assert.equal(parseByteRange(value, 10), null);
  assert.equal(parseByteRange('bytes=0-', 0), null);
  assert.deepEqual(parseByteRange('bytes=8-999', 10), { start: 8, end: 9 });
});

test("idle router eviction closes watchers and retains recently used routers", async () => {
  const { project, dispose } = await fixture();
  const router = createWorkbenchRouter(project);
  const routers = new Map<string, WorkbenchRouter>([['deck', router]]);
  try {
    evictIdleEditorRouters(routers, Date.now(), 60_000);
    assert.equal(routers.size, 1);
    evictIdleEditorRouters(routers, Date.now() + 60_001, 60_000);
    assert.equal(routers.size, 0);
  } finally { if (routers.size) router.close(); await dispose(); }
});

test("HTML thumbnail batches render distinct pages and invalidate when a sidecar changes", async () => {
  const { project, dispose } = await fixture();
  try {
    const asset = path.join(project.assetsRoot, 'html-asset-1234567890abcdef.png');
    const red = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const green = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#00ff00' } }).png().toBuffer();
    await writeFile(asset, red);
    await writeFile(path.join(project.assetsRoot, 'sample.html'), '<!doctype html><html><head><style>html,body{margin:0}.slide{height:100vh}img{width:100%;height:100%}</style></head><body><div class="slide"><img src="html-asset-1234567890abcdef.png"></div><div class="slide" style="background:blue"></div></body></html>');
    const [first, second, duplicate] = await Promise.all([project.renderHtmlThumbnail('assets/sample.html', 1), project.renderHtmlThumbnail('assets/sample.html', 2), project.renderHtmlThumbnail('assets/sample.html', 1)]);
    assert.deepEqual(first, duplicate); assert.notDeepEqual(first, second);
    assert.deepEqual(await project.renderHtmlThumbnail('assets/sample.html', 1), first);
    await writeFile(asset, green);
    assert.notDeepEqual(await project.renderHtmlThumbnail('assets/sample.html', 1), first);
  } finally { await dispose(); }
});
