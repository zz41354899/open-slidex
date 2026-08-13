
import { useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import { slideLayouts } from "@/core/motion-doc/presets/templates/slideLayouts";
import { stripNonLocalMotionDocMedia } from "@/core/motion-doc/application/localMediaPolicy";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger
} from "@/common/ui/shadcnPrimitives";

type SlideLayoutSelectorProps = {
  localAssetsOnly?: boolean;
  onAddLayout: (layoutSource: string, layoutId: string) => void;
};

export function SlideLayoutSelector({ localAssetsOnly = false, onAddLayout }: SlideLayoutSelectorProps) {
  const { tx } = usePitchI18n();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog onOpenChange={setIsOpen} open={isOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="flex w-full items-center justify-between rounded-xl border border-white/[0.05] bg-[#020202] px-3.5 py-2.5 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.03)] transition-all duration-200 hover:border-white/[0.1] focus-visible:border-white/[0.2] focus-visible:ring-1 focus-visible:ring-white/[0.1]"
          variant="ghost"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-12 items-center justify-center overflow-hidden rounded-[4px] border border-white/10 bg-white shadow-sm">
              <LayoutThumbnail layoutId="blank" />
            </div>
            <div className="flex flex-col items-start">
              <span className="mb-0.5 text-[10px] font-bold text-neutral-500">{tx("Add new slide")}</span>
              <span className="text-sm font-semibold text-neutral-200">{tx("Choose Layout")}</span>
            </div>
          </div>
          <ChevronDown className="text-neutral-400" size={14} />
        </Button>
      </DialogTrigger>
      <SlideLayoutsDialog
        localAssetsOnly={localAssetsOnly}
        onAddLayout={onAddLayout}
        onClose={() => setIsOpen(false)}
      />
    </Dialog>
  );
}

function SlideLayoutsDialog({
  onClose,
  localAssetsOnly,
  onAddLayout
}: {
  onClose: () => void;
  localAssetsOnly: boolean;
  onAddLayout: (source: string, id: string) => void;
}) {
  const { tx } = usePitchI18n();
  const closeLabel = tx("Close layout selector");

  return (
    <DialogContent
      aria-describedby={undefined}
      className="flex max-h-[80vh] w-[min(800px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-3xl border-white/[0.1] bg-[#1a1a1a]/95 p-0 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-3xl"
      closeLabel={closeLabel}
      onEscapeKeyDown={(event) => event.stopPropagation()}
      showCloseButton={false}
    >
      <div className="relative flex items-center justify-center border-b border-white/[0.05] px-6 py-4">
        <DialogTitle className="text-[13px] font-semibold text-neutral-200">{tx("Choose Layout")}</DialogTitle>
        <DialogClose asChild>
          <Button
            aria-label={closeLabel}
            className="absolute right-4 top-3.5 grid size-7 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-white/30"
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <X size={15} />
          </Button>
        </DialogClose>
      </div>
      <div className="custom-scrollbar overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {slideLayouts.map((layout) => (
            <Button
              key={layout.id}
              type="button"
              className="group flex h-auto cursor-pointer flex-col items-center gap-2 p-0 text-center outline-none transition-transform duration-200 hover:scale-[1.02] hover:bg-transparent active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#8ea5ff]/70"
              onClick={() => {
                const source = localAssetsOnly ? stripNonLocalMotionDocMedia(layout.source) : layout.source;
                onAddLayout(source, layout.id);
                onClose();
              }}
              variant="ghost"
            >
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/[0.1] bg-white shadow-md transition-colors group-hover:border-[#8ea5ff]/60">
                <LayoutThumbnail layoutId={layout.id} />
              </div>
              <span className="text-xs font-semibold text-neutral-300 transition-colors group-hover:text-white">{tx(layout.name)}</span>
            </Button>
          ))}
        </div>
      </div>
    </DialogContent>
  );
}

type ThumbnailPrimitiveProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

function Block({ className, style }: ThumbnailPrimitiveProps) {
  return <div className={`absolute rounded-sm ${className ?? ""}`} style={style} />;
}

function TextLine({ className, style }: ThumbnailPrimitiveProps) {
  return <div className={`absolute rounded-full bg-black/80 ${className ?? ""}`} style={style} />;
}

function ImgBlock({ className, style, children }: ThumbnailPrimitiveProps) {
  return (
    <div className={`absolute overflow-hidden rounded-[4px] bg-neutral-300 ${className ?? ""}`} style={style}>
      {children ?? <div className="h-full w-full bg-gradient-to-br from-neutral-200 to-neutral-400" />}
    </div>
  );
}

