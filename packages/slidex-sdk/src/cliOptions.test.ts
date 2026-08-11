import assert from "node:assert/strict";
import test from "node:test";

import {
  createSlideXCliHelp,
  parseSlideXCliArguments
} from "./cliOptions";

test("SDK CLI parses validate, montage, slide, and export commands", () => {
  assert.deepEqual(parseSlideXCliArguments(["validate"]), {
    action: "validate",
    file: "presentation.mdx"
  });
  assert.deepEqual(
    parseSlideXCliArguments(["render", "deck.mdx", "--montage", "--out", "deck.png"]),
    {
      action: "render",
      file: "deck.mdx",
      mode: "montage",
      outputPath: "deck.png"
    }
  );
  assert.deepEqual(
    parseSlideXCliArguments([
      "export",
      "--format",
      "mdx",
      "--out",
      "deck.mdx"
    ]),
    {
      action: "export",
      file: "presentation.mdx",
      format: "mdx",
      outputPath: "deck.mdx",
      overwrite: false
    }
  );
  assert.deepEqual(
    parseSlideXCliArguments(["render", "--slide", "2", "--out", "slide.png"]),
    {
      action: "render",
      file: "presentation.mdx",
      mode: "slide",
      outputPath: "slide.png",
      slideIndex: 2
    }
  );
  assert.deepEqual(
    parseSlideXCliArguments([
      "export",
      "--format",
      "pptx",
      "--out",
      "deck.pptx",
      "--overwrite"
    ]),
    {
      action: "export",
      file: "presentation.mdx",
      format: "pptx",
      outputPath: "deck.pptx",
      overwrite: true
    }
  );
});

test("SDK CLI rejects ambiguous or incomplete output commands", () => {
  assert.throws(
    () => parseSlideXCliArguments(["render", "--out", "deck.png"]),
    /requires --montage or --slide/
  );
  assert.throws(
    () =>
      parseSlideXCliArguments([
        "render",
        "--montage",
        "--slide",
        "0",
        "--out",
        "deck.png"
      ]),
    /Choose either/
  );
  assert.throws(
    () =>
      parseSlideXCliArguments(["export", "--format", "pdf", "--out", "deck.pdf"]),
    /html, mdx, or pptx/
  );
  assert.match(createSlideXCliHelp(), /open-slidex validate \[presentation\.mdx\]/);
});
