import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import { motionDocBlockId } from "@/core/motion-doc/application/motionDocBlockIdentity";
import type { MotionDocBlock, MotionDocProps, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import {
  isMotionDocEnterAnimation,
  isMotionDocSlideTransition,
  motionDocEnterAnimations,
  motionDocSlideTransitions
} from "@/core/motion-doc/domain/motionVocabulary";
import { textStyleLines, textStyleRangesFromProps } from "@/core/motion-doc/domain/textStyleRanges";
import {
  continuousRoundedRectPath,
  normalizedContinuousCornerRadii,
  normalizedRelativeCornerRadii
} from "@/core/motion-doc/application/continuousRoundedRect";
import { objectShadowCss } from "@/core/motion-doc/application/objectShadow";
import { renderMotionDocChartSvg } from "@/core/motion-doc/application/chartSvg";
import { normalizedImageScales } from "@/core/motion-doc/application/imageCrop";
import { renderShapeVectorSvg, shapePolygonPath } from "@/core/motion-doc/application/shapeVectorSvg";
import { getPaperImageFilterDefinition } from "@/core/motion-doc/application/shaders/paperImageFilterCatalog";
import { resolveSlideThemeColors } from "@/core/motion-doc/application/slideTheme";
import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";
import { blockRotation } from "@/core/motion-doc/domain/blockTransform";
import { motionDocBlockFrame, percentFrameValue } from "@/core/motion-doc/domain/frame";
import { sharedMorphEffectProps } from "@/core/motion-doc/domain/sharedMorph";
import {
  tableCellsFromProps,
  tableCellStyleOverride,
  tableColumnTrackValuesFromProps,
  tableRowTrackValuesFromProps,
  tableSizeFromProps,
  tableTrackTemplate
} from "@/core/motion-doc/application/tableBlock";
import {
  MOTION_DOC_FONT_SIZES,
  motionDocFontPointsToCanvasPixels,
  motionDocLineHeightCanvasValue
} from "@/core/motion-doc/domain/typography";
import { makeMotionDocExportRuntime } from "@/core/motion-doc/infrastructure/export/motionDocExportRuntime";
import { youtubeEmbedUrl, youtubeVideoId } from "@/core/motion-doc/domain/videoSource";
import { motionDocExportStyles } from "@/core/motion-doc/infrastructure/export/motionDocExportStyles";

export const MOTION_DOC_PNG_HEIGHT = MOTION_DOC_CANVAS_HEIGHT;
export const MOTION_DOC_PNG_WIDTH = MOTION_DOC_CANVAS_WIDTH;

type RenderSceneHtmlOptions = {
  active?: boolean;
  rasterMode?: boolean;
  sharedHtmlOverlay?: boolean;
  sharedSvgOverlay?: boolean;
  slideIndex?: number;
};

export type MotionDocPreviewHtmlOptions = {
  assetBaseUrl?: string;
  canvasOnly?: boolean;
  cspNonce?: string;
  editableCanvas?: boolean;
  parentOrigin?: string;
  selectedNodeId?: string;
  title?: string;
};

export function buildMotionDocHtml(source: string, customTitle?: string) {
  const security = exportRuntimeSecurity(source);
  const document = parseMotionDoc(source);
  const displayTitle = customTitle || document.title;
  const slidesHtml = document.scenes
    .map((scene, slideIndex) => renderSceneHtml(
      { ...scene, props: sharedMorphEffectProps(document.scenes, slideIndex) },
      { sharedHtmlOverlay: true, sharedSvgOverlay: true, slideIndex }
    ))
    .join("\n");
  const sharedHtml = renderSharedHtmlScenes(document.scenes);
  const sharedSvgHtml = renderSharedSvgScenes(document.scenes);
  const slideDots = document.scenes.map((scene, slideIndex) => `<button aria-label="${escapeAttribute(`Go to slide ${slideIndex + 1}: ${sceneLabel(scene)}`)}" class="slide-dot-button" data-slide-target="${slideIndex}" type="button"><span class="slide-dot-label">${escapeHtml(sceneLabel(scene))}</span><span class="slide-dot-mark"></span></button>`).join("");
  const fontStylesheetLinks = motionDocFontStylesheetLinks(document);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${security.policy}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(displayTitle)}</title>
    ${fontStylesheetLinks}
    <style>${motionDocExportStyles}</style>
  </head>
  <body>
    <main class="player" data-slide-count="${document.scenes.length}">
      <div class="stage">
        <div class="viewport" aria-live="polite">
          <div class="frame">
            ${slidesHtml}
            ${sharedHtml}
            ${sharedSvgHtml}
          </div>
        </div>
      </div>
      <nav class="slide-dots" aria-label="Slide navigator">${slideDots}</nav>
      <nav class="controls" aria-label="Slide controls">
        <div class="button-group">
          <button class="control-button" data-action="prev" type="button" aria-label="Previous slide" title="Previous"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button>
          <button class="control-button" data-action="next" type="button" aria-label="Next slide" title="Next"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>
          <button class="control-button" data-action="replay" type="button" aria-label="Replay slide" title="Replay"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>
          <button class="control-button" data-action="play" type="button" aria-label="Play slides" title="Play"><svg viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"/></svg></button>
        </div>
        <div class="counter" aria-hidden="true"><span data-current>1</span> / <span data-total>${document.scenes.length}</span></div>
        <div class="progress" aria-hidden="true"><span></span></div>
        <div class="button-group">
          <button class="control-button" data-action="theme" type="button" aria-label="Toggle player theme" title="Theme"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg></button>
          <button class="control-button" data-action="fullscreen" type="button" aria-label="Toggle fullscreen" title="Fullscreen"><svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg></button>
        </div>
      </nav>
    </main>
    <script nonce="${security.nonce}">${makeMotionDocExportRuntime()}</script>
  </body>
</html>`;
}

function sceneLabel(scene: MotionDocScene) {
  const title = scene.blocks.find((block) => (
    block.type === "heading" || (block.type === "Text" && block.props.role === "title")
  ));
  const text = title && "text" in title ? title.text.replace(/\s+/g, " ").trim() : "";
  return text ? text.slice(0, 52) : "Slide";
}

export function buildMotionDocPreviewHtml(
  source: string,
  options: MotionDocPreviewHtmlOptions = {}
) {
  let documentHtml = buildMotionDocHtml(source, options.title);
  const generatedNonce =
    documentHtml.match(/<script[^>]*nonce="([^"]+)"/)?.[1] ?? "";
  const requestedNonce = options.cspNonce?.trim();
  if (
    requestedNonce &&
    !/^[A-Za-z0-9._:-]{1,128}$/.test(requestedNonce)
  ) {
    throw new Error("cspNonce must contain only portable nonce characters.");
  }
  if (requestedNonce && generatedNonce) {
    documentHtml = documentHtml
      .replaceAll(`nonce="${generatedNonce}"`, `nonce="${requestedNonce}"`)
      .replaceAll(`'nonce-${generatedNonce}'`, `'nonce-${requestedNonce}'`);
  }
  const nonce = requestedNonce || generatedNonce;
  const baseUrl = options.assetBaseUrl?.trim();
  const parentOrigin = options.parentOrigin?.trim() || "*";
  if (
    parentOrigin !== "*" &&
    !/^https?:\/\/[A-Za-z0-9.[\]:_-]+$/.test(parentOrigin)
  ) {
    throw new Error("parentOrigin must be an HTTP origin.");
  }
  const selectedNodeId = options.selectedNodeId?.trim() ?? "";
  const editableCanvas = options.editableCanvas === true;
  const canvasOnlyStyle = options.canvasOnly
    ? ".controls{display:none!important}.stage{padding:0!important}.viewport{width:100%!important;height:100%!important;border-radius:0!important;box-shadow:none!important}"
    : "";
  const previewStyle = `<style>
    ${canvasOnlyStyle}
    .motion-block[data-slidex-node-id]{cursor:pointer}
    .motion-block[data-slidex-node-id]:hover{outline:2px solid rgba(216,255,81,.45);outline-offset:-2px}
    .motion-block[data-slidex-selected="true"]{outline:2px solid #d8ff51;outline-offset:-2px}
    ${editableCanvas ? `
      .motion-block--positioned[data-slidex-node-id]{touch-action:none}
      .motion-block--positioned[data-slidex-node-id][data-slidex-selected="true"]{cursor:grab}
      .motion-block--positioned[data-slidex-node-id][data-slidex-dragging="true"]{cursor:grabbing}
      .slidex-preview-resize{position:absolute;right:-7px;bottom:-7px;width:14px!important;height:14px!important;z-index:50;border:2px solid #111827;border-radius:4px;background:#d8ff51;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:nwse-resize}
    ` : ""}
    @media (max-width:760px){
      .stage{padding:8px}
      .viewport{border-radius:6px}
      .controls{
        bottom:6px;
        gap:6px;
        min-width:270px;
        padding:4px 8px
      }
      .control-button{height:30px;width:30px}
      .control-button svg{height:15px;width:15px}
      .counter{font-size:11px;margin:0}
      .progress{max-width:52px}
    }
  </style>`;
  const previewRuntime = `<script nonce="${escapeAttribute(nonce)}">
    (() => {
      const selected = ${JSON.stringify(selectedNodeId)};
      const editable = ${JSON.stringify(editableCanvas)};
      let gesture = null;
      const round = (value) => Math.round(value * 10000) / 10000;
      const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
      const attachResizeHandle = (target) => {
        document.querySelectorAll(".slidex-preview-resize").forEach((node) => node.remove());
        if (!editable || !target?.classList.contains("motion-block--positioned")) return;
        const handle = document.createElement("button");
        handle.className = "slidex-preview-resize";
        handle.type = "button";
        handle.setAttribute("aria-label", "Resize selected layer");
        target.append(handle);
      };
      const selectTarget = (target) => {
        document.querySelectorAll("[data-slidex-selected='true']")
          .forEach((node) => node.removeAttribute("data-slidex-selected"));
        target?.setAttribute("data-slidex-selected", "true");
        attachResizeHandle(target);
      };
      if (selected) {
        selectTarget(document.querySelector('[data-slidex-node-id="' + CSS.escape(selected) + '"]'));
      }
      document.addEventListener("click", (event) => {
        const target = event.target instanceof Element
          ? event.target.closest("[data-slidex-node-id]")
          : null;
        if (!target) return;
        event.preventDefault();
        selectTarget(target);
        const slide = target.closest("[data-slidex-slide-index]");
        parent.postMessage({
          type: "slidex.preview.select",
          nodeId: target.getAttribute("data-slidex-node-id"),
          blockType: target.getAttribute("data-slidex-block-type"),
          slideIndex: Number(slide?.getAttribute("data-slidex-slide-index") || 0)
        }, ${JSON.stringify(parentOrigin)});
      });
      document.addEventListener("pointerdown", (event) => {
        if (!editable || event.button !== 0) return;
        const handle = event.target instanceof Element ? event.target.closest(".slidex-preview-resize") : null;
        const target = event.target instanceof Element ? event.target.closest(".motion-block--positioned[data-slidex-node-id]") : null;
        if (!(target instanceof HTMLElement)) return;
        const slide = target.closest("[data-slidex-slide-index]");
        if (!(slide instanceof HTMLElement)) return;
        const x = Number(target.dataset.slidexX);
        const y = Number(target.dataset.slidexY);
        const w = Number(target.dataset.slidexW);
        const h = Number(target.dataset.slidexH);
        if (![x, y, w, h].every(Number.isFinite)) return;
        event.preventDefault();
        selectTarget(target);
        target.setAttribute("data-slidex-dragging", "true");
        target.setPointerCapture(event.pointerId);
        gesture = {
          h,
          mode: handle ? "resize" : "move",
          nodeId: target.dataset.slidexNodeId,
          pointerId: event.pointerId,
          slideIndex: Number(slide.dataset.slidexSlideIndex || 0),
          slideRect: slide.getBoundingClientRect(),
          startX: event.clientX,
          startY: event.clientY,
          target,
          w,
          x,
          y
        };
      });
      document.addEventListener("pointermove", (event) => {
        if (!gesture || event.pointerId !== gesture.pointerId) return;
        const dx = (event.clientX - gesture.startX) / gesture.slideRect.width * 100;
        const dy = (event.clientY - gesture.startY) / gesture.slideRect.height * 100;
        if (gesture.mode === "resize") {
          gesture.nextW = clamp(gesture.w + dx, 2, 100 - gesture.x);
          gesture.nextH = clamp(gesture.h + dy, 2, 100 - gesture.y);
          gesture.target.style.setProperty("--motion-w", round(gesture.nextW) + "%");
          gesture.target.style.setProperty("--motion-h", round(gesture.nextH) + "%");
        } else {
          gesture.nextX = clamp(gesture.x + dx, 0, 100 - gesture.w);
          gesture.nextY = clamp(gesture.y + dy, 0, 100 - gesture.h);
          gesture.target.style.setProperty("--motion-x", round(gesture.nextX) + "%");
          gesture.target.style.setProperty("--motion-y", round(gesture.nextY) + "%");
        }
      });
      const finishGesture = (event) => {
        if (!gesture || event.pointerId !== gesture.pointerId) return;
        const completed = gesture;
        gesture = null;
        completed.target.removeAttribute("data-slidex-dragging");
        parent.postMessage({
          type: "slidex.preview.frame",
          nodeId: completed.nodeId,
          slideIndex: completed.slideIndex,
          frame: {
            h: round(completed.nextH ?? completed.h),
            w: round(completed.nextW ?? completed.w),
            x: round(completed.nextX ?? completed.x),
            y: round(completed.nextY ?? completed.y)
          }
        }, ${JSON.stringify(parentOrigin)});
      };
      document.addEventListener("pointerup", finishGesture);
      document.addEventListener("pointercancel", finishGesture);
    })();
  </script>`;

  return documentHtml
    .replace(
      "<head>",
      `<head>${baseUrl ? `<base href="${escapeAttribute(baseUrl)}" />` : ""}`
    )
    .replace("</head>", `${previewStyle}</head>`)
    .replace("</body>", `${previewRuntime}</body>`);
}

function exportRuntimeSecurity(source: string) {
  // The downloadable file is static: an unpredictable nonce would only make
  // otherwise identical exports differ. A stable per-source nonce retains the
  // CSP boundary while making HTML output reproducible.
  const nonce = `slidex-${stableNonce(source)}`;
  // A sandboxed data: iframe inherits the parent's CSP. Imported browser-native
  // HTML therefore needs its inline code and HTTP(S) libraries, media, workers,
  // and connections. The iframe still has no same-origin capability, so these
  // resources cannot directly control the OpenSlideX parent document.
  const scriptPolicy = /<HtmlEmbedBlock\b/.test(source)
    ? "script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' http: https: data: blob:"
    : `script-src 'nonce-${nonce}'`;
  const policy = [
    "default-src 'none'",
    "base-uri http: https:",
    "connect-src http: https: ws: wss: data: blob:",
    "font-src http: https: data: blob:",
    "form-action http: https:",
    "frame-src 'self' http: https: data: blob:",
    "img-src 'self' http: https: data: blob:",
    "manifest-src http: https: data: blob:",
    "media-src 'self' http: https: data: blob:",
    "object-src http: https: data: blob:",
    scriptPolicy,
    "style-src 'unsafe-inline' http: https: data: blob:",
    "worker-src http: https: data: blob:"
  ].join("; ");

  return { nonce, policy };
}

function stableNonce(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function motionDocFontStylesheetLinks(document: ReturnType<typeof parseMotionDoc>) {
  const fontFamilies = new Set<string>();
  const addFontFamily = (value: unknown) => {
    if (typeof value !== "string") return;
    const fontFamily = value.trim();
    if (
      !fontFamily ||
      fontFamily === "inherit" ||
      fontFamily === "Default" ||
      fontFamily === "Default Font" ||
      fontFamily.length > 120
    ) return;
    fontFamilies.add(fontFamily);
  };

  document.scenes.forEach((scene) => {
    scene.blocks.forEach((block) => {
      addFontFamily(block.props.fontFamily);
      if (block.type === "Text" || block.type === "heading") {
        textStyleRangesFromProps(block.props, block.text.length)
          .forEach((range) => addFontFamily(range.fontFamily));
      }
      if (block.type === "Table") {
        const { columns, rows } = tableSizeFromProps(block.props);
        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            addFontFamily(tableCellStyleOverride(block.props, row, column).fontFamily);
          }
        }
      }
    });
  });

  return [...fontFamilies]
    .sort((left, right) => left.localeCompare(right))
    .map((fontFamily) => {
      const family = encodeURIComponent(fontFamily).replaceAll("%20", "+");
      const href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700;800;900&display=swap`;
      return `<link rel="stylesheet" href="${escapeAttribute(href)}" />`;
    })
    .join("\n    ");
}

