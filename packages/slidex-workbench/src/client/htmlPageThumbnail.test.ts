import assert from "node:assert/strict";
import test from "node:test";

import { htmlPageThumbnailSource } from "@/features/pitch/ui/preview/HtmlPageThumbnail";

test("HTML thumbnails reuse the selected Workspace editor route", () => {
  assert.equal(
    htmlPageThumbnailSource(
      "/api/v1/workspace/presentations/idaeo/editor/assets/source.html",
      "assets/source.html",
      11,
      "http://127.0.0.1:4172/workspace/idaeo"
    ),
    "http://127.0.0.1:4172/api/v1/workspace/presentations/idaeo/editor/api/v1/assets/html-thumbnail?page=11&renderVersion=3&source=assets%2Fsource.html"
  );
});
