import assert from "node:assert/strict";
import test from "node:test";

import { isOpenSlideXCompatibleMediaSource, validateOpenSlideXLocalMedia } from "./index";

test("OpenSlideX local media allows local WebP, MP4, SVG, and imported HTML assets", () => {
  assert.equal(isOpenSlideXCompatibleMediaSource("assets/hero.webp"), true);
  assert.equal(isOpenSlideXCompatibleMediaSource("assets/launch.mp4"), true);
  assert.equal(isOpenSlideXCompatibleMediaSource("assets/tree.svg"), true);
  assert.equal(isOpenSlideXCompatibleMediaSource("assets/source.html"), true);
  assert.equal(isOpenSlideXCompatibleMediaSource("https://images.unsplash.com/photo-123?auto=format"), true);

  for (const unsafeSource of [
    "http://images.unsplash.com/photo-123",
    "data:image/png;base64,AAAA",
    "blob:https://images.unsplash.com/photo-123",
    "assets/../hero.webp"
  ]) {
    assert.equal(isOpenSlideXCompatibleMediaSource(unsafeSource), false, unsafeSource);
  }

  const source = `<Slide>
  <ImageBlock src="https://images.unsplash.com/photo-123" alt="Remote" />
  <VideoBlock src="assets/launch.mp4" />
  <VideoBlock src="https://cdn.example.com/launch.mp4" poster="https://images.unsplash.com/poster-123" />
  <SvgBlock src="assets/tree.svg" sharedScene="tree" stage={2} />
  <HtmlEmbedBlock src="assets/source.html" />
</Slide>`;
  assert.deepEqual(validateOpenSlideXLocalMedia(source).issues, []);

  const remoteExecutable = `<Slide><SvgBlock src="https://example.com/tree.svg" /><HtmlEmbedBlock src="https://example.com/deck.html" /></Slide>`;
  assert.equal(validateOpenSlideXLocalMedia(remoteExecutable).issues.length, 2);
});