export function buildMotionDocRasterHtml(
  source: string,
  customTitle?: string,
  slideIndices?: readonly number[]
) {
  const security = exportRuntimeSecurity(source);
  const document = parseMotionDoc(source);
  const displayTitle = customTitle || document.title;
  const scenes = slideIndices
    ? slideIndices
        .map((slideIndex) => document.scenes[slideIndex])
        .filter((scene): scene is MotionDocScene => Boolean(scene))
    : document.scenes;
  const slidesHtml = scenes
    .map((scene, slideIndex) => renderSceneHtml(scene, { active: true, slideIndex }))
    .join("\n");
  const fontStylesheetLinks = motionDocFontStylesheetLinks(document);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${security.policy}" />
    <meta name="viewport" content="width=${MOTION_DOC_CANVAS_WIDTH}, initial-scale=1" />
    <title>${escapeHtml(displayTitle)}</title>
    ${fontStylesheetLinks}
    <style>${motionDocExportStyles}</style>
    <style>
      html, body {
        background: #000000;
        height: ${MOTION_DOC_PNG_HEIGHT}px;
        margin: 0;
        overflow: hidden;
        padding: 0;
        width: ${MOTION_DOC_PNG_WIDTH}px;
      }
      * {
        animation: none !important;
        transition: none !important;
      }
      .player,
      .stage,
      .viewport,
      .frame {
        border-radius: 0 !important;
        box-shadow: none !important;
        height: ${MOTION_DOC_PNG_HEIGHT}px !important;
        margin: 0 !important;
        max-width: none !important;
        overflow: hidden !important;
        padding: 0 !important;
        width: ${MOTION_DOC_PNG_WIDTH}px !important;
      }
      .player,
      .stage {
        display: block !important;
      }
      .viewport,
      .frame {
        position: relative !important;
      }
      .slide {
        display: block !important;
        height: ${MOTION_DOC_PNG_HEIGHT}px !important;
        inset: 0 !important;
        opacity: 1 !important;
        position: absolute !important;
        transform: none !important;
        width: ${MOTION_DOC_PNG_WIDTH}px !important;
      }
      .motion-block {
        clip-path: none !important;
        filter: none !important;
        opacity: 1 !important;
        transform: translate3d(0, 0, 0) scale(1) !important;
      }
      .shader-still-image {
        display: block !important;
      }
    </style>
  </head>
  <body>
    <main class="player" data-export-mode="raster" data-slide-count="${scenes.length}">
      <div class="stage">
        <div class="viewport">
          <div class="frame">
            ${slidesHtml}
          </div>
        </div>
      </div>
    </main>
    <script nonce="${security.nonce}">${makeMotionDocExportRuntime()}</script>
  </body>
</html>`;
}

export function buildMotionDocPngSvg(source: string, slideIndex = 0, customTitle?: string) {
  const document = parseMotionDoc(source);
  const displayTitle = customTitle || document.title;
  const safeSlideIndex = Math.min(Math.max(Math.floor(slideIndex), 0), Math.max(document.scenes.length - 1, 0));
  const scene = document.scenes[safeSlideIndex];
  const slideHtml = scene
    ? renderSceneHtml(scene, { active: true, rasterMode: true })
    : `<section class="slide is-active" style="background:#ffffff;color:#111827;"></section>`;

  return buildMotionDocPngSvgFromSlideHtml(slideHtml, displayTitle);
}

export function buildMotionDocPngSvgFromSlideHtml(slideHtml: string, customTitle?: string) {
  const displayTitle = customTitle || "SlideX PNG";
  const pngCss = `${motionDocExportStyles}
    .png-export-root {
      background: #000000;
      color: #ffffff;
      height: ${MOTION_DOC_PNG_HEIGHT}px;
      margin: 0;
      overflow: hidden;
      width: ${MOTION_DOC_PNG_WIDTH}px;
    }
    .png-export-root *,
    .png-export-root *::before,
    .png-export-root *::after {
      animation: none !important;
      transition: none !important;
    }
    .png-export-root .player,
    .png-export-root .stage,
    .png-export-root .viewport,
    .png-export-root .frame {
      border-radius: 0 !important;
      box-shadow: none !important;
      height: ${MOTION_DOC_PNG_HEIGHT}px !important;
      margin: 0 !important;
      max-width: none !important;
      overflow: hidden !important;
      padding: 0 !important;
      width: ${MOTION_DOC_PNG_WIDTH}px !important;
    }
    .png-export-root .player,
    .png-export-root .stage {
      display: block !important;
    }
    .png-export-root .viewport,
    .png-export-root .frame {
      position: relative !important;
    }
    .png-export-root .slide {
      display: block !important;
      height: ${MOTION_DOC_PNG_HEIGHT}px !important;
      inset: 0 !important;
      opacity: 1 !important;
      position: absolute !important;
      transform: none !important;
      width: ${MOTION_DOC_PNG_WIDTH}px !important;
    }
    .png-export-root .motion-block {
      clip-path: none !important;
      filter: none !important;
      opacity: 1 !important;
      transform: translate3d(0, 0, 0) scale(1) !important;
    }
    .png-export-root .shader-bg:not(.shader-still-image),
    .png-export-root .image-filter-canvas:not(.shader-still-image) {
      display: none !important;
    }
    .png-export-root .shader-still-image {
      display: block !important;
    }
    .png-export-root .controls {
      display: none !important;
    }`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${MOTION_DOC_PNG_WIDTH}" height="${MOTION_DOC_PNG_HEIGHT}" viewBox="0 0 ${MOTION_DOC_PNG_WIDTH} ${MOTION_DOC_PNG_HEIGHT}">
  <title>${escapeHtml(displayTitle)}</title>
  <foreignObject width="${MOTION_DOC_PNG_WIDTH}" height="${MOTION_DOC_PNG_HEIGHT}" x="0" y="0">
    <div xmlns="http://www.w3.org/1999/xhtml" class="png-export-root">
      <style><![CDATA[${escapeCdata(pngCss)}]]></style>
      <main class="player" data-slide-count="1">
        <div class="stage">
          <div class="viewport">
            <div class="frame">
              ${slideHtml}
            </div>
          </div>
        </div>
      </main>
    </div>
  </foreignObject>
</svg>`;
}

