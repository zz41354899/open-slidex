import assert from "node:assert/strict";
import test from "node:test";
import { insertBlankSlideSource } from "../../../../features/pitch/application/motionDocCommands";
import { solidFillUpdates } from "../../../../features/pitch/application/themeColors";
import { colorPresetName } from "../../../../features/pitch/ui/inspector/color/palettes";
import { resolveSlideThemeColors, slideCanvasBackground } from "../../../../core/motion-doc/application/slideTheme";
import { parseMotionDoc } from "../../../../core/motion-doc/domain/motionDocParser";
import { buildMotionDocHtml } from "../../../../core/motion-doc/infrastructure/export/motionDocExport";
import { addEditableSlides } from "../../../../features/pitch/infrastructure/editablePptxExport";

for (const color of ["#FFFFFF", "#F8FAFC", "#000000"] as const) {
  test(`${color} remains exact from the color panel through MotionDoc, canvas CSS, HTML, and PPTX`, async () => {
    const updates = solidFillUpdates(color);
    const source = `<Slide theme="${updates.theme}" background="${updates.background}" accent="${updates.accent}" textColor="${updates.textColor}">\n</Slide>`;
    const document = parseMotionDoc(source);
    const scene = document.scenes[0];
    const themeColors = resolveSlideThemeColors(scene.props);

    assert.equal(String(scene.props.background).toUpperCase(), color);
    assert.equal(slideCanvasBackground(themeColors).toUpperCase(), color);

    const html = buildMotionDocHtml(source);
    assert.match(html, new RegExp(`--slide-bg:${color.toLowerCase()}`, "i"));

    type MockSlide = { background?: { color?: string; data?: string }; addNotes(): void };
    const slides: MockSlide[] = [];
    const pptx = {
      addSlide() {
        const slide: MockSlide = { addNotes() {} };
        slides.push(slide);
        return slide;
      }
    };

    await addEditableSlides(pptx as never, document, []);
    assert.equal(slides[0]?.background?.color, color.slice(1));
  });
}

test("dynamic backgrounds preserve the base color across canvas CSS, HTML, and PPTX", async () => {
  const source = '<Slide theme="light" background="#FFFFFF" shader="Dithering" shaderColor1="#FFFFFF" shaderColor2="#000000">\n</Slide>';
  const document = parseMotionDoc(source);
  const scene = document.scenes[0];
  const themeColors = resolveSlideThemeColors(scene.props);

  assert.equal(slideCanvasBackground(themeColors), "#FFFFFF");

  const html = buildMotionDocHtml(source);
  assert.match(html, /--slide-bg:#FFFFFF/i);
  assert.match(html, /data-shader="Dithering"/);
  assert.match(html, /--slide-overlay-opacity:0\.3/);

  type MockSlide = { background?: { color?: string; data?: string }; addNotes(): void };
  const slides: MockSlide[] = [];
  const pptx = {
    addSlide() {
      const slide: MockSlide = { addNotes() {} };
      slides.push(slide);
      return slide;
    }
  };
  const renderedBackground = "data:image/png;base64,dynamic-background";

  await addEditableSlides(pptx as never, document, [renderedBackground]);
  assert.equal(slides[0]?.background?.data, renderedBackground);
});

test("pure white and soft white remain explicitly named in the palette", () => {
  assert.equal(colorPresetName("#FFFFFF"), "Pure white");
  assert.equal(colorPresetName("#F8FAFC"), "Soft white");
});

test("a light slide without an explicit background resolves to canonical pure white", () => {
  const themeColors = resolveSlideThemeColors({ theme: "light" });

  assert.equal(slideCanvasBackground(themeColors), "#FFFFFF");
});

test("new blank slides always use pure white instead of inheriting soft white", () => {
  const source = '<Slide theme="light" background="#F8FAFC">\n</Slide>';
  const nextSource = insertBlankSlideSource(source, 0, "after");
  const document = parseMotionDoc(nextSource);

  assert.equal(document.scenes[0]?.props.background, "#F8FAFC");
  assert.equal(document.scenes[1]?.props.background, "#FFFFFF");
  assert.equal(document.scenes[1]?.props.theme, "light");
});
