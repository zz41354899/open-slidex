import {
  DEFAULT_DARK_SHADER_PALETTE,
  DEFAULT_SHADER_CONTROLS
} from "@/core/motion-doc/application/shaders/shaderDefaults";
import { paperImageFilterRuntimePresetTable } from "@/core/motion-doc/application/shaders/paperImageFilterCatalog";
import {
  PAPER_SHADER_MAX_COLORS,
  PAPER_SHADER_VERTEX
} from "@/core/motion-doc/application/shaders/paperShaderProgram";
import { paperShaderRuntimePresetTable } from "@/core/motion-doc/application/shaders/paperShaderCatalog";
import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";
import {
  swirlFragmentShader,
  meshGradientFragmentShader,
  staticMeshGradientFragmentShader,
  gemSmokeFragmentShader,
  ditheringFragmentShader,
  imageDitheringFragmentShader,
  dotOrbitFragmentShader,
  godRaysFragmentShader,
  neuroNoiseFragmentShader,
  liquidMetalFragmentShader,
  grainGradientFragmentShader,
  metaballsFragmentShader,
  paperTextureFragmentShader,
  flutedGlassFragmentShader,
  waterFragmentShader,
  heatmapFragmentShader,
  halftoneDotsFragmentShader,
  halftoneCmykFragmentShader
} from "@paper-design/shaders";