function renderSceneHtml(scene: MotionDocScene, options: RenderSceneHtmlOptions = {}) {
  const { blocks, duration, props } = scene;
  const theme = typeof props.theme === "string" ? props.theme : "dark";
  const declaredLight = theme === "light" || theme === "paper";
  const themeColors = resolveSlideThemeColors(props, {
    accentFallback: declaredLight ? "#111111" : "#ffffff",
    backgroundFallback: declaredLight ? "#ffffff" : "#000000",
    themeFallback: theme
  });
  const shader = stringProp(props.shader);
  const shaderPreset = stringProp(props.shaderPreset) ?? "Default";
  const shaderHtml = shader ? `<canvas class="shader-bg" data-shader="${escapeAttribute(shader)}" data-shader-engine="${escapeAttribute(themeColors.shaderEngine)}" data-shader-preset="${escapeAttribute(shaderPreset)}" data-shader-variant="0" data-shader-color1="${escapeAttribute(themeColors.shaderColor1)}" data-shader-color2="${escapeAttribute(themeColors.shaderColor2)}" data-shader-color3="${escapeAttribute(themeColors.shaderColor3)}" data-shader-color4="${escapeAttribute(themeColors.shaderColor4)}" data-shader-color5="${escapeAttribute(themeColors.shaderColor5)}" data-shader-color6="${escapeAttribute(themeColors.shaderColor6)}" data-shader-angle="${numberProp(props.shaderAngle, 0)}" data-shader-frame="${numberProp(props.shaderFrame, 0)}" data-shader-intensity="${numberProp(props.shaderIntensity, 0.5)}" data-shader-speed="${numberProp(props.shaderSpeed, 1)}" data-shader-softness="${numberProp(props.shaderSoftness, 0.5)}" data-shader-scale="${numberProp(props.shaderScale, 0.5)}" data-shader-detail="${numberProp(props.shaderDetail, 0.5)}"></canvas>` : '';
  const backgroundImage = stringProp(props.backgroundImage);
  const backgroundImageHtml = backgroundImage
    ? `<div class="slide-bg-image" style="${escapeAttribute(inlineCss({
        "background-image": cssImageUrl(backgroundImage),
        "background-size": backgroundSizeFromFit(stringProp(props.backgroundFit))
      }))}"></div>`
    : "";
  const slideTransition = slideTransitionClass(props.slideTransition);
  const transitionDuration = numberProp(props.transitionDuration, 0.72);
  const hasPositionedBlocks = blocks.some((block) => "props" in block && isPositionedProps(block.props));
  const layout = slideLayoutProp(props.layout);
  const imageBlocks = blocks.filter((block) => block.type === "ImageBlock");
  const contentBlocks = blocks.filter((block) => block.type !== "ImageBlock");
  const shouldSplit = !hasPositionedBlocks && layout !== "default" && imageBlocks.length > 0;
  const renderedBlocks = blocks.filter((block) => {
    if (options.sharedSvgOverlay && block.type === "SvgBlock" && stringProp(block.props.sharedScene)) return false;
    if (options.sharedHtmlOverlay && block.type === "HtmlEmbedBlock" && stringProp(block.props.sharedScene)) return false;
    return true;
  });
  const contentHtml = shouldSplit
    ? renderSplitSceneContent(contentBlocks, imageBlocks, layout, options)
    : renderedBlocks.map((block, index) => renderBlock(block, index, options)).join("");
  const contentClass = [
    "slide-content",
    hasPositionedBlocks ? "slide-content--freeform" : "",
    shouldSplit ? "slide-content--split" : ""
  ].filter(Boolean).join(" ");

  return `<section class="slide ${slideTransition}${options.active ? " is-active" : ""}" data-duration="${Math.max(duration, 1)}" data-has-shader="${shader ? "true" : "false"}" data-morph-easing="${escapeAttribute(stringProp(props.morphEasing) ?? "easeInOut")}" data-morph-curve-x1="${escapeAttribute(String(numberProp(props.morphCurveX1, 0.4)))}" data-morph-curve-y1="${escapeAttribute(String(numberProp(props.morphCurveY1, 0)))}" data-morph-curve-x2="${escapeAttribute(String(numberProp(props.morphCurveX2, 0.2)))}" data-morph-curve-y2="${escapeAttribute(String(numberProp(props.morphCurveY2, 1)))}" data-morph-fade-unmatched="${props.morphFadeUnmatched === "false" || props.morphFadeUnmatched === 0 ? "false" : "true"}" data-morph-shape-softness="${escapeAttribute(String(numberProp(props.morphShapeSoftness, 0.32)))}" data-morph-shape-precision="${escapeAttribute(String(numberProp(props.morphShapePrecision, 48)))}" data-slidex-slide-index="${options.slideIndex ?? 0}" data-theme-tone="${themeColors.tone}" style="${escapeAttribute(inlineCss({
    "--slide-align-x": alignXCss(props.alignX),
    "--slide-align-y": alignYCss(props.alignY),
    "--slide-accent": themeColors.accent,
    "--slide-bg": themeColors.background,
    "--slide-border": themeColors.borderColor,
    "--slide-card": themeColors.cardBackground,
    "--slide-fg": themeColors.foreground,
    "--slide-muted": themeColors.muted,
    "--slide-overlay-opacity": shader ? "0.3" : "0",
    "--slide-padding": hasPositionedBlocks ? "0" : "clamp(16px, 3%, 32px)",
    "--slide-text-align": textAlignCss(props.textAlign),
    "--slide-transition-duration": `${transitionDuration}s`
  }))}">
    ${backgroundImageHtml}
    ${shaderHtml}
    <div class="${contentClass}" data-layout="${escapeAttribute(layout)}" data-freeform="${hasPositionedBlocks ? "true" : "false"}">
      ${contentHtml}
    </div>
  </section>`;
}

