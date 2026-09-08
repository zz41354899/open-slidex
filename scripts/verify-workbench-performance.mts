// Run after build:runtime: node --import tsx scripts/verify-workbench-performance.mts
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright-core";
import { SlideXProject } from "../packages/slidex-workbench/src/server/project";
import { startWorkbenchServer } from "../packages/slidex-workbench/src/server/http";
import { motionDocToReactPresentationSource } from "../core/react-presentation/reactPresentationSource";
import { summarizeMotionDoc } from "../core/motion-doc/application/motionDocAutomation";

const root = await mkdtemp(path.join(os.tmpdir(), "slidex-browser-perf-"));
const browser = await chromium.launch({ executablePath: process.env.OPEN_SLIDEX_CHROMIUM_EXECUTABLE || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
try {
  for (const count of [30, 120]) {
    const deck = path.join(root, `deck-${count}`);
    await mkdir(deck);
    const slide = (index: number) => `<Slide id="slide-${index}" duration={5} canvasWidth={1920} canvasHeight={1080} fontSizeUnit="pt" background="#ffffff"><Text id="title-${index}" x={10} y={10} w={70} h={12} fontSize={30}>Performance slide ${index + 1}</Text><Shape id="line-${index}" shape="line" x={10} y={40} w={25} h={1} rotation={0} /><Chart id="chart-${index}" type="bar" data='[{"label":"Q1","value":42},{"label":"Q2","value":58}]' x={50} y={35} w={40} h={50} /></Slide>`;
    const file = path.join(deck, "presentation.tsx");
    const source = motionDocToReactPresentationSource('# Performance QA\n\n' + Array.from({ length: count }, (_, i) => slide(i)).join('\n\n'));
    assert.equal(summarizeMotionDoc(source).validation.isValid, true, 'browser fixture must be valid');
    await writeFile(file, source);
    const project = new SlideXProject(deck);
    await project.prepare();
    const server = await startWorkbenchServer({ project, port: 0, clientRoot: path.resolve('packages/slidex-workbench/dist/client') });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors: string[] = [];
    const requests: Array<{ url: string; method: string }> = [];
    let workers = 0;
    page.on('worker', () => workers++);
    page.on('pageerror', (error) => errors.push(error.stack || error.message));
    page.on('console', (message) => { if (message.type() === 'error' && !message.location().url.endsWith('/favicon.ico')) errors.push(message.text()); });
    page.on('request', (request) => requests.push({ url: request.url(), method: request.method() }));
    try {
      await page.goto(`http://127.0.0.1:${server.port}/`);
      if (errors.length) throw new Error(errors.join('\n'));
      await page.locator('[data-slide-frame-index="0"] [aria-current="true"]').waitFor();
      await page.waitForTimeout(400);
      assert.equal(requests.some((request) => /editor-chart-inspector|\/ChartInspector-/.test(request.url)), false, 'chart controls must not load before selection');
      const next = page.getByRole('button', { name: /^(Next slide|下一張投影片)$/ });
      for (let i = 1; i < count; i++) await next.click();
      await page.locator(`[data-slide-frame-index="${count - 1}"] [aria-current="true"]`).waitFor();
      const previous = page.getByRole('button', { name: /^(Previous slide|上一張投影片)$/ });
      for (let i = 1; i < count; i++) await previous.click();
      await page.locator('[data-slide-frame-index="0"] [aria-current="true"]').waitFor();
      const code = page.getByRole('button', { name: /^(Code editor|Code Editor|Code 編輯器)$/ });
      if (!await code.isVisible()) await page.getByRole('checkbox', { name: /Toggle inspector|切換屬性面板/ }).click();
      await code.click();
      const editor = page.locator('.cm-content');
      await editor.waitFor();
      await editor.click();
      await editor.press('ControlOrMeta+A');
      await page.keyboard.insertText(slide(0).replace('Performance slide 1', 'Verified edit'));
      await page.waitForFunction(() => !document.querySelector('[data-save-state="saving"]'));
      for (let attempt = 0; attempt < 100 && !(await readFile(file, 'utf8')).includes('Verified edit'); attempt++) await page.waitForTimeout(100);
      assert.match(await readFile(file, 'utf8'), /Verified edit/, 'background validation and autosave must persist the edit');
      await page.getByRole('button', { name: /Close code editor|關閉 Code 編輯器/ }).click();
      await page.getByRole('button', { name: /^(Undo|復原)$/ }).click();
      for (let attempt = 0; attempt < 100 && (await readFile(file, 'utf8')).includes('Verified edit'); attempt++) await page.waitForTimeout(100);
      assert.doesNotMatch(await readFile(file, 'utf8'), /Verified edit/, 'undo must restore the prior source');
      await page.getByRole('button', { name: /^(Redo|重做)$/ }).click();
      for (let attempt = 0; attempt < 100 && !(await readFile(file, 'utf8')).includes('Verified edit'); attempt++) await page.waitForTimeout(100);
      assert.match(await readFile(file, 'utf8'), /Verified edit/, 'redo must restore the edited source');
      await page.getByRole('button', { name: /Move Chart layer 3|移動圖表圖層 3/ }).click();
      await page.getByText(/^(Chart design|圖表設計)$/).waitFor();
      assert.ok(requests.some((request) => /editor-chart-inspector/.test(request.url)), 'selecting a chart must load its deferred inspector');
      assert.ok(workers > 0, 'validation must use a worker in the built browser runtime');
      await page.waitForTimeout(500);
      const beforeBurst = requests.length;
      const saved = await readFile(file, 'utf8');
      for (let version = 0; version < 20; version++) {
        await writeFile(file, saved.replace('Verified edit', `External version ${version}`));
      }
      await page.getByText('External version 19', { exact: true }).first().waitFor();
      await page.waitForTimeout(300);
      const burstReads = requests.slice(beforeBurst).filter((request) => request.method === 'GET' && request.url.endsWith('/api/v1/document')).length;
      assert.ok(burstReads > 0 && burstReads < 20, `external burst must coalesce reads, got ${burstReads}`);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ pages: count, navigation: `1 → ${count} → 1`, autosave: 'passed', undoRedo: 'passed', lazyChart: 'passed', externalBurst: { writes: 20, reads: burstReads }, validationWorkers: workers, contextPosts: requests.filter((request) => request.url.endsWith('/api/v1/context')).length, errors }));
    } catch (error) {
      console.error((await page.locator('body').innerText()).slice(0, 3000));
      console.error({ errors });
      throw error;
    } finally { await context.close(); await server.close(); }
  }
} finally { await browser.close(); await rm(root, { recursive: true, force: true }); }
