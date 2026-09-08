import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { assertSafeMotionDocSvg } from "@/core/motion-doc/domain/svgPolicy";
import { usePreviewMediaSource } from "@/features/pitch/ui/preview/PreviewMediaPolicy";
import { HtmlPageThumbnail } from "@/features/pitch/ui/preview/HtmlPageThumbnail";

export function HtmlEmbedBlock({
  page = 1,
  src
}: {
  onNavigate?: (page: number) => void;
  page?: number;
  replayNonce?: number;
  src: string;
}) {
  return <HtmlPageThumbnail eager page={page} source={src} />;
}

export type SvgStageBlockProps = {
  easing?: string;
  playback?: boolean;
  replayNonce?: number;
  src: string;
  stage?: number;
  stageDuration?: number;
};

export function SvgStageBlock({
  easing = "ease-in-out",
  playback = false,
  replayNonce = 0,
  src,
  stage = 0,
  stageDuration = 0.6
}: SvgStageBlockProps) {
  const resolved = usePreviewMediaSource(src);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);
  const [loadedSource, setLoadedSource] = useState("");
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    if (!hostRef.current || shadowRef.current) return;
    shadowRef.current = hostRef.current.attachShadow({ mode: "open" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadedSource("");
    setError("");
    if (!resolved) return;
    void fetch(resolved, { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`SVG request failed (${response.status})`);
        const text = await response.text();
        assertSafeMotionDocSvg(text);
        if (!cancelled) setLoadedSource(text);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "SVG unavailable");
      });
    return () => { cancelled = true; };
  }, [resolved]);

  useLayoutEffect(() => {
    const shadow = shadowRef.current;
    if (!shadow || !loadedSource) return;
    shadow.innerHTML = `${svgStageStyles}${loadedSource}`;
    const svg = shadow.querySelector("svg");
    if (svg instanceof SVGSVGElement) {
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("preserveAspectRatio", svg.getAttribute("preserveAspectRatio") || "xMidYMid meet");
      svg.style.display = "block";
    }
  }, [loadedSource]);

  useLayoutEffect(() => {
    const shadow = shadowRef.current;
    if (!shadow || !loadedSource) return;
    const reduceMotion = !playback || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduceMotion ? 0 : clamp(stageDuration, 0, 30);
    if (playback && replayNonce > 0 && !reduceMotion) {
      applySvgStage(shadow, stage, duration, easing, true);
      return;
    }
    applySvgStage(shadow, stage, duration, easing, false);
  }, [easing, loadedSource, playback, replayNonce, stage, stageDuration]);

  return (
    <div className="relative h-full w-full overflow-hidden" ref={hostRef}>
      {error ? <div className="absolute inset-0 flex items-center justify-center bg-neutral-950 px-6 text-center text-neutral-500">{error}</div> : null}
    </div>
  );
}

function applySvgStage(root: ShadowRoot, requestedStage: number, duration: number, easing: string, replay: boolean) {
  const stage = Number.isFinite(requestedStage) ? requestedStage : 0;
  const safeEasing = /^(?:linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\([\d.,\s-]+\))$/.test(easing)
    ? easing
    : "ease-in-out";
  const targets = [...root.querySelectorAll<SVGElement>("[data-stage]")];
  const render = (hideCurrentStage: boolean) => {
    targets.forEach((element) => {
      const threshold = Number(element.dataset.stage || 0);
      const visible = stage >= threshold && !(hideCurrentStage && stage === threshold);
      const motions = new Set((element.dataset.motion || "reveal").split(/[\s,]+/).filter(Boolean));
      if (motions.has("stagger")) {
        const children = [...element.children].filter((child): child is SVGElement => child instanceof SVGElement);
        const childMotions = new Set(motions);
        childMotions.delete("stagger");
        if (childMotions.size === 0) childMotions.add("reveal");
        element.style.opacity = "1";
        element.style.transition = "none";
        children.forEach((child, index) => {
          const delay = index * Math.min(0.12, duration / Math.max(children.length, 1));
          applySvgMotion(child, childMotions, visible, duration, safeEasing, delay);
        });
        return;
      }
      applySvgMotion(element, motions, visible, duration, safeEasing, 0);
    });
  };
  if (!replay) {
    render(false);
    return;
  }
  render(true);
  requestAnimationFrame(() => requestAnimationFrame(() => render(false)));
}

function applySvgMotion(
  element: SVGElement,
  motions: Set<string>,
  visible: boolean,
  duration: number,
  easing: string,
  delay: number
) {
  element.style.transition = duration > 0
    ? `opacity ${duration}s ${easing} ${delay}s, transform ${duration}s ${easing} ${delay}s, stroke-dashoffset ${duration}s ${easing} ${delay}s`
    : "none";
  if (motions.has("draw") && "getTotalLength" in element && typeof element.getTotalLength === "function") {
    const length = safeGeometryLength(element as SVGGeometryElement);
    element.style.strokeDasharray = `${length}`;
    element.style.strokeDashoffset = visible ? "0" : `${length}`;
  }
  if (motions.has("reveal") || motions.has("scale")) {
    element.style.opacity = visible ? "1" : "0";
  }
  if (motions.has("scale")) {
    element.style.transformBox = "fill-box";
    element.style.transformOrigin = "center";
    element.style.transform = visible ? "scale(1)" : "scale(.82)";
  }
  element.classList.toggle("slidex-svg-sway", visible && duration > 0 && motions.has("sway"));
}

function safeGeometryLength(element: SVGGeometryElement) {
  try { return Math.max(1, element.getTotalLength()); } catch { return 1; }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

const svgStageStyles = `<style>
  :host{display:block;width:100%;height:100%}
  svg{max-width:100%;max-height:100%;overflow:visible}
  .slidex-svg-sway{animation:slidex-svg-sway 3.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
  @keyframes slidex-svg-sway{0%,100%{rotate:-1.25deg}50%{rotate:1.25deg}}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>`;