function renderSplitSceneContent(
  contentBlocks: MotionDocBlock[],
  imageBlocks: MotionDocBlock[],
  layout: "split-left" | "split-right",
  options: RenderSceneHtmlOptions
) {
  const textOrder = layout === "split-left" ? 1 : 2;
  const imageOrder = layout === "split-left" ? 2 : 1;
  const contentHtml = contentBlocks.length > 0
    ? contentBlocks.map((block, index) => renderBlock(block, index, options)).join("")
    : `<div class="motion-block enter-none"><p class="block-text">Add a text layer for this side.</p></div>`;
  const imageHtml = imageBlocks.map((block, index) => renderBlock(block, contentBlocks.length + index, options)).join("");

  return `<div class="slide-split-pane slide-split-pane--content" style="order:${textOrder}">${contentHtml}</div><div class="slide-split-pane slide-split-pane--media" style="order:${imageOrder}">${imageHtml}</div>`;
}

function renderSharedSvgScenes(scenes: MotionDocScene[]) {
  const groups = new Map<string, Array<{ block: Extract<MotionDocBlock, { type: "SvgBlock" }>; slideIndex: number }>>();
  scenes.forEach((scene, slideIndex) => scene.blocks.forEach((block) => {
    if (block.type !== "SvgBlock") return;
    const sharedScene = stringProp(block.props.sharedScene);
    if (!sharedScene) return;
    const entries = groups.get(sharedScene) ?? [];
    entries.push({ block, slideIndex });
    groups.set(sharedScene, entries);
  }));
  if (!groups.size) return "";
  const layers = [...groups.entries()].map(([sharedScene, entries]) => {
    const first = entries[0]!.block;
    const declarations = entries.map(({ block, slideIndex }) => ({
      easing: stringProp(block.props.easing) ?? "ease-in-out",
      h: motionDocBlockFrame(block).h,
      slideIndex,
      stage: numberProp(block.props.stage, 0),
      stageDuration: numberProp(block.props.stageDuration, 0.6),
      w: motionDocBlockFrame(block).w,
      x: motionDocBlockFrame(block).x,
      y: motionDocBlockFrame(block).y
    }));
    const frame = motionDocBlockFrame(first);
    return `<div class="shared-svg-scene" data-svg-shared-scene="${escapeAttribute(sharedScene)}" data-svg-shared-declarations="${escapeAttribute(JSON.stringify(declarations))}" style="${escapeAttribute(inlineCss({
      height: `${frame.h}%`,
      left: `${frame.x}%`,
      top: `${frame.y}%`,
      width: `${frame.w}%`
    }))}">${renderSvgStageSurface(first)}</div>`;
  }).join("");
  return `<div class="shared-svg-layer" aria-hidden="true">${layers}</div>`;
}

function renderSharedHtmlScenes(scenes: MotionDocScene[]) {
  const groups = new Map<string, Array<{ block: Extract<MotionDocBlock, { type: "HtmlEmbedBlock" }>; slideIndex: number }>>();
  scenes.forEach((scene, slideIndex) => scene.blocks.forEach((block) => {
    if (block.type !== "HtmlEmbedBlock") return;
    const sharedScene = stringProp(block.props.sharedScene);
    if (!sharedScene) return;
    const entries = groups.get(sharedScene) ?? [];
    entries.push({ block, slideIndex });
    groups.set(sharedScene, entries);
  }));
  if (!groups.size) return "";
  const layers = [...groups.entries()].map(([sharedScene, entries]) => {
    const first = entries[0]!.block;
    const declarations = entries.map(({ block, slideIndex }) => ({
      h: motionDocBlockFrame(block).h,
      page: Math.max(1, Math.floor(numberProp(block.props.page, 1))),
      slideIndex,
      w: motionDocBlockFrame(block).w,
      x: motionDocBlockFrame(block).x,
      y: motionDocBlockFrame(block).y
    }));
    const frame = motionDocBlockFrame(first);
    return `<div class="shared-html-scene" data-html-shared-scene="${escapeAttribute(sharedScene)}" data-html-shared-declarations="${escapeAttribute(JSON.stringify(declarations))}" style="${escapeAttribute(inlineCss({
      height: `${frame.h}%`, left: `${frame.x}%`, top: `${frame.y}%`, width: `${frame.w}%`
    }))}">${renderHtmlEmbedSurface(first)}</div>`;
  }).join("");
  return `<div class="shared-html-layer">${layers}</div>`;
}

function renderSvgStageSurface(block: Extract<MotionDocBlock, { type: "SvgBlock" }>) {
  return `<div class="block-svg-stage" data-svg-easing="${escapeAttribute(stringProp(block.props.easing) ?? "ease-in-out")}" data-svg-src="${escapeAttribute(stringProp(block.props.src) ?? "")}" data-svg-stage="${numberProp(block.props.stage, 0)}" data-svg-stage-duration="${numberProp(block.props.stageDuration, 0.6)}"></div>`;
}

