import assert from "node:assert/strict";
import test from "node:test";

import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";

import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import { addOpenSlideXChartToPptx } from "./localPptxChartAdapter";

test("OpenSlideX adds Chart as an editable native PowerPoint object", async () => {
  const document = parseMotionDoc(`<Slide>
    <Chart type="donut" data='[{"label":"Product","value":72},{"label":"Services","value":28}]' showLabels="true" x={12} y={18} w={76} h={64} />
  </Slide>`);
  const block = document.scenes[0]?.blocks[0];
  assert.ok(block);

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  const slide = pptx.addSlide();
  assert.equal(addOpenSlideXChartToPptx({ block, foreground: "#111827", muted: "#64748b", pptx, slide }), true);

  const output = await pptx.write({ outputType: "nodebuffer" });
  const archive = await JSZip.loadAsync(output as Buffer);
  const chartPath = Object.keys(archive.files).find((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name));
  assert.ok(chartPath, "Expected a native chart part in the OpenSlideX PowerPoint.");
  assert.match(await archive.file(chartPath)!.async("string"), /<c:doughnutChart>/);
});
