import { hidePptxEditableContent } from "@/features/pitch/infrastructure/pptxVisualFallback";
import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";
import {
  preparePitchExportWindow,
  waitForPitchExportIframe,
  type MotionDocExportWindow
} from "@/features/pitch/infrastructure/pitchExportRuntime";

type PptxRasterExportOptions = {
  captureFilteredImagesBySlide: readonly boolean[];
  captureSlideBackgroundsBySlide: readonly boolean[];
  slideCount: number;
  slideIndices: readonly number[];
};

export type PptxRasterAssets = {
  filteredImagesBySlide: string[][];
  slideBackgrounds: string[];
};

const DESIGN_HEIGHT = MOTION_DOC_CANVAS_HEIGHT;
const DESIGN_WIDTH = MOTION_DOC_CANVAS_WIDTH;
const EXPORT_SCALE = 1920 / DESIGN_WIDTH;
const PPTX_BACKGROUND_JPEG_QUALITY = 0.82;

export async function renderPptxRasterAssets(
  rasterHtml: string,
  options: PptxRasterExportOptions
): Promise<PptxRasterAssets> {
  const html2canvasPromise = import("html2canvas-pro").then((module) => module.default);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${DESIGN_WIDTH}px;height:${DESIGN_HEIGHT}px;pointer-events:none;opacity:0;`;
  document.body.appendChild(iframe);
  const iframeLoad = waitForPitchExportIframe(iframe);
  iframe.srcdoc = rasterHtml;

  try {
    await iframeLoad;
    const frameWindow = iframe.contentWindow as MotionDocExportWindow | null;
    if (!frameWindow?.document) throw new Error("Export renderer failed to load");

    await preparePitchExportWindow(frameWindow);
    const slides = Array.from(frameWindow.document.querySelectorAll<HTMLElement>(".slide"));
    if (slides.length === 0) throw new Error("No slides to export");

    const html2canvas = await html2canvasPromise;
    const filteredImagesBySlide = Array.from({ length: options.slideCount }, () => [] as string[]);
    const slideBackgrounds = Array.from({ length: options.slideCount }, () => "");

    for (let renderedSlideIndex = 0; renderedSlideIndex < slides.length; renderedSlideIndex += 1) {
      const slide = slides[renderedSlideIndex];
      const sourceSlideIndex = options.slideIndices[renderedSlideIndex];
      if (sourceSlideIndex === undefined) throw new Error("PowerPoint raster slide mapping failed");
      slide.classList.add("is-active");

      if (options.captureFilteredImagesBySlide[sourceSlideIndex]) {
        filteredImagesBySlide[sourceSlideIndex] = await captureMotionBlocks(
          slide,
          ".block-image[data-exact-image-raster]",
          html2canvas
        );
      }

      if (options.captureSlideBackgroundsBySlide[sourceSlideIndex]) {
        hidePptxEditableContent(slide);
        const canvas = await html2canvas(slide, {
          allowTaint: false,
          backgroundColor: null,
          height: DESIGN_HEIGHT,
          logging: false,
          scale: EXPORT_SCALE,
          useCORS: true,
          width: DESIGN_WIDTH,
          windowHeight: DESIGN_HEIGHT,
          windowWidth: DESIGN_WIDTH
        });
        try {
          slideBackgrounds[sourceSlideIndex] = await canvasToDataUrl(
            canvas,
            "image/jpeg",
            PPTX_BACKGROUND_JPEG_QUALITY
          );
        } finally {
          releaseCanvas(canvas);
        }
      }

      slide.classList.remove("is-active");
    }

    return { filteredImagesBySlide, slideBackgrounds };
  } finally {
    iframe.remove();
  }
}

type Html2Canvas = typeof import("html2canvas-pro")["default"];

async function captureMotionBlocks(
  slide: HTMLElement,
  contentSelector: string,
  html2canvas: Html2Canvas
) {
  const blocks = Array.from(slide.querySelectorAll<HTMLElement>(".motion-block"))
    .filter((block) => block.querySelector(contentSelector));
  const images: string[] = [];

  for (const block of blocks) {
    const rect = block.getBoundingClientRect();
    const canvas = await html2canvas(block, {
      allowTaint: false,
      backgroundColor: null,
      height: Math.max(1, Math.ceil(rect.height)),
      logging: false,
      scale: EXPORT_SCALE,
      useCORS: true,
      width: Math.max(1, Math.ceil(rect.width)),
      windowHeight: DESIGN_HEIGHT,
      windowWidth: DESIGN_WIDTH
    });
    images.push(canvas.toDataURL("image/png"));
    releaseCanvas(canvas);
  }

  return images;
}

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 1;
  canvas.height = 1;
}

function canvasToDataUrl(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("PowerPoint background compression failed"));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    }, type, quality);
  });
}