function renderBlock(block: MotionDocBlock, blockIndex: number, options: RenderSceneHtmlOptions = {}) {
  if (block.type === "Text" || block.type === "heading") {
    const listType = "props" in block ? block.props?.listType : undefined;
    const props = "props" in block ? block.props : {};
    const markdownKind = stringProp(props.markdownKind);
    const contents = renderTextLines(String(block.text ?? ""), listType, props);

    if (markdownKind === "heading" || props.role === "title") {
      const depth = Math.min(Math.max(Math.round(numberProp(props.markdownDepth, props.role === "title" ? 1 : 2)), 1), 6);
      return renderMotionBlock(block, `<h${depth} class="block-text block-markdown-heading" data-motion-text-content="true">${contents}</h${depth}>`);
    }
    if (markdownKind === "blockquote") {
      return renderMotionBlock(block, `<blockquote class="block-text block-text--blockquote" data-motion-text-content="true">${contents}</blockquote>`);
    }
    if (markdownKind === "code") {
      return renderMotionBlock(block, `<pre class="block-text block-text--code" data-motion-text-content="true"><code>${contents}</code></pre>`);
    }

    return renderMotionBlock(block, `<p class="block-text" data-motion-text-content="true">${contents}</p>`);
  }

  if (block.type === "Chart") {
    return renderMotionBlock(
      block,
      `<div class="block-chart">${renderMotionDocChartSvg(block.props, {
        appearance: "editor-modern",
        frame: motionDocBlockFrame(block)
      })}</div>`
    );
  }

  if (block.type === "ImageBlock") {
    const fit = fitProp(block.props.fit);
    const imageCropX = clampExportImageCropPosition(optionalNumberProp(block.props.cropX));
    const imageCropY = clampExportImageCropPosition(optionalNumberProp(block.props.cropY));
    const normalizedScales = normalizedImageScales(
      fit,
      optionalNumberProp(block.props.scaleX),
      optionalNumberProp(block.props.scaleY)
    );
    const imageScaleX = clampExportImageScale(normalizedScales.scaleX);
    const imageScaleY = clampExportImageScale(normalizedScales.scaleY);
    const imageTransform = `translate(${imageCropX}%, ${imageCropY}%) scale(${imageScaleX}, ${imageScaleY})`;
    const hasImageCropTransform = imageCropX !== 0 || imageCropY !== 0 || imageScaleX !== 1 || imageScaleY !== 1;
    const imageScaleStyle = {
      "object-fit": fit,
      "transform": imageTransform,
      "transform-origin": "center"
    };
    const filterDefinition = getPaperImageFilterDefinition(stringProp(block.props.filter));
    const needsExactImageRaster = Boolean(filterDefinition) || hasImageCropTransform;
    const exactRasterAttr = needsExactImageRaster ? ` data-exact-image-raster="true"` : "";

    if (filterDefinition && !options.rasterMode) {
      const fPreset = stringProp(block.props.filterPreset) || filterDefinition.defaultPreset;
      const fDistortion = optionalNumberProp(block.props.filterDistortion);
      const fSize = optionalNumberProp(block.props.filterSize);
      const fAngle = optionalNumberProp(block.props.filterAngle);
      const fContrast = optionalNumberProp(block.props.filterContrast);
      const fSpeed = optionalNumberProp(block.props.filterSpeed);
      const fDetail = optionalNumberProp(block.props.filterDetail);

      const fPresetAttr = fPreset ? ` data-filter-preset="${escapeAttribute(fPreset)}"` : "";
      const fDistortionAttr = fDistortion !== undefined ? ` data-filter-distortion="${fDistortion}"` : "";
      const fSizeAttr = fSize !== undefined ? ` data-filter-size="${fSize}"` : "";
      const fAngleAttr = fAngle !== undefined ? ` data-filter-angle="${fAngle}"` : "";
      const fContrastAttr = fContrast !== undefined ? ` data-filter-contrast="${fContrast}"` : "";
      const fSpeedAttr = fSpeed !== undefined ? ` data-filter-speed="${fSpeed}"` : "";
      const fDetailAttr = fDetail !== undefined ? ` data-filter-detail="${fDetail}"` : "";
      const fFitAttr = ` data-filter-fit="${escapeAttribute(shaderFitProp(fit))}"`;
      const cropFilterClass = hasImageCropTransform ? " block-image__crop-filter" : "";
      const filterStyle = hasImageCropTransform
        ? inlineCss({
            "height": "100%",
            "left": "50%",
            "position": "absolute",
            "top": "50%",
            "transform": "translate(-50%, -50%)",
            "width": "100%"
          })
        : inlineCss({
            "height": "100%",
            "inset": "0",
            "object-fit": fit,
            "position": "absolute",
            "transform": imageTransform,
            "transform-origin": "center",
            "width": "100%"
          });
      const filterCanvas = `<canvas class="image-filter-canvas${cropFilterClass}" data-shader="${escapeAttribute(filterDefinition.id)}"${fPresetAttr}${fFitAttr}${fDistortionAttr}${fSizeAttr}${fAngleAttr}${fContrastAttr}${fSpeedAttr}${fDetailAttr} style="${escapeAttribute(filterStyle)}" data-shader-image="${escapeAttribute(String(block.props.src ?? ""))}"></canvas>`;
      const filteredImageContent = hasImageCropTransform
        ? renderCroppedImageMedia(
            String(block.props.src ?? ""),
            String(block.props.alt ?? ""),
            fit,
            imageCropX,
            imageCropY,
            imageScaleX,
            imageScaleY,
            filterCanvas
          )
        : `<img src="${escapeAttribute(String(block.props.src ?? ""))}" alt="${escapeAttribute(String(block.props.alt ?? ""))}" style="${escapeAttribute(inlineCss(imageScaleStyle))}" />${filterCanvas}`;

      return renderMotionBlock(
        block,
        `<figure class="block-image"${exactRasterAttr}>${filteredImageContent}</figure>`
      );
    }

    const imageContent = hasImageCropTransform
      ? renderCroppedImageMedia(
          String(block.props.src ?? ""),
          String(block.props.alt ?? ""),
          fit,
          imageCropX,
          imageCropY,
          imageScaleX,
          imageScaleY
        )
      : `<img src="${escapeAttribute(String(block.props.src ?? ""))}" alt="${escapeAttribute(String(block.props.alt ?? ""))}" style="${escapeAttribute(inlineCss(imageScaleStyle))}" />`;

    return renderMotionBlock(
      block,
      `<figure class="block-image"${exactRasterAttr}>${imageContent}</figure>`
    );
  }

  if (block.type === "HtmlEmbedBlock") {
    if (!options.rasterMode) return renderMotionBlock(block, renderHtmlEmbedSurface(block));
    return renderMotionBlock(
      block,
      `<div class="block-html-unsupported" role="note"><strong>Interactive HTML is available only in the local OpenSlideX Workbench.</strong><span>Download the original HTML to retain its JavaScript animation and controls.</span></div>`
    );
  }

  if (block.type === "SvgBlock") {
    return renderMotionBlock(block, renderSvgStageSurface(block));
  }

  if (block.type === "VideoBlock") {
    const fit = fitProp(block.props.fit);
    const poster = stringProp(block.props.poster);
    const src = stringProp(block.props.src);

    if (options.rasterMode) {
      return renderMotionBlock(
        block,
        `<figure class="block-image block-video">${poster ? `<img src="${escapeAttribute(poster)}" alt="" style="${escapeAttribute(inlineCss({ "object-fit": fit }))}" />` : ""}</figure>`
      );
    }

    if (!src) {
      return renderMotionBlock(
        block,
        `<figure class="block-image block-video">${poster ? `<img src="${escapeAttribute(poster)}" alt="" style="${escapeAttribute(inlineCss({ "object-fit": fit }))}" />` : ""}</figure>`
      );
    }

    const controlsEnabled = boolProp(block.props.controls, true);
    const loopEnabled = boolProp(block.props.loop, true);
    const mutedEnabled = boolProp(block.props.muted, true);
    const youtubeId = youtubeVideoId(src);
    const youtubeSrc = youtubeEmbedUrl(src, {
      autoplay: mutedEnabled,
      controls: controlsEnabled,
      loop: loopEnabled,
      muted: mutedEnabled
    });

    if (youtubeSrc) {
      const youtubeWatchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId ?? "")}`;
      const youtubePoster = poster
        ? `<img class="block-video__youtube-poster" src="${escapeAttribute(poster)}" alt="" style="${escapeAttribute(inlineCss({ "object-fit": fit }))}" />`
        : "";

      return renderMotionBlock(
        block,
        `<figure class="block-image block-video block-video--youtube" data-youtube-embed><iframe data-youtube-src="${escapeAttribute(youtubeSrc)}" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" allowfullscreen></iframe><a class="block-video__youtube-fallback" href="${escapeAttribute(youtubeWatchUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open video on YouTube">${youtubePoster}<span class="block-video__youtube-fallback-content"><span class="block-video__youtube-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 7.5v9l7-4.5-7-4.5Z"/></svg></span><strong>Open on YouTube</strong><span>Online playback is unavailable in a local HTML file.</span></span></a></figure>`
      );
    }

    const controls = controlsEnabled ? " controls" : "";
    const loop = loopEnabled ? " loop" : "";
    const muted = mutedEnabled ? " muted autoplay playsinline" : "";
    const posterAttr = poster ? ` poster="${escapeAttribute(poster)}"` : "";

    return renderMotionBlock(
      block,
      `<figure class="block-image block-video"><video src="${escapeAttribute(src)}"${posterAttr}${controls}${loop}${muted} style="${escapeAttribute(inlineCss({ "object-fit": fit }))}"></video></figure>`
    );
  }

  if (block.type === "Shape") {
    return renderMotionBlock(
      block,
      `<div class="block-shape">${renderShapeHtmlFallback(block.props)}${renderShapeSvg(block.props, blockIndex)}</div>`
    );
  }

  if (block.type === "Table") {
    return renderMotionBlock(block, renderTableBlock(block.props));
  }

  return "";
}

function renderHtmlEmbedSurface(block: Extract<MotionDocBlock, { type: "HtmlEmbedBlock" }>) {
  return `<iframe allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen class="block-html-embed" data-html-page="${Math.max(1, Math.floor(numberProp(block.props.page, 1)))}" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-downloads allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-presentation allow-scripts" src="${escapeAttribute(stringProp(block.props.src) ?? "")}" title="Imported HTML presentation"></iframe>`;
}

function renderCroppedImageMedia(
  source: string,
  alt: string,
  fit: string,
  cropX: number,
  cropY: number,
  scaleX: number,
  scaleY: number,
  overlay = ""
) {
  return `<div class="block-image__crop-media" data-image-crop-x="${cropX}" data-image-crop-y="${cropY}" data-image-fit="${escapeAttribute(fit)}" data-image-layout-ready="false" data-image-scale-x="${scaleX}" data-image-scale-y="${scaleY}" style="${escapeAttribute(inlineCss({
    "transform": `translate(${cropX}%, ${cropY}%) scale(${scaleX}, ${scaleY})`,
    "transform-origin": "center"
  }))}"><img class="block-image__crop-image" src="${escapeAttribute(source)}" alt="${escapeAttribute(alt)}" />${overlay}</div>`;
}

function renderTableBlock(props: MotionDocProps) {
  const { columns, rows } = tableSizeFromProps(props);
  const cells = tableCellsFromProps(props, rows, columns);
  const columnTracks = tableColumnTrackValuesFromProps(props, columns);
  const rowTracks = tableRowTrackValuesFromProps(props, rows);
  const borderColor = stringProp(props.borderColor) ?? "#d1d5db";
  const borderWidth = numberProp(props.borderWidth, 1);
  const tableStyle = inlineCss({
    "--table-border": borderColor,
    "--table-border-style": tableBorderStyle(props.borderStyle),
    "--table-border-width": `${borderWidth}px`,
    "--table-cell-justify": tableCellJustify(props.textAlign),
    "--table-font-size": `${motionDocFontPointsToCanvasPixels(numberProp(props.fontSize, MOTION_DOC_FONT_SIZES.table))}px`,
    "--table-padding-x": `${numberProp(props.cellPaddingX, 10)}px`,
    "--table-padding-y": `${numberProp(props.cellPaddingY, 8)}px`,
    "--table-text-align": tableTextAlign(props.textAlign),
    "--table-vertical-align": tableVerticalAlign(props.textVerticalAlign),
    background: stringProp(props.background ?? props.backgroundColor ?? props.bg) ?? "#ffffff",
    color: stringProp(props.color ?? props.textColor) ?? "#000000",
    "grid-template-columns": tableTrackTemplate(columnTracks),
    "grid-template-rows": tableTrackTemplate(rowTracks)
  });

  const cellHtml = cells.flatMap((row, rowIndex) =>
    row.map((cell, columnIndex) => {
      const override = tableCellStyleOverride(props, rowIndex, columnIndex);
      const cellBackground =
        override.background ??
        tableCellBackground(props, rowIndex);
      const cellBorderColor = override.borderColor;
      const cellTextAlign = override.textAlign ?? tableTextAlign(props.textAlign);
      const cellColor = override.textColor ?? stringProp(props.color ?? props.textColor);
      const cellFontFamily = override.fontFamily;
      const cellFontSize = override.fontSize;
      const cellFontWeight = override.fontWeight;
      const cellStyle = inlineCss({
        ...(cellBackground ? { background: cellBackground } : {}),
        ...(cellBorderColor ? {
          "border-bottom-color": cellBorderColor,
          "border-right-color": cellBorderColor
        } : {}),
        ...(cellColor ? { color: cellColor } : {}),
        ...(cellFontFamily ? { "font-family": cellFontFamily } : {}),
        ...(cellFontSize ? { "font-size": `${motionDocFontPointsToCanvasPixels(cellFontSize)}px` } : {}),
        ...(cellFontWeight ? { "font-weight": String(cellFontWeight) } : {}),
        "justify-content": tableCellJustify(cellTextAlign),
        "text-align": cellTextAlign
      });

      return `<div class="block-table__cell" style="${escapeAttribute(cellStyle)}">${escapeHtml(cell)}</div>`;
    })
  ).join("");

  return `<div class="block-table" style="${escapeAttribute(tableStyle)}">${cellHtml}</div>`;
}

