import { renderMotionDocChartSvg } from "@/core/motion-doc/application/chartSvg";
import type { MotionDocFrame } from "@/core/motion-doc/domain/frame";
import type { MotionDocProps } from "@/core/motion-doc/domain/motionDocTypes";
import { usePreviewRenderPolicy } from "@/features/pitch/ui/preview/PreviewMediaPolicy";

export function ChartBlock({ frame, props }: { frame?: MotionDocFrame; props: MotionDocProps }) {
  const { chartMotionMode, responsiveCharts } = usePreviewRenderPolicy();
  return (
    <div data-motion-chart-block data-motion-chart-static={chartMotionMode === "editor-static" || undefined} style={{ alignItems: "stretch", display: "flex", height: "100%", minHeight: 0, width: "100%" }}>
      <style>{chartStyles}</style>
      <div className="motion-chart-host" dangerouslySetInnerHTML={{ __html: renderMotionDocChartSvg(props, responsiveCharts ? { appearance: "editor-modern", frame, motionMode: chartMotionMode } : { motionMode: chartMotionMode }) }} />
    </div>
  );
}

const chartStyles = `
[data-motion-chart-block] .motion-chart-host,[data-motion-chart-block] .motion-chart{display:block;height:100%;width:100%}
[data-motion-chart-block] .motion-chart{overflow:visible}
[data-motion-chart-block] .chart-grid{stroke:var(--slide-fg,currentColor);stroke-opacity:.1;stroke-width:1}
[data-motion-chart-block] .chart-axis-label,[data-motion-chart-block] .chart-label,[data-motion-chart-block] .chart-legend,[data-motion-chart-block] .chart-legend-value,[data-motion-chart-block] .chart-value{fill:var(--chart-label-color,var(--slide-muted,#94a3b8));font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:17px}
[data-motion-chart-block] .chart-value,[data-motion-chart-block] .chart-legend-value{fill:var(--slide-fg,currentColor);font-size:18px;font-variant-numeric:tabular-nums;font-weight:650}
[data-motion-chart-block] .chart-value--radial{fill:#fff;font-size:16px;paint-order:stroke;stroke:rgb(0 0 0/.3);stroke-width:3px}
[data-motion-chart-block] .motion-chart--modern .chart-grid{stroke-opacity:.075}
[data-motion-chart-block] .motion-chart--modern .chart-grid--baseline{stroke-opacity:.18}
[data-motion-chart-block] .motion-chart--modern .chart-axis-label,[data-motion-chart-block] .motion-chart--modern .chart-label,[data-motion-chart-block] .motion-chart--modern .chart-legend{font-family:Geist,"SF Pro Display","SF Pro Text",ui-sans-serif,system-ui,sans-serif;font-size:var(--chart-label-size,20px);font-weight:500;letter-spacing:.01em}
[data-motion-chart-block] .motion-chart--modern .chart-axis-label{opacity:.7}
[data-motion-chart-block] .motion-chart--modern .chart-value,[data-motion-chart-block] .motion-chart--modern .chart-legend-value{font-family:Geist,"SF Pro Display","SF Pro Text",ui-sans-serif,system-ui,sans-serif;font-size:var(--chart-value-size,23px);font-weight:620;letter-spacing:-.02em}
[data-motion-chart-block] .motion-chart--modern .chart-point-halo{opacity:.13}
[data-motion-chart-block] .motion-chart--modern .chart-point{stroke:var(--slide-bg,#fff);stroke-width:2.5}
[data-motion-chart-block] .motion-chart--modern .chart-bubble{stroke:var(--slide-bg,#fff);stroke-width:3}
[data-motion-chart-block] .motion-chart--modern .chart-slice{stroke:var(--slide-bg,#fff);stroke-width:2}
[data-motion-chart-block] .motion-chart--modern .chart-center-metric{fill:var(--slide-fg,currentColor);font-family:Geist,"SF Pro Display","SF Pro Text",ui-sans-serif,system-ui,sans-serif;font-size:var(--chart-center-size,32px);font-variant-numeric:tabular-nums;font-weight:650;letter-spacing:-.04em}
[data-motion-chart-block] .motion-chart--modern .chart-center-label{fill:var(--slide-muted,#94a3b8);font-size:13px;font-weight:500;letter-spacing:.02em}
[data-motion-chart-block] .chart-reference line{stroke:var(--chart-reference-color,#dc2626);stroke-dasharray:8 6;stroke-width:2}
[data-motion-chart-block] .chart-reference text{fill:var(--chart-reference-color,#dc2626);font-family:Geist,ui-sans-serif,system-ui,sans-serif;font-size:var(--chart-label-size,18px);font-weight:650}
[data-motion-chart-block] .chart-annotation line{stroke:var(--chart-annotation-color,#dc2626);stroke-width:1.5}
[data-motion-chart-block] .chart-annotation circle{fill:var(--slide-bg,#fff);stroke:var(--chart-annotation-color,#dc2626);stroke-width:2.5}
[data-motion-chart-block] .chart-annotation text,[data-motion-chart-block] .chart-annotation-text{fill:var(--chart-annotation-color,#dc2626);font-family:Geist,ui-sans-serif,system-ui,sans-serif;font-size:var(--chart-label-size,18px);font-weight:650}
[data-motion-chart-block] .chart-bar,[data-motion-chart-block] .chart-bubble,[data-motion-chart-block] .chart-point,[data-motion-chart-block] .chart-series,[data-motion-chart-block] .chart-slice{animation-delay:var(--chart-delay,0ms);animation-duration:.72s;animation-fill-mode:both;animation-timing-function:cubic-bezier(.22,1,.36,1)}
[data-motion-chart-block] .motion-chart--grow .chart-bar,[data-motion-chart-block] .motion-chart--grow.motion-chart--line .chart-series,[data-motion-chart-block] .motion-chart--grow.motion-chart--area .chart-series{animation-name:slidex-chart-grow;transform-box:fill-box;transform-origin:center bottom}
[data-motion-chart-block] .motion-chart--grow .chart-radial,[data-motion-chart-block] .motion-chart--grow.motion-chart--scatter .chart-series{animation:slidex-chart-grow-center .78s var(--chart-delay,0ms) cubic-bezier(.22,1,.36,1) both;transform-box:fill-box;transform-origin:center}
[data-motion-chart-block] .motion-chart--draw .chart-line{animation:slidex-chart-draw 1.05s cubic-bezier(.22,1,.36,1) both;stroke-dasharray:1}
[data-motion-chart-block] .motion-chart--draw .chart-area{animation:slidex-chart-area .85s .18s cubic-bezier(.22,1,.36,1) both}
[data-motion-chart-block] .motion-chart--draw.motion-chart--bar .chart-series,[data-motion-chart-block] .motion-chart--draw.motion-chart--scatter .chart-series,[data-motion-chart-block] .motion-chart--draw .chart-slice{animation-name:slidex-chart-reveal;transform-box:fill-box;transform-origin:left center}
[data-motion-chart-block] .motion-chart--pop .chart-series,[data-motion-chart-block] .motion-chart--pop .chart-slice{animation-name:slidex-chart-pop;transform-box:fill-box;transform-origin:center}
[data-motion-chart-block] .motion-chart--sweep.motion-chart--bar .chart-content,[data-motion-chart-block] .motion-chart--sweep.motion-chart--line .chart-content,[data-motion-chart-block] .motion-chart--sweep.motion-chart--area .chart-content,[data-motion-chart-block] .motion-chart--sweep.motion-chart--scatter .chart-content{animation:slidex-chart-sweep-x .92s cubic-bezier(.22,1,.36,1) both}
[data-motion-chart-block] .motion-chart--sweep .chart-radial{animation:slidex-chart-sweep .9s cubic-bezier(.22,1,.36,1) both;transform-box:fill-box;transform-origin:center}
[data-motion-chart-block][data-motion-chart-static] .motion-chart *,[data-motion-chart-block] .motion-chart--editor-static *{animation:none!important}
@keyframes slidex-chart-grow{from{opacity:.2;transform:scaleY(.04)}to{opacity:1;transform:scaleY(1)}}
@keyframes slidex-chart-grow-center{from{opacity:.12;transform:scale(.08)}to{opacity:1;transform:scale(1)}}
@keyframes slidex-chart-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes slidex-chart-area{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes slidex-chart-pop{0%{opacity:0;transform:scale(.2)}70%{opacity:1;transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
@keyframes slidex-chart-reveal{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:translateX(0)}}
@keyframes slidex-chart-sweep-x{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes slidex-chart-sweep{from{opacity:0;transform:rotate(-20deg) scale(.82)}to{opacity:1;transform:rotate(0) scale(1)}}
@media(prefers-reduced-motion:reduce){[data-motion-chart-block] .motion-chart *{animation:none!important}}
`;
