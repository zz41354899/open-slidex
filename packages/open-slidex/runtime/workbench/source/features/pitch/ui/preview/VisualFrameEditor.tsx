
import * as Popover from "@radix-ui/react-popover";
import { Check, Crop, Maximize, Minimize, Minus, PanelBottom, PanelBottomDashed, Plus, RefreshCcw, Shrink, Volume2, VolumeX } from "lucide-react";
import type { MotionDocProps, MotionDocVisualBlock } from "@/core/motion-doc/domain/motionDocTypes";
import {
  imagePropsAsShapeImageProps,
  shapeImageAsImageProps
} from "@/core/motion-doc/application/shapeImage";
import type { BlockUpdater } from "@/features/pitch/application/pitchCommandTypes";
import type { VisualFrameToolbarPlacement } from "@/features/pitch/application/visualFrameToolbar";
import { CompactColorPanel } from "@/features/pitch/ui/inspector/color/CompactColorPanel";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type VisualFrameEditorProps = {
  block: MotionDocVisualBlock;
  blockIndex: number;
  onSelectBlock: (index: number) => void;
  isImageCropActive?: boolean;
  onToggleImageCrop?: (blockIndex: number) => void;
  onUpdateBlock: BlockUpdater;
  placement?: VisualFrameToolbarPlacement;
};

const fitOptions = [
  { icon: <Maximize size={13} />, label: "Cover", value: "cover" },
  { icon: <Minimize size={13} />, label: "Contain", value: "contain" },
  { icon: <Shrink size={13} />, label: "Scale down", value: "scale-down" }
] as const;

export function VisualFrameEditor({ block, blockIndex, isImageCropActive = false, onSelectBlock, onToggleImageCrop, onUpdateBlock, placement = "above" }: VisualFrameEditorProps) {
  const { tx } = usePitchI18n();
  const isImage = block.type === "ImageBlock";
  const isVideo = block.type === "VideoBlock";
  const isShape = block.type === "Shape" && block.props.shape !== "line";
  const isShapeImage = block.type === "Shape" && Boolean(block.props.shapeImageSrc) && block.props.shape !== "line";

  if (!isImage && !isVideo && !isShape) return null;

  function update(updates: MotionDocProps) {
    onUpdateBlock(blockIndex, { ...block.props, ...updates });
  }

  return (
    <div
      aria-label={`${tx(block.type)} ${tx("quick controls")}`}
      className={`absolute left-1/2 z-80 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-white/[0.09] bg-[#151419]/95 p-1 shadow-[0_12px_36px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl ${toolbarPlacementClass(placement)}`}
      onPointerDownCapture={(event) => {
        event.stopPropagation();
        onSelectBlock(blockIndex);
      }}
      role="toolbar"
    >
      {isShape ? <ShapeQuickControls block={block} onUpdate={update} /> : null}
      {isImage || isVideo ? (
        <MediaQuickControls
          block={block}
          isImageCropActive={isImageCropActive}
          isVideo={isVideo}
          onToggleImageCrop={isImage ? () => onToggleImageCrop?.(blockIndex) : undefined}
          onUpdate={update}
        />
      ) : null}
      {isShapeImage ? (
        <MediaQuickControls
          block={{ props: shapeImageAsImageProps(block.props), type: "ImageBlock" }}
          isImageCropActive={isImageCropActive}
          isVideo={false}
          onToggleImageCrop={() => onToggleImageCrop?.(blockIndex)}
          onUpdate={(updates) => onUpdateBlock(
            blockIndex,
            imagePropsAsShapeImageProps(block.props, { ...shapeImageAsImageProps(block.props), ...updates })
          )}
        />
      ) : null}
    </div>
  );
}

function toolbarPlacementClass(placement: VisualFrameToolbarPlacement) {
  if (placement === "below") return "top-[calc(100%+10px)]";
  return "bottom-[calc(100%+10px)]";
}

function ShapeQuickControls({ block, onUpdate }: { block: MotionDocVisualBlock; onUpdate: (updates: MotionDocProps) => void }) {
  return (
    <>
      <ColorSwatch label="Fill color" value={String(block.props.fill ?? "#8b5cf6")} onChange={(fill) => onUpdate({ fill })} />
      <ColorSwatch label="Stroke color" value={String(block.props.stroke ?? "#ffffff")} onChange={(stroke) => onUpdate({ stroke })} />
    </>
  );
}

