import { ExternalLink, MousePointerClick } from "lucide-react";
import { useEffect, useState } from "react";
import type { MotionDocBlockWithProps, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import {
  interactionFromProps,
  withInteraction,
  type InteractionActionV1
} from "@/core/motion-doc/domain/interaction";
import type { BlockUpdater } from "@/features/pitch/application/pitchCommandTypes";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/common/ui/shadcnPrimitives";

export function InteractionActionPanel({ block, scenes, selectedBlockIndex, updateBlock }: {
  block: MotionDocBlockWithProps;
  scenes: MotionDocScene[];
  selectedBlockIndex: number;
  updateBlock: BlockUpdater;
}) {
  const { tx } = usePitchI18n();
  const interaction = interactionFromProps(block.props);
  const action = interaction?.action ?? null;
  const [urlDraft, setUrlDraft] = useState(action?.type === "openUrl" ? action.url : "https://example.com");

  useEffect(() => {
    if (action?.type === "openUrl") setUrlDraft(action.url);
  }, [action?.type === "openUrl" ? action.url : ""]);

  function commit(nextAction: InteractionActionV1 | null) {
    updateBlock(selectedBlockIndex, withInteraction(block.props, nextAction ? { action: nextAction, trigger: "click", version: 1 } : null));
  }

  function changeType(value: string) {
    if (value === "none") commit(null);
    if (value === "nextSlide") commit({ type: "nextSlide" });
    if (value === "previousSlide") commit({ type: "previousSlide" });
    if (value === "goToSlide") commit({ slide: 1, type: "goToSlide" });
    if (value === "openUrl") commit({ type: "openUrl", url: "https://example.com" });
  }

  return (
    <div className="mt-3 overflow-hidden rounded-[16px] border border-white/[0.07] bg-[#171717]">
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-3 py-3">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${action ? "bg-cyan-400/12 text-cyan-200" : "bg-white/[0.04] text-neutral-500"}`}><MousePointerClick size={15} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-neutral-200">{tx("Click action")}</span>
          <span className="block truncate text-[9px] text-neutral-600">{tx("The selected layer becomes the interactive area.")}</span>
        </span>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <Select onValueChange={changeType} value={action?.type ?? "none"}>
          <SelectTrigger className="h-9 rounded-xl px-3 text-[11px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{tx("No click action")}</SelectItem>
            <SelectItem value="nextSlide">{tx("Next slide")}</SelectItem>
            <SelectItem value="previousSlide">{tx("Previous slide")}</SelectItem>
            <SelectItem value="goToSlide">{tx("Go to slide")}</SelectItem>
            <SelectItem value="openUrl">{tx("Open link")}</SelectItem>
          </SelectContent>
        </Select>
        {action?.type === "goToSlide" ? (
          <Select onValueChange={(value) => commit({ slide: Number(value), type: "goToSlide" })} value={String(action.slide)}>
            <SelectTrigger className="h-9 rounded-xl px-3 text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {scenes.map((_, index) => <SelectItem key={index} value={String(index + 1)}>{tx("Slide")} {index + 1}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : null}
        {action?.type === "openUrl" ? (
          <label className="relative block">
            <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={13} />
            <Input
              aria-label={tx("Link URL")}
              className="h-9 rounded-xl pl-9 text-[11px]"
              onBlur={() => commit({ type: "openUrl", url: urlDraft.trim() || "https://example.com" })}
              onChange={(event) => setUrlDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
              placeholder="https://example.com"
              value={urlDraft}
            />
          </label>
        ) : null}
        {action ? <p className="rounded-xl bg-cyan-400/[0.055] px-3 py-2 text-[9px] leading-4 text-cyan-100/60">{tx("Works in presentation preview and exported HTML. MDX keeps the same declarative action.")}</p> : null}
      </div>
    </div>
  );
}
