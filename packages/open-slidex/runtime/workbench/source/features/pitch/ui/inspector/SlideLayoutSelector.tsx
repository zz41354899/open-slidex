
import { useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, LayoutGrid, X } from "lucide-react";
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
          className="flex min-h-12 w-full min-w-0 items-center justify-between overflow-hidden rounded-xl border border-white/[0.1] bg-[#242424] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors duration-200 hover:border-white/[0.18] hover:bg-[#2a2a2a] focus-visible:border-white/[0.28] focus-visible:ring-2 focus-visible:ring-white/[0.12]"
          variant="ghost"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.09] bg-white/[0.05] text-neutral-200">
              <LayoutGrid aria-hidden="true" size={16} strokeWidth={1.8} />
            </div>
            <div className="flex min-w-0 flex-col items-start text-left">
              <span className="max-w-full truncate text-[12px] font-medium leading-4 text-neutral-500">{tx("Add new slide")}</span>
              <span className="max-w-full truncate text-[14px] font-semibold leading-5 text-neutral-100">{tx("Choose Layout")}</span>
            </div>
          </div>
          <ChevronDown className="ml-2 shrink-0 text-neutral-400" size={14} />
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
      className="flex max-h-[min(760px,calc(100vh-2rem))] w-[calc(100vw-2rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-white/[0.1] bg-[#1a1a1a]/95 p-0 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_1px_0_rgba(255,255,255,0.12)] backdrop-blur-3xl sm:max-w-[800px]"
      closeLabel={closeLabel}
      onEscapeKeyDown={(event) => event.stopPropagation()}
      showCloseButton={false}
    >
      <div className="relative flex items-center justify-center border-b border-white/[0.05] px-6 py-4">
        <DialogTitle className="text-[14px] font-semibold text-neutral-100">{tx("Choose Layout")}</DialogTitle>
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
      <div className="custom-scrollbar overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 sm:gap-x-5">
          {slideLayouts.map((layout) => (
            <Button
              key={layout.id}
              type="button"
              className="group flex h-auto min-w-0 cursor-pointer flex-col items-center gap-2 whitespace-normal rounded-xl p-1 text-center outline-none transition-colors duration-200 hover:bg-white/[0.04] active:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-white/35"
              onClick={() => {
                const source = localAssetsOnly ? stripNonLocalMotionDocMedia(layout.source) : layout.source;
                onAddLayout(source, layout.id);
                onClose();
              }}
              variant="ghost"
            >
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/[0.12] bg-white shadow-md transition-colors group-hover:border-white/35">
                <LayoutThumbnail layoutId={layout.id} />
              </div>
              <span className="flex min-h-9 w-full items-start justify-center px-1 text-[14px] font-semibold leading-[18px] text-neutral-300 transition-colors group-hover:text-white">
                {tx(layout.name)}
              </span>
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