function tableCellBackground(props: MotionDocProps, rowIndex: number) {
  const stripeBackground = stringProp(props.stripeBackground);

  if (stripeBackground && rowIndex % 2 === 1) {
    return stripeBackground;
  }

  return stringProp(props.cellBackground) ?? "transparent";
}

function tableBorderStyle(value: string | number | undefined) {
  return value === "dashed" || value === "dotted" ? value : "solid";
}

function tableTextAlign(value: string | number | undefined) {
  if (value === "left" || value === "right") {
    return value;
  }

  return "center";
}

function tableCellJustify(value: string | number | undefined) {
  if (value === "left") return "flex-start";
  if (value === "right") return "flex-end";

  return "center";
}

function tableVerticalAlign(value: string | number | undefined) {
  if (value === "top") return "flex-start";
  if (value === "bottom") return "flex-end";

  return "center";
}

function renderMotionBlock(block: MotionDocBlock, content: string) {
  const props = "props" in block ? block.props : {};
  const nodeId = motionDocBlockId(block);
  const groupId = stringProp(props.groupId)?.trim() ?? "";
  const sharedId = stringProp(props.sharedId)?.trim() ?? "";
  const motionSequence = stringProp(props.motion)?.trim() ?? "";
  const interaction = stringProp(props.interaction)?.trim() ?? "";
  const shapeAttributes = block.type === "Shape"
    ? ` data-shape-kind="${escapeAttribute(stringProp(props.shape) ?? "rectangle")}" data-shape-points="${escapeAttribute(String(numberProp(props.points, 5)))}" data-shape-sides="${escapeAttribute(String(numberProp(props.sides, 3)))}"`
    : "";
  const enter = motionSequence ? "enter-none" : animationClass(props.enter);
  const delay = numberProp(props.delay, 0);
  const duration = numberProp(props.duration, 0.6);
  const fullClass = props.full === "true" || props.full === 1 ? " motion-block--full" : "";
  const positionClass = isPositionedProps(props) ? " motion-block--positioned" : "";
  const frameAttributes = isPositionedProps(props)
    ? ` data-slidex-x="${framePositionPercent(props.x, 8)}" data-slidex-y="${framePositionPercent(props.y, 12)}" data-slidex-w="${framePercent(props.w, 42)}" data-slidex-h="${framePercent(props.h, 18)}"`
    : "";

  return `<div class="motion-block ${enter}${fullClass}${positionClass}"${nodeId ? ` data-slidex-node-id="${escapeAttribute(nodeId)}"` : ""}${groupId ? ` data-slidex-group-id="${escapeAttribute(groupId)}"` : ""}${sharedId ? ` data-shared-id="${escapeAttribute(sharedId)}"` : ""}${motionSequence ? ` data-motion-sequence="${escapeAttribute(motionSequence)}"` : ""}${interaction ? ` data-slidex-interaction="${escapeAttribute(interaction)}"` : ""}${shapeAttributes}${frameAttributes} data-slidex-block-type="${escapeAttribute(block.type)}" style="${escapeAttribute(inlineCss({
    "--motion-delay": `${delay}s`,
    "--motion-duration": `${duration}s`,
    ...fontSizeVars(props),
    ...textStyleVars(props),
    ...positionVars(props),
    ...objectShadowCss(props),
    ...(interaction ? { cursor: "pointer" } : {}),
    rotate: `${blockRotation(props)}deg`,
    ...radiusVars(props),
    ...colorVars(props),
    ...textAlignVars(props),
    ...flexAlignVars(props)
  }))}">${content}</div>`;
}

function renderTextLines(text: string, listType?: string | unknown, props: MotionDocProps = {}) {
  if (!text) return "";

  const listStart = Math.max(1, Math.round(numberProp(props.listStart, 1)));

  return textStyleLines(text, props).map((line, lineIndex) => {
    const isBullet = listType === "bullet";
    const isOrdered = listType === "ordered";
    const className = isBullet
      ? "block-line block-line--bullet"
      : isOrdered
        ? "block-line block-line--ordered"
        : "block-line";
    const content = line.length === 0
      ? "&#8203;"
      : line.map((segment) => {
          const styles = {
            ...(segment.color ? { color: segment.color } : {}),
            ...(segment.fontFamily ? { "font-family": `"${segment.fontFamily}", sans-serif` } : {}),
            ...(segment.fontSize === undefined ? {} : { "font-size": `${motionDocFontPointsToCanvasPixels(segment.fontSize)}px` }),
            ...(segment.fontWeight === undefined ? {} : { "font-weight": String(segment.fontWeight) }),
            ...(segment.italic === undefined ? {} : { "font-style": segment.italic ? "italic" : "normal" }),
            ...(segment.letterSpacing === undefined ? {} : { "letter-spacing": `${motionDocFontPointsToCanvasPixels(segment.letterSpacing)}px` }),
            ...(segment.underline === undefined ? {} : { "text-decoration": segment.underline ? "underline" : "none" })
          };
          const escapedText = escapeHtml(segment.text);
          const styledText = Object.keys(styles).length > 0
            ? `<span style="${escapeAttribute(inlineCss(styles))}">${escapedText}</span>`
            : escapedText;
          const href = safeRenderedHref(segment.href);
          return href
            ? `<a href="${escapeAttribute(href)}" rel="noopener noreferrer">${styledText}</a>`
            : styledText;
        }).join("");
    const marker = isBullet
      ? "• "
      : isOrdered
        ? `${listStart + lineIndex}. `
        : "";
    return `<span class="${className}">${marker}${content}</span>`;
  }).join("");
}

