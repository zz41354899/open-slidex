import assert from "node:assert/strict";
import test from "node:test";

import {
  officialTemplatePackages,
  parseMotionDoc,
  validateOpenSlideXLocalMedia,
  validateTemplatePackageV1
} from "./index";

const expectedTemplateSlides = new Map([
  ["summer-time-report", 7],
  ["moodboard", 14],
  ["planetary-morph", 4],
  ["church-presentation", 13]
]);

test("official local templates include the prior MDX catalog without Notion or Obsidian", () => {
  assert.deepEqual(
    officialTemplatePackages.map((template) => template.id),
    [...expectedTemplateSlides.keys()]
  );
  assert.doesNotMatch(JSON.stringify(officialTemplatePackages), /notion|obsidian|supabase/i);
});

test("every official local template is complete, valid, and filesystem-safe", () => {
  for (const template of officialTemplatePackages) {
    const expectedSlides = expectedTemplateSlides.get(template.id);
    assert.ok(expectedSlides, `Unexpected template: ${template.id}`);
    assert.equal(template.catalog.slideCount, expectedSlides);
    assert.ok(template.assets.every((asset) => asset.path.startsWith("assets/")));

    const packageValidation = validateTemplatePackageV1(template);
    assert.equal(packageValidation.valid, true, `${template.id}: ${JSON.stringify(packageValidation.issues)}`);

    for (const locale of ["en", "zh-TW"] as const) {
      const source = template.sources[locale];
      assert.equal(parseMotionDoc(source).scenes.length, expectedSlides, `${template.id} ${locale}`);
      assert.deepEqual(validateOpenSlideXLocalMedia(source).issues, [], `${template.id} ${locale}`);
      assert.equal(parseMotionDoc(template.starterSources[locale]).scenes.length, 1, `${template.id} ${locale} starter`);
    }
  }
});
