import assert from "node:assert/strict";
import test from "node:test";

import {
  closeSlideXChromiumPool,
  withSlideXChromiumPage
} from "../../../slidex-sdk/src/nodeBrowser";

import {
  HTML_PLAYBACK_CONTENT_SECURITY_POLICY,
  analyzeHtmlPresentation,
  assertSandboxedHtml,
  inspectHtmlNetworkResources,
  injectHtmlPlaybackBridge
} from "./htmlImportPolicy";

test.after(async () => closeSlideXChromiumPool());

test("sandboxed HTML keeps inline SVG, CSS, SMIL, and JavaScript valid", () => {
  assert.doesNotThrow(() => assertSandboxedHtml(`<!doctype html><html><head><style>.x{background:url(data:image/svg+xml;base64,PHN2Zy8+)}</style></head><body><svg><animate attributeName="opacity" values="0;1" /></svg><script>document.body.dataset.ready='yes'</script></body></html>`));
});

test("HTML import decodes character references in inline CSS resource values", () => {
  const source = `<!doctype html><html><body>
    <div style="background-image:url(&quot;data:image/webp;base64,UklGRkAQAABXRUJQVlA4IDQQAAAwrwCdASrAA4ACPlUqk0ej&quot;)"></div>
  </body></html>`;

  assert.doesNotThrow(() => assertSandboxedHtml(source));
  assert.deepEqual(inspectHtmlNetworkResources(source), {
    origins: [],
    referenceCount: 0,
    requiresNetwork: false
  });
});

test("HTML import supports browser-native HTTP(S) images, libraries, fonts, media, and frames", () => {
  const source = `<!doctype html><html><head>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
    <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
    <style>@import url("https://cdn.example.com/deck.css");.hero{background:url(https://images.example.com/hero.webp)}</style>
  </head><body>
    <img src="https://images.unsplash.com/photo.jpg" srcset="https://images.unsplash.com/small.jpg 1x, https://images.unsplash.com/large.jpg 2x">
    <video src="https://media.example.com/launch.mp4" poster="https://images.example.com/poster.webp"></video>
    <iframe src="https://www.youtube-nocookie.com/embed/demo"></iframe>
  </body></html>`;

  assert.doesNotThrow(() => assertSandboxedHtml(source));
  assert.deepEqual(inspectHtmlNetworkResources(source), {
    origins: [
      "https://cdn.example.com",
      "https://cdn.jsdelivr.net",
      "https://fonts.googleapis.com",
      "https://images.example.com",
      "https://images.unsplash.com",
      "https://media.example.com",
      "https://www.youtube-nocookie.com"
    ],
    referenceCount: 10,
    requiresNetwork: true
  });
});

test("HTML import resolves relative CDN resources through a remote base", () => {
  const source = `<html><head><base href="https://cdn.example.com/deck/"><script src="runtime.js"></script></head><body><img src="images/hero.webp"></body></html>`;
  assert.doesNotThrow(() => assertSandboxedHtml(source));
  assert.deepEqual(inspectHtmlNetworkResources(source), {
    origins: ["https://cdn.example.com"],
    referenceCount: 3,
    requiresNetwork: true
  });
});

test("HTML dependency inspection supports valid unquoted and protocol-relative resource attributes", () => {
  const source = `<html><head><script src=//cdn.example.com/runtime.js></script></head><body><img src=https://images.example.com/hero.webp></body></html>`;
  assert.doesNotThrow(() => assertSandboxedHtml(source));
  assert.deepEqual(inspectHtmlNetworkResources(source), {
    origins: ["https://cdn.example.com", "https://images.example.com"],
    referenceCount: 2,
    requiresNetwork: true
  });
});

test("HTML import still rejects unresolved local sidecars and browser-unsupported protocols", () => {
  for (const html of [
    `<html><body><img src="./tree.svg"></body></html>`,
    `<html><head><style>@font-face{src:url(font.woff2)}</style></head></html>`,
    `<html><body><video src="file:///Users/demo/movie.mp4"></video></body></html>`,
    `<html><head><script src="ftp://example.com/app.js"></script></head></html>`
  ]) {
    assert.throws(() => assertSandboxedHtml(html), /relative or unsupported resource|unsupported resource protocol/i);
  }
});