function LayoutThumbnail({ layoutId }: { layoutId: string }) {

  switch (layoutId) {
    case "title":
      return (
        <div className="w-full h-full relative">
          <TextLine className="w-[60%] h-[12%] left-[20%] top-[40%]" />
        </div>
      );
    case "title-photo":
      return (
        <div className="w-full h-full relative">
          <TextLine className="w-[30%] h-[10%] left-[10%] top-[45%]" />
          <ImgBlock className="w-[40%] h-[80%] left-[50%] top-[10%]" />
        </div>
      );
    case "title-alt-photo":
      return (
        <div className="w-full h-full relative">
          <ImgBlock className="w-[40%] h-[80%] left-[10%] top-[10%]" />
          <TextLine className="w-[30%] h-[10%] left-[60%] top-[45%]" />
        </div>
      );
    case "title-bullets":
      return (
        <div className="w-full h-full relative">
          <TextLine className="w-[40%] h-[8%] left-[10%] top-[15%]" />
          <TextLine className="w-[50%] h-[4%] left-[15%] top-[40%]" />
          <Block className="w-[1.5%] h-[4%] left-[10%] top-[40%] rounded-full bg-black/60" />
          <TextLine className="w-[40%] h-[4%] left-[15%] top-[55%]" />
          <Block className="w-[1.5%] h-[4%] left-[10%] top-[55%] rounded-full bg-black/60" />
          <TextLine className="w-[60%] h-[4%] left-[15%] top-[70%]" />
          <Block className="w-[1.5%] h-[4%] left-[10%] top-[70%] rounded-full bg-black/60" />
        </div>
      );
    case "bullets":
      return (
        <div className="w-full h-full relative">
          <TextLine className="w-[50%] h-[5%] left-[15%] top-[30%]" />
          <Block className="w-[2%] h-[5%] left-[10%] top-[30%] rounded-full bg-black/60" />
          <TextLine className="w-[40%] h-[5%] left-[15%] top-[50%]" />
          <Block className="w-[2%] h-[5%] left-[10%] top-[50%] rounded-full bg-black/60" />
          <TextLine className="w-[60%] h-[5%] left-[15%] top-[70%]" />
          <Block className="w-[2%] h-[5%] left-[10%] top-[70%] rounded-full bg-black/60" />
        </div>
      );
    case "title-bullets-photo":
      return (
        <div className="w-full h-full relative">
          <TextLine className="w-[30%] h-[8%] left-[8%] top-[10%]" />
          <TextLine className="w-[20%] h-[4%] left-[12%] top-[35%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[35%] rounded-full bg-black/60" />
          <TextLine className="w-[25%] h-[4%] left-[12%] top-[50%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[50%] rounded-full bg-black/60" />
          <ImgBlock className="w-[40%] h-[60%] left-[52%] top-[30%]" />
        </div>
      );
    case "title-bullets-small-video":
      return (
        <div className="w-full h-full relative">
          <TextLine className="w-[30%] h-[8%] left-[8%] top-[10%]" />
          <TextLine className="w-[20%] h-[4%] left-[12%] top-[35%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[35%] rounded-full bg-black/60" />
          <TextLine className="w-[25%] h-[4%] left-[12%] top-[50%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[50%] rounded-full bg-black/60" />
          <ImgBlock className="w-[35%] h-[45%] left-[52%] top-[30%] !bg-neutral-800 flex items-center justify-center">
            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-white border-b-[4px] border-b-transparent ml-[2px]" />
          </ImgBlock>
        </div>
      );
    case "title-bullets-large-video":
      return (
        <div className="w-full h-full relative">
          <TextLine className="w-[30%] h-[8%] left-[8%] top-[10%]" />
          <TextLine className="w-[20%] h-[4%] left-[12%] top-[35%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[35%] rounded-full bg-black/60" />
          <TextLine className="w-[15%] h-[4%] left-[12%] top-[50%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[50%] rounded-full bg-black/60" />
          <ImgBlock className="w-[50%] h-[65%] left-[42%] top-[25%] !bg-neutral-800 flex items-center justify-center">
            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-[3px]" />
          </ImgBlock>
        </div>
      );
    case "chapter":
      return (
        <div className="w-full h-full relative flex items-center justify-center">
          <TextLine className="w-[40%] h-[12%] !relative" />
        </div>
      );
    case "only-title":
      return (
        <div className="w-full h-full relative flex items-center">
          <TextLine className="w-[50%] h-[10%] left-[8%] top-[45%]" />
        </div>
      );
    case "agenda":
      return (
        <div className="w-full h-full relative">
          <TextLine className="w-[20%] h-[8%] left-[8%] top-[10%]" />
          <TextLine className="w-[30%] h-[4%] left-[15%] top-[35%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[35%] rounded-full bg-black/60" />
          <TextLine className="w-[40%] h-[4%] left-[15%] top-[55%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[55%] rounded-full bg-black/60" />
          <TextLine className="w-[35%] h-[4%] left-[15%] top-[75%]" />
          <Block className="w-[1.5%] h-[4%] left-[8%] top-[75%] rounded-full bg-black/60" />
        </div>
      );
    case "statement":
      return (
        <div className="w-full h-full relative flex flex-col items-center justify-center gap-1.5">
          <TextLine className="w-[60%] h-[6%] !relative" />
          <TextLine className="w-[50%] h-[6%] !relative" />
          <TextLine className="w-[40%] h-[6%] !relative" />
        </div>
      );
    case "key-fact":
      return (
        <div className="w-full h-full relative flex flex-col items-center justify-center gap-2">
          <TextLine className="w-[30%] h-[16%] !relative" />
          <TextLine className="w-[15%] h-[4%] !relative" />
        </div>
      );
    case "quote":
      return (
        <div className="w-full h-full relative flex flex-col justify-center pl-[15%] gap-2">
          <TextLine className="w-[50%] h-[6%] !relative" />
          <TextLine className="w-[40%] h-[6%] !relative" />
          <TextLine className="w-[20%] h-[4%] !relative mt-[10%]" />
        </div>
      );
    case "photos-3":
      return (
        <div className="w-full h-full relative">
          <ImgBlock className="w-[40%] h-[80%] left-[8%] top-[10%]" />
          <ImgBlock className="w-[40%] h-[38%] left-[52%] top-[10%]" />
          <ImgBlock className="w-[40%] h-[38%] left-[52%] top-[52%]" />
        </div>
      );
    case "photo":
      return (
        <div className="w-full h-full relative">
          <ImgBlock className="w-full h-full rounded-none" />
        </div>
      );
    case "blank":
    default:
      return <div className="w-full h-full relative" />;
  }
}
