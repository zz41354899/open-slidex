import assert from "node:assert/strict";
import test from "node:test";

import {
  effectiveCanvasShaderSpeed,
  CANVAS_SAFE_AREA_INSET_PERCENT,
  canvasSafeAreaPixels,
  MAIN_CANVAS_INACTIVE_SHADER_MAX_PIXEL_COUNT,
  MAIN_CANVAS_PRELOAD_MARGIN,
  mainCanvasShaderMaxPixelCount,
  THUMBNAIL_SHADER_MAX_PIXEL_COUNT,
  THUMBNAIL_SHADER_MIN_PIXEL_RATIO
} from "../../../../features/pitch/application/canvasPerformance";
import { EMPTY_BLOCK_FRAME_OVERRIDES } from "../../../../features/pitch/application/pitchGeometry";
import {
  canvasPointFromRect,
  interactionFrameUpdates,
  visiblePreviewFrameOverrides
} from "../../../../features/pitch/application/previewCanvas";
import {
  motionDocSceneSourceSignatures,
  stabilizeMotionDocScenes
} from "../../../../features/pitch/application/motionDocSceneStability";
import type { MotionDocScene } from "../../../../core/motion-doc/domain/motionDocTypes";

test("only the active canvas advances a dynamic shader", () => {
  assert.equal(effectiveCanvasShaderSpeed(0.8, true), 0.8);
  assert.equal(effectiveCanvasShaderSpeed(0.8, false), 0);
  assert.equal(effectiveCanvasShaderSpeed(0, true), 0);
});

test("deferred canvases preload nearby slides and thumbnails use a bounded shader surface", () => {
  assert.equal(MAIN_CANVAS_PRELOAD_MARGIN, "640px 0px");
  assert.equal(THUMBNAIL_SHADER_MAX_PIXEL_COUNT, 129_600);
  assert.equal(THUMBNAIL_SHADER_MIN_PIXEL_RATIO, 0.25);
});

test("main canvas shader quality follows quantized visible-size tiers", () => {
  assert.equal(mainCanvasShaderMaxPixelCount(0.2, 2), 640 * 360);
  assert.equal(mainCanvasShaderMaxPixelCount(0.31, 2), 960 * 540);
  assert.equal(mainCanvasShaderMaxPixelCount(1, 2), 1280 * 720);
  assert.equal(MAIN_CANVAS_INACTIVE_SHADER_MAX_PIXEL_COUNT, 640 * 360);
});

test("editor safe area is a five-percent 1920 by 1080 inset", () => {
  assert.equal(CANVAS_SAFE_AREA_INSET_PERCENT, 5);
  assert.deepEqual(canvasSafeAreaPixels(), { horizontal: 96, vertical: 54 });
});

test("creation stays inside the slide while direct manipulation can continue onto the pasteboard", () => {
  const rect = { height: 100, left: 100, top: 100, width: 200 };
  const pointer = { clientX: 360, clientY: 70 };

  assert.deepEqual(canvasPointFromRect(pointer, rect), { x: 100, y: 0 });
  assert.deepEqual(
    canvasPointFromRect(pointer, rect, { allowOverflow: true }),
    { x: 130, y: -30 }
  );
});

test("drag movement follows the pointer directly without pickup or quantization", () => {
  assert.deepEqual(
    interactionFrameUpdates(
      {
        blockId: "headline",
        blockIndex: 0,
        mode: "move",
        startFrame: { h: 20, w: 30, x: 10, y: 15 },
        startFrames: [
          {
            blockId: "headline",
            blockIndex: 0,
            frame: { h: 20, w: 30, x: 10, y: 15 }
          }
        ],
        startPointer: { x: 20, y: 20 }
      },
      { x: 20.4, y: 20.7 }
    ),
    [
      {
        blockId: "headline",
        blockIndex: 0,
        frame: { h: 20, w: 30, x: 10.4, y: 15.7 }
      }
    ]
  );
});

test("hidden editable layer movement does not invalidate the scene preview", () => {
  const textBlock = { props: { h: 20, id: "headline", w: 30, x: 10, y: 15 }, text: "Hello", type: "Text" } as const;
  const imageBlock = { props: { h: 30, id: "photo", src: "https://example.com/a.png", w: 40, x: 20, y: 25 }, type: "ImageBlock" } as const;
  const blocks = [textBlock, imageBlock];
  const textOnly = visiblePreviewFrameOverrides(
    blocks,
    [0],
    new Map([["headline", { h: 20, w: 30, x: 12, y: 18 }]])
  );
  const imageOnly = visiblePreviewFrameOverrides(
    blocks,
    [0],
    new Map([["photo", { h: 30, w: 40, x: 22, y: 28 }]])
  );

  assert.equal(textOnly, EMPTY_BLOCK_FRAME_OVERRIDES);
  assert.equal(imageOnly.size, 1);
});

test("unchanged scene objects survive a one-slide source edit", () => {
  const source = `<Slide id="one"><Text id="a">One</Text></Slide>\n<Slide id="two"><Text id="b">Two</Text></Slide>`;
  const changedSource = source.replace(">Two<", ">Changed<");
  const firstScene = { blocks: [], duration: 5, props: { id: "one" } } satisfies MotionDocScene;
  const secondScene = { blocks: [], duration: 5, props: { id: "two" } } satisfies MotionDocScene;
  const changedFirstScene = { ...firstScene };
  const changedSecondScene = { ...secondScene };
  const previous = {
    scenes: [firstScene, secondScene],
    signatures: motionDocSceneSourceSignatures(source)
  };

  const stable = stabilizeMotionDocScenes(
    [changedFirstScene, changedSecondScene],
    motionDocSceneSourceSignatures(changedSource),
    previous
  );

  assert.equal(stable.scenes[0], firstScene);
  assert.equal(stable.scenes[1], changedSecondScene);
});