test("HTML import permits navigation links that do not load presentation assets", () => {
  assert.doesNotThrow(() => assertSandboxedHtml(`<html><body><a href="https://example.com/details">Details</a></body></html>`));
  assert.deepEqual(inspectHtmlNetworkResources(`<html><body><a href="https://example.com/details">Details</a></body></html>`), {
    origins: [],
    referenceCount: 0,
    requiresNetwork: false
  });
});

test("HTML dependency inspection ignores inert script text, comments, and non-resource data attributes", () => {
  const source = `<html><body>
    <!-- <img src="./comment-only.png"> -->
    <div data="./analytics-value">Content</div>
    <script>const example = '<img src="./documentation-only.png">';</script>
  </body></html>`;

  assert.doesNotThrow(() => assertSandboxedHtml(source));
  assert.deepEqual(inspectHtmlNetworkResources(source), {
    origins: [],
    referenceCount: 0,
    requiresNetwork: false
  });
});

test("HTML playback policy enables remote browser resources without same-origin access", () => {
  assert.match(HTML_PLAYBACK_CONTENT_SECURITY_POLICY, /script-src[^;]+https:/);
  assert.match(HTML_PLAYBACK_CONTENT_SECURITY_POLICY, /connect-src[^;]+wss:/);
  assert.match(HTML_PLAYBACK_CONTENT_SECURITY_POLICY, /img-src[^;]+https:/);
  assert.match(HTML_PLAYBACK_CONTENT_SECURITY_POLICY, /media-src[^;]+https:/);
  assert.match(HTML_PLAYBACK_CONTENT_SECURITY_POLICY, /frame-src[^;]+https:/);
  assert.doesNotMatch(HTML_PLAYBACK_CONTENT_SECURITY_POLICY, /allow-same-origin/);
});

test("HTML presentation analysis maps explicit and IDAEO Gamma-style pages", () => {
  assert.deepEqual(analyzeHtmlPresentation(`<html><body>
    <section class="gcard page" id="g1" data-stage="4"></section>
    <section class="page gcard" id="g2" data-stage="2"></section>
  </body></html>`), [
    { id: "g1", page: 1, stage: 4 },
    { id: "g2", page: 2, stage: 2 }
  ]);
  assert.deepEqual(analyzeHtmlPresentation(`<html><body>
    <main data-slidex-page="1"></main><main data-slidex-page="2"></main>
  </body></html>`).map(({ page }) => page), [1, 2]);
  assert.deepEqual(analyzeHtmlPresentation(`<html><body>
    <section class="slide is-active" data-slidex-slide-index="0"></section>
    <section class="slide" data-slidex-slide-index="1"></section>
    <section class="slide" data-slidex-slide-index="2"></section>
  </body></html>`).map(({ page }) => page), [1, 2, 3]);
});

test("HTML playback bridge changes only the served response", () => {
  const source = `<html><body><p>Exact source</p></body></html>`;
  const served = injectHtmlPlaybackBridge(source);
  assert.match(served, /data-open-slidex-playback-bridge/);
  assert.match(served, /open-slidex:html-page/);
  assert.equal(source, `<html><body><p>Exact source</p></body></html>`);
  assert.equal(injectHtmlPlaybackBridge(served), served);
});

