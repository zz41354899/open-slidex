import assert from "node:assert/strict";
import test from "node:test";

import {
  insertTableRow,
  tableCellStyleOverride,
  updateCellOverride
} from "../../../../core/motion-doc/application/tableBlock";
import { buildMotionDocHtml } from "../../../../core/motion-doc/infrastructure/export/motionDocExport";
import { parseMotionDoc } from "../../../../core/motion-doc/domain/motionDocParser";
import { addEditableSlides } from "../../../../features/pitch/infrastructure/editablePptxExport";

test("a cell override wins over column and row styling and follows row insertion", () => {
  const base = {
    cellOverrides: "",
    colOverrides: JSON.stringify({ 1: { background: "#334455", textColor: "#111111" } }),
    columns: 2,
    rowOverrides: JSON.stringify({ 0: { background: "#556677", textColor: "#222222" } }),
    rows: 2
  };
  const styled = updateCellOverride(base, 0, 1, {
    background: "#112233",
    borderColor: "#445566",
    textColor: "#ffffff"
  });

  assert.deepEqual(tableCellStyleOverride(styled, 0, 1), {
    background: "#112233",
    borderColor: "#445566",
    textColor: "#ffffff"
  });
  assert.deepEqual(tableCellStyleOverride(insertTableRow(styled, -1), 1, 1), {
    background: "#112233",
    borderColor: "#445566",
    textColor: "#ffffff"
  });
});

test("cell background, text, and border colors survive HTML and editable PPTX export", async () => {
  const source = `<Slide><Table rows={2} columns={2} cells="One|Two;Three|Four" cellOverrides='{"0:1":{"background":"#112233","borderColor":"#445566","textColor":"#ffffff"}}' /></Slide>`;
  const html = buildMotionDocHtml(source);
  assert.match(html, /background:#112233/);
  assert.match(html, /border-bottom-color:#445566/);
  assert.match(html, /color:#ffffff/);

  let tableRows: Array<Array<{ options?: Record<string, unknown>; text?: string }>> = [];
  const pptx = {
    addSlide() {
      return {
        addNotes() {},
        addTable(rows: typeof tableRows) { tableRows = rows; },
        background: {}
      };
    }
  };
  await addEditableSlides(pptx as never, parseMotionDoc(source), []);

  const options = tableRows[0]?.[1]?.options;
  assert.equal((options?.fill as { color?: string } | undefined)?.color, "112233");
  assert.equal(options?.color, "FFFFFF");
  assert.equal((options?.border as { color?: string } | undefined)?.color, "445566");
});

test("table shadows are opt-in and retain an editable PowerPoint table", async () => {
  const source = '<Slide><Table rows={1} columns={1} cells="One" shadowOpacity={0.28} shadowBlur={12} shadowOffsetY={6} /></Slide>';
  assert.match(buildMotionDocHtml(source), /drop-shadow\(0px 6px 12px rgba\(0, 0, 0, 0.28\)\)/);

  let shapeCount = 0;
  let tableCount = 0;
  const pptx = {
    addSlide() {
      return {
        addNotes() {},
        addShape() { shapeCount += 1; },
        addTable() { tableCount += 1; },
        background: {}
      };
    }
  };
  await addEditableSlides(pptx as never, parseMotionDoc(source), []);

  assert.equal(shapeCount, 1);
  assert.equal(tableCount, 1);
});