function ColorSwatch({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  const { tx } = usePitchI18n();
  return (
    <Popover.Root modal={false}>
      <Popover.Trigger asChild>
        <button aria-label={tx(label)} className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[9px] font-semibold text-neutral-400 hover:bg-white/[0.07] hover:text-white" type="button">
          <span className="h-4 w-4 rounded-md border border-white/25" style={{ backgroundColor: value }} />
          {tx(label.replace(" color", ""))}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="center" className="z-[130] w-[250px] rounded-xl border border-white/10 bg-[#17171a] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.58)]" sideOffset={8}>
          <CompactColorPanel label={tx(label)} onChange={onChange} value={value} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function MediaQuickControls({
  block,
  isImageCropActive,
  isVideo,
  onToggleImageCrop,
  onUpdate
}: {
  block: MotionDocVisualBlock;
  isImageCropActive: boolean;
  isVideo: boolean;
  onToggleImageCrop?: () => void;
  onUpdate: (updates: MotionDocProps) => void;
}) {
  const { tx } = usePitchI18n();
  const fit = normalizeFit(block.props.fit);
  const isMuted = normalizeBoolean(block.props.muted, true);
  const showsControls = normalizeBoolean(block.props.controls, true);

  return (
    <>
      <span className="shrink-0 whitespace-nowrap px-1.5 text-[9px] font-semibold text-neutral-500">
        {tx("Fit").toUpperCase()}
      </span>
      {fitOptions.map((option) => (
        <ToolbarButton active={fit === option.value} key={option.value} label={option.label} onClick={() => onUpdate({ fit: option.value })}>
          {option.icon}
        </ToolbarButton>
      ))}
      <ToolbarDivider />
      {isVideo ? (
        <>
          <ToolbarButton active={isMuted} label={isMuted ? "Unmute video" : "Mute video"} onClick={() => onUpdate({ muted: isMuted ? "false" : "true" })}>
            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton active={showsControls} label={showsControls ? "Hide playback controls" : "Show playback controls"} onClick={() => onUpdate({ controls: showsControls ? "false" : "true" })}>
            {showsControls ? <PanelBottom size={13} /> : <PanelBottomDashed size={13} />}
          </ToolbarButton>
        </>
      ) : (
        <>
          <ToolbarButton active={isImageCropActive} label={isImageCropActive ? "Apply crop" : "Crop image"} onClick={() => onToggleImageCrop?.()}>{isImageCropActive ? <Check size={13} /> : <Crop size={13} />}</ToolbarButton>
          {isImageCropActive ? <CropZoomControls block={block} onUpdate={onUpdate} /> : null}
          <ToolbarButton label="Reset image crop" onClick={() => onUpdate({ cropX: 0, cropY: 0, scaleX: 1, scaleY: 1 })}><RefreshCcw size={13} /></ToolbarButton>
        </>
      )}
    </>
  );
}

function CropZoomControls({ block, onUpdate }: { block: MotionDocVisualBlock; onUpdate: (updates: MotionDocProps) => void }) {
  const scale = Math.max(numberProp(block.props.scaleX, 1), numberProp(block.props.scaleY, 1));

  function setScale(nextValue: number) {
    const nextScale = Math.round(Math.min(Math.max(nextValue, 1), 8) * 20) / 20;
    const scaleRatio = nextScale / Math.max(scale, 0.1);
    onUpdate({
      cropX: clampImagePosition(numberProp(block.props.cropX, 0) * scaleRatio),
      cropY: clampImagePosition(numberProp(block.props.cropY, 0) * scaleRatio),
      scaleX: nextScale,
      scaleY: nextScale
    });
  }

  return (
    <>
      <ToolbarDivider />
      <ToolbarButton label="Zoom out 5%" onClick={() => setScale(scale - 0.05)}><Minus size={12} /></ToolbarButton>
      <span className="min-w-8 text-center font-mono text-[9px] tabular-nums text-neutral-400">{Math.round(scale * 100)}%</span>
      <ToolbarButton label="Zoom in 5%" onClick={() => setScale(scale + 0.05)}><Plus size={12} /></ToolbarButton>
      <ToolbarDivider />
    </>
  );
}

function ToolbarButton({ active = false, children, label, onClick }: { active?: boolean; children: React.ReactNode; label: string; onClick: () => void }) {
  const { tx } = usePitchI18n();
  return (
    <button aria-label={tx(label)} className={`flex h-7 w-7 items-center justify-center rounded-lg outline-none transition active:scale-90 focus-visible:ring-1 focus-visible:ring-violet-300/70 ${active ? "bg-white text-[#17171a] shadow-sm" : "text-neutral-500 hover:bg-white/[0.07] hover:text-white"}`} onClick={onClick} title={tx(label)} type="button">
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-white/[0.08]" />;
}

function numberProp(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeFit(value: string | number | undefined) {
  return value === "contain" || value === "fill" || value === "scale-down" ? value : "cover";
}

function normalizeBoolean(value: string | number | undefined, fallback: boolean) {
  if (value === "false" || value === 0) return false;
  if (value === "true" || value === 1) return true;
  return fallback;
}

function clampImagePosition(value: number) {
  return Math.round(Math.min(Math.max(value, -350), 350) * 100) / 100;
}
