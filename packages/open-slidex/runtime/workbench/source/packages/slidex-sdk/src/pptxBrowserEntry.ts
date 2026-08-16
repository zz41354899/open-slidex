import PptxGenJS from "pptxgenjs";

import { buildMotionDocRasterHtml, slugifyFilename } from "@/core/motion-doc/infrastructure/export/motionDocExport";
import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import { addEditableSlides, pptxRasterRequirements } from "@/features/pitch/infrastructure/editablePptxExport";
import { renderPptxRasterAssets } from "@/features/pitch/infrastructure/pptxRasterExport";
import { addOpenSlideXChartToPptx } from "./localPptxChartAdapter";

type BrowserPptxExportInput = {
  source: string;
  title: string;
};

declare global {
  interface Window {
    __slidexExportPptx: (input: BrowserPptxExportInput) => Promise<{
      rasterizedSlideIndices: number[];
    }>;
  }
}

window.__slidexExportPptx = async ({ source, title }) => {
  const document = parseMotionDoc(source);
  const localNativeTypes = ["Chart"] as const;
  const rasterRequirements = pptxRasterRequirements(document, localNativeTypes);
  const rasterAssets = rasterRequirements.slideIndices.length > 0
    ? await renderPptxRasterAssets(
        buildMotionDocRasterHtml(source, title, rasterRequirements.slideIndices),
        rasterRequirements
      )
    : { filteredImagesBySlide: [], slideBackgrounds: [] };
  const pptx = new PptxGenJS();

  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "OpenSlideX";
  pptx.company = "OpenSlideX";
  pptx.subject = "Presentation exported from OpenSlideX Workbench";
  pptx.title = title;

  await addEditableSlides(
    pptx,
    document,
    rasterAssets.slideBackgrounds,
    rasterAssets.filteredImagesBySlide,
    {
      additionalNativeBlockTypes: localNativeTypes,
      renderBlock: addOpenSlideXChartToPptx
    }
  );

  await pptx.writeFile({
    // Shader and filtered-image fallbacks are already PNG-compressed. ZIP
    // recompression adds substantial CPU time for multi-slide decks while
    // yielding almost no size reduction, so keep the download responsive.
    compression: false,
    fileName: `${slugifyFilename(title || "open-slidex-deck")}.pptx`
  });

  return {
    rasterizedSlideIndices: [...rasterRequirements.slideIndices]
  };
};
