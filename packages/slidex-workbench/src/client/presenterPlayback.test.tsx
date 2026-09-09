import assert from "node:assert/strict";
import test from "node:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Window } from "happy-dom";

import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import { PresenterSlideStage } from "@/features/pitch/ui/PresenterSlideStage";

test("presenter playback runs Motion, Morph and native interactions through the shared stage", async () => {
  const window = new Window({ url: "http://slidex.test" });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "CSS", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle", "IS_REACT_ACT_ENVIRONMENT"]) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  }
  const animationCalls: Element[] = [];
  class ResizeObserver {
    observe() {}
    disconnect() {}
  }
  const globals: Record<string, unknown> = {
    window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, Element: window.Element, Node: window.Node, CSS: window.CSS,
    ResizeObserver, requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window), getComputedStyle: window.getComputedStyle.bind(window),
    IS_REACT_ACT_ENVIRONMENT: true
  };
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  Object.defineProperty(window.Element.prototype, "animate", {
    configurable: true,
    value(this: Element) {
      animationCalls.push(this);
      return { cancel() {}, finished: Promise.resolve() };
    }
  });
  Object.defineProperty(window.Element.prototype, "getAnimations", {
    configurable: true,
    value: () => []
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: false })
  });

  const source = `<Deck>
    <Slide slideTransition="morph" transitionDuration={1}>
      <Shape id="source" sharedId="planet" shape="circle" x={10} y={10} w={20} h={20}
        motion="{&quot;actions&quot;:[{&quot;duration&quot;:1,&quot;easing&quot;:&quot;linear&quot;,&quot;id&quot;:&quot;enter&quot;,&quot;order&quot;:0,&quot;preset&quot;:&quot;pop&quot;,&quot;start&quot;:&quot;afterPrevious&quot;,&quot;type&quot;:&quot;enter&quot;}],&quot;version&quot;:1}"
        interaction="{&quot;action&quot;:{&quot;slide&quot;:2,&quot;type&quot;:&quot;goToSlide&quot;},&quot;trigger&quot;:&quot;click&quot;,&quot;version&quot;:1}" />
    </Slide>
    <Slide slideTransition="morph" transitionDuration={1}>
      <Shape id="target" sharedId="planet" shape="circle" x={60} y={30} w={30} h={30} />
    </Slide>
  </Deck>`;
  const scenes = parseMotionDoc(source).scenes;
  const requests: number[] = [];
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root = createRoot(container as unknown as HTMLElement);

  try {
    await act(async () => root.render(<PresenterSlideStage index={0} onRequestSlide={(index) => requests.push(index)} scenes={scenes} />));
    assert.ok(container.querySelector("[data-motion-sequence]"), "Motion sequence is mounted in presenter playback");
    (container.querySelector("[data-slidex-interaction]") as unknown as HTMLElement).click();
    assert.deepEqual(requests, [1], "native interaction requests its target slide");

    await act(async () => root.render(<PresenterSlideStage index={1} onRequestSlide={(index) => requests.push(index)} scenes={scenes} />));
    assert.equal(container.querySelector("[data-presenter-rendered-slide]")?.getAttribute("data-presenter-rendered-slide"), "1");
    assert.ok(container.querySelector("[data-slidex-morph-overlay]"), "Morph overlay is created for presenter transitions");
    assert.ok(animationCalls.length > 0, "the playback engine starts Web Animations");
  } finally {
    await act(async () => root.unmount());
    for (const [key, descriptor] of previous) {
      if (descriptor === undefined) Reflect.deleteProperty(globalThis, key);
      else Object.defineProperty(globalThis, key, descriptor);
    }
    await window.happyDOM.abort();
  }
});
