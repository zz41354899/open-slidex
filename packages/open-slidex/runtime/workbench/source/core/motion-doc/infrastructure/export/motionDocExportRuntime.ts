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
        const player = document.querySelector(".player");
        const stage = document.querySelector(".stage");
        const viewport = document.querySelector(".viewport");
        let index = 0;
        let timer = null;
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

        function render(nextIndex, replay = false) {
          if (slides.length === 0) return;
          index = (nextIndex + slides.length) % slides.length;
          slides.forEach((slide) => slide.classList.remove("is-active"));
          const activeSlide = slides[index];

          if (replay) {
            activeSlide.getBoundingClientRect();
          }

          activeSlide.classList.add("is-active");
          layoutCroppedImages(activeSlide);
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
          fullscreenButton.textContent = document.fullscreenElement ? "×" : "⛶";
          fullscreenButton.setAttribute("aria-label", document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen");
        }

        document.addEventListener("click", (event) => {
          const button = event.target.closest("[data-action]");
          if (!button) return;
          const action = button.dataset.action;

          if (action === "prev") {
            stop();
            render(index - 1);
          }
          if (action === "next") {
            stop();
            render(index + 1);
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
        });

        document.addEventListener("fullscreenchange", updateFullscreenButton);
        window.addEventListener("resize", updateFrameScale);

        document.addEventListener("keydown", (event) => {
          if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
            event.preventDefault();
            stop();
            render(index + 1);
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

        updateFrameScale();
        render(0);
        updateFullscreenButton();

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

          if (!src) return Promise.resolve();

          return new Promise((resolve) => {
            const img = new Image();
            if (!src.startsWith('data:') && !src.startsWith('blob:')) {
              img.crossOrigin = 'anonymous';
            }
            img.onload = () => {
              if (!shaderStates.has(canvas) || img.naturalWidth === 0 || img.naturalHeight === 0) {
                resolve();
                return;
              }
              state.gl.activeTexture(state.gl.TEXTURE0);
              state.gl.bindTexture(state.gl.TEXTURE_2D, state.texture);
              configureTexture(state.gl);
              state.gl.texImage2D(state.gl.TEXTURE_2D, 0, state.gl.RGBA, state.gl.RGBA, state.gl.UNSIGNED_BYTE, img);
              state.imageAspectRatio = img.naturalWidth / img.naturalHeight;
              state.hasImage = 1;
              requestShaderFrame(state);
              resolve();
            };
            img.onerror = () => resolve();
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
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
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
            const renderScale = Math.max(1, Math.min(dpr, maxScale));
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

        async function prepareStaticExport() {
          stop();
          document.documentElement.classList.add('motion-doc-static-export');
          document.body.dataset.motionExportPrepared = 'false';
          slides.forEach((slide) => slide.classList.add('is-active'));
          updateFrameScale();

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