test("HTML playback bridge inherits the source nonce and fits native export slides to the projection canvas", () => {
  const source = `<!doctype html><html><head>
    <meta http-equiv="Content-Security-Policy" content="script-src 'nonce-slidex-a292d497'">
  </head><body>
    <main class="player"><div class="stage"><div class="viewport"><div class="frame">
      <section class="slide is-active" data-slidex-slide-index="0"></section>
      <section class="slide" data-slidex-slide-index="1"></section>
    </div></div></div><nav class="slide-dots"></nav><nav class="controls"></nav></main>
    <script nonce="slidex-a292d497">window.runtimeReady=true</script>
  </body></html>`;
  const served = injectHtmlPlaybackBridge(source);

  assert.match(served, /data-open-slidex-playback-bridge nonce="slidex-a292d497"/);
  assert.match(served, /data-open-slidex-native-projection/);
  assert.match(served, /data-slidex-slide-index/);
  assert.match(served, /data-slide-target/);
  assert.match(served, /node!==document\.documentElement/);
  assert.match(served, /\[data-slidex-page\],\.gcard\.page/);
  assert.match(served, /getAttribute\('data-page'\)/);
  assert.match(served, /\^#p\?\(\\d\+\)\$/);
  assert.match(served, /\.controls.*\.slide-dots\{display:none!important\}/);
  assert.equal(source.includes("data-open-slidex-playback-bridge"), false);
});

test("HTML playback bridge keeps Gamma-style outer and inner navigation synchronized", async (context) => {
  if (!process.env.OPEN_SLIDEX_CHROMIUM_EXECUTABLE) {
    context.skip("OPEN_SLIDEX_CHROMIUM_EXECUTABLE is not configured");
    return;
  }
  const source = `<!doctype html><html><body>
    <section class="gcard page active" data-page="1">One</section>
    <section class="gcard page" data-page="2">Two</section>
    <section class="gcard page" data-page="3">Three</section>
    <button data-nav="next">Next</button>
    <script>(()=>{const pages=[...document.querySelectorAll('.gcard.page')];let index=0;const show=next=>{index=Math.max(0,Math.min(pages.length-1,next));pages.forEach((page,i)=>page.classList.toggle('active',i===index));history.replaceState(null,'','#'+(index+1))};document.querySelector('[data-nav="next"]').onclick=()=>show(index+1);addEventListener('hashchange',()=>show(Number(location.hash.slice(1))-1||0));show(0)})()</script>
  </body></html>`;

  await withSlideXChromiumPage({ viewport: { height: 1080, width: 1920 } }, async (page) => {
    await page.setContent(injectHtmlPlaybackBridge(source), { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.postMessage({ page: 2, type: "open-slidex:html-page" }, "*"));
    await page.waitForTimeout(50);
    assert.deepEqual(await page.evaluate(() => ({
      active: document.querySelector(".gcard.page.active")?.getAttribute("data-page"),
      hash: location.hash
    })), { active: "2", hash: "#2" });

    await page.click('[data-nav="next"]');
    await page.waitForTimeout(50);
    assert.deepEqual(await page.evaluate(() => ({
      active: document.querySelector(".gcard.page.active")?.getAttribute("data-page"),
      hash: location.hash
    })), { active: "3", hash: "#3" });
  });
});

test("HTML playback keeps Canvas zoom and temporary hand shortcuts without DOM extraction", () => {
  const source = `<!doctype html><html><body><h1>Source only</h1></body></html>`;
  const served = injectHtmlPlaybackBridge(source);

  assert.match(served, /open-slidex:html-canvas-keyboard/);
  assert.match(served, /kind:'temporary-hand'/);
  assert.match(served, /kind:'tool'/);
  assert.match(served, /kind:'wheel-zoom'/);
  assert.doesNotMatch(served, /open-slidex:html-text-layers/);
  assert.doesNotMatch(served, /open-slidex:html-native-text-mode/);
  assert.doesNotMatch(served, /document\.createTreeWalker/);
  assert.doesNotMatch(source, /open-slidex/);
});

test("HTML playback bridge pauses hidden CSS and SVG animation work", () => {
  const served = injectHtmlPlaybackBridge(`<html><body><svg></svg></body></html>`);
  assert.match(served, /data-open-slidex-motion-governor/);
  assert.match(served, /animation-play-state:paused/);
  assert.match(served, /svg\.pauseAnimations/);
  assert.match(served, /syncMotionActivity/);
});
