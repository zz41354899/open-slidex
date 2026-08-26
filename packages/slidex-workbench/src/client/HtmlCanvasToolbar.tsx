import { CodeXml, Hand, MousePointer2, ZoomIn } from "lucide-react";

import { canvasToolOptions, type CanvasTool } from "@/features/pitch/application/canvasTools";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

const toolIcons = {
  hand: Hand,
  select: MousePointer2,
  zoom: ZoomIn
} as const;

export function HtmlCanvasToolbar({ activeTool, onToolChange }: {
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
}) {
  const { locale, tx } = usePitchI18n();

  return (
    <div
      aria-label={locale === "zh-TW" ? "HTML 畫布工具" : "HTML canvas tools"}
      className="flex h-9 items-center gap-0.5 rounded-xl border border-white/[0.09] bg-[#171719]/95 p-1 shadow-[0_10px_28px_rgba(0,0,0,0.24)] backdrop-blur-xl"
      data-html-canvas-toolbar
      role="toolbar"
    >
      <div className="flex h-7 items-center gap-1.5 rounded-lg bg-violet-400/[0.09] px-2 text-[9px] font-semibold tracking-[0.08em] text-violet-100/80">
        <CodeXml className="text-[#a99cff]" size={13} />
        <span>HTML</span>
      </div>
      <span aria-hidden="true" className="mx-1 h-4 w-px bg-white/[0.08]" />
      {canvasToolOptions.map((tool) => {
        const Icon = toolIcons[tool.id];
        const active = activeTool === tool.id;
        const label = tx(tool.label);
        return (
          <button
            aria-label={`${label} (${tool.shortcut})`}
            aria-pressed={active}
            className={`group relative flex size-7 items-center justify-center rounded-lg transition duration-150 ${active
              ? "bg-white/[0.1] text-white shadow-[inset_0_0_0_1px_rgba(196,181,253,0.14)]"
              : "text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200"
            }`}
            data-html-canvas-tool={tool.id}
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            title={`${label} (${tool.shortcut})`}
            type="button"
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
