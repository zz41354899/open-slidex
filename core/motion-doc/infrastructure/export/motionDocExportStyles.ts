import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";
import {
  legacyCssFontPixelsToCanvasPixels,
  MOTION_DOC_FONT_SIZES,
  motionDocFontPointsToCanvasPixels
} from "@/core/motion-doc/domain/typography";

export const motionDocExportStyles = `      :root {
        --motion-doc-canvas-width: ${MOTION_DOC_CANVAS_WIDTH}px;
        --motion-doc-canvas-height: ${MOTION_DOC_CANVAS_HEIGHT}px;
        color-scheme: dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      html,
      body {
        min-height: 100%;
      }
      body {
        margin: 0;
        background: radial-gradient(circle at center, #18181b 0%, #000 100%);
        color: #ffffff;
        overflow: hidden;
      }
      button {
        font: inherit;
      }
      .player {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100vh;
        width: 100%;
        padding: 0;
      }
      .player:fullscreen {
        background: #000;
      }
      .stage {
        display: flex;
        flex: 1;
        min-height: 0;
        align-items: center;
        justify-content: center;
        padding: 40px;
      }
      .player:fullscreen .stage {
        padding: 0;
      }
      .viewport {
        position: relative;
        width: var(--export-viewport-width, var(--motion-doc-canvas-width));
        height: var(--export-viewport-height, var(--motion-doc-canvas-height));
        aspect-ratio: ${MOTION_DOC_CANVAS_WIDTH} / ${MOTION_DOC_CANVAS_HEIGHT};
        overflow: hidden;
        border-radius: 12px;
        background: #000;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 32px 120px rgba(0, 0, 0, 0.6), 0 0 80px rgba(255, 255, 255, 0.02);
      }
      .player:fullscreen .viewport {
        border-radius: 0;
        box-shadow: none;
      }
      .frame {
        position: absolute;
        left: 0;
        top: 0;
        width: var(--motion-doc-canvas-width);
        height: var(--motion-doc-canvas-height);
        overflow: hidden;
        transform: scale(var(--viewport-scale, 1));
        transform-origin: left top;
      }
      .slide {
        position: absolute;
        left: 0;
        top: 0;
        width: var(--motion-doc-canvas-width);
        height: var(--motion-doc-canvas-height);
        display: none;
        flex-direction: column;
        overflow: hidden;
        padding: var(--slide-padding, clamp(16px, 3%, 32px));
        background: var(--slide-bg);
        color: var(--slide-fg);
        text-align: var(--slide-text-align, left);
      }
      .slide.is-active {
        display: flex;
        z-index: 2;
      }
      .slide.is-leaving {
        animation: slide-exit-soft var(--slide-transition-duration, 0.72s) cubic-bezier(0.4, 0, 1, 1) both;
        display: flex;
        pointer-events: none;
        z-index: 1;
      }
      .slide.is-leaving.is-morph-leaving {
        animation-name: morph-exit-unmatched;
        animation-timing-function: linear;
      }
      .slide-content {
        position: relative;
        z-index: 10;
        display: flex;
        flex: 1;
        min-width: 0;
        min-height: 0;
        width: 100%;
        flex-direction: var(--slide-content-direction, column);
        align-items: var(--slide-align-x, flex-start);
        justify-content: var(--slide-align-y, center);
        gap: var(--slide-content-gap, 20px);
        overflow: visible;
      }
      .slide-content--freeform {
        height: 100%;
      }
      .slide-content--split {
        --slide-content-direction: row;
        --slide-content-gap: 48px;
        align-items: stretch;
      }
      .slide-split-pane {
        display: flex;
        flex: 1 1 0;
        min-width: 0;
        min-height: 0;
      }
      .slide-split-pane--content {
        flex-direction: column;
        justify-content: center;
      }
      .slide-split-pane--media {
        align-items: center;
        justify-content: center;
      }
      .slide-transition-fade.is-active {
        animation: slide-enter-fade var(--slide-transition-duration, 0.72s) cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .slide-transition-rise.is-active {
        animation: slide-enter-rise var(--slide-transition-duration, 0.72s) cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .slide-transition-push-left.is-active {
        animation: slide-enter-push-left var(--slide-transition-duration, 0.72s) cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .slide-transition-scale.is-active {
        animation: slide-enter-scale var(--slide-transition-duration, 0.72s) cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .slide-transition-wipe.is-active {
        animation: slide-enter-wipe var(--slide-transition-duration, 0.72s) cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .slide-transition-curtain.is-active {
        animation: slide-enter-curtain var(--slide-transition-duration, 0.72s) cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .slide::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 20% 10%, color-mix(in srgb, var(--slide-accent) 28%, transparent), transparent 28rem),
          radial-gradient(circle at 90% 70%, color-mix(in srgb, var(--slide-accent) 18%, transparent), transparent 24rem);
        opacity: var(--slide-overlay-opacity, 0.72);
        pointer-events: none;
      }
      .shader-bg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
        display: block;
        pointer-events: none;
      }
      .slide-bg-image {
        position: absolute;
        inset: 0;
        z-index: 0;
        background-position: center;
        background-repeat: no-repeat;
        pointer-events: none;
      }
      .motion-block {
        position: relative;
        width: 100%;
        height: auto;
        z-index: 2;
        opacity: 0;
        transform: translate3d(0, calc(28px * var(--frame-scale, 1)), 0);
      }
      .motion-block--positioned {
        position: absolute;
        left: var(--motion-x, 8%);
        top: var(--motion-y, 12%);
        width: var(--motion-w, 42%);
        height: var(--motion-h, auto);
      }
      .slide.show-interaction-hints [data-slidex-interaction] {
        border-radius: 12px;
        box-shadow: 0 0 0 3px rgba(196, 181, 253, .95), 0 0 0 10px rgba(139, 92, 246, .18), 0 0 34px rgba(139, 92, 246, .55);
        animation: interaction-area-hint .9s ease-out both !important;
      }
      .motion-block > * {
        width: 100%;
        height: 100%;
        max-width: none;
      }
      .motion-block:not(.motion-block--positioned):not(.motion-block--full) > * {
        height: auto;
      }
      .motion-block .block-text {
        width: 100%;
        max-width: none;
      }
      .slide.is-active .motion-block {
        animation: enter-motion var(--motion-duration, 0.6s) cubic-bezier(0.22, 1, 0.36, 1) var(--motion-delay, 0s) both;
      }
      .slide.is-active .motion-block.enter-reveal {
        animation-name: enter-reveal-motion;
      }
      .slide.is-active .motion-block.enter-none {
        animation: none;
      }
      .enter-none {
        opacity: 1;
        transform: none;
      }
      .enter-blur-in {
        filter: blur(14px);
        transform: scale(1.04);
      }
      .enter-fade-in {
        transform: none;
      }
      .enter-pop {
        transform: scale(0.72);
      }
      .enter-reveal {
        clip-path: inset(0 100% 0 0);
        transform: translate3d(0, calc(10px * var(--frame-scale, 1)), 0) scale(0.98);
      }
      .enter-rise {
        transform: translate3d(0, calc(42px * var(--frame-scale, 1)), 0) rotate(-1.2deg);
      }
      .enter-zoom-in {
        transform: scale(0.88);
      }
      .enter-slide-left {
        transform: translate3d(calc(54px * var(--frame-scale, 1)), 0, 0);
      }
      .enter-fade-up {
        transform: translate3d(0, calc(28px * var(--frame-scale, 1)), 0);
      }
      @keyframes enter-motion {
        to {
          filter: blur(0);
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1) rotate(0);
        }
      }
      @keyframes interaction-area-hint {
        0%, 100% { box-shadow: 0 0 0 3px rgba(196, 181, 253, .8), 0 0 0 7px rgba(139, 92, 246, .12), 0 0 20px rgba(139, 92, 246, .3); }
        45% { box-shadow: 0 0 0 4px rgba(221, 214, 254, 1), 0 0 0 14px rgba(139, 92, 246, .23), 0 0 42px rgba(139, 92, 246, .65); }
      }
      @keyframes enter-reveal-motion {
        to {
          clip-path: inset(0 0 0 0);
          filter: blur(0);
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1) rotate(0);
        }
      }
      @keyframes slide-enter-fade {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes slide-enter-rise {
        from {
          opacity: 0;
          transform: translate3d(0, calc(36px * var(--frame-scale, 1)), 0) scale(0.985);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0) scale(1);
        }
      }
      @keyframes slide-enter-push-left {
        from {
          opacity: 0;
          transform: translate3d(calc(96px * var(--frame-scale, 1)), 0, 0);
        }
        to {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
      }
      @keyframes slide-enter-scale {
        from {
          filter: blur(8px);
          opacity: 0;
          transform: scale(1.08);
        }
        to {
          filter: blur(0);
          opacity: 1;
          transform: scale(1);
        }
      }
      @keyframes slide-enter-wipe {
        from {
          clip-path: inset(0 100% 0 0);
        }
        to {
          clip-path: inset(0 0 0 0);
        }
      }
      @keyframes slide-enter-curtain {
        from {
          clip-path: inset(0 0 100% 0);
          transform: translate3d(0, calc(18px * var(--frame-scale, 1)), 0);
        }
        to {
          clip-path: inset(0 0 0 0);
          transform: translate3d(0, 0, 0);
        }
      }
      .block-text {
        margin: 0;
        max-width: 46rem;
        border-radius: var(--motion-radius, 0);
        font-size: calc(var(--motion-font-size, ${motionDocFontPointsToCanvasPixels(MOTION_DOC_FONT_SIZES.body)}px) * var(--frame-scale, 1));
        font-weight: var(--motion-font-weight, 400);
        letter-spacing: var(--motion-letter-spacing, 0px);
        line-height: var(--motion-line-height, 1.45);
        padding: var(--motion-text-padding, 0);
        background: var(--motion-bg, transparent);
        color: var(--motion-fg, var(--slide-muted));
        text-align: var(--motion-text-align, inherit);
      }
      .block-line {
        display: block;
        white-space: pre-wrap;
      }
      .block-line--bullet {
        padding-left: 1.2em;
        text-indent: -1.2em;
      }
      .block-line--ordered {
        padding-left: 1.8em;
        text-indent: -1.8em;
      }
      .block-markdown-heading {
        color: var(--motion-fg, var(--slide-fg));
      }
      .block-text a {
        color: inherit;
        text-decoration-thickness: 0.07em;
        text-underline-offset: 0.12em;
      }
      .block-text--blockquote {
        border-left: 0.16em solid var(--slide-accent);
        font-style: italic;
        padding-left: 0.85em;
      }
      .block-text--code {
        overflow: hidden;
        padding: 0.75em 0.9em;
        border: 1px solid var(--slide-border);
        background: color-mix(in srgb, var(--slide-card) 88%, black);
        color: var(--motion-fg, var(--slide-fg));
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: calc(var(--motion-font-size, ${motionDocFontPointsToCanvasPixels(MOTION_DOC_FONT_SIZES.body * 0.86)}px) * var(--frame-scale, 1));
        line-height: 1.5;
        white-space: pre-wrap;
      }
      .block-image {
        margin: 0;
        width: 100%;
        max-width: 54rem;
        overflow: hidden;
        position: relative;
        border-radius: var(--motion-radius, 16px);
        border: 1px solid var(--slide-border);
        background: var(--motion-bg, rgba(255,255,255,0.06));
        box-shadow: 0 24px 72px rgba(0,0,0,0.24);
      }
      .motion-block--positioned .block-image {
        max-width: none;
        border: 0;
        background: transparent;
        box-shadow: none;
      }
      .block-image img {
        display: block;
        width: 100%;
        height: 100%;
        aspect-ratio: auto;
        object-fit: cover;
      }
      .block-image__crop-media {
        position: absolute;
        inset: 0;
        transform-origin: center;
      }
      .block-image img.block-image__crop-image,
      .block-image .block-image__crop-filter {
        display: block;
        position: absolute;
        left: 50%;
        top: 50%;
        width: 100%;
        height: 100%;
        max-width: none;
        aspect-ratio: auto;
        object-fit: fill;
        transform: translate(-50%, -50%);
        transform-origin: center;
      }
      .block-video video,
      .block-video iframe {
        display: block;
        width: 100%;
        height: 100%;
        aspect-ratio: auto;
        border: 0;
        object-fit: cover;
      }
      .block-video--youtube iframe {
        display: none;
      }
      .block-video--youtube[data-youtube-mode="embed"] iframe {
        display: block;
      }
      .block-video__youtube-fallback {
        position: absolute;
        inset: 0;
        display: grid;
        overflow: hidden;
        place-items: center;
        color: #fff;
        background: #18181b;
        text-align: center;
        text-decoration: none;
      }
      .block-video--youtube[data-youtube-mode="embed"] .block-video__youtube-fallback {
        display: none;
      }
      .block-video__youtube-poster {
        position: absolute;
        inset: 0;
        opacity: 0.56;
      }
      .block-video__youtube-fallback::after {
        position: absolute;
        inset: 0;
        content: "";
        background: rgba(9, 9, 11, 0.46);
      }
      .block-video__youtube-fallback-content {
        position: relative;
        z-index: 1;
        display: grid;
        max-width: 80%;
        justify-items: center;
        gap: 8px;
        font-family: Arial, sans-serif;
      }
      .block-video__youtube-fallback-content strong {
        font-size: calc(${legacyCssFontPixelsToCanvasPixels(22)}px * var(--frame-scale, 1));
        line-height: 1.15;
      }
      .block-video__youtube-fallback-content > span:last-child {
        color: rgba(255, 255, 255, 0.68);
        font-size: calc(${legacyCssFontPixelsToCanvasPixels(13)}px * var(--frame-scale, 1));
        line-height: 1.35;
      }
      .block-video__youtube-play {
        display: grid;
        width: calc(58px * var(--frame-scale, 1));
        height: calc(58px * var(--frame-scale, 1));
        place-items: center;
        border: 1px solid rgba(255, 255, 255, 0.42);
        border-radius: 999px;
        background: rgba(9, 9, 11, 0.64);
      }
      .block-video__youtube-play svg {
        width: 56%;
        height: 56%;
        fill: currentColor;
      }
      .block-icon {
        display: grid;
        width: 100%;
        height: 100%;
        place-items: center;
        padding: 16px;
        border-radius: var(--motion-radius, 16px);
        border: 1px solid var(--slide-border);
        background: var(--motion-bg, var(--slide-card));
        color: var(--motion-fg, var(--slide-fg));
        box-shadow: 0 20px 60px rgba(0,0,0,0.18);
        backdrop-filter: blur(16px);
      }
      .block-icon svg {
        width: 100%;
        height: 100%;
      }
      .block-shape,
      .block-shape svg {
        width: 100%;
        height: 100%;
      }
      .block-shape { position: relative; }
      .shape-line-endpoint { pointer-events: none; position: absolute; top: 50%; color: var(--line-endpoint-color); }
      .shape-line-endpoint--start { left: 0; }
      .shape-line-endpoint--end { right: 0; }
      .shape-line-endpoint--circle { width: calc(10px * var(--line-endpoint-scale, 1)); height: calc(10px * var(--line-endpoint-scale, 1)); border-radius: 999px; background: var(--line-endpoint-color); }
      .shape-line-endpoint--start.shape-line-endpoint--circle { transform: translate(-50%, -50%); }
      .shape-line-endpoint--end.shape-line-endpoint--circle { transform: translate(50%, -50%); }
      .shape-line-endpoint--bar { width: calc(2px * var(--line-endpoint-scale, 1)); height: calc(16px * var(--line-endpoint-scale, 1)); background: var(--line-endpoint-color); }
      .shape-line-endpoint--start.shape-line-endpoint--bar { transform: translate(-50%, -50%); }
      .shape-line-endpoint--end.shape-line-endpoint--bar { transform: translate(50%, -50%); }
      .shape-line-endpoint--arrow { width: 0; height: 0; border-top: calc(6px * var(--line-endpoint-scale, 1)) solid transparent; border-bottom: calc(6px * var(--line-endpoint-scale, 1)) solid transparent; transform: translateY(-50%); }
      .shape-line-endpoint--start.shape-line-endpoint--arrow { border-right: calc(10px * var(--line-endpoint-scale, 1)) solid var(--line-endpoint-color); }
      .shape-line-endpoint--end.shape-line-endpoint--arrow { border-left: calc(10px * var(--line-endpoint-scale, 1)) solid var(--line-endpoint-color); }
      .shape-line-vector-endpoint { position:absolute; top:50%; overflow:visible; pointer-events:none; }
      .shape-line-vector-endpoint--start { left:0; transform:translate(-50%,-50%); }
      .shape-line-vector-endpoint--end { right:0; transform:translate(50%,-50%); }
      .block-table {
        display: grid;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        border: var(--table-border-width, 1px) var(--table-border-style, solid) var(--table-border, var(--slide-border));
        border-radius: var(--motion-radius, 8px);
      }
      .block-table__cell {
        display: flex;
        min-width: 0;
        min-height: 0;
        align-items: var(--table-vertical-align, center);
        justify-content: var(--table-cell-justify, center);
        overflow: hidden;
        border-bottom: var(--table-border-width, 1px) var(--table-border-style, solid) var(--table-border, var(--slide-border));
        border-right: var(--table-border-width, 1px) var(--table-border-style, solid) var(--table-border, var(--slide-border));
        padding: calc(var(--table-padding-y, 8px) * var(--frame-scale, 1)) calc(var(--table-padding-x, 10px) * var(--frame-scale, 1));
        color: inherit;
        font-size: calc(var(--table-font-size, ${motionDocFontPointsToCanvasPixels(MOTION_DOC_FONT_SIZES.table)}px) * var(--frame-scale, 1));
        line-height: 1.25;
        text-align: var(--table-text-align, center);
        white-space: pre-wrap;
        word-break: break-word;
      }
      .motion-block--full {
        position: absolute;
        inset: 0;
        z-index: 0;
        margin: 0;
      }
      .motion-block--positioned > * {
        max-width: none;
      }
      .motion-block--full .block-image {
        width: 100%;
        height: 100%;
        max-width: none;
        border: 0;
        border-radius: var(--motion-radius, 0);
      }
      .motion-block--full .block-image img,
      .motion-block--full .block-video video,
      .motion-block--full .block-video iframe {
        height: 100%;
        aspect-ratio: auto;
      }
      .motion-block--positioned > * {
        width: 100%;
        height: 100%;
        max-width: none;
        margin: 0;
      }
      .player:fullscreen .controls {
        opacity: 0;
        transform: translateX(-50%) translateY(10px);
        transition: opacity 300ms ease, transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      .player:fullscreen .controls:hover,
      .player:fullscreen.controls-visible .controls {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      .slide-dots {
        align-items: flex-end;
        display: flex;
        flex-direction: column;
        gap: 2px;
        position: absolute;
        right: 22px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 101;
      }
      .slide-dot-button {
        align-items: center;
        background: transparent;
        border: 0;
        color: rgba(255,255,255,.48);
        cursor: pointer;
        display: flex;
        gap: 9px;
        justify-content: flex-end;
        min-height: 24px;
        padding: 3px;
      }
      .slide-dot-label {
        background: rgba(14,14,16,.72);
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 7px;
        font-size: 11px;
        max-width: 210px;
        opacity: 0;
        overflow: hidden;
        padding: 5px 8px;
        text-overflow: ellipsis;
        transform: translateX(7px);
        transition: opacity 180ms ease, transform 260ms cubic-bezier(.16,1,.3,1);
        white-space: nowrap;
      }
      .slide-dot-mark {
        background: rgba(255,255,255,.28);
        border-radius: 999px;
        height: 7px;
        transition: background 180ms ease, height 260ms cubic-bezier(.16,1,.3,1), transform 260ms cubic-bezier(.16,1,.3,1);
        width: 7px;
      }
      .slide-dot-button:hover .slide-dot-label,
      .slide-dot-button:focus-visible .slide-dot-label { opacity: 1; transform: none; }
      .slide-dot-button[aria-current="true"] .slide-dot-mark { background: #8ea5ff; height: 18px; }
      .player[data-player-theme="light"] .controls,
      .player[data-player-theme="light"] .slide-dot-label { background: rgba(250,250,252,.76); border-color: rgba(17,24,39,.1); color: #374151; }
      .player[data-player-theme="light"] .control-button { color: #52525b; }
      .player[data-player-theme="light"] .control-button:hover { background: rgba(17,24,39,.08); color: #111827; }
      .player[data-player-theme="light"] .counter { color: #71717a; }
      .player[data-player-theme="light"] .counter [data-current] { color: #18181b; }
      .controls {
        position: absolute;
        left: 50%;
        bottom: 32px;
        transform: translateX(-50%);
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        width: auto;
        min-width: 440px;
        padding: 10px 24px;
        border-radius: 999px;
        background: rgba(15, 15, 15, 0.65);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 16px 50px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255,255,255,0.06);
        backdrop-filter: blur(28px);
        -webkit-backdrop-filter: blur(28px);
        transition: opacity 300ms ease, transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      .button-group {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .control-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border: 1px solid transparent;
        border-radius: 50%;
        background: transparent;
        color: #a3a3a3;
        cursor: pointer;
        transition: all 150ms ease;
      }
      .control-button:hover {
        background: rgba(255,255,255,0.1);
        color: #ffffff;
        border-color: rgba(255,255,255,0.05);
        transform: scale(1.05);
      }
      .control-button:active {
        transform: scale(0.95);
      }
      .control-button svg {
        width: 18px;
        height: 18px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .counter {
        color: #a3a3a3;
        font: 14px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
        font-weight: 500;
        white-space: nowrap;
        margin: 0 4px;
      }
      .counter [data-current] {
        color: #ffffff;
      }
      .progress {
        flex: 1;
        height: 5px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255,255,255,0.12);
        box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
      }
      .progress span {
        display: block;
        width: var(--progress, 0%);
        height: 100%;
        border-radius: inherit;
        background: #0ea5e9;
        transition: width 220ms ease;
      }
      @media (max-width: 760px) {
        body {
          overflow: auto;
        }
        .player {
          min-height: 100vh;
        }
        .viewport {
          width: 100%;
        }
        .controls {
          grid-template-columns: 1fr;
        }
        .slide-dots { display: none; }
        .counter {
          text-align: center;
        }
        .button-group {
          justify-content: center;
        }
      }
      @keyframes slide-exit-soft {
        from { opacity: 1; transform: scale(1); filter: blur(0); }
        to { opacity: 0; transform: scale(.992); filter: blur(3px); }
      }
      @keyframes morph-exit-unmatched {
        0% { opacity: 1; transform: scale(1); filter: blur(0); }
        42%, 100% { opacity: 0; transform: scale(.996); filter: blur(2px); }
      }
      .block-chart {
        align-items: stretch;
        display: flex;
        height: 100%;
        min-height: 0;
        width: 100%;
      }
      .motion-chart {
        display: block;
        height: 100%;
        overflow: visible;
        width: 100%;
      }
      .chart-grid {
        stroke: var(--slide-fg);
        stroke-opacity: .1;
        stroke-width: 1;
      }
      .chart-axis-label,
      .chart-label,
      .chart-legend,
      .chart-legend-value,
      .chart-value {
        fill: var(--chart-label-color, var(--slide-muted));
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        font-size: 17px;
      }
      .chart-value,
      .chart-legend-value {
        fill: var(--slide-fg);
        font-size: 18px;
        font-variant-numeric: tabular-nums;
        font-weight: 650;
      }
      .chart-value--radial {
        fill: #ffffff;
        font-size: 16px;
        paint-order: stroke;
        stroke: rgba(0,0,0,.3);
        stroke-width: 3px;
      }
      .motion-chart--modern .chart-grid {
        stroke-opacity: .075;
      }
      .motion-chart--modern .chart-grid--baseline {
        stroke-opacity: .18;
      }
      .motion-chart--modern .chart-axis-label,
      .motion-chart--modern .chart-label,
      .motion-chart--modern .chart-legend {
        font-family: Geist, "SF Pro Display", "SF Pro Text", ui-sans-serif, system-ui, sans-serif;
        font-size: var(--chart-label-size, 20px);
        font-weight: 500;
        letter-spacing: .01em;
      }
      .motion-chart--modern .chart-axis-label {
        opacity: .7;
      }
      .motion-chart--modern .chart-value,
      .motion-chart--modern .chart-legend-value {
        font-family: Geist, "SF Pro Display", "SF Pro Text", ui-sans-serif, system-ui, sans-serif;
        font-size: var(--chart-value-size, 23px);
        font-weight: 620;
        letter-spacing: -.02em;
      }
      .motion-chart--modern .chart-point-halo {
        opacity: .13;
      }
      .motion-chart--modern .chart-point {
        stroke: var(--slide-bg, #ffffff);
        stroke-width: 2.5;
      }
      .motion-chart--modern .chart-bubble {
        stroke: var(--slide-bg, #ffffff);
        stroke-width: 3;
      }
      .motion-chart--modern .chart-slice {
        stroke: var(--slide-bg, #ffffff);
        stroke-width: 2;
      }
      .motion-chart--modern .chart-center-metric {
        fill: var(--slide-fg, currentColor);
        font-family: Geist, "SF Pro Display", "SF Pro Text", ui-sans-serif, system-ui, sans-serif;
        font-size: var(--chart-center-size, 32px);
        font-variant-numeric: tabular-nums;
        font-weight: 650;
        letter-spacing: -.04em;
      }
      .motion-chart--modern .chart-center-label {
        fill: var(--slide-muted, #94a3b8);
        font-size: 13px;
        font-weight: 500;
        letter-spacing: .02em;
      }
      .chart-reference line {
        stroke: var(--chart-reference-color, #dc2626);
        stroke-dasharray: 8 6;
        stroke-width: 2;
      }
      .chart-reference text {
        fill: var(--chart-reference-color, #dc2626);
        font-family: Geist, ui-sans-serif, system-ui, sans-serif;
        font-size: var(--chart-label-size, 18px);
        font-weight: 650;
      }
      .chart-annotation line {
        stroke: var(--chart-annotation-color, #dc2626);
        stroke-width: 1.5;
      }
      .chart-annotation circle {
        fill: var(--slide-bg, #ffffff);
        stroke: var(--chart-annotation-color, #dc2626);
        stroke-width: 2.5;
      }
      .chart-annotation text,
      .chart-annotation-text {
        fill: var(--chart-annotation-color, #dc2626);
        font-family: Geist, ui-sans-serif, system-ui, sans-serif;
        font-size: var(--chart-label-size, 18px);
        font-weight: 650;
      }
      .chart-bar,
      .chart-bubble,
      .chart-point,
      .chart-series,
      .chart-slice {
        animation-delay: var(--chart-delay, 0ms);
        animation-duration: .72s;
        animation-fill-mode: both;
        animation-timing-function: cubic-bezier(.22, 1, .36, 1);
      }
      .motion-chart--grow .chart-bar,
      .motion-chart--grow.motion-chart--line .chart-series,
      .motion-chart--grow.motion-chart--area .chart-series {
        animation-name: chart-grow;
        transform-box: fill-box;
        transform-origin: center bottom;
      }
      .motion-chart--grow .chart-radial,
      .motion-chart--grow.motion-chart--scatter .chart-series {
        animation: chart-grow-center .78s var(--chart-delay, 0ms) cubic-bezier(.22, 1, .36, 1) both;
        transform-box: fill-box;
        transform-origin: center;
      }
      .motion-chart--draw .chart-line {
        animation: chart-draw 1.05s cubic-bezier(.22, 1, .36, 1) both;
        stroke-dasharray: 1;
      }
      .motion-chart--draw .chart-area {
        animation: chart-area .85s .18s cubic-bezier(.22, 1, .36, 1) both;
      }
      .motion-chart--draw.motion-chart--bar .chart-series,
      .motion-chart--draw.motion-chart--scatter .chart-series,
      .motion-chart--draw .chart-slice {
        animation-name: chart-reveal;
        transform-box: fill-box;
        transform-origin: left center;
      }
      .motion-chart--pop .chart-series,
      .motion-chart--pop .chart-slice {
        animation-name: chart-pop;
        transform-box: fill-box;
        transform-origin: center;
      }
      .motion-chart--sweep.motion-chart--bar .chart-content,
      .motion-chart--sweep.motion-chart--line .chart-content,
      .motion-chart--sweep.motion-chart--area .chart-content,
      .motion-chart--sweep.motion-chart--scatter .chart-content {
        animation: chart-sweep-x .92s cubic-bezier(.22, 1, .36, 1) both;
      }
      .motion-chart--sweep .chart-radial {
        animation: chart-sweep .9s cubic-bezier(.22, 1, .36, 1) both;
        transform-box: fill-box;
        transform-origin: center;
      }
      @keyframes chart-grow {
        from { opacity: .2; transform: scaleY(.04); }
        to { opacity: 1; transform: scaleY(1); }
      }
      @keyframes chart-grow-center {
        from { opacity: .12; transform: scale(.08); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes chart-draw {
        from { stroke-dashoffset: 1; }
        to { stroke-dashoffset: 0; }
      }
      @keyframes chart-area {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes chart-pop {
        0% { opacity: 0; transform: scale(.2); }
        70% { opacity: 1; transform: scale(1.08); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes chart-reveal {
        from { opacity: 0; transform: translateX(-14px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes chart-sweep-x {
        from { clip-path: inset(0 100% 0 0); }
        to { clip-path: inset(0 0 0 0); }
      }
      @keyframes chart-sweep {
        from { opacity: 0; transform: rotate(-20deg) scale(.82); }
        to { opacity: 1; transform: rotate(0) scale(1); }
      }
      @media (prefers-reduced-motion: reduce) {
        .motion-chart * {
          animation: none !important;
        }
      }
      .motion-chart--editor-static * {
        animation: none !important;
      }
      .block-html-unsupported {
        align-items: center;
        background: #111827;
        color: #e5e7eb;
        display: flex;
        flex-direction: column;
        gap: 10px;
        height: 100%;
        justify-content: center;
        padding: 32px;
        text-align: center;
        width: 100%;
      }
      .block-html-unsupported span { color: #9ca3af; font-size: 14px; }
      .block-html-embed { background: #fff; border: 0; display: block; height: 100%; width: 100%; }
      .shared-html-layer { inset: 0; overflow: hidden; pointer-events: none; position: absolute; z-index: 85; }
      .shared-html-scene { opacity: 0; pointer-events: none; position: absolute; visibility: hidden; }
      .shared-html-scene.is-active { opacity: 1; pointer-events: auto; visibility: visible; }
      .block-svg-stage, .block-svg-stage > svg { display: block; height: 100%; width: 100%; }
      .shared-svg-layer { inset: 0; overflow: hidden; pointer-events: none; position: absolute; z-index: 80; }
      .shared-svg-scene { opacity: 0; position: absolute; visibility: hidden; }
      .shared-svg-scene.is-active { opacity: 1; visibility: visible; }
      @media print {
        @page {
          size: ${MOTION_DOC_CANVAS_WIDTH}px ${MOTION_DOC_CANVAS_HEIGHT}px;
          margin: 0;
        }
        html, body {
          width: ${MOTION_DOC_CANVAS_WIDTH}px;
          height: ${MOTION_DOC_CANVAS_HEIGHT}px;
          margin: 0;
          padding: 0;
          background: #000;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          overflow: visible;
        }
        .player {
          display: block;
          height: auto;
          padding: 0;
          background: transparent;
        }
        .controls {
          display: none !important;
        }
        .stage {
          display: block;
          height: auto;
        }
        .viewport {
          width: 100%;
          max-width: none;
          height: auto;
          aspect-ratio: auto;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          overflow: visible;
        }
        .frame {
          position: relative;
          width: 100%;
          height: auto;
          transform: none;
          overflow: visible;
        }
        .slide {
          position: relative;
          display: block !important;
          width: ${MOTION_DOC_CANVAS_WIDTH}px;
          height: ${MOTION_DOC_CANVAS_HEIGHT}px;
          page-break-after: always;
          page-break-inside: avoid;
          overflow: hidden;
          opacity: 1 !important;
          transform: none !important;
          margin-bottom: 0;
        }
        * {
          transition: none !important;
          animation: none !important;
        }
        .motion-block {
          opacity: 1 !important;
          transform: translate3d(0, 0, 0) scale(1) !important;
        }
        .shader-bg {
          display: none !important;
        }
        .slide-bg-image {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .slide::before {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }`;
