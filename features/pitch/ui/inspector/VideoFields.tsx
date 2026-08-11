"use client";

import { Link2, Video, Maximize, Minimize, StretchHorizontal, Shrink } from "lucide-react";
import { youtubeVideoId } from "@/core/motion-doc/domain/videoSource";
import { OptionButtons, TextInput, IconSegmentedControl, type BlockFieldProps } from "@/features/pitch/ui/inspector/InspectorControls";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

const booleanOptions = [
  { label: "Off", value: "false" },
  { label: "On", value: "true" }
] as const;

export function VideoFields({
  block,
  selectedBlockIndex,
  updateBlock
}: BlockFieldProps) {
  const { tx } = usePitchI18n();
  const source = String(block.props.src ?? "");
  const youtubeId = youtubeVideoId(source);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[34px_1fr] items-end gap-2">
        <span className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-black/35 text-neutral-400">
          <Link2 size={15} />
        </span>
        <TextInput
          label="Video path"
          onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, src: value })}
          placeholder="/media/video.mp4 or https://..."
          value={source}
        />
      </div>
      <p className="-mt-3 text-[10px] leading-relaxed text-neutral-600">
        {tx(youtubeId ? "YouTube path detected. Preview and hosted HTML use the player; local HTML opens YouTube safely." : "Use an existing relative path, YouTube URL, or direct MP4/WebM URL.")}
      </p>
      <div className="grid grid-cols-[34px_1fr] items-end gap-2">
        <span className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-black/35 text-neutral-400">
          <Video size={15} />
        </span>
        <TextInput
          label="Poster"
          onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, poster: value })}
          placeholder="/images/poster.webp or https://..."
          value={block.props.poster ?? ""}
        />
      </div>
      <IconSegmentedControl
        label="Fit"
        options={[
          { label: "cover", value: "cover", icon: <Maximize size={14} /> },
          { label: "contain", value: "contain", icon: <Minimize size={14} /> },
          { label: "fill", value: "fill", icon: <StretchHorizontal size={14} /> },
          { label: "scale-down", value: "scale-down", icon: <Shrink size={14} /> },
        ]}
        value={normalizeFit(block.props.fit)}
        onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, fit: value })}
      />
      <div className="grid gap-3 rounded-xl border border-white/[0.055] bg-black/20 p-3">
        <p className="text-[10px] font-semibold tracking-wide text-neutral-500">{tx("Playback")}</p>
        <OptionButtons label="Controls" options={booleanOptions} value={normalizeBoolean(block.props.controls, "true")} onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, controls: value })} />
        <OptionButtons label="Loop" options={booleanOptions} value={normalizeBoolean(block.props.loop, "true")} onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, loop: value })} />
        <OptionButtons label="Muted" options={booleanOptions} value={normalizeBoolean(block.props.muted, "true")} onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, muted: value })} />
      </div>
      <p className="-mt-2 text-[10px] leading-relaxed text-neutral-600">{tx("Fit, mute, and playback controls are also available directly on the selected video frame.")}</p>
    </div>
  );
}

function normalizeFit(value: string | number | undefined) {
  if (value === "contain" || value === "fill" || value === "scale-down") {
    return value;
  }

  return "cover";
}

function normalizeBoolean(value: string | number | undefined, fallback: "false" | "true") {
  if (value === "false" || value === 0) {
    return "false";
  }

  if (value === "true" || value === 1) {
    return "true";
  }

  return fallback;
}
