import assert from "node:assert/strict";
import test from "node:test";

import {
  htmlPageSourceLocations,
  htmlPageSourceSelection,
  replaceHtmlSourceRange
} from "../../../../core/motion-doc/domain/htmlPageSource";

test("HTML page source locations follow explicit and IDAEO page declarations", () => {
  const source = `<!doctype html>\n<html><body>\n<section class="gcard page" id="g1">One</section>\n<main data-slidex-page="4" data-stage="2">Four</main>\n<section class="page gcard" id="g5">Five</section>\n</body></html>`;

  assert.deepEqual(htmlPageSourceLocations(source).map(({ id, line, page, stage }) => ({ id, line, page, stage })), [
    { id: "g1", line: 3, page: 1, stage: undefined },
    { id: undefined, line: 4, page: 4, stage: 2 },
    { id: "g5", line: 5, page: 3, stage: undefined }
  ]);
});

test("HTML page source locations recognize every OpenSlideX HTML export slide", () => {
  const source = `<!doctype html><html><body>
    <section class="slide is-active" data-slidex-slide-index="0">One</section>
    <section class="slide slide-transition-none" data-slidex-slide-index="1">Two</section>
    <section class="slide" data-slidex-slide-index="2">Three</section>
  </body></html>`;

  assert.deepEqual(htmlPageSourceLocations(source).map(({ page }) => page), [1, 2, 3]);
  assert.equal(htmlPageSourceSelection(source, 2)?.source, `<section class="slide slide-transition-none" data-slidex-slide-index="1">Two</section>`);
});

test("HTML page source locations use plain slide classes as a generic deck fallback", () => {
  const source = `<!doctype html><html><body>${Array.from({ length: 52 }, (_, index) =>
    `<section class="slide${index === 0 ? " active" : ""}" id="slide-${index + 1}">${index + 1}</section>`
  ).join("\n")}</body></html>`;

  const pages = htmlPageSourceLocations(source);
  assert.equal(pages.length, 52);
  assert.deepEqual(pages.map(({ page }) => page), Array.from({ length: 52 }, (_, index) => index + 1));
  assert.match(htmlPageSourceSelection(source, 52)?.source ?? "", /id="slide-52"/);
});

test("explicit page declarations take priority over nested generic slide classes", () => {
  const source = `<html><body><main data-slidex-page="1"><div class="slide">Decoration</div></main><main data-slidex-page="2"></main></body></html>`;
  assert.deepEqual(htmlPageSourceLocations(source).map(({ page }) => page), [1, 2]);
});

test("HTML page source locations point at the opening tag for editor focus", () => {
  const source = `<html><body><section class="gcard page" id="g1">One</section></body></html>`;
  const [page] = htmlPageSourceLocations(source);

  assert.equal(source.slice(page?.from, page?.to), `<section class="gcard page" id="g1">`);
  assert.equal(source.slice(page?.from, page?.outerTo), `<section class="gcard page" id="g1">One</section>`);
});

test("HTML page ranges ignore fake page markup in scripts and pair nested tags", () => {
  const source = `<script>const fake = '<section class="gcard page">';</script>\n<section class="gcard page" id="g1"><div><section>Nested</section></div></section>\n<section class="page gcard" id="g2">Two</section>`;
  const pages = htmlPageSourceLocations(source);

  assert.equal(pages.length, 2);
  assert.equal(source.slice(pages[0]?.from, pages[0]?.outerTo), `<section class="gcard page" id="g1"><div><section>Nested</section></div></section>`);
  assert.equal(source.slice(pages[1]?.from, pages[1]?.outerTo), `<section class="page gcard" id="g2">Two</section>`);
});

test("selected-page editing replaces only that page and preserves shared source bytes", () => {
  const source = `<style>.shared{color:red}</style>\n<section class="gcard page" id="g1">One</section>\n<script>window.shared=true</script>\n<section class="gcard page" id="g2">Two</section>`;
  const selected = htmlPageSourceSelection(source, 2);
  assert.ok(selected);

  const replacement = `<section class="gcard page" id="g2"><strong>Edited</strong></section>`;
  const next = replaceHtmlSourceRange(source, selected, replacement);
  assert.equal(next, `<style>.shared{color:red}</style>\n<section class="gcard page" id="g1">One</section>\n<script>window.shared=true</script>\n${replacement}`);
});

test("a one-page HTML document edits as one complete source", () => {
  const source = `<!doctype html><html><body><main>Only page</main></body></html>`;
  const selected = htmlPageSourceSelection(source, 1);
  assert.ok(selected?.fullDocument);
  assert.equal(selected.source, source);
});
