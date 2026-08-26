import assert from "node:assert/strict";
import test from "node:test";

import type { MotionDocScene, ParsedMotionDoc } from "@/core/motion-doc/domain/motionDocTypes";
import {
  htmlSourceWorkspace,
  sceneContainsHtmlRuntime,
  sharedHtmlDeckRuntime
} from "@/features/pitch/application/htmlRuntimePolicy";

function htmlScene(page: number, source = "assets/deck.html", sharedScene = "deck") {
  return {
    blocks: [{
      props: { h: 100, page, sharedScene, src: source, w: 100, x: 0, y: 0 },
      type: "HtmlEmbedBlock"
    }],
    duration: 5,
    props: {}
  } as MotionDocScene;
}

test("pure shared HTML decks use one reusable Canvas runtime", () => {
  assert.deepEqual(sharedHtmlDeckRuntime([htmlScene(1), htmlScene(2), htmlScene(3)]), {
    sharedScene: "deck",
    source: "assets/deck.html"
  });
});

test("source-linked native Text overlays keep the one-iframe runtime", () => {
  const first = htmlScene(1);
  first.blocks.push({
    props: {
      h: 8,
      htmlSourceSelector: "html:nth-of-type(1) > body:nth-of-type(1) > h1:nth-of-type(1)",
      htmlSourceTextNode: 0,
      id: "html-text-1",
      w: 40,
      x: 8,
      y: 10
    },
    text: "Editable",
    type: "Text"
  });
  assert.deepEqual(sharedHtmlDeckRuntime([first, htmlScene(2)]), {
    sharedScene: "deck",
    source: "assets/deck.html"
  });
});

test("mixed or mismatched HTML decks keep per-slide rendering", () => {
  const nativeScene = { blocks: [{ props: {}, text: "Native", type: "Text" }], duration: 5, props: {} } as MotionDocScene;
  assert.equal(sharedHtmlDeckRuntime([htmlScene(1), nativeScene]), null);
  assert.equal(sharedHtmlDeckRuntime([htmlScene(1), htmlScene(2, "assets/other.html")]), null);
  assert.equal(sharedHtmlDeckRuntime([htmlScene(1), htmlScene(2, "assets/deck.html", "other")]), null);
  assert.equal(sceneContainsHtmlRuntime(htmlScene(1)), true);
  assert.equal(sceneContainsHtmlRuntime(nativeScene), false);
});

test("an imported HTML deck opens the dedicated source workspace", () => {
  const document = {
    scenes: [htmlScene(1), htmlScene(2), htmlScene(3)],
    title: "HTML deck"
  } as ParsedMotionDoc;

  assert.deepEqual(htmlSourceWorkspace(document), {
    pageCount: 3,
    source: "assets/deck.html"
  });
});

test("legacy generated Text overlays do not turn HTML source mode back into Canvas editing", () => {
  const first = htmlScene(1);
  first.blocks.push({
    props: {
      htmlSourceSelector: "html:nth-of-type(1) > body:nth-of-type(1) > h1:nth-of-type(1)",
      htmlSourceTextNode: 0,
      id: "legacy-html-text"
    },
    text: "Legacy",
    type: "Text"
  });
  const document = { scenes: [first, htmlScene(2)], title: "HTML deck" } as ParsedMotionDoc;

  assert.deepEqual(htmlSourceWorkspace(document), {
    pageCount: 2,
    source: "assets/deck.html"
  });
});

test("ordinary and mixed MotionDoc decks retain the native Canvas workspace", () => {
  const nativeScene = {
    blocks: [{ props: { id: "title" }, text: "Native", type: "Text" }],
    duration: 5,
    props: {}
  } as MotionDocScene;
  const nativeDocument = { scenes: [nativeScene], title: "Native deck" } as ParsedMotionDoc;
  const mixedDocument = { scenes: [htmlScene(1), nativeScene], title: "Mixed deck" } as ParsedMotionDoc;

  assert.equal(htmlSourceWorkspace(nativeDocument), null);
  assert.equal(htmlSourceWorkspace(mixedDocument), null);
});
