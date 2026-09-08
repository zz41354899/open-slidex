import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  SlideXMotionDocRoot,
  Text,
  definePresentation,
  defineSlideXComponent
} from "./react/index";

test("React entrypoint defines presentations without importing the renderer into headless SDK", () => {
  const component = () => createElement(Text, { id: "title", x: 8, y: 8, w: 84, h: 12 }, "Hello");
  const definition = definePresentation({ component, title: "React deck" });
  assert.equal(definition.title, "React deck");
  assert.equal(definition.component, component);
});

test("registered components validate literal props and require toMotionDoc for portable expansion", () => {
  const Hero = defineSlideXComponent({
    component: ({ title }: { title: string }) => createElement(Text, { id: "hero-title" }, title),
    name: "Hero",
    props: { title: { required: true, type: "string" } }
  });
  const invalid = renderToStaticMarkup(createElement(Hero, { title: 4 as unknown as string }));
  assert.match(invalid, /props failed validation/);
  const portable = renderToStaticMarkup(createElement(
    SlideXMotionDocRoot,
    null,
    createElement(Hero, { title: "Hello" })
  ));
  assert.match(portable, /must define toMotionDoc/);
});