function safeRenderedHref(value: string | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^(?:https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (/^(?:\/|#|\.\.?\/)/.test(trimmed)) return trimmed;
  return "";
}

function flexAlignVars(props: MotionDocProps): Record<string, string> {
  const value = props.textVerticalAlign;
  if (!value) return {};

  const justifyContent = value === "bottom"
    ? "flex-end"
    : value === "middle" || value === "center"
      ? "center"
      : "flex-start";

  return {
    "display": "flex",
    "flex-direction": "column",
    "justify-content": justifyContent
  };
}

function animationClass(value: string | number | undefined) {
  if (value !== undefined && value !== "" && !isMotionDocEnterAnimation(value)) {
    throw new Error(
      `Unknown MotionDoc enter animation "${String(value)}". Expected one of: ${motionDocEnterAnimations.join(", ")}.`
    );
  }
  if (value === "none" || value === "") return "enter-none";
  if (value === "blurIn") return "enter-blur-in";
  if (value === "fadeIn") return "enter-fade-in";
  if (value === "pop") return "enter-pop";
  if (value === "reveal") return "enter-reveal";
  if (value === "rise") return "enter-rise";
  if (value === "zoomIn") return "enter-zoom-in";
  if (value === "slideLeft") return "enter-slide-left";

  return "enter-fade-up";
}

function slideTransitionClass(value: string | number | undefined) {
  if (
    value !== undefined &&
    value !== "" &&
    !isMotionDocSlideTransition(value)
  ) {
    throw new Error(
      `Unknown MotionDoc slide transition "${String(value)}". Expected one of: ${motionDocSlideTransitions.join(", ")}.`
    );
  }
  if (value === "curtain") return "slide-transition-curtain";
  if (value === "fade") return "slide-transition-fade";
  if (value === "morph") return "slide-transition-morph";
  if (value === "pushLeft") return "slide-transition-push-left";
  if (value === "rise") return "slide-transition-rise";
  if (value === "scale") return "slide-transition-scale";
  if (value === "wipe") return "slide-transition-wipe";

  return "slide-transition-none";
}

function slideLayoutProp(value: string | number | undefined): "default" | "split-left" | "split-right" {
  if (value === "split-left" || value === "split-right") {
    return value;
  }

  return "default";
}

function alignXCss(value: string | number | undefined) {
  if (value === "center") return "center";
  if (value === "right") return "flex-end";
  if (value === "stretch") return "stretch";

  return "flex-start";
}

function alignYCss(value: string | number | undefined) {
  if (value === "top") return "flex-start";
  if (value === "bottom") return "flex-end";

  return "center";
}

function textAlignCss(value: string | number | undefined) {
  if (value === "center" || value === "right") {
    return value;
  }

  return "left";
}

function numberProp(value: string | number | undefined): number | undefined;
function numberProp(value: string | number | undefined, fallback: number): number;
function numberProp(value: string | number | undefined, fallback?: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumberProp(value: string | number | undefined) {
  if (value === "" || value === undefined) {
    return undefined;
  }

  return numberProp(value);
}

function boolProp(value: string | number | undefined, fallback: boolean) {
  if (value === "false" || value === 0) return false;
  if (value === "true" || value === 1) return true;

  return fallback;
}

function isPositionedProps(props: MotionDocProps) {
  return Number.isFinite(Number(props.x)) || Number.isFinite(Number(props.y));
}

function positionVars(props: MotionDocProps): Record<string, string> {
  if (!isPositionedProps(props)) {
    return {};
  }

  return {
    "--motion-h": `${framePercent(props.h, 18)}%`,
    "--motion-x": `${framePositionPercent(props.x, 8)}%`,
    "--motion-y": `${framePositionPercent(props.y, 12)}%`,
    "--motion-w": `${framePercent(props.w, 42)}%`
  };
}

function fontSizeVars(props: MotionDocProps): Record<string, string> {
  const fontSize = numberProp(props.fontSize, 0);

  if (fontSize <= 0) {
    return {};
  }

  return {
    "--motion-font-size": `${motionDocFontPointsToCanvasPixels(fontSize)}px`
  };
}

function textStyleVars(props: MotionDocProps): Record<string, string> {
  const fontFamily = stringProp(props.fontFamily);
  const fontWeight = props.fontWeight;
  const letterSpacing = numberProp(props.letterSpacing);
  const lineHeight = motionDocLineHeightCanvasValue(props.lineHeight, props.lineHeightPt, 0);

  return {
    ...(fontFamily ? { "font-family": `"${fontFamily}", sans-serif` } : {}),
    ...(props.fontStyle === "italic" ? { "font-style": "italic" } : {}),
    ...(fontWeight === undefined || fontWeight === "" ? {} : { "--motion-font-weight": String(fontWeight) }),
    ...(letterSpacing === undefined ? {} : { "--motion-letter-spacing": `${motionDocFontPointsToCanvasPixels(letterSpacing)}px` }),
    ...(lineHeight === 0 ? {} : { "--motion-line-height": String(lineHeight) })
  };
}

function radiusVars(props: MotionDocProps): Record<string, string> {
  const value = props.radius ?? props.borderRadius;

  if (value === undefined || value === "") {
    return {};
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (Number.isFinite(parsed)) {
    return { "--motion-radius": `${Math.max(parsed, 0)}px` };
  }

  return { "--motion-radius": String(value) };
}

function colorVars(props: MotionDocProps): Record<string, string> {
  const background = stringProp(props.background ?? props.backgroundColor ?? props.bg);
  const color = stringProp(props.color ?? props.textColor);
  const mutedColor = stringProp(props.mutedColor);

  return {
    ...(background ? { "--motion-bg": background } : {}),
    ...(background ? { "--motion-text-padding": "0.12em 0.18em" } : {}),
    ...(color ? { "--motion-fg": color } : {}),
    ...(mutedColor || color ? { "--motion-muted": mutedColor ?? color } : {})
  };
}

function textAlignVars(props: MotionDocProps): Record<string, string> {
  if (props.textAlign === "center" || props.textAlign === "right") {
    return { "--motion-text-align": props.textAlign };
  }

  if (props.textAlign === "left") {
    return { "--motion-text-align": "left" };
  }

  return {};
}

function stringProp(value: string | number | undefined) {
  const stringValue = typeof value === "string" ? value.trim() : "";
  return stringValue || undefined;
}

function framePercent(value: string | number | undefined, fallbackPercent: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return roundValue(fallbackPercent);
  }

  return roundValue(Math.min(Math.max(parsed, 0), 200));
}

function framePositionPercent(value: string | number | undefined, fallbackPercent: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return roundValue(fallbackPercent);
  }

  return roundValue(Math.min(Math.max(parsed, -100), 100));
}

function roundValue(value: number) {
  return Math.round(value * 100) / 100;
}

function fitProp(value: string | number | undefined) {
  if (value === "cover" || value === "contain" || value === "fill" || value === "scale-down") {
    return value;
  }

  return "cover";
}

function shaderFitProp(value: string) {
  if (value === "contain" || value === "scale-down") {
    return "contain";
  }

  return "cover";
}

function backgroundSizeFromFit(value: string | undefined) {
  if (value === "contain" || value === "scale-down") {
    return "contain";
  }

  if (value === "fill") {
    return "100% 100%";
  }

  return "cover";
}

function clampExportImageScale(value: number | undefined) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(value ?? 1, 0.1), 8);
}

function clampExportImageCropPosition(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value ?? 0, -350), 350);
}

function cssImageUrl(value: string) {
  return `url("${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}

function renderShapeSvg(props: MotionDocProps, blockIndex: number) {
  const fill = stringProp(props.fill) ?? "rgba(142,165,255,0.72)";
  const mask = stringProp(props.mask) ?? "none";
  const operation = stringProp(props.operation) ?? "none";
  const shape = stringProp(props.shape) ?? "rectangle";
  const stroke = stringProp(props.stroke) ?? "#ffffff";
  const strokeWidth = numberProp(props.strokeWidth, 2);
  const opacity = Math.min(Math.max(numberProp(props.opacity, 1), 0), 1);
  const sides = Math.min(Math.max(Math.round(numberProp(props.sides, 3)), 3), 12);
  const points = Math.min(Math.max(Math.round(numberProp(props.points, 5)), 3), 12);
  const frameWidth = percentFrameValue(props.w, 28) / 100 * MOTION_DOC_CANVAS_WIDTH;
  const frameHeight = percentFrameValue(props.h, 28) / 100 * MOTION_DOC_CANVAS_HEIGHT;
  const radius = Math.max(numberProp(props.radius ?? props.borderRadius, 0), 0);
  const corner = Math.max(numberProp(props.corner, 0), 0);
  const { radiusX, radiusY } = corner > 0
    ? normalizedRelativeCornerRadii(corner, frameWidth, frameHeight)
    : normalizedContinuousCornerRadii(radius, frameWidth, frameHeight);
  const maskId = `shape-mask-${blockIndex}-${String(shape).replace(/[^a-z0-9]+/gi, "-")}-${String(mask).replace(/[^a-z0-9]+/gi, "-")}`;
  const imageClipId = `${maskId}-image-clip`;
  const shapeImageSrc = stringProp(props.shapeImageSrc);
  if (shapeImageSrc && shape !== "line") {
    const { shapeImageSrc: _shapeImageSrc, ...shapeVectorProps } = props;
    return renderShapeVectorSvg(
      { ...shapeVectorProps, fill: "transparent" },
      `html-shape-${blockIndex}`
    );
  }
  const shapeImageFit = stringProp(props.shapeImageFit) ?? "cover";
  const shapeImageScaleX = Math.min(Math.max(numberProp(props.shapeImageScaleX, 1), 0.1), 8);
  const shapeImageScaleY = Math.min(Math.max(numberProp(props.shapeImageScaleY, 1), 0.1), 8);
  const shapeImageCropX = numberProp(props.shapeImageCropX, 0);
  const shapeImageCropY = numberProp(props.shapeImageCropY, 0);
  const maskDefs = mask === "alpha"
    ? `<linearGradient id="${maskId}-fade" x1="0" x2="1" y1="0" y2="0"><stop offset="0%" stop-color="white" stop-opacity="0.15" /><stop offset="45%" stop-color="white" stop-opacity="1" /><stop offset="100%" stop-color="white" stop-opacity="0.2" /></linearGradient><mask id="${maskId}"><rect width="100" height="100" fill="url(#${maskId}-fade)" /></mask>`
    : mask === "luma"
      ? `<radialGradient id="${maskId}-radial" cx="50%" cy="45%" r="58%"><stop offset="0%" stop-color="white" stop-opacity="1" /><stop offset="100%" stop-color="white" stop-opacity="0.08" /></radialGradient><mask id="${maskId}"><rect width="100" height="100" fill="url(#${maskId}-radial)" /></mask>`
      : mask === "clip"
        ? `<mask id="${maskId}"><rect fill="white" height="72" rx="14" width="72" x="14" y="14" /></mask>`
        : "";
  const imageClipDef = shapeImageSrc && shape !== "line"
    ? `<clipPath id="${imageClipId}">${shapeSvg(shape, "white", "none", 0, sides, points, "solid", "none", "none", radiusX, radiusY)}</clipPath>`
    : "";
  const maskAttr = mask === "none" ? "" : ` mask="url(#${maskId})"`;
  const imageLayer = shapeImageSrc && shape !== "line"
    ? `<image clip-path="url(#${imageClipId})" href="${escapeAttribute(shapeImageSrc)}" preserveAspectRatio="${shapeImageFit === "contain" ? "xMidYMid meet" : "xMidYMid slice"}" x="${50 - 50 * shapeImageScaleX + shapeImageCropX}" y="${50 - 50 * shapeImageScaleY + shapeImageCropY}" width="${100 * shapeImageScaleX}" height="${100 * shapeImageScaleY}" />`
    : "";
  const booleanLayer = operation === "subtract"
    ? `<circle cx="68" cy="34" fill="var(--slide-bg, #030303)" r="22" />`
    : operation === "intersect"
      ? `<circle cx="62" cy="44" fill="${escapeAttribute(fill)}" opacity="0.45" r="30" stroke="${escapeAttribute(stroke)}" stroke-width="${strokeWidth}" />`
      : operation === "exclude"
        ? `<circle cx="62" cy="44" fill="transparent" opacity="0.9" r="30" stroke="${escapeAttribute(stroke)}" stroke-dasharray="7 7" stroke-width="${strokeWidth}" />`
        : "";

  const lineEndpoints = shape === "line" ? `${renderLineEndpoint(stringProp(props.arrowStart) ?? "none", "start", stroke, numberProp(props.arrowStartSize, 100))}${renderLineEndpoint(stringProp(props.arrowEnd) ?? "none", "end", stroke, numberProp(props.arrowEndSize, 100))}` : "";
  return `<svg aria-hidden="true" preserveAspectRatio="none" viewBox="${shape === "line" ? "0 0 100 20" : "0 0 100 100"}" style="${escapeAttribute(inlineCss({ opacity: String(opacity) }))}"><defs>${maskDefs}${imageClipDef}</defs><g${maskAttr}>${imageLayer}${shapeSvg(shape, imageLayer ? "transparent" : fill, stroke, strokeWidth, sides, points, stringProp(props.lineStyle) ?? "solid", stringProp(props.arrowStart) ?? "none", stringProp(props.arrowEnd) ?? "none", radiusX, radiusY)}${booleanLayer}</g></svg>${lineEndpoints}`;
}

function renderShapeHtmlFallback(props: MotionDocProps) {
  const fill = stringProp(props.fill) ?? "rgba(142,165,255,0.72)";
  const shape = stringProp(props.shape) ?? "rectangle";
  const stroke = stringProp(props.stroke) ?? "#ffffff";
  const strokeWidth = Math.max(numberProp(props.strokeWidth, 2), 0);
  const opacity = Math.min(Math.max(numberProp(props.opacity, 1), 0), 1);
  const radius = Math.max(
    numberProp(props.radius ?? props.borderRadius, 0),
    0
  );
  const resolvedStroke = stroke === "transparent" ? fill : stroke;
  const shapeImageSrc = stringProp(props.shapeImageSrc);
  const shapeImageFit = stringProp(props.shapeImageFit) ?? "cover";
  const shapeImageScales = normalizedImageScales(
    shapeImageFit,
    props.shapeImageScaleX,
    props.shapeImageScaleY
  );
  const baseStyle: Record<string, string> = {
    inset: "0",
    opacity: String(opacity),
    position: "absolute"
  };

  if (shape === "line") {
    const lineStyle = stringProp(props.lineStyle) ?? "solid";
    return `<span aria-hidden="true" class="shape-html-fallback" style="${escapeAttribute(
      inlineCss({
        ...baseStyle,
        "border-top": `${Math.max(strokeWidth, 1)}px ${lineStyle} ${resolvedStroke}`,
        height: "0",
        top: "50%"
      })
    )}"></span>`;
  }

  const clipPath = shape === "triangle" || shape === "polygon"
    ? "polygon(50% 0, 100% 100%, 0 100%)"
    : shape === "diamond"
      ? "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)"
      : shape === "chevron"
        ? "polygon(0 0, 68% 0, 100% 50%, 68% 100%, 0 100%, 32% 50%)"
        : shape === "parallelogram"
          ? "polygon(18% 0, 100% 0, 82% 100%, 0 100%)"
          : shape === "arrow"
            ? "polygon(0 20%, 60% 20%, 60% 0, 100% 50%, 60% 100%, 60% 80%, 0 80%)"
            : shape === "star"
              ? "polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 94%, 50% 72%, 21% 94%, 32% 57%, 2% 35%, 39% 35%)"
              : undefined;
  const border =
    strokeWidth > 0 && stroke !== "transparent"
      ? `${strokeWidth}px solid ${stroke}`
      : "none";

  const imageContent = shapeImageSrc
    ? `<img alt="" src="${escapeAttribute(shapeImageSrc)}" style="${escapeAttribute(inlineCss({
        height: "100%",
        inset: "0",
        "object-fit": shapeImageFit === "contain" || shapeImageFit === "scale-down" ? "contain" : "cover",
        position: "absolute",
        transform: `translate(${numberProp(props.shapeImageCropX, 0)}%, ${numberProp(props.shapeImageCropY, 0)}%) scale(${shapeImageScales.scaleX}, ${shapeImageScales.scaleY})`,
        "transform-origin": "center",
        width: "100%"
      }))}" />`
    : "";

  return `<span aria-hidden="true" class="shape-html-fallback" style="${escapeAttribute(
    inlineCss({
      ...baseStyle,
      ...(!shapeImageSrc ? { background: fill } : {}),
      border,
      "border-radius": shape === "circle" ? "50%" : `${radius}px`,
      overflow: "hidden",
      ...(clipPath ? { "clip-path": clipPath } : {})
    })
  )}">${imageContent}</span>`;
}

