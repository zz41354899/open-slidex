import assert from "node:assert/strict";
import test from "node:test";

import { resolvePreviewMediaSource } from "../../../../features/pitch/ui/preview/PreviewMediaPolicy";

test("inspector previews resolve local assets through the active Workspace deck route", () => {
  const assetUrl = (source: string) => `/api/v1/workspace/presentations/imported/editor/${source}`;

  assert.equal(
    resolvePreviewMediaSource("assets/imported-photo.webp", assetUrl, true),
    "/api/v1/workspace/presentations/imported/editor/assets/imported-photo.webp"
  );
  assert.equal(
    resolvePreviewMediaSource("https://images.example.com/photo.webp", assetUrl, true),
    "https://images.example.com/photo.webp"
  );
});
