
import { ImagePlus, Maximize, Minimize, RefreshCcw, Shrink, StretchHorizontal, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { normalizeDirectPitchImageSource } from "@/features/pitch/application/pitchAssetPolicy";
import { presentationImageStoragePathFromSource } from "@/features/pitch/application/presentationImagePath";
import {
  Field,
  IconSegmentedControl,
  NumberInput,
  TextInput,
  type BlockFieldProps
} from "@/features/pitch/ui/inspector/InspectorControls";
import { ImageFilterSection } from "@/features/pitch/ui/inspector/image/ImageFilterSection";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { usePreviewMediaSource } from "@/features/pitch/ui/preview/PreviewMediaPolicy";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/common/ui/shadcnPrimitives";

export function ImageFields({
  block,
  imageSourceRequiresAbsoluteUrl,
  importImageUrlForBlock,
  removeImageForBlock,
  requestImageRemoval,
  requestImageUpload,
  selectedBlockIndex,
  updateBlock,
  uploadImageForBlock
}: BlockFieldProps & {
  imageSourceRequiresAbsoluteUrl: boolean;
  importImageUrlForBlock: (blockIndex: number, source: string) => boolean;
  removeImageForBlock: (blockIndex: number) => void;
  requestImageRemoval: () => boolean;
  requestImageUpload: () => boolean;
  uploadImageForBlock: (blockIndex: number, file: File | undefined) => void;
}) {
  const { tx } = usePitchI18n();
  const hasImage = Boolean(block.props.src);
  const previewImageSource = usePreviewMediaSource(String(block.props.src ?? ""));
  const [isRemoveConfirmationOpen, setIsRemoveConfirmationOpen] = useState(false);
  const externalImageSource = externalSource(block.props.sourceUrl ?? block.props.src);

  function commitImageUrl(value: string) {
    const source = value.trim();
    if (source === externalImageSource) return true;
    if (!source) {
      if (!requestImageRemoval()) return false;
      setIsRemoveConfirmationOpen(true);
      return false;
    }
    return importImageUrlForBlock(selectedBlockIndex, source);
  }

  function removeImage() {
    setIsRemoveConfirmationOpen(false);
    removeImageForBlock(selectedBlockIndex);
    return true;
  }

  const removesSupabaseFile = presentationImageStoragePathFromSource(String(block.props.src ?? "")) !== null;

  return (
    <div className="flex flex-col gap-5">
      {/* Visual Image Uploader/Preview Area */}
      <Field label="Content">
        <div className="group relative flex h-32 w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-white/[0.07] bg-[#151518] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-[border-color,box-shadow] hover:border-white/[0.13] hover:shadow-[0_10px_28px_rgba(0,0,0,0.22)]">
          {hasImage ? (
            <>
              <img
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-75 transition-[opacity,transform] duration-300 group-hover:scale-[1.015] group-hover:opacity-60"
                decoding="async"
                loading="lazy"
                src={previewImageSource}
              />
              <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/45" />
              <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-[10px] border border-white/10 bg-black/55 p-1 shadow-lg backdrop-blur-md">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <label aria-label={tx("Replace image")} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-neutral-300 outline-none transition hover:bg-white/10 hover:text-white active:scale-90">
                      <Upload size={14} />
                      <input
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => {
                          uploadImageForBlock(selectedBlockIndex, event.target.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                        onClick={(event) => {
                          if (!requestImageUpload()) event.preventDefault();
                        }}
                        type="file"
                      />
                    </label>
                  </TooltipTrigger>
                  <TooltipContent side="left">{tx("Replace image")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label={tx("Remove image")}
                      className="h-7 w-7 text-neutral-400 hover:bg-rose-500/15 hover:text-rose-300 active:scale-90 focus-visible:ring-1 focus-visible:ring-rose-300/60"
                      onClick={() => {
                        if (requestImageRemoval()) setIsRemoveConfirmationOpen(true);
                      }}
                      size="icon-xs"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">{tx("Remove image")}</TooltipContent>
                </Tooltip>
              </div>
            </>
          ) : (
            <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 text-neutral-500 transition-colors hover:text-neutral-300">
              <ImagePlus size={24} />
              <span className="text-xs font-medium">{tx("Upload Image")}</span>
              <input
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  uploadImageForBlock(selectedBlockIndex, event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
                onClick={(event) => {
                  if (!requestImageUpload()) event.preventDefault();
                }}
                type="file"
              />
            </label>
          )}
        </div>
      </Field>

      <Dialog onOpenChange={setIsRemoveConfirmationOpen} open={isRemoveConfirmationOpen}>
        <DialogContent
          aria-describedby="remove-image-description"
          className="w-[min(420px,calc(100vw-2rem))] border-white/[0.1] bg-[#17171a]"
          closeLabel={tx("Cancel")}
        >
          <DialogTitle>{tx("Remove image")}</DialogTitle>
          <DialogDescription id="remove-image-description">
            {tx(removesSupabaseFile ? "Remove from this slide and delete the unused Supabase file?" : "Remove this image from the slide?")}
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">{tx("Cancel")}</Button>
            </DialogClose>
            <Button onClick={removeImage} type="button" variant="destructive">
              <Trash2 size={14} />
              {tx("Remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CommittedImageUrlInput
        absoluteUrlOnly={imageSourceRequiresAbsoluteUrl}
        key={`${selectedBlockIndex}-${externalImageSource}`}
        onCommit={commitImageUrl}
        value={externalImageSource}
      />

      <TextInput
        label="Alt Text"
        placeholder={tx("Image description")}
        value={block.props.alt ?? ""}
        onChange={(value) => updateBlock(
          selectedBlockIndex,
          { ...block.props, alt: value }
        )}
      />

      <IconSegmentedControl
        label="Image fit"
        options={[
          { label: "cover", value: "cover", icon: <Maximize size={14} /> },
          { label: "contain", value: "contain", icon: <Minimize size={14} /> },
          { label: "fill", value: "fill", icon: <StretchHorizontal size={14} /> },
          { label: "scale-down", value: "scale-down", icon: <Shrink size={14} /> },
        ]}
        value={String(block.props.fit ?? "cover")}
        onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, fit: value })}
      />

      <Field label="Image scale">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
          <NumberInput
            min="0.1"
            max="8"
            onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, scaleX: value === "" ? 1 : value })}
            prefix={<span className="text-[9px] font-semibold text-neutral-500">X</span>}
            step="0.05"
            suffix="×"
            value={block.props.scaleX ?? 1}
          />
          <NumberInput
            min="0.1"
            max="8"
            onChange={(value) => updateBlock(selectedBlockIndex, { ...block.props, scaleY: value === "" ? 1 : value })}
            prefix={<span className="text-[9px] font-semibold text-neutral-500">Y</span>}
            step="0.05"
            suffix="×"
            value={block.props.scaleY ?? 1}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={tx("Reset image scale")}
                className="h-9 w-9 rounded-xl border border-white/[0.055] bg-[#18181b] text-neutral-500 transition-all hover:border-white/10 hover:bg-white/[0.06] hover:text-white active:scale-95"
                onClick={() => updateBlock(selectedBlockIndex, { ...block.props, cropX: 0, cropY: 0, scaleX: 1, scaleY: 1 })}
                size="icon"
                type="button"
                variant="ghost"
              >
                <RefreshCcw size={13} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{tx("Reset image scale")}</TooltipContent>
          </Tooltip>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-neutral-600">{tx("Scale the image content without changing its frame.")}</p>
      </Field>

      <ImageFilterSection
        onChange={(updates, options) => updateBlock(selectedBlockIndex, { ...block.props, ...updates }, undefined, options)}
        props={block.props}
      />
      <p className="-mt-2 text-[10px] leading-relaxed text-neutral-600">{tx("Fit and scale reset are also available directly on the selected image frame.")}</p>
    </div>
  );
}

function CommittedImageUrlInput({
  absoluteUrlOnly,
  onCommit,
  value
}: {
  absoluteUrlOnly: boolean;
  onCommit: (value: string) => boolean;
  value: string;
}) {
  const { tx } = usePitchI18n();
  const [draft, setDraft] = useState(value);

  return (
    <Field label={absoluteUrlOnly ? "HTTPS image URL" : "Image URL / path"}>
      <input
        className="h-9 w-full rounded-xl border border-white/[0.055] bg-[#18181b] px-3 text-[12px] text-neutral-200 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-[border-color,background-color,box-shadow] placeholder:text-neutral-600 hover:border-white/[0.09] hover:bg-[#1b1b1e] focus:border-violet-300/35 focus:bg-[#1d1d20] focus:ring-2 focus:ring-violet-400/10"
        onBlur={(event) => {
          if (!onCommit(event.currentTarget.value)) setDraft(value);
        }}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
        placeholder={absoluteUrlOnly ? "https://..." : "https://... or /images/..."}
        type="text"
        value={draft}
      />
      <p className="text-[10px] leading-relaxed text-neutral-600">
        {absoluteUrlOnly
          ? tx("Guests can replace images only with a complete HTTPS URL.")
          : tx("URLs and existing paths are used directly on Enter or blur.")}
      </p>
    </Field>
  );
}

function externalSource(value: string | number | undefined) {
  return typeof value === "string" ? normalizeDirectPitchImageSource(value) ?? "" : "";
}