function escapeRuntimeTemplateLiteral(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

const runtimeVertexShader = escapeRuntimeTemplateLiteral(PAPER_SHADER_VERTEX);
const escapedSwirl = escapeRuntimeTemplateLiteral(swirlFragmentShader);
const escapedMeshGradient = escapeRuntimeTemplateLiteral(meshGradientFragmentShader);
const escapedStaticMeshGradient = escapeRuntimeTemplateLiteral(staticMeshGradientFragmentShader);
const escapedGemSmoke = escapeRuntimeTemplateLiteral(gemSmokeFragmentShader);
const escapedDithering = escapeRuntimeTemplateLiteral(ditheringFragmentShader);
const escapedImageDithering = escapeRuntimeTemplateLiteral(imageDitheringFragmentShader);
const escapedDotOrbit = escapeRuntimeTemplateLiteral(dotOrbitFragmentShader);
const escapedGodRays = escapeRuntimeTemplateLiteral(godRaysFragmentShader);
const escapedNeuroNoise = escapeRuntimeTemplateLiteral(neuroNoiseFragmentShader);
const escapedLiquidMetal = escapeRuntimeTemplateLiteral(liquidMetalFragmentShader);
const escapedGrainGradient = escapeRuntimeTemplateLiteral(grainGradientFragmentShader);
const escapedMetaballs = escapeRuntimeTemplateLiteral(metaballsFragmentShader);
const escapedPaperTexture = escapeRuntimeTemplateLiteral(paperTextureFragmentShader);
const escapedFlutedGlass = escapeRuntimeTemplateLiteral(flutedGlassFragmentShader);
const escapedWater = escapeRuntimeTemplateLiteral(waterFragmentShader);
const escapedHeatmap = escapeRuntimeTemplateLiteral(heatmapFragmentShader);
const escapedHalftoneDots = escapeRuntimeTemplateLiteral(halftoneDotsFragmentShader);
const escapedHalftoneCmyk = escapeRuntimeTemplateLiteral(halftoneCmykFragmentShader);
const escapedPaperShaderRuntimePresets = escapeRuntimeTemplateLiteral(JSON.stringify(paperShaderRuntimePresetTable()));
const escapedPaperImageFilterRuntimePresets = escapeRuntimeTemplateLiteral(JSON.stringify(paperImageFilterRuntimePresetTable()));

export function makeMotionDocExportRuntime() {
  return `      (() => {
        const slides = Array.from(document.querySelectorAll(".slide"));
        const progress = document.querySelector(".progress span");
        const current = document.querySelector("[data-current]");
        const playButton = document.querySelector('[data-action="play"]');
        const fullscreenButton = document.querySelector('[data-action="fullscreen"]');
        const dotButtons = Array.from(document.querySelectorAll("[data-slide-target]"));
        const player = document.querySelector(".player");
        const stage = document.querySelector(".stage");
        const viewport = document.querySelector(".viewport");
        let index = 0;
        let timer = null;
        let interactionHintTimer = null;
        let motionController = null;
        let morphCleanup = null;
        const DESIGN_WIDTH = ${MOTION_DOC_CANVAS_WIDTH};
        const DESIGN_HEIGHT = ${MOTION_DOC_CANVAS_HEIGHT};

        function hydrateYouTubeEmbeds() {
          const canEmbed = window.location.protocol === "http:" || window.location.protocol === "https:";

          document.querySelectorAll("[data-youtube-embed]").forEach((container) => {
            const iframe = container.querySelector("iframe[data-youtube-src]");
            const source = iframe?.dataset.youtubeSrc;

            if (!iframe || !source || !canEmbed) {
              iframe?.remove();
              container.dataset.youtubeMode = "link";
              return;
            }

            container.dataset.youtubeMode = "embed";
            iframe.src = source;
          });
        }

        function sanitizeSvgMarkup(markup) {
          const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
          const svg = parsed.documentElement;
          if (!svg || svg.localName !== "svg" || parsed.querySelector("parsererror")) return null;
          svg.querySelectorAll("script,foreignObject,iframe,object,embed,audio,video,animate,animateMotion,animateTransform,set,mpath").forEach((node) => node.remove());
          svg.querySelectorAll("*").forEach((node) => {
            Array.from(node.attributes).forEach((attribute) => {
              const name = attribute.name.toLowerCase();
              const value = attribute.value.trim();
              if (name.startsWith("on") || /javascript\\s*:/i.test(value)) node.removeAttribute(attribute.name);
              if ((name === "href" || name === "xlink:href") && value && !value.startsWith("#")) node.removeAttribute(attribute.name);
            });
          });
          svg.querySelectorAll("style").forEach((node) => {
            if (/@import|url\\(\\s*[\"']?(?!#)/i.test(node.textContent || "")) node.remove();
          });
          svg.setAttribute("width", "100%");
          svg.setAttribute("height", "100%");
          if (!svg.getAttribute("preserveAspectRatio")) svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
          return svg;
        }

        async function hydrateSvgBlocks() {
          const surfaces = Array.from(document.querySelectorAll(".block-svg-stage[data-svg-src]"));
          await Promise.all(surfaces.map(async (surface) => {
            const source = surface.dataset.svgSrc;
            if (!source) return;
            try {
              const response = await fetch(source);
              if (!response.ok) return;
              const svg = sanitizeSvgMarkup(await response.text());
              if (!svg) return;
              surface.replaceChildren(document.importNode(svg, true));
              surface.dataset.svgReady = "true";
            } catch {}
          }));
        }

        function svgGeometryLength(element) {
          try { return Math.max(1, element.getTotalLength()); } catch { return 1; }
        }

        const svgSwayAnimations = new WeakMap();

        function applySvgStage(surface, stage, duration, easing, replay) {
          if (!surface || surface.dataset.svgReady !== "true") return;
          const safeStage = Number.isFinite(Number(stage)) ? Number(stage) : 0;
          const safeDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : Math.min(Math.max(Number(duration) || 0, 0), 30);
          const safeEasing = /^(?:linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\\([\\d.,\\s-]+\\))$/.test(easing || "") ? easing : "ease-in-out";
          const targets = Array.from(surface.querySelectorAll("[data-stage]"));
          const paintMotion = (element, motions, visible, delay) => {
            element.style.transition = safeDuration > 0
              ? "opacity " + safeDuration + "s " + safeEasing + " " + delay + "s, transform " + safeDuration + "s " + safeEasing + " " + delay + "s, stroke-dashoffset " + safeDuration + "s " + safeEasing + " " + delay + "s"
              : "none";
            if (motions.has("draw") && typeof element.getTotalLength === "function") {
              const length = svgGeometryLength(element);
              element.style.strokeDasharray = String(length);
              element.style.strokeDashoffset = visible ? "0" : String(length);
            }
            if (motions.has("reveal") || motions.has("scale")) element.style.opacity = visible ? "1" : "0";
            if (motions.has("scale")) {
              element.style.transformBox = "fill-box";
              element.style.transformOrigin = "center";
              element.style.transform = visible ? "scale(1)" : "scale(.82)";
            }
            svgSwayAnimations.get(element)?.cancel();
            svgSwayAnimations.delete(element);
            if (motions.has("sway") && visible && safeDuration > 0) {
              const animation = element.animate?.([{ rotate: "-1.25deg" }, { rotate: "1.25deg" }, { rotate: "-1.25deg" }], {
                duration: 3600,
                easing: "ease-in-out",
                iterations: Infinity
              });
              if (animation) svgSwayAnimations.set(element, animation);
            }
          };
          const paint = (hideCurrent) => targets.forEach((element) => {
            const threshold = Number(element.dataset.stage || 0);
            const visible = safeStage >= threshold && !(hideCurrent && safeStage === threshold);
            const motions = new Set((element.dataset.motion || "reveal").split(/[\\s,]+/).filter(Boolean));
            if (motions.has("stagger")) {
              const children = Array.from(element.children).filter((child) => child instanceof SVGElement);
              const childMotions = new Set(motions);
              childMotions.delete("stagger");
              if (!childMotions.size) childMotions.add("reveal");
              element.style.opacity = "1";
              element.style.transition = "none";
              children.forEach((child, childIndex) => {
                const delay = childIndex * Math.min(.12, safeDuration / Math.max(children.length, 1));
                paintMotion(child, childMotions, visible, delay);
              });
              return;
            }
            paintMotion(element, motions, visible, 0);
          });
          if (!replay || safeDuration <= 0) return paint(false);
          paint(true);
          requestAnimationFrame(() => requestAnimationFrame(() => paint(false)));
        }

        function renderSvgScenes(slideIndex, replay) {
          const activeSlide = slides[slideIndex];
          activeSlide?.querySelectorAll(".block-svg-stage").forEach((surface) => {
            applySvgStage(surface, surface.dataset.svgStage, surface.dataset.svgStageDuration, surface.dataset.svgEasing, replay);
          });
          document.querySelectorAll(".shared-svg-scene").forEach((scene) => {
            let declarations = [];
            try { declarations = JSON.parse(scene.dataset.svgSharedDeclarations || "[]"); } catch {}
            const declaration = declarations.find((item) => Number(item.slideIndex) === slideIndex);
            scene.classList.toggle("is-active", Boolean(declaration));
            if (!declaration) return;
            const duration = Math.min(Math.max(Number(declaration.stageDuration) || .6, 0), 30);
            const requestedEasing = declaration.easing || "ease-in-out";
            const easing = /^(?:linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\\([\\d.,\\s-]+\\))$/.test(requestedEasing) ? requestedEasing : "ease-in-out";
            scene.style.transition = "left " + duration + "s " + easing + ", top " + duration + "s " + easing + ", width " + duration + "s " + easing + ", height " + duration + "s " + easing + ", opacity 120ms ease-out";
            scene.style.left = declaration.x + "%";
            scene.style.top = declaration.y + "%";
            scene.style.width = declaration.w + "%";
            scene.style.height = declaration.h + "%";
            const surface = scene.querySelector(".block-svg-stage");
            applySvgStage(surface, declaration.stage, duration, easing, replay);
          });
        }

        function postHtmlPage(frame, page, replay) {
          frame?.contentWindow?.postMessage({ page: Math.max(1, Math.floor(Number(page) || 1)), replay: Boolean(replay), type: "open-slidex:html-page" }, "*");
        }

        function renderHtmlScenes(slideIndex, replay) {
          const activeSlide = slides[slideIndex];
          activeSlide?.querySelectorAll(".block-html-embed").forEach((frame) => postHtmlPage(frame, frame.dataset.htmlPage, replay));
          document.querySelectorAll(".shared-html-scene").forEach((scene) => {
            let declarations = [];
            try { declarations = JSON.parse(scene.dataset.htmlSharedDeclarations || "[]"); } catch {}
            const declaration = declarations.find((item) => Number(item.slideIndex) === slideIndex);
            scene.classList.toggle("is-active", Boolean(declaration));
            if (!declaration) return;
            scene.style.left = declaration.x + "%";
            scene.style.top = declaration.y + "%";
            scene.style.width = declaration.w + "%";
            scene.style.height = declaration.h + "%";
            postHtmlPage(scene.querySelector(".block-html-embed"), declaration.page, replay);
          });
        }

        window.addEventListener("message", (event) => {
          const frames = Array.from(document.querySelectorAll(".block-html-embed"));
          const frame = frames.find((candidate) => candidate.contentWindow === event.source);
          if (!frame || !event.data) return;
          if (event.data.type === "open-slidex:html-ready") {
            renderHtmlScenes(index, false);
            return;
          }
          if (event.data.type !== "open-slidex:html-page-change" || !Number.isInteger(event.data.page)) return;
          const scene = frame.closest(".shared-html-scene");
          if (!scene) return;
          let declarations = [];
          try { declarations = JSON.parse(scene.dataset.htmlSharedDeclarations || "[]"); } catch {}
          const declaration = declarations.find((item) => Number(item.page) === event.data.page);
          if (declaration && Number(declaration.slideIndex) !== index) {
            stop();
            render(Number(declaration.slideIndex));
          }
        });

        function croppedImageDimensions(fit, frameAspectRatio, imageAspectRatio) {
          if (!imageAspectRatio || fit === "fill") return { height: 100, width: 100 };
          const useContain = fit === "contain" || fit === "scale-down";
          const imageIsWider = imageAspectRatio > frameAspectRatio;
          const widthFromFullHeight = imageAspectRatio / frameAspectRatio * 100;
          const heightFromFullWidth = frameAspectRatio / imageAspectRatio * 100;

          if (useContain) {
            return imageIsWider
              ? { height: heightFromFullWidth, width: 100 }
              : { height: 100, width: widthFromFullHeight };
          }

          return imageIsWider
            ? { height: 100, width: widthFromFullHeight }
            : { height: heightFromFullWidth, width: 100 };
        }

        function croppedImageNumber(value, fallback, minimum, maximum) {
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) return fallback;
          return Math.min(Math.max(parsed, minimum), maximum);
        }

        function clampCroppedImagePosition(value, scaledImageSize) {
          const minimum = 50 - scaledImageSize / 2;
          const maximum = -50 + scaledImageSize / 2;
          if (minimum <= maximum) return Math.min(Math.max(value, minimum), maximum);
          return (minimum + maximum) / 2;
        }

        function layoutCroppedImageMedia(media, restartFilter) {
          const image = media.querySelector(".block-image__crop-image");
          const frame = media.parentElement;
          if (!image || !frame || image.naturalWidth <= 0 || image.naturalHeight <= 0) return false;

          const rect = frame.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return false;

          const fit = media.dataset.imageFit || "cover";
          let scaleX = croppedImageNumber(media.dataset.imageScaleX, 1, 0.1, 8);
          let scaleY = croppedImageNumber(media.dataset.imageScaleY, 1, 0.1, 8);
          if (fit !== "fill") {
            const uniformScale = Math.max(scaleX, scaleY);
            scaleX = uniformScale;
            scaleY = uniformScale;
          }
          const dimensions = croppedImageDimensions(
            fit,
            rect.width / rect.height,
            image.naturalWidth / image.naturalHeight
          );
          let cropX = croppedImageNumber(media.dataset.imageCropX, 0, -350, 350);
          let cropY = croppedImageNumber(media.dataset.imageCropY, 0, -350, 350);

          if (fit === "cover") {
            cropX = clampCroppedImagePosition(cropX, dimensions.width * scaleX);
            cropY = clampCroppedImagePosition(cropY, dimensions.height * scaleY);
          }

          media.querySelectorAll(".block-image__crop-image, .block-image__crop-filter").forEach((surface) => {
            surface.style.width = dimensions.width + "%";
            surface.style.height = dimensions.height + "%";
          });
          media.style.transform = "translate(" + cropX + "%, " + cropY + "%) scale(" + scaleX + ", " + scaleY + ")";
          media.dataset.imageLayoutReady = "true";

          if (restartFilter) {
            const canvas = media.querySelector("canvas.image-filter-canvas");
            if (canvas) {
              stopShader(canvas);
              startShader(canvas);
            }
          }

          return true;
        }

        function layoutCroppedImages(root, restartFilters = false) {
          root.querySelectorAll(".block-image__crop-media").forEach((media) => {
            if (layoutCroppedImageMedia(media, restartFilters)) return;
            const image = media.querySelector(".block-image__crop-image");
            if (!image || media.dataset.imageLayoutPending === "true") return;
            media.dataset.imageLayoutPending = "true";
            image.addEventListener("load", () => {
              delete media.dataset.imageLayoutPending;
              layoutCroppedImageMedia(media, true);
            }, { once: true });
          });
        }

        function updateFrameScale() {
          if (!viewport) return;
          const host = stage || viewport.parentElement || document.body;
          const rect = host.getBoundingClientRect();
          const style = window.getComputedStyle(host);
          const paddingX = parseFloat(style.paddingLeft || "0") + parseFloat(style.paddingRight || "0");
          const paddingY = parseFloat(style.paddingTop || "0") + parseFloat(style.paddingBottom || "0");
          const availableWidth = Math.max(1, rect.width - paddingX);
          const availableHeight = Math.max(1, rect.height - paddingY);
          const scale = Math.max(0.05, Math.min(availableWidth / DESIGN_WIDTH, availableHeight / DESIGN_HEIGHT));

          viewport.style.setProperty("--frame-scale", "1");
          viewport.style.setProperty("--viewport-scale", String(scale));
          viewport.style.setProperty("--export-viewport-width", Math.round(DESIGN_WIDTH * scale * 100) / 100 + "px");
          viewport.style.setProperty("--export-viewport-height", Math.round(DESIGN_HEIGHT * scale * 100) / 100 + "px");
        }

        const MOTION_EASING = { linear: "linear", easeIn: "ease-in", easeOut: "ease-out", easeInOut: "ease-in-out", smooth: "cubic-bezier(.45,0,.2,1)", emphasized: "cubic-bezier(.2,0,0,1)", spring: "cubic-bezier(.18,.9,.22,1.18)", backOut: "cubic-bezier(.34,1.56,.64,1)" };

        function parseMotionSequence(element) {
          try {
            const value = JSON.parse(element.dataset.motionSequence || "");
            if (!value || value.version !== 1 || !Array.isArray(value.actions)) return null;
            return value.actions.slice().sort((a, b) => Number(a.order) - Number(b.order));
          } catch { return null; }
        }

        function tweenMotionState(from, to, progress, path) {
          const mix = (a, b) => Number(a) + (Number(b) - Number(a)) * progress;
          let x = mix(from.x, to.x);
          let y = mix(from.y, to.y);
          const w = mix(from.w, to.w);
          const h = mix(from.h, to.h);
          if (path) {
            const inverse = 1 - progress;
            x = inverse * inverse * (Number(from.x) + Number(from.w) / 2) + 2 * inverse * progress * Number(path.controlX) + progress * progress * (Number(to.x) + Number(to.w) / 2) - w / 2;
            y = inverse * inverse * (Number(from.y) + Number(from.h) / 2) + 2 * inverse * progress * Number(path.controlY) + progress * progress * (Number(to.y) + Number(to.h) / 2) - h / 2;
          }
          return { x, y, w, h, rotation: mix(from.rotation, to.rotation), opacity: mix(from.opacity, to.opacity) };
        }

        function motionStateFrame(state) {
          return { left: state.x + "%", top: state.y + "%", width: state.w + "%", height: state.h + "%", rotate: state.rotation + "deg", opacity: state.opacity };
        }

        function easedMotionProgress(value, easing) {
          const progress = Math.min(1, Math.max(0, value));
          if (easing === "linear") return progress;
          if (easing === "easeIn") return progress * progress * progress;
          if (easing === "easeOut") return 1 - Math.pow(1 - progress, 3);
          return progress < .5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        }

        function motionNumberValue(range, progress, easing) {
          if (progress <= 0) return Number(range.from);
          if (progress >= 1) return Number(range.to);
          const from = Number(range.from);
          const to = Number(range.to);
          const step = Number(range.step);
          const raw = from + (to - from) * easedMotionProgress(progress, easing);
          const direction = to >= from ? 1 : -1;
          const snapped = from + direction * Math.floor(Math.abs(raw - from) / step) * step;
          return Math.min(Math.max(snapped, Math.min(from, to)), Math.max(from, to));
        }

        function formatMotionNumber(value, range) {
          const precision = Math.min(6, Math.max(...[range.from, range.to, range.step].map((entry) => {
            const text = String(entry).toLowerCase();
            if (text.includes("e-")) return Number(text.split("e-")[1]) || 0;
            return text.includes(".") ? (text.split(".")[1] || "").length : 0;
          })));
          return new Intl.NumberFormat("en-US", { minimumFractionDigits: precision, maximumFractionDigits: precision }).format(Number(value.toFixed(precision)));
        }

        function enterFrames(preset) {
          if (preset === "fadeUp" || preset === "rise") return [{ opacity: 0, transform: "translateY(28px)" }, { opacity: 1, transform: "translateY(0)" }];
          if (preset === "slideLeft") return [{ opacity: 0, transform: "translateX(52px)" }, { opacity: 1, transform: "translateX(0)" }];
          if (preset === "zoomIn") return [{ opacity: 0, transform: "scale(.86)" }, { opacity: 1, transform: "scale(1)" }];
          if (preset === "pop") return [{ opacity: 0, transform: "scale(.72)" }, { opacity: 1, transform: "scale(1)" }];
          if (preset === "blurIn") return [{ filter: "blur(16px)", opacity: 0 }, { filter: "blur(0)", opacity: 1 }];
          if (preset === "reveal") return [{ clipPath: "inset(0 100% 0 0)", opacity: 0 }, { clipPath: "inset(0 0 0 0)", opacity: 1 }];
          return [{ opacity: 0 }, { opacity: 1 }];
        }

        function exitFrames(preset) {
          if (preset === "fadeDown") return [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(28px)" }];
          if (preset === "slideRight") return [{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: "translateX(52px)" }];
          if (preset === "zoomOut") return [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.16)" }];
          if (preset === "shrink") return [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.72)" }];
          return [{ opacity: 1 }, { opacity: 0 }];
        }

        function makeMotionController(slide, autoStartDelay = 0, morphSource = null) {
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return { cancel() {}, consume() { return false; } };
          let animations = [];
          let animationFrames = [];
          let timeouts = [];
          const originalStyles = new Map();
          const originalTextContents = new Map();
          const initializedElements = new Set();
          let batchIndex = 0;
          const items = [];
          slide.querySelectorAll("[data-motion-sequence]").forEach((element) => {
            if (element.closest("[data-slidex-morph-overlay]")) return;
            const actions = parseMotionSequence(element);
            actions?.forEach((action) => items.push({ action, element }));
          });
          items.sort((a, b) => Number(a.action.order) - Number(b.action.order));
          items.forEach((item) => {
            if (!originalStyles.has(item.element)) originalStyles.set(item.element, item.element.getAttribute("style"));
            const textTarget = item.element.querySelector("[data-motion-text-content]");
            if (textTarget && !originalTextContents.has(textTarget)) originalTextContents.set(textTarget, textTarget.innerHTML);
          });
          const batches = [];
          items.forEach((item, itemIndex) => {
            if (itemIndex === 0 || item.action.start === "onClick") batches.push([]);
            batches[batches.length - 1].push(item);
          });
          const firstByElement = new Map();
          items.forEach((item) => { if (!firstByElement.has(item.element)) firstByElement.set(item.element, item); });
          const deferredMotion = (element) => {
            const sharedId = (element.dataset.sharedId || "").trim();
            const sharedSource = sharedId ? morphSource?.get("shared:" + sharedId) : null;
            return sharedSource?.type === (element.dataset.slidexBlockType || "");
          };
          const initializeElement = (element) => {
            if (initializedElements.has(element)) return;
            const item = firstByElement.get(element);
            if (!item) return;
            const { action } = item;
            element.getAnimations().forEach((animation) => animation.cancel());
            if (action.type === "tween" && action.from) Object.assign(element.style, motionStateFrame(action.from));
            if (action.type === "tween" && action.preset === "numberRange" && action.numberRange) {
              const textTarget = element.querySelector("[data-motion-text-content]");
              if (textTarget) textTarget.textContent = formatMotionNumber(Number(action.numberRange.from), action.numberRange);
            }
            if (action.type === "enter") Object.assign(element.style, enterFrames(action.preset)[0]);
            initializedElements.add(element);
          };
          firstByElement.forEach((item) => { if (!deferredMotion(item.element)) initializeElement(item.element); });
          function cancel() {
            animations.forEach((animation) => animation.cancel());
            animationFrames.forEach((frame) => window.cancelAnimationFrame(frame));
            timeouts.forEach((timeout) => window.clearTimeout(timeout));
            animations = [];
            animationFrames = [];
            timeouts = [];
            originalStyles.forEach((style, element) => { if (style === null) element.removeAttribute("style"); else element.setAttribute("style", style); });
            originalStyles.clear();
            originalTextContents.forEach((content, element) => { element.innerHTML = content; });
            originalTextContents.clear();
            initializedElements.clear();
          }
          function playNumberRange(element, action) {
            const range = action.numberRange;
            const target = element.querySelector("[data-motion-text-content]");
            if (!range || !target) return;
            const startedAt = performance.now();
            const duration = Math.max(0, Number(action.duration) || 0) * 1000;
            const tick = (now) => {
              const progress = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
              target.textContent = formatMotionNumber(motionNumberValue(range, progress, action.easing), range);
              if (progress < 1) animationFrames.push(window.requestAnimationFrame(tick));
              else if (originalTextContents.has(target)) target.innerHTML = originalTextContents.get(target);
            };
            animationFrames.push(window.requestAnimationFrame(tick));
          }
          function playItem(item, delay) {
            const timeout = window.setTimeout(() => {
              const { action, element } = item;
              initializeElement(element);
              if (action.type === "tween" && action.preset === "numberRange" && action.numberRange) {
                playNumberRange(element, action);
                return;
              }
              let frames = action.type === "exit" ? exitFrames(action.preset) : enterFrames(action.preset);
              if (action.type === "tween" && action.from && action.to) {
                const count = action.path ? 31 : 2;
                frames = Array.from({ length: count }, (_, frameIndex) => motionStateFrame(tweenMotionState(action.from, action.to, frameIndex / (count - 1), action.path)));
              }
              const animation = element.animate(frames, {
                duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : Math.max(0, Number(action.duration) || 0) * 1000,
                easing: MOTION_EASING[action.easing] || "ease-in-out",
                fill: "forwards"
              });
              animations.push(animation);
            }, Math.max(0, delay));
            timeouts.push(timeout);
          }
          function consume() {
            const batch = batches[batchIndex];
            if (!batch) return false;
            batchIndex += 1;
            let previousStart = 0;
            let previousDuration = 0;
            batch.forEach((item, itemIndex) => {
              const start = itemIndex === 0 ? 0 : item.action.start === "withPrevious" ? previousStart : previousStart + previousDuration;
              playItem(item, start * 1000);
              previousStart = start;
              previousDuration = Number(item.action.duration) || 0;
            });
            return true;
          }
          if (batches[0]?.[0]?.action.start === "afterPrevious") {
            const batch = batches[batchIndex];
            batchIndex += 1;
            const timeout = window.setTimeout(() => {
              let previousStart = 0;
              let previousDuration = 0;
              batch?.forEach((item, itemIndex) => {
                const start = itemIndex === 0 ? 0 : item.action.start === "withPrevious" ? previousStart : previousStart + previousDuration;
                playItem(item, start * 1000);
                previousStart = start;
                previousDuration = Number(item.action.duration) || 0;
              });
            }, Math.max(0, autoStartDelay));
            timeouts.push(timeout);
          }
          return { cancel, consume };
        }

        function captureMorph(slide, options = {}) {
          const includeUnmatched = options.includeUnmatched !== false;
          const captured = new Map();
          const slideRect = slide.getBoundingClientRect();
          const slideScaleX = slideRect.width / Math.max(slide.offsetWidth, 1);
          const slideScaleY = slideRect.height / Math.max(slide.offsetHeight, 1);
          slide.querySelectorAll("[data-slidex-block-type]").forEach((element, index) => {
            const type = element.dataset.slidexBlockType || "";
            const candidateSharedId = (element.dataset.sharedId || "").trim();
            const sharedId = candidateSharedId && ["Text", "ImageBlock", "Shape", "SvgBlock"].includes(type) ? candidateSharedId : null;
            const nodeId = (element.dataset.motionDocNodeId || "").trim() || type + "-" + index;
            if (!sharedId && !includeUnmatched) return;
            const snapshotKey = sharedId ? "shared:" + sharedId : "unmatched:" + nodeId;
            if (captured.has(snapshotKey)) return;
            const rect = element.getBoundingClientRect();
            const styleTarget = type === "Text" ? element.querySelector("[data-motion-text-content]") || element : element;
            const style = getComputedStyle(styleTarget);
            const textLayout = type === "Text" ? captureTextLayout(styleTarget, slideRect, slideScaleX, slideScaleY) : null;
            captured.set(snapshotKey, {
              element,
              frame: { left: (rect.left - slideRect.left) / slideScaleX, top: (rect.top - slideRect.top) / slideScaleY, width: rect.width / slideScaleX, height: rect.height / slideScaleY },
              opacity: Number.isFinite(Number(style.opacity)) ? Number(style.opacity) : 1,
              rotation: style.rotate === "none" ? "0deg" : style.rotate,
              sharedId,
              style: { backgroundColor: style.backgroundColor, borderRadius: style.borderRadius, color: style.color, fontFamily: style.fontFamily, fontSize: style.fontSize, fontStyle: style.fontStyle, fontWeight: style.fontWeight, letterSpacing: style.letterSpacing, lineHeight: style.lineHeight, textAlign: style.textAlign },
              textFrame: textLayout?.frame || null,
              textLineCount: textLayout?.lineCount || 0,
              shape: type === "Shape" ? { shape: element.dataset.shapeKind || "rectangle", sides: Number(element.dataset.shapeSides) || 3, points: Number(element.dataset.shapePoints) || 5 } : null,
              type
            });
          });
          return captured;
        }

        function captureTextLayout(element, slideRect, scaleX, scaleY) {
          const rects = [];
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          let node = walker.nextNode();
          while (node) {
            if ((node.textContent || "").trim()) {
              const range = document.createRange();
              range.selectNodeContents(node);
              rects.push(...Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0));
            }
            node = walker.nextNode();
          }
          if (!rects.length) return null;
          const left = Math.min(...rects.map((rect) => rect.left));
          const top = Math.min(...rects.map((rect) => rect.top));
          const right = Math.max(...rects.map((rect) => rect.right));
          const bottom = Math.max(...rects.map((rect) => rect.bottom));
          return {
            frame: { left: (left - slideRect.left) / scaleX, top: (top - slideRect.top) / scaleY, width: (right - left) / scaleX, height: (bottom - top) / scaleY },
            lineCount: new Set(rects.map((rect) => Math.round(rect.top * 2) / 2)).size
          };
        }

        function playMorph(slide, source, duration, easingName, fadeUnmatched, shapeSoftness, shapePrecision, curve) {
          if (!source?.size || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
          const easing = easingName === "custom" ? "cubic-bezier(" + curve.x1 + "," + curve.y1 + "," + curve.x2 + "," + curve.y2 + ")" : MOTION_EASING[easingName] || "ease-in-out";
          // Only shared layers can participate in a Morph. Avoid synchronously
          // measuring every destination block immediately after navigation.
          const destination = captureMorph(slide, { includeUnmatched: false });
          const overlay = document.createElement("div");
          overlay.dataset.slidexMorphOverlay = "true";
          Object.assign(overlay.style, { position: "absolute", inset: "0", overflow: "hidden", pointerEvents: "none", zIndex: "9999" });
          slide.appendChild(overlay);
          const animations = [];
          const shapeFrames = [];
          const hidden = [];
          const moved = [];
          let restoreBackground = null;
          const transform = (origin, item) => {
            const sourceWidth = Math.max(origin.frame.width, .001);
            const sourceHeight = Math.max(origin.frame.height, .001);
            const translateX = item.frame.left - origin.frame.left + (item.frame.width - origin.frame.width) / 2;
            const translateY = item.frame.top - origin.frame.top + (item.frame.height - origin.frame.height) / 2;
            return "translate(" + translateX + "px, " + translateY + "px) rotate(" + item.rotation + ") scale(" + item.frame.width / sourceWidth + ", " + item.frame.height / sourceHeight + ")";
          };
          // Keep source dimensions fixed and animate transform instead of
          // left/top/width/height, which forces a canvas layout on every frame.
          const frame = (origin, item) => ({ left: origin.frame.left + "px", top: origin.frame.top + "px", width: origin.frame.width + "px", height: origin.frame.height + "px", opacity: item.opacity, rotate: "none", transform: transform(origin, item), transformOrigin: "center center", backgroundColor: item.style.backgroundColor, borderRadius: item.style.borderRadius, color: item.style.color, fontSize: item.style.fontSize, fontWeight: item.style.fontWeight });
          const textFrame = (itemFrame, style, opacity) => ({ left: itemFrame.left + "px", top: itemFrame.top + "px", width: itemFrame.width + "px", height: itemFrame.height + "px", opacity, transform: "none", color: style.color, fontFamily: style.fontFamily, fontSize: style.fontSize, fontStyle: style.fontStyle, fontWeight: style.fontWeight, letterSpacing: style.letterSpacing, lineHeight: style.lineHeight, textAlign: style.textAlign });
          const prepareTextClone = (element, itemFrame, singleLine) => {
            Object.assign(element.style, { position: "absolute", left: itemFrame.left + "px", top: itemFrame.top + "px", width: itemFrame.width + "px", height: itemFrame.height + "px", margin: "0", maxWidth: "none", overflow: "visible", transform: "none", transformOrigin: "left top", textAlign: singleLine ? "left" : element.style.textAlign });
            if (singleLine) element.querySelectorAll(".block-line").forEach((line) => { line.style.whiteSpace = "nowrap"; });
          };
          const animateTextLayer = (from, to) => {
            const sourceText = from.element.querySelector("[data-motion-text-content]");
            const targetText = to.element.querySelector("[data-motion-text-content]");
            if (!sourceText || !targetText) return;
            const sameSingleLine = sourceText.textContent === targetText.textContent && from.textLineCount === 1 && to.textLineCount === 1 && from.textFrame && to.textFrame;
            if (sameSingleLine) {
              const clone = sourceText.cloneNode(true);
              prepareTextClone(clone, from.textFrame, true);
              overlay.appendChild(clone);
              animations.push(clone.animate([textFrame(from.textFrame, from.style, from.opacity), textFrame(to.textFrame, to.style, to.opacity)], { duration, easing, fill: "forwards" }));
              return;
            }
            const sourceClone = sourceText.cloneNode(true);
            prepareTextClone(sourceClone, from.frame, false);
            overlay.appendChild(sourceClone);
            animations.push(sourceClone.animate([{ ...textFrame(from.frame, from.style, from.opacity), offset: 0 }, { ...textFrame(from.frame, from.style, 0), offset: .46 }, { ...textFrame(from.frame, from.style, 0), offset: 1 }], { duration, easing: "linear", fill: "forwards" }));
            const targetClone = targetText.cloneNode(true);
            prepareTextClone(targetClone, to.frame, false);
            overlay.appendChild(targetClone);
            animations.push(targetClone.animate([{ ...textFrame(to.frame, to.style, 0), offset: 0 }, { ...textFrame(to.frame, to.style, 0), offset: .38 }, { ...textFrame(to.frame, to.style, to.opacity), offset: .82 }, { ...textFrame(to.frame, to.style, to.opacity), offset: 1 }], { duration, easing: "linear", fill: "forwards" }));
          };
          destination.forEach((to, snapshotKey) => {
            const from = source.get(snapshotKey);
            if (!from?.sharedId || !to.sharedId || from.type !== to.type) return;
            const live = slide.querySelector('[data-shared-id="' + CSS.escape(to.sharedId) + '"]');
            if (live) { live.style.visibility = "hidden"; hidden.push(live); }
            if (from.type === "Text") {
              from.element.style.visibility = "hidden";
              hidden.push(from.element);
              animateTextLayer(from, to);
              return;
            }
            // Move the decoded source node into the overlay instead of cloning
            // embedded image media at navigation time. It is restored on cleanup.
            const clone = from.element;
            const parent = clone.parentNode;
            if (!parent) return;
            moved.push({ element: clone, parent, nextSibling: clone.nextSibling, style: clone.getAttribute("style") });
            // The moved source node is now inside the active destination slide.
            // Disable the generic active-slide motion-block entrance so
            // it cannot fade or scale on top of the Morph animation.
            Object.assign(clone.style, frame(from, from), { animation: "none", position: "absolute", margin: "0" });
            overlay.appendChild(clone);
            if (from.type === "Shape" && from.shape && to.shape && from.shape.shape !== to.shape.shape) {
              animateShapeMorph(clone, from.shape, to.shape, duration, easingName, shapeSoftness, shapePrecision, shapeFrames, curve);
            }
            animations.push(clone.animate([frame(from, from), frame(from, to)], { duration, easing, fill: "forwards" }));
          });
          if (fadeUnmatched) {
            // Let the existing leaving-slide transition fade source-only layers
            // behind the destination. This keeps decoded media in its original
            // DOM instead of cloning or reparenting embedded images at click time.
            const backgroundColor = slide.style.backgroundColor;
            slide.style.backgroundColor = "transparent";
            restoreBackground = () => {
              if (backgroundColor) slide.style.backgroundColor = backgroundColor;
              else slide.style.removeProperty("background-color");
            };
            const content = slide.querySelector(".slide-content");
            if (content) animations.push(content.animate([
              { offset: 0, opacity: 0 },
              { offset: .28, opacity: 0 },
              { offset: .78, opacity: 1 },
              { offset: 1, opacity: 1 }
            ], { duration, easing: "linear", fill: "both" }));
          }
          const cleanup = () => {
            animations.forEach((animation) => animation.cancel());
            shapeFrames.forEach((frame) => cancelAnimationFrame(frame));
            hidden.forEach((element) => element.style.removeProperty("visibility"));
            moved.slice().reverse().forEach(({ element, parent, nextSibling, style }) => {
              if (style === null) element.removeAttribute("style"); else element.setAttribute("style", style);
              if (nextSibling?.parentNode === parent) parent.insertBefore(element, nextSibling); else parent.appendChild(element);
            });
            restoreBackground?.();
            overlay.remove();
          };
          window.setTimeout(cleanup, duration + 40);
          return cleanup;
        }

        function animateShapeMorph(clone, from, to, duration, easing, softness, precision, frames, curve) {
          const fromPoints = shapePoints(from, precision);
          const toPoints = shapePoints(to, precision);
          if (!fromPoints || !toPoints) return;
          const geometry = Array.from(clone.querySelectorAll("svg path, svg circle, svg rect, svg polygon")).find((node) => !node.closest("defs, mask"));
          if (!geometry) return;
          const path = geometry.tagName.toLowerCase() === "path" ? geometry : document.createElementNS("http://www.w3.org/2000/svg", "path");
          if (path !== geometry) {
            ["fill", "stroke", "stroke-width", "stroke-linejoin", "vector-effect", "style"].forEach((name) => { const value = geometry.getAttribute(name); if (value !== null) path.setAttribute(name, value); });
            geometry.replaceWith(path);
          }
          const startedAt = performance.now();
          const tick = (now) => {
            const raw = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
            path.setAttribute("d", shapePath(fromPoints, toPoints, morphEase(raw, easing, curve), softness));
            if (raw < 1) frames.push(requestAnimationFrame(tick));
          };
          frames.push(requestAnimationFrame(tick));
        }

        function shapePoints(descriptor, requestedCount) {
          if (descriptor.shape === "line") return null;
          const count = Math.max(12, Math.min(Math.round(Number(requestedCount) || 48), 96));
          if (descriptor.shape === "circle") return Array.from({ length: count }, (_, index) => { const angle = -Math.PI / 2 + Math.PI * 2 * index / count; return { x: 50 + 48 * Math.cos(angle), y: 50 + 48 * Math.sin(angle) }; });
          const custom = {
            arrow: [[2,22],[58,22],[58,2],[98,50],[58,98],[58,78],[2,78]], chevron: [[1,1],[68,1],[99,50],[68,99],[1,99],[32,50]], corner: [[1,1],[72,1],[99,28],[99,99],[1,99]], diamond: [[50,1],[99,50],[50,99],[1,50]], hexagon: [[20,1],[80,1],[99,50],[80,99],[20,99],[1,50]], parallelogram: [[24,1],[99,1],[76,99],[1,99]], rectangle: [[1,1],[99,1],[99,99],[1,99]]
          };
          let vertices;
          if (descriptor.shape === "star") vertices = radialShape(Math.max(3, Math.min(Math.round(descriptor.points || 5), 12)), true);
          else if (descriptor.shape === "triangle") vertices = radialShape(3, false);
          else if (descriptor.shape === "polygon") vertices = radialShape(Math.max(3, Math.min(Math.round(descriptor.sides || 3), 12)), false);
          else vertices = (custom[descriptor.shape] || custom.rectangle).map((point) => ({ x: point[0], y: point[1] }));
          return resampleShape(vertices, count);
        }

        function radialShape(count, star) {
          const total = star ? count * 2 : count;
          return Array.from({ length: total }, (_, index) => { const angle = -Math.PI / 2 + Math.PI * 2 * index / total; const radius = star && index % 2 ? 20.16 : 48; return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) }; });
        }

        function resampleShape(vertices, count) {
          const segments = vertices.map((point, index) => { const to = vertices[(index + 1) % vertices.length]; return { from: point, to, length: Math.hypot(to.x - point.x, to.y - point.y) }; });
          const perimeter = segments.reduce((total, segment) => total + segment.length, 0);
          return Array.from({ length: count }, (_, index) => { let distance = perimeter * index / count; const segment = segments.find((candidate) => { if (distance <= candidate.length) return true; distance -= candidate.length; return false; }) || segments[segments.length - 1]; const progress = segment.length ? distance / segment.length : 0; return { x: segment.from.x + (segment.to.x - segment.from.x) * progress, y: segment.from.y + (segment.to.y - segment.from.y) * progress }; });
        }

        function shapePath(from, to, progress, softness) {
          const count = Math.min(from.length, to.length);
          const weight = Math.max(0, Math.min(Number(softness) || 0, 1)) * Math.sin(Math.PI * progress) * .42;
          const points = Array.from({ length: count }, (_, index) => ({ x: from[index].x + (to[index].x - from[index].x) * progress, y: from[index].y + (to[index].y - from[index].y) * progress }));
          const resolved = weight ? points.map((point, index) => { const previous = points[(index - 1 + count) % count]; const next = points[(index + 1) % count]; return { x: point.x + ((previous.x + next.x) / 2 - point.x) * weight, y: point.y + ((previous.y + next.y) / 2 - point.y) * weight }; }) : points;
          return "M" + resolved.map((point) => point.x.toFixed(2) + "," + point.y.toFixed(2)).join(" L") + " Z";
        }

        function morphEase(value, easing, curve) {
          if (easing === "linear") return value;
          if (easing === "easeIn") return value * value;
          if (easing === "easeOut") return 1 - (1 - value) * (1 - value);
          if (easing === "smooth") return value * value * value * (value * (value * 6 - 15) + 10);
          if (easing === "emphasized") return cubicBezierProgress(value, { x1: .2, y1: 0, x2: 0, y2: 1 });
          if (easing === "spring") return Math.min(1, Math.max(0, 1 - Math.cos(value * Math.PI * 2.5) * Math.exp(-5 * value)));
          if (easing === "backOut") return cubicBezierProgress(value, { x1: .34, y1: 1.56, x2: .64, y2: 1 });
          if (easing === "custom") return cubicBezierProgress(value, curve);
          return value < .5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
        }

        function cubicBezierProgress(progress, curve) {
          let lower = 0, upper = 1, t = progress;
          for (let index = 0; index < 12; index += 1) {
            const x = cubicCoordinate(t, curve.x1, curve.x2);
            if (Math.abs(x - progress) < .0001) break;
            if (x < progress) lower = t; else upper = t;
            t = (lower + upper) / 2;
          }
          return cubicCoordinate(t, curve.y1, curve.y2);
        }

        function cubicCoordinate(t, first, second) {
          const inverse = 1 - t;
          return 3 * inverse * inverse * t * first + 3 * inverse * t * t * second + t * t * t;
        }

        function finiteDatasetNumber(value, fallback) {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : fallback;
        }

        function render(nextIndex, replay = false) {
          if (slides.length === 0) return;
          const previousIndex = index;
          const nextResolvedIndex = (nextIndex + slides.length) % slides.length;
          const previousSlide = slides[previousIndex];
          const forward = nextResolvedIndex >= previousIndex;
          const morphSlide = forward ? previousSlide : slides[nextResolvedIndex];
          // MotionDoc's native frame is the complete final state. Restore it
          // before measuring a Morph so an early click cannot capture a
          // half-finished entrance scale or opacity from Action Tween.
          motionController?.cancel();
          const morphSource = !replay && previousSlide && previousSlide !== slides[nextResolvedIndex] && morphSlide?.classList.contains("slide-transition-morph")
            ? captureMorph(previousSlide, { includeUnmatched: false })
            : null;
          morphCleanup?.();
          index = nextResolvedIndex;
          slides.forEach((slide) => slide.classList.remove("is-active", "is-leaving", "is-morph-leaving"));
          const activeSlide = slides[index];

          if (!replay && previousSlide && previousSlide !== activeSlide && (morphSource || !activeSlide.classList.contains("slide-transition-none"))) {
            previousSlide.classList.add("is-leaving");
            if (morphSource) previousSlide.classList.add("is-morph-leaving");
            const transitionOwner = morphSource ? morphSlide : activeSlide;
            window.setTimeout(() => previousSlide.classList.remove("is-leaving", "is-morph-leaving"), Math.max(180, Number(transitionOwner.style.getPropertyValue("--slide-transition-duration").replace("s", "")) * 1000 || 720));
          }
          document.documentElement.dataset.slideDirection = forward ? "forward" : "backward";

          if (replay) {
            activeSlide.getBoundingClientRect();
          }

          activeSlide.classList.add("is-active");
          let transitionDelay = 0;
          if (morphSource) {
            const duration = Math.max(0, Number(morphSlide.style.getPropertyValue("--slide-transition-duration").replace("s", "")) || .72) * 1000;
            transitionDelay = duration;
            const easing = morphSlide.dataset.morphEasing || "easeInOut";
            const curve = { x1: finiteDatasetNumber(morphSlide.dataset.morphCurveX1, .4), y1: finiteDatasetNumber(morphSlide.dataset.morphCurveY1, 0), x2: finiteDatasetNumber(morphSlide.dataset.morphCurveX2, .2), y2: finiteDatasetNumber(morphSlide.dataset.morphCurveY2, 1) };
            morphCleanup = playMorph(activeSlide, morphSource, duration, easing, morphSlide.dataset.morphFadeUnmatched !== "false", Number(morphSlide.dataset.morphShapeSoftness) || .32, Number(morphSlide.dataset.morphShapePrecision) || 48, curve);
          } else if (!replay && previousSlide && previousSlide !== activeSlide && !activeSlide.classList.contains("slide-transition-none")) {
            transitionDelay = Math.max(0, Number(activeSlide.style.getPropertyValue("--slide-transition-duration").replace("s", "")) || .72) * 1000;
          }
          motionController = makeMotionController(activeSlide, transitionDelay, morphSource);
          layoutCroppedImages(activeSlide);
          renderHtmlScenes(index, replay);
          renderSvgScenes(index, replay);
          dotButtons.forEach((button, buttonIndex) => button.setAttribute("aria-current", String(buttonIndex === index)));
          if (current) current.textContent = String(index + 1);
          if (progress) progress.style.setProperty("--progress", slides.length <= 1 ? "100%" : ((index + 1) / slides.length * 100).toFixed(2) + "%");
        }

        function stop() {
          window.clearTimeout(timer);
          timer = null;
          if (playButton) playButton.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
        }

        function play() {
          stop();
          if (playButton) playButton.innerHTML = '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
          const tick = () => {
            const duration = Number(slides[index]?.dataset.duration || 5);
            timer = window.setTimeout(() => {
              render(index + 1);
              tick();
            }, Math.max(duration, 1) * 1000);
          };
          tick();
        }

        async function toggleFullscreen() {
          if (!player) return;

          if (document.fullscreenElement) {
            await document.exitFullscreen();
            return;
          }

          if (player.requestFullscreen) {
            await player.requestFullscreen();
          }
        }

        function updateFullscreenButton() {
          updateFrameScale();
          if (!fullscreenButton) return;
          fullscreenButton.innerHTML = document.fullscreenElement
            ? '<svg viewBox="0 0 24 24"><path d="M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M8 21v-3a2 2 0 0 0-2-2H3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>'
            : '<svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
          fullscreenButton.setAttribute("aria-label", document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen");
        }

        document.addEventListener("click", (event) => {
          const interactive = event.target instanceof Element ? event.target.closest("[data-slidex-interaction]") : null;
          if (interactive && interactive.closest(".slide") === slides[index]) {
            try {
              const interaction = JSON.parse(interactive.dataset.slidexInteraction || "null");
              const action = interaction?.version === 1 && interaction.trigger === "click" ? interaction.action : null;
              if (action?.type === "nextSlide") { stop(); render(index + 1); return; }
              if (action?.type === "previousSlide") { stop(); render(index - 1); return; }
              if (action?.type === "goToSlide" && Number.isInteger(action.slide) && action.slide > 0) { stop(); render(action.slide - 1); return; }
              if (action?.type === "openUrl" && typeof action.url === "string") {
                if (action.url.startsWith("#") && action.url.length > 1) { location.hash = action.url; return; }
                const url = new URL(action.url);
                if (["https:", "http:", "mailto:"].includes(url.protocol)) window.open(url.href, "_blank", "noopener,noreferrer");
                return;
              }
            } catch {}
          }
          const dot = event.target.closest("[data-slide-target]");
          if (dot) {
            stop();
            render(Number(dot.dataset.slideTarget));
            return;
          }
          const button = event.target.closest("[data-action]");
          if (!button) {
            if (event.target.closest(".viewport") && !event.target.closest("a,button,input,iframe,video")) {
              const activeSlide = slides[index];
              if (activeSlide?.querySelector("[data-slidex-interaction]")) {
                window.clearTimeout(interactionHintTimer);
                activeSlide.classList.remove("show-interaction-hints");
                activeSlide.getBoundingClientRect();
                activeSlide.classList.add("show-interaction-hints");
                interactionHintTimer = window.setTimeout(() => activeSlide.classList.remove("show-interaction-hints"), 900);
                return;
              }
              stop();
              if (!motionController?.consume()) render(index + 1);
            }
            return;
          }
          const action = button.dataset.action;

          if (action === "prev") {
            stop();
            render(index - 1);
          }
          if (action === "next") {
            stop();
            if (!motionController?.consume()) render(index + 1);
          }
          if (action === "replay") {
            render(index, true);
          }
          if (action === "play") {
            timer ? stop() : play();
          }
          if (action === "fullscreen") {
            toggleFullscreen().catch(() => {});
          }
          if (action === "theme") {
            const nextTheme = player?.dataset.playerTheme === "light" ? "dark" : "light";
            if (player) player.dataset.playerTheme = nextTheme;
            try { localStorage.setItem("slidex-player-theme", nextTheme); } catch {}
          }
        });

        document.addEventListener("fullscreenchange", updateFullscreenButton);
        window.addEventListener("resize", updateFrameScale);

        document.addEventListener("keydown", (event) => {
          if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
            event.preventDefault();
            stop();
            if (!motionController?.consume()) render(index + 1);
          }
          if (event.key === "ArrowLeft" || event.key === "PageUp") {
            event.preventDefault();
            stop();
            render(index - 1);
          }
          if (event.key === "Home") {
            stop();
            render(0);
          }
          if (event.key === "End") {
            stop();
            render(slides.length - 1);
          }
          if (event.key.toLowerCase() === "f") {
            event.preventDefault();
            toggleFullscreen().catch(() => {});
          }
        });

        try { if (player) player.dataset.playerTheme = localStorage.getItem("slidex-player-theme") || "dark"; } catch { if (player) player.dataset.playerTheme = "dark"; }
        updateFrameScale();
        render(0);
        updateFullscreenButton();
        const svgHydration = hydrateSvgBlocks().then(() => render(index));

        // ── Shader Background System ──
        const SHADER_VERTEX = \`${runtimeVertexShader}\`;
        const PAPER_SHADER_MAX_COLORS = ${PAPER_SHADER_MAX_COLORS};
        const PAPER_SHADER_PRESETS = JSON.parse(\`${escapedPaperShaderRuntimePresets}\`);
        const PAPER_IMAGE_FILTER_PRESETS = JSON.parse(\`${escapedPaperImageFilterRuntimePresets}\`);
        const SHADER_ALIASES = {
          "aurora": "swirl",
          "balatro-swirl": "swirl",
          "reaction-diffusion": "swirl",
          "silk-gradient": "static-mesh-gradient",
          "mesh": "mesh-gradient",
          "geometric-grid": "dithering",
          "particle-field": "dot-orbit",
          "metaball-fields": "metaballs",
          "noise-fog": "grain-gradient",
          "wave-distortion": "liquid-metal",
          "caustic-water": "water",
          "waves": "water",
          "watercolor-classic": "paper-texture",
          "watercolor-wet": "swirl",
          "watercolor-rough": "paper-texture",
          "watercolor-salt": "dithering",
          "watercolor-ink": "grain-gradient",
          "watercolor-glaze": "mesh-gradient",
          "watercolor-metallic": "liquid-metal",
          "watercolor-gravity": "swirl",
          "watercolor-granulating": "grain-gradient"
        };
        const LIQUID_METAL_SHAPES = { none: 0, circle: 1, daisy: 2, diamond: 3, metaballs: 4 };
        const GRAIN_GRADIENT_SHAPES = { wave: 1, dots: 2, truchet: 3, corners: 4, ripple: 5, blob: 6, sphere: 7 };
        const DITHERING_SHAPES = { simplex: 1, warp: 2, dots: 3, wave: 4, ripple: 5, swirl: 6, sphere: 7 };
        const DITHERING_TYPES = { random: 1, "2x2": 2, "4x4": 3, "8x8": 4 };
        const GLASS_GRID_SHAPES = { lines: 1, linesIrregular: 2, wave: 3, zigzag: 4, pattern: 5 };
        const GLASS_DISTORTION_SHAPES = { prism: 1, lens: 2, contour: 3, cascade: 4, flat: 5 };
        const HALFTONE_DOTS_TYPES = { classic: 0, gooey: 1, holes: 2, soft: 3 };
        const HALFTONE_DOTS_GRIDS = { square: 0, hex: 1 };
        const HALFTONE_CMYK_TYPES = { dots: 0, ink: 1, sharp: 2 };
        const SHADER_FIT_OPTIONS = { none: 0, contain: 1, cover: 2 };
        const SHADER_FRAGS = {
          "swirl": \`${escapedSwirl}\`,
          "mesh-gradient": \`${escapedMeshGradient}\`,
          "static-mesh-gradient": \`${escapedStaticMeshGradient}\`,
          "dithering": \`${escapedDithering}\`,
          "dot-orbit": \`${escapedDotOrbit}\`,
          "god-rays": \`${escapedGodRays}\`,
          "neuro-noise": \`${escapedNeuroNoise}\`,
          "liquid-metal": \`${escapedLiquidMetal}\`,
          "grain-gradient": \`${escapedGrainGradient}\`,
          "metaballs": \`${escapedMetaballs}\`,
          "paper-texture": \`${escapedPaperTexture}\`,
          "water": \`${escapedWater}\`,

          // Image Filters
          "image-filter-fluted-glass": \`${escapedFlutedGlass}\`,
          "image-filter-water": \`${escapedWater}\`,
          "image-filter-dithering": \`${escapedImageDithering}\`,
          "image-filter-heatmap": \`${escapedHeatmap}\`,
          "image-filter-liquid-metal": \`${escapedLiquidMetal}\`,
          "image-filter-halftone-dots": \`${escapedHalftoneDots}\`,
          "image-filter-halftone-cmyk": \`${escapedHalftoneCmyk}\`,
          "image-filter-gem-smoke": \`${escapedGemSmoke}\`,
          "image-filter-paper-texture": \`${escapedPaperTexture}\`
        };
        function resolveShaderId(id) {
          return SHADER_FRAGS[id] ? id : (SHADER_ALIASES[id] || id);
        }
        function enumValue(map, value, fallback) {
          return typeof value === "string" && Object.prototype.hasOwnProperty.call(map, value) ? map[value] : fallback;
        }
        const FULLSCREEN_POSITIONS = new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]);
        const DEFAULT_MAX_PIXEL_COUNT = 1920 * 1080 * 4;
        const DEFAULT_MIN_PIXEL_RATIO = 1;
        let staticExportRasterScale = 1;

        function hexToVec3(hex) {
          const c = hex.replace('#','');
          const f = c.length===3 ? c[0]+c[0]+c[1]+c[1]+c[2]+c[2] : c;
          if (!/^[0-9a-fA-F]{6}$/.test(f)) return [0, 0, 0];
          return [parseInt(f.slice(0,2),16)/255, parseInt(f.slice(2,4),16)/255, parseInt(f.slice(4,6),16)/255];
        }

        function numberDataset(value, fallback) {
          const parsed = Number.parseFloat(value);
          return Number.isFinite(parsed) ? parsed : fallback;
        }

        function mixColor(a, b, amount) {
          return [
            a[0] * (1 - amount) + b[0] * amount,
            a[1] * (1 - amount) + b[1] * amount,
            a[2] * (1 - amount) + b[2] * amount
          ];
        }

        function paletteFromColors(c1, c2, c3, c4, c5, c6) {
          const stops = [
            c1,
            mixColor(c1, c2, 0.38),
            c2,
            mixColor(c2, c3, 0.45),
            c3,
            mixColor(c3, c4, 0.5),
            c4,
            mixColor(c4, c6, 0.42),
            c5,
            c6
          ];
          const palette = new Float32Array(PAPER_SHADER_MAX_COLORS * 4);

          for (let i = 0; i < PAPER_SHADER_MAX_COLORS; i += 1) {
            const color = stops[i] || c6;
            palette[i * 4] = color[0];
            palette[i * 4 + 1] = color[1];
            palette[i * 4 + 2] = color[2];
            palette[i * 4 + 3] = 1;
          }

          return palette;
        }

        function makeColorsArray(count, colorsList) {
          const colorCount = Math.max(1, Math.min(Math.floor(count), PAPER_SHADER_MAX_COLORS));
          const res = new Float32Array(colorCount * 4);
          for (let i = 0; i < colorCount; i++) {
            const c = colorsList[i % colorsList.length] || [0,0,0];
            res[i * 4] = c[0];
            res[i * 4 + 1] = c[1];
            res[i * 4 + 2] = c[2];
            res[i * 4 + 3] = 1.0;
          }
          return res;
        }

        function presetVec3(value, fallback) {
          if (Array.isArray(value)) {
            return [
              Number.isFinite(Number(value[0])) ? Number(value[0]) : 0,
              Number.isFinite(Number(value[1])) ? Number(value[1]) : 0,
              Number.isFinite(Number(value[2])) ? Number(value[2]) : 0
            ];
          }

          const color = typeof value === "string" ? value : fallback;
          return hexToVec3(color.length === 9 ? color.slice(0, 7) : color);
        }

        function presetVec4(value, fallback, alpha) {
          const color = presetVec3(value, fallback);
          const parsedAlpha = typeof value === "string" && value.length === 9
            ? parseInt(value.slice(7, 9), 16) / 255
            : alpha;
          return [color[0], color[1], color[2], Number.isFinite(parsedAlpha) ? parsedAlpha : alpha];
        }

        function enumOrNumber(map, value, fallback) {
          if (typeof value === "number" && Number.isFinite(value)) {
            return value;
          }

          return enumValue(map, value, fallback);
        }

        function boolParam(value, fallback) {
          if (typeof value === "boolean") return value;
          if (value === 1 || value === "1" || value === "true") return true;
          if (value === 0 || value === "0" || value === "false") return false;
          return fallback;
        }

        function fitUniform(value, fallback = "cover") {
          const key = typeof value === "string" ? value : fallback;
          return SHADER_FIT_OPTIONS[key] !== undefined ? SHADER_FIT_OPTIONS[key] : SHADER_FIT_OPTIONS[fallback];
        }

        function configureTexture(gl) {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        }

        function createNoiseTexture(gl) {
          const size = 64;
          const data = new Uint8Array(size * size * 4);

          for (let y = 0; y < size; y += 1) {
            for (let x = 0; x < size; x += 1) {
              const i = (y * size + x) * 4;
              const v = Math.floor((Math.sin((x * 127.1 + y * 311.7) * 12.9898) * 43758.5453 % 1 + 1) % 1 * 255);
              data[i] = v;
              data[i + 1] = (v * 73 + x * 17) % 256;
              data[i + 2] = (v * 37 + y * 29) % 256;
              data[i + 3] = 255;
            }
          }

          const texture = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, texture);
          configureTexture(gl);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);

          return texture;
        }

        function getUniforms(gl, prog) {
          const list = [
            'u_time', 'u_resolution', 'u_pixelRatio', 'u_image', 'u_hasImage', 'u_imageAspectRatio', 'u_noiseTexture',
            'u_fit', 'u_rotation', 'u_scale', 'u_offsetX', 'u_offsetY', 'u_originX', 'u_originY', 'u_worldWidth', 'u_worldHeight',
            'u_colorBack', 'u_colorFront', 'u_colorMid', 'u_colorBloom', 'u_colorTint', 'u_colorShadow', 'u_colorHighlight', 'u_colorInner',
            'u_colorGap', 'u_colorGlow',
            'u_colors', 'u_colorsCount',
            'u_softness', 'u_noise', 'u_twist', 'u_distortion', 'u_swirl', 'u_grainMixer', 'u_grainOverlay', 'u_grainSize',
            'u_bandCount', 'u_center', 'u_proportion', 'u_noiseFrequency',
            'u_positions', 'u_waveX', 'u_waveXShift', 'u_waveY', 'u_waveYShift', 'u_mixing',
            'u_innerDistortion', 'u_outerDistortion', 'u_innerGlow', 'u_outerGlow', 'u_size', 'u_offset',
            'u_shape', 'u_type', 'u_pxSize', 'u_spreading', 'u_stepsPerColor', 'u_sizeRange', 'u_density', 'u_spotty', 'u_midSize', 'u_midIntensity', 'u_bloom', 'u_intensity', 'u_brightness', 'u_contrast', 'u_repetition',
            'u_count', 'u_roughness', 'u_fiber', 'u_proportion', 'u_octaveCount', 'u_persistence', 'u_lacunarity', 'u_glow', 'u_gap', 'u_colorSteps', 'u_originalColors', 'u_inverted', 'u_grid',
            'u_highlights', 'u_shadows', 'u_stretch', 'u_distortionShape', 'u_shift', 'u_blur', 'u_edges', 'u_marginLeft', 'u_marginRight', 'u_marginTop', 'u_marginBottom',
            'u_layering', 'u_caustic', 'u_waves', 'u_contour', 'u_isImage', 'u_fade', 'u_seed',
            'u_color1', 'u_color2', 'u_color3', 'u_color4', 'u_color5', 'u_color6',
            'u_speed', 'u_radius', 'u_colorC', 'u_colorM', 'u_colorY', 'u_colorK', 'u_minDot', 'u_gridNoise',
            'u_floodC', 'u_floodM', 'u_floodY', 'u_floodK', 'u_gainC', 'u_gainM', 'u_gainY', 'u_gainK',
            'u_shiftRed', 'u_shiftBlue', 'u_fiberSize', 'u_crumples', 'u_crumpleSize', 'u_folds', 'u_foldCount', 'u_drops', 'u_angle'
          ];
          const u = {};
          for (const name of list) {
            u[name] = gl.getUniformLocation(prog, name);
            if (name === 'u_colors' && !u[name]) {
              u[name] = gl.getUniformLocation(prog, 'u_colors[0]');
            }
          }
          return u;
        }

        function uploadImage(canvas, state) {
          const src = canvas.dataset.shaderImage;
          state.imageAspectRatio = 1;
          state.hasImage = 0;
          state.imageLoadFailed = false;

          function fallBackToSourceImage() {
            state.imageLoadFailed = true;
            canvas.dataset.shaderImageFallback = "true";
            // Image filters are rendered above the unfiltered <img>. If WebGL
            // cannot obtain the source texture (for example, a local-file or
            // CORS restriction), hide only the canvas so the original image
            // remains visible instead of a black rectangle.
            canvas.style.display = "none";
          }

          if (!src) {
            if (canvas.classList.contains("image-filter-canvas")) fallBackToSourceImage();
            return Promise.resolve(false);
          }

          canvas.style.removeProperty("display");
          delete canvas.dataset.shaderImageFallback;

          return new Promise((resolve) => {
            const img = new Image();
            if (!src.startsWith('data:') && !src.startsWith('blob:')) {
              img.crossOrigin = 'anonymous';
            }
            img.onload = () => {
              if (!shaderStates.has(canvas) || img.naturalWidth === 0 || img.naturalHeight === 0) {
                if (canvas.classList.contains("image-filter-canvas")) fallBackToSourceImage();
                resolve(false);
                return;
              }
              state.gl.activeTexture(state.gl.TEXTURE0);
              state.gl.bindTexture(state.gl.TEXTURE_2D, state.texture);
              configureTexture(state.gl);
              state.gl.texImage2D(state.gl.TEXTURE_2D, 0, state.gl.RGBA, state.gl.RGBA, state.gl.UNSIGNED_BYTE, img);
              state.imageAspectRatio = img.naturalWidth / img.naturalHeight;
              state.hasImage = 1;
              requestShaderFrame(state);
              resolve(true);
            };
            img.onerror = () => {
              if (canvas.classList.contains("image-filter-canvas")) fallBackToSourceImage();
              resolve(false);
            };
            img.src = src;
          });
        }

        function initWebglShader(canvas) {
          const sourceId = canvas.dataset.shader;
          const id = resolveShaderId(sourceId);
          const variant = numberDataset(canvas.dataset.shaderVariant, 0);
          const isImageFilter = canvas.classList.contains("image-filter-canvas");
          let frag = isImageFilter ? SHADER_FRAGS["image-filter-" + id] : SHADER_FRAGS[id];
          if (id === "dithering" && canvas.dataset.shaderImage) {
            frag = \`${escapedImageDithering}\`;
          }
          if (!frag) return null;
          const gl = canvas.getContext('webgl2', {alpha:true, antialias:false, premultipliedAlpha:false, preserveDrawingBuffer: true});
          if (!gl) return null;
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          function compile(type, src) {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
            console.warn('Shader compile failed:', gl.getShaderInfoLog(s));
            gl.deleteShader(s);
            return null;
          }
          let vsSource = SHADER_VERTEX;
          if (frag.indexOf('precision mediump float;') !== -1) {
            vsSource = vsSource.replace('precision highp float;', 'precision mediump float;');
          } else if (frag.indexOf('precision lowp float;') !== -1) {
            vsSource = vsSource.replace('precision highp float;', 'precision lowp float;');
          }
          const vs = compile(gl.VERTEX_SHADER, vsSource);
          const fs = compile(gl.FRAGMENT_SHADER, frag);
          if (!vs || !fs) return null;
          const prog = gl.createProgram();
          gl.attachShader(prog, vs); gl.attachShader(prog, fs);
          gl.linkProgram(prog);
          gl.deleteShader(vs);
          gl.deleteShader(fs);
          if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.warn('Shader link failed:', gl.getProgramInfoLog(prog));
            return null;
          }
          gl.useProgram(prog);
          const positionBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_POSITIONS, gl.STATIC_DRAW);
          const positionLocation = gl.getAttribLocation(prog, 'a_position');
          gl.enableVertexAttribArray(positionLocation);
          gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
          const texture = gl.createTexture();
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          configureTexture(gl);
          // PaperTexture blends the input image whenever its alpha is non-zero.
          // A background shader has no image, so an opaque black placeholder
          // becomes a large black slab in the frozen HTML/PPTX canvas. Keep
          // the placeholder transparent for that one no-image background;
          // image filters retain their opaque texture until the real image
          // completes loading.
          const emptyTexturePixel = !isImageFilter && id === "paper-texture"
            ? new Uint8Array([0, 0, 0, 0])
            : new Uint8Array([0, 0, 0, 255]);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, emptyTexturePixel);
          const noiseTexture = createNoiseTexture(gl);
          const c1 = hexToVec3(canvas.dataset.shaderColor1 || '${DEFAULT_DARK_SHADER_PALETTE.color1}');
          const c2 = hexToVec3(canvas.dataset.shaderColor2 || '${DEFAULT_DARK_SHADER_PALETTE.color2}');
          const c3 = hexToVec3(canvas.dataset.shaderColor3 || '${DEFAULT_DARK_SHADER_PALETTE.color3}');
          const c4 = hexToVec3(canvas.dataset.shaderColor4 || '${DEFAULT_DARK_SHADER_PALETTE.color4}');
          const c5 = hexToVec3(canvas.dataset.shaderColor5 || '${DEFAULT_DARK_SHADER_PALETTE.color5}');
          const c6 = hexToVec3(canvas.dataset.shaderColor6 || '${DEFAULT_DARK_SHADER_PALETTE.color6}');
          const intensity = numberDataset(canvas.dataset.shaderIntensity, ${DEFAULT_SHADER_CONTROLS.intensity});
          const frame = numberDataset(canvas.dataset.shaderFrame, ${DEFAULT_SHADER_CONTROLS.frame});
          const speed = numberDataset(canvas.dataset.shaderSpeed, ${DEFAULT_SHADER_CONTROLS.speed});
          const softness = numberDataset(canvas.dataset.shaderSoftness, ${DEFAULT_SHADER_CONTROLS.softness});
          const scale = numberDataset(canvas.dataset.shaderScale, ${DEFAULT_SHADER_CONTROLS.scale});
          const angle = numberDataset(canvas.dataset.shaderAngle, ${DEFAULT_SHADER_CONTROLS.angle});
          const detail = numberDataset(canvas.dataset.shaderDetail, ${DEFAULT_SHADER_CONTROLS.detail});
          const filterDistortion = (canvas.dataset.filterDistortion && !isNaN(parseFloat(canvas.dataset.filterDistortion))) ? parseFloat(canvas.dataset.filterDistortion) : undefined;
          const filterSize = (canvas.dataset.filterSize && !isNaN(parseFloat(canvas.dataset.filterSize))) ? parseFloat(canvas.dataset.filterSize) : undefined;
          const filterAngle = (canvas.dataset.filterAngle && !isNaN(parseFloat(canvas.dataset.filterAngle))) ? parseFloat(canvas.dataset.filterAngle) : undefined;
          const filterContrast = (canvas.dataset.filterContrast && !isNaN(parseFloat(canvas.dataset.filterContrast))) ? parseFloat(canvas.dataset.filterContrast) : undefined;
          const filterSpeed = (canvas.dataset.filterSpeed && !isNaN(parseFloat(canvas.dataset.filterSpeed))) ? parseFloat(canvas.dataset.filterSpeed) : undefined;
          const filterDetail = (canvas.dataset.filterDetail && !isNaN(parseFloat(canvas.dataset.filterDetail))) ? parseFloat(canvas.dataset.filterDetail) : undefined;

          const presets = {
            "paper-texture": {
              "Default": { contrast: 0.5, roughness: 0.5, fiber: 0.5, fiberSize: 0.5, crumples: 0.5, crumpleSize: 0.5, folds: 0.5, foldCount: 5.0, drops: 0.5 },
              "Abstract": { contrast: 0.8, roughness: 2.0, fiber: 0.1, fiberSize: 0.2, crumples: 0.0, crumpleSize: 0.3, folds: 1.0, foldCount: 3, drops: 0.2 },
              "Waves": { contrast: 0.0, roughness: 0.15, fiber: 0.65, fiberSize: 0.1, crumples: 0.5, crumpleSize: 0.5, folds: 0.5, foldCount: 5, drops: 0.0 },
              "Folds": { contrast: 0.0, roughness: 1.0, fiber: 0.27, fiberSize: 0.22, crumples: 1.0, crumpleSize: 0.5, folds: 1.0, foldCount: 15, drops: 0.0 }
            },
            "fluted-glass": {
              "Default": { distortion: 0.1, size: 0.5, angle: 0 },
              "Abstract": { distortion: 0.35, size: 0.2, angle: 45 },
              "Waves": { distortion: 0.25, size: 0.8, angle: 90 },
              "Folds": { distortion: 0.4, size: 0.4, angle: 135 }
            },
            "water": {
              "Default": { waves: 0.5, caustic: 0.5, speed: 1.0 },
              "Abstract": { waves: 0.9, caustic: 1.8, speed: 2.0 },
              "Waves": { waves: 0.8, caustic: 0.2, speed: 0.5 },
              "Folds": { waves: 0.3, caustic: 1.2, speed: 1.5 }
            },
            "dithering": {
              "Default": { colorFront: [0.58, 1.0, 0.69], colorBack: [0.0, 0.05, 0.22], colorHighlight: [0.92, 1.0, 0.58], type: 0, size: 2.0, colorSteps: 2.0, originalColors: 0 },
              "Abstract": { colorFront: [0.93, 0.93, 0.93], colorBack: [0.33, 0.32, 1.0], colorHighlight: [0.93, 0.93, 0.93], type: 1, size: 3.0, colorSteps: 1.0, originalColors: 1 },
              "Waves": { colorFront: [0.64, 0.60, 0.49], colorBack: [0.0, 0.0, 0.0], colorHighlight: [0.93, 0.93, 0.93], type: 2, size: 1.0, colorSteps: 1.0, originalColors: 0 },
              "Folds": { colorFront: [1.0, 1.0, 1.0], colorBack: [0.0, 0.0, 0.0], colorHighlight: [1.0, 1.0, 1.0], type: 0, size: 2.0, colorSteps: 5.0, originalColors: 1 }
            },
            "halftone-dots": {
              "Default": { colorBack: [0.95, 0.95, 0.91], colorFront: [0.17, 0.17, 0.17], size: 0.5, radius: 1.25, contrast: 0.4, originalColors: 0, grid: 0, type: 0, inverted: 0 },
              "Abstract": { colorBack: [0.0, 0.0, 0.0], colorFront: [0.16, 1.0, 0.48], size: 0.5, radius: 1.5, contrast: 0.3, originalColors: 0, grid: 1, type: 1, inverted: 0 },
              "Waves": { colorBack: [0.0, 0.0, 0.0], colorFront: [0.70, 0.68, 0.68], size: 0.6, radius: 2.0, contrast: 0.01, originalColors: 1, grid: 0, type: 2, inverted: 0 },
              "Folds": { colorBack: [0.08, 0.08, 0.08], colorFront: [1.0, 0.50, 0.0], size: 0.8, radius: 1.0, contrast: 1.0, originalColors: 0, grid: 1, type: 3, inverted: 1 }
            },
            "halftone-cmyk": {
              "Default": { colorBack: [0.98, 0.98, 0.96], colorC: [0.0, 0.70, 1.0], colorM: [0.99, 0.32, 0.62], colorY: [1.0, 0.85, 0.0], colorK: [0.14, 0.12, 0.13], size: 0.2, contrast: 1.0, softness: 1.0, type: 0 },
              "Abstract": { colorBack: [1.0, 0.98, 0.94], colorC: [0.35, 0.69, 0.77], colorM: [0.85, 0.41, 0.49], colorY: [0.98, 0.85, 0.36], colorK: [0.18, 0.16, 0.14], size: 0.2, contrast: 1.25, softness: 0.4, type: 1 },
              "Waves": { colorBack: [0.93, 0.94, 0.84], colorC: [0.0, 0.70, 1.0], colorM: [0.99, 0.31, 0.31], colorY: [1.0, 0.85, 0.0], colorK: [0.14, 0.12, 0.13], size: 0.88, contrast: 1.15, softness: 0.0, type: 0 },
              "Folds": { colorBack: [0.95, 0.95, 0.91], colorC: [0.48, 0.48, 0.46], colorM: [0.48, 0.48, 0.46], colorY: [0.48, 0.48, 0.46], colorK: [0.14, 0.12, 0.13], size: 0.01, contrast: 2.0, softness: 0.2, type: 2 }
            }
          };

          const activePresetId = canvas.dataset.shaderPreset || canvas.dataset.filterPreset || "Default";
          const activePreset = isImageFilter
            ? ((PAPER_IMAGE_FILTER_PRESETS[id] && PAPER_IMAGE_FILTER_PRESETS[id][activePresetId]) || (presets[id] && presets[id][activePresetId]) || (PAPER_SHADER_PRESETS[id] && PAPER_SHADER_PRESETS[id][activePresetId]) || {})
            : ((PAPER_SHADER_PRESETS[id] && PAPER_SHADER_PRESETS[id][activePresetId]) || (presets[id] && presets[id][activePresetId]) || {});
          const getVal = (val, presetVal, fallback) => (val !== undefined) ? val : ((presetVal !== undefined) ? presetVal : fallback);
          const activeFit = isImageFilter
            ? fitUniform(canvas.dataset.filterFit || activePreset.fit || "cover", "cover")
            : fitUniform(activePreset.fit, "contain");
          const activeScale = isImageFilter ? numberDataset(activePreset.scale, 1) : Math.max(0.01, scale);
          const activeRotation = isImageFilter ? numberDataset(activePreset.rotation, 0) : angle;
          const activeSpeed = isImageFilter
            ? getVal(filterSpeed, activePreset.speed, 0)
            : (id === "static-mesh-gradient" || id === "paper-texture" ? 0 : speed);

          const state = {
            id,
            c1,
            c2,
            c3,
            c4,
            c5,
            c6,
            currentFrameMs: Math.max(0, frame),
            detail,
            filterDistortion,
            filterSize,
            filterAngle,
            filterContrast,
            filterSpeed,
            filterDetail,
            activePreset,
            getVal,
            gl,
            hasImage: 0,
            imageReady: Promise.resolve(),
            imageAspectRatio: 1,
            intensity,
            lastRenderTime: performance.now(),
            palette: paletteFromColors(c1, c2, c3, c4, c5, c6),
            fit: activeFit,
            noiseTexture,
            positionBuffer,
            prog,
            raf: 0,
            renderedFrames: 0,
            renderScale: 1,
            rotation: activeRotation,
            scale: activeScale,
            angle,
            softness,
            speed: activeSpeed,
            offsetX: isImageFilter ? 0 : numberDataset(activePreset.offsetX, 0),
            offsetY: isImageFilter ? 0 : numberDataset(activePreset.offsetY, 0),
            originX: isImageFilter ? 0.5 : numberDataset(activePreset.originX, 0.5),
            originY: isImageFilter ? 0.5 : numberDataset(activePreset.originY, 0.5),
            worldWidth: isImageFilter ? 0 : numberDataset(activePreset.worldWidth, 0),
            worldHeight: isImageFilter ? 0 : numberDataset(activePreset.worldHeight, 0),
            texture,
            uniforms: getUniforms(gl, prog),
            variant
          };
          state.imageReady = uploadImage(canvas, state);
          return state;
        }

        const shaderStates = new Map();

        function startShader(canvas) {
          if (shaderStates.has(canvas)) return;
          startShaderState(canvas, initWebglShader(canvas));
        }

        function startShaderState(canvas, state) {
          if (!state || shaderStates.has(canvas)) return;
          shaderStates.set(canvas, state);
          state.tick = function tick(now) {
            state.raf = 0;
            if (!shaderStates.has(canvas)) return;
            const isImageFilter = canvas.classList.contains("image-filter-canvas");
            const dt = now - state.lastRenderTime;

            if (dt < 30) {
              state.raf = requestAnimationFrame(state.tick);
              return;
            }

            state.lastRenderTime = now;
            state.currentFrameMs += dt * state.speed;
            const cssW = Math.max(canvas.clientWidth, 1);
            const cssH = Math.max(canvas.clientHeight, 1);
            const dpr = Math.min(Math.max(devicePixelRatio || 1, DEFAULT_MIN_PIXEL_RATIO), 2);
            const maxScale = Math.sqrt(DEFAULT_MAX_PIXEL_COUNT / Math.max(cssW * cssH, 1));
            const isStaticExport = document.documentElement.classList.contains('motion-doc-static-export');
            const renderScale = isStaticExport
              ? Math.max(0.25, Math.min(staticExportRasterScale, dpr, maxScale))
              : Math.max(DEFAULT_MIN_PIXEL_RATIO, Math.min(dpr, maxScale));
            const w = Math.max(1, Math.round(cssW * renderScale));
            const h = Math.max(1, Math.round(cssH * renderScale));

            if (canvas.width !== w || canvas.height !== h || state.renderScale !== renderScale) {
              canvas.width = w;
              canvas.height = h;
              state.renderScale = renderScale;
              state.gl.viewport(0, 0, w, h);
            }

            const gl = state.gl;
            const u = state.uniforms;
            gl.useProgram(state.prog);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, state.texture);
            if (state.noiseTexture && u.u_noiseTexture) {
              gl.activeTexture(gl.TEXTURE1);
              gl.bindTexture(gl.TEXTURE_2D, state.noiseTexture);
              gl.uniform1i(u.u_noiseTexture, 1);
              gl.activeTexture(gl.TEXTURE0);
            }
            if (u.u_time) gl.uniform1f(u.u_time, state.currentFrameMs / 1000);
            if (u.u_resolution) gl.uniform2f(u.u_resolution, w, h);
            if (u.u_pixelRatio) gl.uniform1f(u.u_pixelRatio, state.renderScale);
            if (u.u_fit) gl.uniform1f(u.u_fit, state.fit);
            if (u.u_rotation) gl.uniform1f(u.u_rotation, state.rotation);
            if (u.u_scale) gl.uniform1f(u.u_scale, Math.max(isImageFilter ? 0.05 : 0.01, state.scale));
            if (u.u_originX) gl.uniform1f(u.u_originX, state.originX);
            if (u.u_originY) gl.uniform1f(u.u_originY, state.originY);
            if (u.u_offsetX) gl.uniform1f(u.u_offsetX, state.offsetX);
            if (u.u_offsetY) gl.uniform1f(u.u_offsetY, state.offsetY);
            if (u.u_worldWidth) gl.uniform1f(u.u_worldWidth, state.worldWidth);
            if (u.u_worldHeight) gl.uniform1f(u.u_worldHeight, state.worldHeight);
            if (u.u_hasImage) gl.uniform1i(u.u_hasImage, state.hasImage);
            if (u.u_image) gl.uniform1i(u.u_image, 0);
            if (u.u_imageAspectRatio) gl.uniform1f(u.u_imageAspectRatio, state.imageAspectRatio);
            if (u.u_isImage) gl.uniform1i(u.u_isImage, state.hasImage ? 1 : 0);

            // Bind fallback color vectors (just in case)
            if (u.u_color1) gl.uniform3fv(u.u_color1, state.c1);
            if (u.u_color2) gl.uniform3fv(u.u_color2, state.c2);
            if (u.u_color3) gl.uniform3fv(u.u_color3, state.c3);
            if (u.u_color4) gl.uniform3fv(u.u_color4, state.c4);
            if (u.u_color5) gl.uniform3fv(u.u_color5, state.c5);
            if (u.u_color6) gl.uniform3fv(u.u_color6, state.c6);

            // Shader-specific uniform mappings matching ThreeShaderCanvas.tsx exactly!
            const sixColors = makeColorsArray(6, [state.c1, state.c2, state.c3, state.c4, state.c5, state.c6]);
            const fiveColorsFrom2 = makeColorsArray(5, [state.c2, state.c3, state.c4, state.c5, state.c6]);
            const fourColorsFrom3 = makeColorsArray(4, [state.c3, state.c4, state.c5, state.c6]);

            switch (state.id) {
              case "swirl": {
                const preset = state.activePreset;
                if (u.u_colors) gl.uniform4fv(u.u_colors, fiveColorsFrom2);
                if (u.u_colorsCount) gl.uniform1f(u.u_colorsCount, 5);
                if (u.u_colorBack) gl.uniform4fv(u.u_colorBack, [state.c1[0], state.c1[1], state.c1[2], 1.0]);
                if (u.u_bandCount) gl.uniform1f(u.u_bandCount, preset.bandCount !== undefined ? preset.bandCount : 4.0);
                if (u.u_center) gl.uniform1f(u.u_center, preset.center !== undefined ? preset.center : 0.2);
                if (u.u_proportion) gl.uniform1f(u.u_proportion, preset.proportion !== undefined ? preset.proportion : 0.5);
                if (u.u_softness) gl.uniform1f(u.u_softness, state.softness);
                if (u.u_noiseFrequency) gl.uniform1f(u.u_noiseFrequency, preset.noiseFrequency !== undefined ? preset.noiseFrequency : 0.4);
                if (u.u_noise) gl.uniform1f(u.u_noise, state.detail);
                if (u.u_twist) gl.uniform1f(u.u_twist, state.intensity);
                break;
              }

              case "mesh-gradient": {
                const preset = state.activePreset;
                if (u.u_colors) gl.uniform4fv(u.u_colors, sixColors);
                if (u.u_colorsCount) gl.uniform1f(u.u_colorsCount, 6);
                if (u.u_distortion) gl.uniform1f(u.u_distortion, state.intensity);
                if (u.u_swirl) gl.uniform1f(u.u_swirl, state.softness);
                if (u.u_grainMixer) gl.uniform1f(u.u_grainMixer, state.detail);
                if (u.u_grainOverlay) gl.uniform1f(u.u_grainOverlay, preset.grainOverlay !== undefined ? preset.grainOverlay : 0.0);
                break;
              }

              case "static-mesh-gradient": {
                const preset = state.activePreset;
                if (u.u_colors) gl.uniform4fv(u.u_colors, sixColors);
                if (u.u_colorsCount) gl.uniform1f(u.u_colorsCount, 6);
                if (u.u_positions) gl.uniform1f(u.u_positions, preset.positions !== undefined ? preset.positions : 0.0);
                if (u.u_waveX) gl.uniform1f(u.u_waveX, state.intensity);
                if (u.u_waveXShift) gl.uniform1f(u.u_waveXShift, preset.waveXShift !== undefined ? preset.waveXShift : 0.0);
                if (u.u_waveY) gl.uniform1f(u.u_waveY, state.intensity);
                if (u.u_waveYShift) gl.uniform1f(u.u_waveYShift, preset.waveYShift !== undefined ? preset.waveYShift : 0.0);
                if (u.u_mixing) gl.uniform1f(u.u_mixing, state.softness);
                if (u.u_grainMixer) gl.uniform1f(u.u_grainMixer, state.detail);
                if (u.u_grainOverlay) gl.uniform1f(u.u_grainOverlay, preset.grainOverlay !== undefined ? preset.grainOverlay : 0.0);
                break;
              }

              // ── Image Filters ──
              case "fluted-glass": {
                if (isImageFilter) {
                  const getVal = state.getVal;
                  const preset = state.activePreset;
                  if (u.u_highlights) gl.uniform1f(u.u_highlights, getVal(undefined, preset.highlights, 0.1));
                  if (u.u_shadows) gl.uniform1f(u.u_shadows, getVal(undefined, preset.shadows, 0.25));
                  if (u.u_stretch) gl.uniform1f(u.u_stretch, getVal(undefined, preset.stretch, 0.0));
                  if (u.u_shape) gl.uniform1f(u.u_shape, enumOrNumber(GLASS_GRID_SHAPES, preset.shape, 1));
                  if (u.u_distortionShape) gl.uniform1f(u.u_distortionShape, enumOrNumber(GLASS_DISTORTION_SHAPES, preset.distortionShape, 1));
                  if (u.u_shift) gl.uniform1f(u.u_shift, getVal(undefined, preset.shift, 0.0));
                  if (u.u_blur) gl.uniform1f(u.u_blur, getVal(undefined, preset.blur, 0.0));
                  if (u.u_edges) gl.uniform1f(u.u_edges, getVal(undefined, preset.edges, 0.25));
                  if (u.u_marginLeft) gl.uniform1f(u.u_marginLeft, getVal(undefined, preset.marginLeft, getVal(undefined, preset.margin, 0.0)));
                  if (u.u_marginRight) gl.uniform1f(u.u_marginRight, getVal(undefined, preset.marginRight, getVal(undefined, preset.margin, 0.0)));
                  if (u.u_marginTop) gl.uniform1f(u.u_marginTop, getVal(undefined, preset.marginTop, getVal(undefined, preset.margin, 0.0)));
                  if (u.u_marginBottom) gl.uniform1f(u.u_marginBottom, getVal(undefined, preset.marginBottom, getVal(undefined, preset.margin, 0.0)));
                  if (u.u_grainMixer) gl.uniform1f(u.u_grainMixer, getVal(undefined, preset.grainMixer, 0.0));
                  if (u.u_grainOverlay) gl.uniform1f(u.u_grainOverlay, getVal(undefined, preset.grainOverlay, 0.0));
                  if (u.u_distortion) gl.uniform1f(u.u_distortion, getVal(state.filterDistortion, preset.distortion, 0.5));
                  if (u.u_size) gl.uniform1f(u.u_size, getVal(state.filterSize, preset.size, 0.5));
                  if (u.u_angle) gl.uniform1f(u.u_angle, getVal(state.filterAngle, preset.angle, 0.0));
                  if (u.u_colorBack) gl.uniform4fv(u.u_colorBack, presetVec4(preset.colorBack, "#000000", 0.0));
                  if (u.u_colorShadow) gl.uniform4fv(u.u_colorShadow, presetVec4(preset.colorShadow, "#000000", 0.5));
                  if (u.u_colorHighlight) gl.uniform4fv(u.u_colorHighlight, presetVec4(preset.colorHighlight, "#ffffff", 0.5));
                  break;
                }
                if (u.u_colors) gl.uniform4fv(u.u_colors, fourColorsFrom3);
                if (u.u_colorsCount) gl.uniform1f(u.u_colorsCount, 4);
                if (u.u_colorBack) gl.uniform4fv(u.u_colorBack, [state.c1[0], state.c1[1], state.c1[2], 1.0]);
                if (u.u_colorBloom) gl.uniform4fv(u.u_colorBloom, [state.c2[0], state.c2[1], state.c2[2], 1.0]);
                if (u.u_density) gl.uniform1f(u.u_density, state.detail);
                if (u.u_spotty) gl.uniform1f(u.u_spotty, state.softness);
                if (u.u_intensity) gl.uniform1f(u.u_intensity, state.intensity);
                if (u.u_midSize) gl.uniform1f(u.u_midSize, 0.2);
                if (u.u_midIntensity) gl.uniform1f(u.u_midIntensity, 0.4);
                if (u.u_bloom) gl.uniform1f(u.u_bloom, 0.4);
                break;
              }

              case "water": {
                const getVal = state.getVal;
                const preset = state.activePreset;
                if (u.u_size) gl.uniform1f(u.u_size, isImageFilter ? getVal(state.filterSize, preset.size, 1.0) : Math.max(0.01, state.detail));
                if (u.u_highlights) gl.uniform1f(u.u_highlights, preset.highlights !== undefined ? preset.highlights : 0.07);
                if (u.u_layering) gl.uniform1f(u.u_layering, preset.layering !== undefined ? preset.layering : 0.5);
                if (u.u_edges) gl.uniform1f(u.u_edges, preset.edges !== undefined ? preset.edges : 0.8);
                if (u.u_caustic) gl.uniform1f(u.u_caustic, isImageFilter ? getVal(state.filterContrast, preset.caustic, 0.1) : state.intensity);
                if (u.u_waves) gl.uniform1f(u.u_waves, isImageFilter ? getVal(state.filterDistortion, preset.waves, 0.3) : state.softness);
                if (u.u_colorBack) gl.uniform4fv(u.u_colorBack, isImageFilter ? presetVec4(preset.colorBack, "#000000", 0.0) : [state.c1[0], state.c1[1], state.c1[2], 1.0]);
                if (u.u_colorHighlight) gl.uniform4fv(u.u_colorHighlight, isImageFilter ? presetVec4(preset.colorHighlight, "#ffffff", 0.5) : [state.c2[0], state.c2[1], state.c2[2], 0.72]);
                break;
              }

              case "heatmap": {
                if (u.u_colorsCount) gl.uniform1f(u.u_colorsCount, 5);
                const heatmapColors = makeColorsArray(5, [
                  [0.0, 0.0, 1.0], // Blue
                  [0.0, 1.0, 1.0], // Cyan
                  [0.0, 1.0, 0.0], // Green
                  [1.0, 1.0, 0.0], // Yellow
                  [1.0, 0.0, 0.0]  // Red
                ]);
                if (u.u_colors) gl.uniform4fv(u.u_colors, heatmapColors);
                if (u.u_colorBack) gl.uniform4fv(u.u_colorBack, [0.0, 0.0, 0.0, 1.0]);
                if (u.u_angle) gl.uniform1f(u.u_angle, 0.0);
                if (u.u_noise) gl.uniform1f(u.u_noise, 0.5);
                if (u.u_innerGlow) gl.uniform1f(u.u_innerGlow, 0.5);
                if (u.u_outerGlow) gl.uniform1f(u.u_outerGlow, 0.5);
                if (u.u_contour) gl.uniform1f(u.u_contour, 0.5);
                if (u.u_isImage) gl.uniform1i(u.u_isImage, state.hasImage ? 1 : 0);
                break;
              }

              case "halftone-dots": {
                const getVal = state.getVal;
                const preset = state.activePreset;
                const cB = presetVec3(preset.colorBack, "#f2f1e8");
                const cF = presetVec3(preset.colorFront, "#2b2b2b");
                if (u.u_colorBack) gl.uniform4fv(u.u_colorBack, [cB[0], cB[1], cB[2], 1.0]);
                if (u.u_colorFront) gl.uniform4fv(u.u_colorFront, [cF[0], cF[1], cF[2], 1.0]);
                if (u.u_radius) gl.uniform1f(u.u_radius, getVal(state.filterDistortion, preset.radius, 1.25));
                if (u.u_contrast) gl.uniform1f(u.u_contrast, getVal(state.filterContrast, preset.contrast, 0.4));
                if (u.u_size) gl.uniform1f(u.u_size, getVal(state.filterSize, preset.size, 0.5));
                if (u.u_rotation) gl.uniform1f(u.u_rotation, 0.0);
                if (u.u_originalColors) gl.uniform1i(u.u_originalColors, boolParam(preset.originalColors, false) ? 1 : 0);
                if (u.u_inverted) gl.uniform1i(u.u_inverted, boolParam(preset.inverted, false) ? 1 : 0);
                if (u.u_grid) gl.uniform1f(u.u_grid, enumOrNumber(HALFTONE_DOTS_GRIDS, preset.grid, 1));
                if (u.u_type) gl.uniform1f(u.u_type, enumOrNumber(HALFTONE_DOTS_TYPES, preset.type, 1));
                if (u.u_grainMixer) gl.uniform1f(u.u_grainMixer, getVal(undefined, preset.grainMixer, 0.2));
                if (u.u_grainOverlay) gl.uniform1f(u.u_grainOverlay, getVal(undefined, preset.grainOverlay, 0.2));
                if (u.u_grainSize) gl.uniform1f(u.u_grainSize, getVal(undefined, preset.grainSize, 0.5));
                break;
              }

              case "halftone-cmyk": {
                const getVal = state.getVal;
                const preset = state.activePreset;
                const cB = presetVec3(preset.colorBack, "#fbfaf5");
                const cC = presetVec3(preset.colorC, "#00b4ff");
                const cM = presetVec3(preset.colorM, "#fc519f");
                const cY = presetVec3(preset.colorY, "#ffd800");
                const cK = presetVec3(preset.colorK, "#231f20");
                if (u.u_colorBack) gl.uniform4fv(u.u_colorBack, [cB[0], cB[1], cB[2], 1.0]);
                if (u.u_colorC) gl.uniform4fv(u.u_colorC, [cC[0], cC[1], cC[2], 1.0]);
                if (u.u_colorM) gl.uniform4fv(u.u_colorM, [cM[0], cM[1], cM[2], 1.0]);
                if (u.u_colorY) gl.uniform4fv(u.u_colorY, [cY[0], cY[1], cY[2], 1.0]);
                if (u.u_colorK) gl.uniform4fv(u.u_colorK, [cK[0], cK[1], cK[2], 1.0]);
                if (u.u_size) gl.uniform1f(u.u_size, getVal(state.filterSize, preset.size, 0.2));
                if (u.u_minDot) gl.uniform1f(u.u_minDot, getVal(state.filterDetail, preset.minDot, 0.1));
                if (u.u_contrast) gl.uniform1f(u.u_contrast, getVal(state.filterContrast, preset.contrast, 1.0));
                if (u.u_softness) gl.uniform1f(u.u_softness, getVal(state.filterSpeed, preset.softness, 1.0));
                if (u.u_type) gl.uniform1f(u.u_type, enumOrNumber(HALFTONE_CMYK_TYPES, preset.type, 1));
                if (u.u_grainSize) gl.uniform1f(u.u_grainSize, getVal(undefined, preset.grainSize, 0.5));
                if (u.u_grainMixer) gl.uniform1f(u.u_grainMixer, getVal(undefined, preset.grainMixer, 0.0));
                if (u.u_grainOverlay) gl.uniform1f(u.u_grainOverlay, getVal(undefined, preset.grainOverlay, 0.0));
                if (u.u_gridNoise) gl.uniform1f(u.u_gridNoise, getVal(undefined, preset.gridNoise, 0.2));
                if (u.u_floodC) gl.uniform1f(u.u_floodC, getVal(undefined, preset.floodC, 0.15));
                if (u.u_floodM) gl.uniform1f(u.u_floodM, getVal(undefined, preset.floodM, 0.0));
                if (u.u_floodY) gl.uniform1f(u.u_floodY, getVal(undefined, preset.floodY, 0.0));
                if (u.u_floodK) gl.uniform1f(u.u_floodK, getVal(undefined, preset.floodK, 0.0));
                if (u.u_gainC) gl.uniform1f(u.u_gainC, getVal(undefined, preset.gainC, 0.3));
                if (u.u_gainM) gl.uniform1f(u.u_gainM, getVal(undefined, preset.gainM, 0.0));
                if (u.u_gainY) gl.uniform1f(u.u_gainY, getVal(undefined, preset.gainY, 0.2));
                if (u.u_gainK) gl.uniform1f(u.u_gainK, getVal(undefined, preset.gainK, 0.0));
                break;
              }

              case "paper-texture": {
                const getVal = state.getVal;
                const preset = state.activePreset;
                if (u.u_colorFront) gl.uniform4fv(u.u_colorFront, isImageFilter ? presetVec4(preset.colorFront, "#9fadbc", 1.0) : [state.c2[0], state.c2[1], state.c2[2], 1.0]);
                if (u.u_colorBack) gl.uniform4fv(u.u_colorBack, isImageFilter ? presetVec4(preset.colorBack, "#ffffff", 1.0) : [state.c1[0], state.c1[1], state.c1[2], 1.0]);
                if (u.u_contrast) gl.uniform1f(u.u_contrast, isImageFilter ? getVal(state.filterContrast, preset.contrast, 0.5) : state.detail);
                if (u.u_roughness) gl.uniform1f(u.u_roughness, isImageFilter ? getVal(state.filterDistortion, preset.roughness, 0.5) : state.intensity);
                if (u.u_fiber) gl.uniform1f(u.u_fiber, isImageFilter ? getVal(state.filterSize, preset.fiber, 0.5) : state.softness);
                if (u.u_fiberSize) gl.uniform1f(u.u_fiberSize, preset.fiberSize !== undefined ? preset.fiberSize : 0.5);
                if (u.u_crumples) gl.uniform1f(u.u_crumples, preset.crumples !== undefined ? preset.crumples : 0.5);
                if (u.u_crumpleSize) gl.uniform1f(u.u_crumpleSize, preset.crumpleSize !== undefined ? preset.crumpleSize : 0.5);
                if (u.u_folds) gl.uniform1f(u.u_folds, preset.folds !== undefined ? preset.folds : 0.5);
                if (u.u_foldCount) gl.uniform1f(u.u_foldCount, preset.foldCount !== undefined ? preset.foldCount : 5.0);
                if (u.u_drops) gl.uniform1f(u.u_drops, preset.drops !== undefined ? preset.drops : 0.5);
                if (u.u_fade) gl.uniform1f(u.u_fade, preset.fade !== undefined ? preset.fade : 0.0);
                if (u.u_seed) gl.uniform1f(u.u_seed, preset.seed !== undefined ? preset.seed : 5.8);
                break;
              }

              case "dithering": {
                if (isImageFilter) {
                  const getVal = state.getVal;
                  const preset = state.activePreset;
                  const cF = presetVec3(preset.colorFront, "#ffffff");
                  const cB = presetVec3(preset.colorBack, "#000000");
                  const cH = presetVec3(preset.colorHighlight, "#ffffff");
                  if (u.u_colorFront) gl.uniform4fv(u.u_colorFront, [cF[0], cF[1], cF[2], 1.0]);
                  if (u.u_colorBack) gl.uniform4fv(u.u_colorBack, [cB[0], cB[1], cB[2], 1.0]);
                  if (u.u_colorHighlight) gl.uniform4fv(u.u_colorHighlight, [cH[0], cH[1], cH[2], 1.0]);
                  if (u.u_scale) gl.uniform1f(u.u_scale, 1.0);
                  if (u.u_pxSize) gl.uniform1f(u.u_pxSize, getVal(state.filterSize, preset.size, 2.0));
                  if (u.u_colorSteps) gl.uniform1f(u.u_colorSteps, Math.max(1, Math.round(getVal(state.filterDetail, preset.colorSteps, 2.0))));
                  if (u.u_rotation) gl.uniform1f(u.u_rotation, 0.0);
                  if (u.u_originalColors) gl.uniform1i(u.u_originalColors, state.filterDistortion !== undefined ? (state.filterDistortion > 0.5 ? 1 : 0) : (boolParam(preset.originalColors, false) ? 1 : 0));
                  if (u.u_inverted) gl.uniform1i(u.u_inverted, boolParam(preset.inverted, false) ? 1 : 0);
                  if (u.u_type) gl.uniform1f(u.u_type, enumOrNumber(DITHERING_TYPES, preset.type, 4));
                  break;
                }
                const preset = state.activePreset;
                const ditherShape = enumValue(DITHERING_SHAPES, preset.shape, 7.0);
                const ditherType = enumValue(DITHERING_TYPES, preset.type, 3.0);

                if (u.u_colorBack) gl.uniform4fv(u.u_colorBack, [state.c1[0], state.c1[1], state.c1[2], 1.0]);
                if (u.u_colorFront) gl.uniform4fv(u.u_colorFront, [state.c2[0], state.c2[1], state.c2[2], 1.0]);
                if (u.u_pxSize) gl.uniform1f(u.u_pxSize, Math.max(0.5, state.detail));
                if (u.u_shape) gl.uniform1f(u.u_shape, ditherShape);
                if (u.u_type) gl.uniform1f(u.u_type, ditherType);

                if (state.hasImage) {
                  if (u.u_colorHighlight) gl.uniform4fv(u.u_colorHighlight, [state.c3[0], state.c3[1], state.c3[2], 1.0]);
                  if (u.u_colorSteps) gl.uniform1f(u.u_colorSteps, Math.max(1, Math.round(state.softness * 8)));
                  if (u.u_originalColors) gl.uniform1i(u.u_originalColors, state.intensity > 0.3 ? 1 : 0);
                }
                break;
              }

              case "dot-orbit": {
                const preset = state.activePreset;
                if (u.u_colors) gl.uniform4fv(u.u_colors, fiveColorsFrom2);
                if (u.u_colorsCount) gl.uniform1f(u.u_colorsCount, 5);
                if (u.u_colorBack) gl.uniform4fv(u.u_colorBack, [state.c1[0], state.c1[1], state.c1[2], 1.0]);
                if (u.u_size) gl.uniform1f(u.u_size, preset.size !== undefined ? preset.size : 0.8);
                if (u.u_spreading) gl.uniform1f(u.u_spreading, state.intensity);
                if (u.u_sizeRange) gl.uniform1f(u.u_sizeRange, state.softness);
                if (u.u_stepsPerColor) gl.uniform1f(u.u_stepsPerColor, Math.max(1, Math.round(state.detail)));
                break;
              }

              case "god-rays": {
                const preset = state.activePreset;
                if (u.u_colors) gl.uniform4fv(u.u_colors, fourColorsFrom3);
                if (u.u_colorsCount) gl.uniform1f(u.u_colorsCount, 4);
                if (u.u_colorBack) gl.uniform4fv(u.u_colorBack, [state.c1[0], state.c1[1], state.c1[2], 1.0]);
                if (u.u_colorBloom) gl.uniform4fv(u.u_colorBloom, [state.c2[0], state.c2[1], state.c2[2], 1.0]);
                if (u.u_density) gl.uniform1f(u.u_density, state.detail);
                if (u.u_spotty) gl.uniform1f(u.u_spotty, state.softness);
                if (u.u_intensity) gl.uniform1f(u.u_intensity, state.intensity);
                if (u.u_midSize) gl.uniform1f(u.u_midSize, preset.midSize !== undefined ? preset.midSize : 0.2);
                if (u.u_midIntensity) gl.uniform1f(u.u_midIntensity, preset.midIntensity !== undefined ? preset.midIntensity : 0.4);
                if (u.u_bloom) gl.uniform1f(u.u_bloom, preset.bloom !== undefined ? preset.bloom : 0.4);
                break;
              }

              case "neuro-noise": {
                if (u.u_colorBack) gl.uniform4fv(u.u_colorBack, [state.c1[0], state.c1[1], state.c1[2], 1.0]);
                if (u.u_colorMid) gl.uniform4fv(u.u_colorMid, [state.c2[0], state.c2[1], state.c2[2], 1.0]);
                if (u.u_colorFront) gl.uniform4fv(u.u_colorFront, [state.c3[0], state.c3[1], state.c3[2], 1.0]);
                if (u.u_brightness) gl.uniform1f(u.u_brightness, state.intensity);
                if (u.u_contrast) gl.uniform1f(u.u_contrast, state.detail);
                break;
              }

              case "liquid-metal": {
                const preset = state.activePreset;
                if (u.u_colorBack) gl.uniform4fv(u.u_colorBack, [state.c1[0], state.c1[1], state.c1[2], 1.0]);
                if (u.u_colorTint) gl.uniform4fv(u.u_colorTint, [state.c2[0], state.c2[1], state.c2[2], 1.0]);
                if (u.u_distortion) gl.uniform1f(u.u_distortion, state.intensity);
                if (u.u_softness) gl.uniform1f(u.u_softness, state.softness);
                if (u.u_repetition) gl.uniform1f(u.u_repetition, preset.repetition !== undefined ? preset.repetition : 2.0);
                if (u.u_contour) gl.uniform1f(u.u_contour, state.detail);
                if (u.u_shiftRed) gl.uniform1f(u.u_shiftRed, preset.shiftRed !== undefined ? preset.shiftRed : 0.3);
                if (u.u_shiftBlue) gl.uniform1f(u.u_shiftBlue, preset.shiftBlue !== undefined ? preset.shiftBlue : 0.3);
                if (u.u_angle) gl.uniform1f(u.u_angle, state.angle);
                if (u.u_shape) gl.uniform1f(u.u_shape, state.hasImage ? 0 : enumValue(LIQUID_METAL_SHAPES, preset.shape, 3));
                break;
              }

              case "grain-gradient": {
                const preset = state.activePreset;
                if (u.u_colors) gl.uniform4fv(u.u_colors, sixColors);
                if (u.u_colorsCount) gl.uniform1f(u.u_colorsCount, 6);
                if (u.u_colorBack) gl.uniform4fv(u.u_colorBack, [state.c1[0], state.c1[1], state.c1[2], 1.0]);
                if (u.u_intensity) gl.uniform1f(u.u_intensity, state.intensity);
                if (u.u_noise) gl.uniform1f(u.u_noise, state.detail);
                if (u.u_softness) gl.uniform1f(u.u_softness, state.softness);
                if (u.u_shape) gl.uniform1f(u.u_shape, enumValue(GRAIN_GRADIENT_SHAPES, preset.shape, 4.0));
                break;
              }

              case "metaballs": {
                if (u.u_colors) gl.uniform4fv(u.u_colors, sixColors);
                if (u.u_colorsCount) gl.uniform1f(u.u_colorsCount, 6);
                if (u.u_colorBack) gl.uniform4fv(u.u_colorBack, [state.c1[0], state.c1[1], state.c1[2], 1.0]);
                if (u.u_size) gl.uniform1f(u.u_size, state.intensity);
                if (u.u_count) gl.uniform1f(u.u_count, Math.max(1, Math.round(state.detail)));
                break;
              }

              default: {
                if (u.u_colors) gl.uniform4fv(u.u_colors, sixColors);
                break;
              }
            }
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            state.renderedFrames += 1;

            if (state.speed !== 0) {
              state.raf = requestAnimationFrame(state.tick);
            }
          };
          requestShaderFrame(state);
        }

        function requestShaderFrame(state) {
          if (state.raf) return;
          state.lastRenderTime = performance.now();
          state.raf = requestAnimationFrame(state.tick);
        }

        function requestFreshShaderFrame(state) {
          if (state.raf) {
            cancelAnimationFrame(state.raf);
            state.raf = 0;
          }
          state.renderedFrames = 0;
          state.lastRenderTime = performance.now() - 34;
          requestShaderFrame(state);
        }

        function waitForRenderedShaders(canvases) {
          return new Promise((resolve) => {
            let remaining = 12;
            const step = () => {
              const pending = canvases.some((canvas) => {
                const state = shaderStates.get(canvas);
                return state && state.renderedFrames < 1;
              });

              if (!pending || remaining <= 0) {
                resolve();
                return;
              }
              remaining -= 1;
              requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          });
        }

        function waitForImages(root) {
          const images = Array.from(root.querySelectorAll('img'));
          return Promise.all(images.map((image) => {
            if (image.complete) return Promise.resolve();
            return new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            });
          }));
        }

        async function freezeCanvas(canvas) {
          if (!(canvas instanceof HTMLCanvasElement)) return;

          const state = shaderStates.get(canvas);
          if (canvas.classList.contains('image-filter-canvas') && (!state || state.hasImage !== 1 || state.imageLoadFailed)) {
            // Preserve the source <img> already rendered below the filter
            // canvas. Capturing an unavailable WebGL texture yields opaque
            // black pixels in HTML/PPTX exports.
            stopShader(canvas);
            canvas.remove();
            return;
          }

          let dataUrl = '';

          try {
            dataUrl = canvas.toDataURL('image/png');
          } catch (error) {
            console.warn('Unable to freeze shader canvas', error);
          }

          if (!dataUrl && canvas.classList.contains('image-filter-canvas') && canvas.dataset.shaderImage) {
            dataUrl = canvas.dataset.shaderImage;
          }

          if (!dataUrl) return;

          const image = document.createElement('img');
          image.alt = '';
          image.decoding = 'sync';
          image.className = canvas.className ? canvas.className + ' shader-still-image' : 'shader-still-image';

          const inlineStyle = canvas.getAttribute('style');
          if (inlineStyle) {
            image.setAttribute('style', inlineStyle);
          }

          Array.from(canvas.attributes).forEach((attribute) => {
            if (attribute.name.startsWith('data-')) {
              image.setAttribute(attribute.name, attribute.value);
            }
          });

          image.src = dataUrl;
          stopShader(canvas);
          canvas.replaceWith(image);

          if (typeof image.decode === 'function') {
            try {
              await image.decode();
            } catch {
              // The source image remains underneath image filters if decoding fails.
            }
          } else if (!image.complete) {
            await new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            });
          }
        }

        async function prepareStaticExport(options = {}) {
          stop();
          motionController?.cancel();
          const requestedRasterScale = Number(options.rasterScale);
          staticExportRasterScale = Number.isFinite(requestedRasterScale)
            ? Math.max(0.25, Math.min(requestedRasterScale, 2))
            : 1;
          document.documentElement.classList.add('motion-doc-static-export');
          document.body.dataset.motionExportPrepared = 'false';
          await svgHydration;
          slides.forEach((slide) => slide.classList.add('is-active'));
          document.querySelectorAll('.slide .block-svg-stage').forEach((surface) => {
            applySvgStage(surface, surface.dataset.svgStage, 0, surface.dataset.svgEasing, false);
          });
          updateFrameScale();

          if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
          }
          await waitForImages(document);
          layoutCroppedImages(document);

          const canvases = Array.from(document.querySelectorAll('.shader-bg, .image-filter-canvas'))
            .filter((canvas) => canvas instanceof HTMLCanvasElement);

          canvases.forEach((canvas) => {
            stopShader(canvas);
            startShader(canvas);
          });
          await Promise.all(canvases.map((canvas) => {
            const state = shaderStates.get(canvas);
            return state ? state.imageReady : Promise.resolve();
          }));
          canvases.forEach((canvas) => {
            const state = shaderStates.get(canvas);
            if (state) requestFreshShaderFrame(state);
          });
          if (canvases.length > 0) {
            await waitForRenderedShaders(canvases);
          }
          await Promise.all(canvases.map(freezeCanvas));
          shaderStates.forEach((_, canvas) => stopShader(canvas));
          document.body.dataset.motionExportPrepared = 'true';

          return { slideCount: slides.length };
        }

        window.__motionDocExport = {
          prepareStaticExport
        };

        hydrateYouTubeEmbeds();

        function stopShader(canvas) {
          const state = shaderStates.get(canvas);
          if (!state) return;
          cancelAnimationFrame(state.raf);
          if (state.positionBuffer) state.gl.deleteBuffer(state.positionBuffer);
          if (state.texture) state.gl.deleteTexture(state.texture);
          if (state.noiseTexture) state.gl.deleteTexture(state.noiseTexture);
          state.gl.deleteProgram(state.prog);
          shaderStates.delete(canvas);
        }

        // Hook into slide transitions
        const origRender = render;
        render = function(nextIndex, replay) {
          // Stop all shaders before transition
          shaderStates.forEach((_, canvas) => stopShader(canvas));
          origRender(nextIndex, replay);
          // Start shader on active slide
          const active = slides[index];
          if (active) {
            const shaderCanvas = active.querySelector('.shader-bg');
            if (shaderCanvas) startShader(shaderCanvas);
            const imageFilterCanvases = active.querySelectorAll('.image-filter-canvas');
            imageFilterCanvases.forEach(startShader);
          }
        };

        // Stop live shaders before print unless static export already froze them as images.
        window.addEventListener('beforeprint', () => {
          if (document.body.dataset.motionExportPrepared === 'true') return;
          shaderStates.forEach((_, canvas) => stopShader(canvas));
        });
        window.addEventListener('afterprint', () => {
          if (document.body.dataset.motionExportPrepared === 'true') return;
          const active = slides[index];
          if (active) {
            const shaderCanvas = active.querySelector('.shader-bg');
            if (shaderCanvas) startShader(shaderCanvas);
            const imageFilterCanvases = active.querySelectorAll('.image-filter-canvas');
            imageFilterCanvases.forEach(startShader);
          }
        });

        // Initial shader start
        if (slides[0]) {
          const sc = slides[0].querySelector('.shader-bg');
          if (sc) startShader(sc);
          const filterCanvases = slides[0].querySelectorAll('.image-filter-canvas');
          filterCanvases.forEach(startShader);
        }
      })();`;

}
