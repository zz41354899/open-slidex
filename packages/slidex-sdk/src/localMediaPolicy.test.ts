import assert from "node:assert/strict";
import test from "node:test";

import { isOpenSlideXCompatibleMediaSource, validateOpenSlideXLocalMedia } from "./index";

test("OpenSlideX local media allows local WebP and MP4 assets plus complete HTTPS links", () => {
  assert.equal(isOpenSlideXCompatibleMediaSource("assets/hero.webp"), true);
  assert.equal(isOpenSlideXCompatibleMediaSource("assets/launch.mp4"), true);
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
</Slide>`;
  assert.deepEqual(validateOpenSlideXLocalMedia(source).issues, []);
});