function renderLineEndpoint(endpoint: string, side: "end" | "start", stroke: string, size: number) {
  if (endpoint === "none" || !endpoint) return "";
  const color = stroke === "transparent" ? "#e5e7eb" : stroke;
  const scale = Math.min(Math.max(size, 25), 300) / 100;
  const geometry = endpoint === "circle"
    ? `<circle cx="10" cy="10" fill="${escapeAttribute(color)}" r="9"/>`
    : endpoint === "bar"
      ? `<path d="M10 1V19" fill="none" stroke="${escapeAttribute(color)}" stroke-linecap="round" stroke-width="3" vector-effect="non-scaling-stroke"/>`
      : `<path d="${side === "start" ? "M19 1L1 10 19 19Z" : "M1 1L19 10 1 19Z"}" fill="${escapeAttribute(color)}"/>`;
  const width = endpoint === "bar" ? 4 * scale : endpoint === "circle" ? 10 * scale : 11 * scale;
  const height = endpoint === "bar" ? 16 * scale : endpoint === "circle" ? 10 * scale : 12 * scale;
  return `<svg aria-hidden="true" class="shape-line-vector-endpoint shape-line-vector-endpoint--${side}" preserveAspectRatio="none" viewBox="0 0 20 20" style="${escapeAttribute(inlineCss({ height: `${height}px`, width: `${width}px` }))}">${geometry}</svg>`;
}

function shapeSvg(shape: string, fill: string, stroke: string, strokeWidth: number, sides: number, points: number, lineStyle: string, arrowStart: string, arrowEnd: string, radiusX: number, radiusY: number) {
  if (shape === "circle") {
    return `<circle cx="50" cy="50" fill="${escapeAttribute(fill)}" r="48" stroke="${escapeAttribute(stroke)}" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke" />`;
  }

  if (shape === "triangle" || shape === "polygon") {
    return `<path d="${escapeAttribute(shapePolygonPath(shape === "triangle" ? 3 : sides))}" fill="${escapeAttribute(fill)}" stroke="${escapeAttribute(stroke)}" stroke-linejoin="round" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke" />`;
  }

  if (shape === "line") {
    const resolvedStroke = escapeAttribute(stroke === "transparent" ? "#e5e7eb" : stroke);
    const dash = lineStyle === "dashed" ? ` stroke-dasharray="8 6"` : lineStyle === "dotted" ? ` stroke-dasharray="1 6"` : "";
    const isPlainLine = arrowStart === "none" && arrowEnd === "none";
    return `<g stroke="${resolvedStroke}" stroke-linecap="${isPlainLine && lineStyle === "solid" ? "butt" : "round"}" stroke-linejoin="round" stroke-width="${strokeWidth}"><path d="M0 10H100" fill="none"${dash} vector-effect="non-scaling-stroke" /></g>`;
  }

  if (shape === "arrow") {
    const arrowStroke = escapeAttribute(stroke === "transparent" ? fill : stroke);
    return `<path d="M2 22H58V2L98 50 58 98V78H2Z" fill="${escapeAttribute(fill)}" stroke="${arrowStroke}" stroke-linejoin="round" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke" />`;
  }

  if (shape === "star") {
    return `<path d="${escapeAttribute(generateStarPath(points))}" fill="${escapeAttribute(fill)}" stroke="${escapeAttribute(stroke)}" stroke-linejoin="round" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke" />`;
  }

  const customPaths: Record<string, string> = {
    chevron: "M1 1H68L99 50 68 99H1L32 50Z",
    corner: "M1 1H72L99 28V99H1Z",
    diamond: "M50 1L99 50 50 99 1 50Z",
    hexagon: "M20 1H80L99 50 80 99H20L1 50Z",
    parallelogram: "M24 1H99L76 99H1Z"
  };
  if (customPaths[shape]) return `<path d="${customPaths[shape]}" fill="${escapeAttribute(fill)}" stroke="${escapeAttribute(stroke)}" stroke-linejoin="round" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke" />`;

  if (radiusX <= 0 || radiusY <= 0) {
    return `<rect fill="${escapeAttribute(fill)}" height="100" stroke="${escapeAttribute(stroke)}" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke" width="100" x="0" y="0" />`;
  }

  return `<path d="${continuousRoundedRectPath({ height: 100, radiusX, radiusY, width: 100 })}" fill="${escapeAttribute(fill)}" stroke="${escapeAttribute(stroke)}" stroke-linejoin="round" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke" />`;
}

function generateStarPath(points: number, cx = 50, cy = 50, outerR = 48) {
  const innerR = outerR * 0.42;
  const angleOffset = -Math.PI / 2;
  const vertices: string[] = [];

  for (let index = 0; index < points * 2; index += 1) {
    const angle = angleOffset + (2 * Math.PI * index) / (points * 2);
    const radius = index % 2 === 0 ? outerR : innerR;
    vertices.push(`${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`);
  }

  return `M${vertices.join(" L")} Z`;
}

function inlineCss(styles: Record<string, string>) {
  return Object.entries(styles)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function escapeCdata(value: string) {
  return value.replaceAll("]]>", "]]]]><![CDATA[>");
}

export function slugifyFilename(name: string) {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "slidex-deck";
}
