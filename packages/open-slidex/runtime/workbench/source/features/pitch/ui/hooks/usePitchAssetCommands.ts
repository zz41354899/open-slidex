
import type { Dispatch, SetStateAction } from "react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { omitMotionDocProps } from "@/core/motion-doc/application/motionDocProps";
import { removeShapeImageProps } from "@/core/motion-doc/application/shapeImage";
import {
  appendBlockToSlide,
  replaceSlideSource,
  updateBlockInSlide
} from "@/features/pitch/application/motionDocCommands";
import type { BlockUpdater } from "@/features/pitch/application/pitchCommandTypes";
import {
  normalizeAbsolutePitchImageSource,
  normalizeDirectPitchImageSource
} from "@/features/pitch/application/pitchAssetPolicy";
import {
  presentationImageReferenceCount,
  presentationImageStoragePathFromSource
} from "@/features/pitch/application/presentationImagePath";
import { PitchAssetFileError } from "@/features/pitch/infrastructure/pitchAssetFiles";
import { stringValue } from "@/common/util/valueUtils";
import type { SlideXEditorAssetAdapter, SlideXEditorCloudAssetAdapter } from "@/features/pitch/domain/localEditor";

type UsePitchAssetCommandsArgs = {
  activeSlide: MotionDocScene | undefined;
  activeSlideIndex: number;
  assetAdapter?: SlideXEditorAssetAdapter;
  cloudAssetAdapter?: SlideXEditorCloudAssetAdapter;
  commitSource: (nextSource: string | ((current: string) => string)) => void;
  onImageUploadAuthRequired: () => void;
  onImageRemovalAuthRequired: () => void;
  presentationId?: string;
  scenes: MotionDocScene[];
  selectedBlockIndex: number | null;
  selectSingleBlock: (index: number | null) => void;
  setNotice: Dispatch<SetStateAction<string>>;
  updateBlock: BlockUpdater;
};

export function usePitchAssetCommands({
  activeSlide,
  activeSlideIndex,
  assetAdapter,
  cloudAssetAdapter,
  commitSource,
  onImageUploadAuthRequired,
  onImageRemovalAuthRequired,
  presentationId,
  scenes,
  selectedBlockIndex,
  selectSingleBlock,
  setNotice,
  updateBlock
}: UsePitchAssetCommandsArgs) {
  function requestImageUpload() {
    if (presentationId || assetAdapter) return true;
    onImageUploadAuthRequired();
    return false;
  }

  function requestImageRemoval() {
    if (presentationId || assetAdapter) return true;
    onImageRemovalAuthRequired();
    return false;
  }

  async function uploadPresentationImage(file: File) {
    if (assetAdapter) {
      const asset = await assetAdapter.import(file);
      return {
        optimized: false,
        path: asset.source,
        url: asset.source
      };
    }
    if (!presentationId) {
      throw new PitchAssetFileError("Sign in and open a saved presentation before uploading images");
    }

    if (!cloudAssetAdapter) {
      throw new PitchAssetFileError("Cloud image adapter is unavailable");
    }
    return cloudAssetAdapter.import(file, presentationId);
  }

  async function pasteImageFile(file: File) {
    if (!activeSlide || !file.type.startsWith("image/")) return;
    if (!requestImageUpload()) return;

    try {
      setNotice("Uploading image...");
      const preparedAsset = await uploadPresentationImage(file);
      const selectedBlock = selectedBlockIndex === null ? undefined : activeSlide.blocks[selectedBlockIndex];

      if (selectedBlockIndex !== null && selectedBlock?.type === "Shape" && selectedBlock.props.shape !== "line") {
        updateBlock(selectedBlockIndex, {
          ...selectedBlock.props,
          shapeImageAlt: file.name || "Pasted image",
          shapeImageFit: selectedBlock.props.shapeImageFit || "cover",
          shapeImageSrc: preparedAsset.url
        });
        setNotice(preparedAsset.optimized ? "Image optimized and placed inside shape" : "Image placed inside shape");
        return;
      }

      if (selectedBlockIndex !== null && selectedBlock?.type === "ImageBlock") {
        const selectedImageProps = omitMotionDocProps(selectedBlock.props, ["sourceUrl"]);
        const slide = updateBlockInSlide(activeSlide, selectedBlockIndex, {
          ...selectedImageProps,
          alt: file.name || "Pasted image",
          fit: selectedBlock.props.fit || "contain",
          src: preparedAsset.url
        });
        if (!slide) return;
        commitSource((current) => replaceSlideSource(current, activeSlideIndex, slide));
        setNotice(preparedAsset.optimized ? "Image optimized, uploaded, and pasted into selected layer" : "Image uploaded and pasted into selected layer");
        return;
      }

      const { blockIndex, slide } = appendBlockToSlide(activeSlide, "Image", {
        props: { alt: file.name || "Pasted image", fit: "contain", src: preparedAsset.url }
      });
      commitSource((current) => replaceSlideSource(current, activeSlideIndex, slide));
      selectSingleBlock(blockIndex);
      setNotice(preparedAsset.optimized ? "Image optimized, uploaded, and pasted" : "Image uploaded and pasted");
    } catch (error) {
      if (cloudAssetAdapter?.isAuthenticationError(error)) {
        onImageUploadAuthRequired();
      }
      setNotice(error instanceof Error ? error.message : "Unable to paste image");
    }
  }

  async function uploadImageForBlock(blockIndex: number, file: File | undefined) {
    if (!activeSlide || !file) return;
    if (!requestImageUpload()) return;
    const block = activeSlide.blocks[blockIndex];
    if (!block || (block.type !== "ImageBlock" && block.type !== "Shape")) return;
    if (block.type === "Shape" && block.props.shape === "line") return;
    if (!file.type.startsWith("image/")) {
      setNotice("Choose an image file");
      return;
    }

    try {
      setNotice("Uploading image...");
      const preparedAsset = await uploadPresentationImage(file);
      if (block.type === "Shape") {
        updateBlock(blockIndex, {
          ...block.props,
          shapeImageAlt: stringValue(block.props.shapeImageAlt) || file.name,
          shapeImageFit: stringValue(block.props.shapeImageFit) || "cover",
          shapeImageSrc: preparedAsset.url
        });
      } else {
        const imageProps = omitMotionDocProps(block.props, ["sourceUrl"]);
        updateBlock(blockIndex, {
          ...imageProps,
          alt: stringValue(block.props.alt) || file.name,
          fit: stringValue(block.props.fit) || "cover",
          src: preparedAsset.url
        });
      }
      setNotice(preparedAsset.optimized ? "Image optimized and uploaded" : "Image uploaded");
    } catch (error) {
      if (cloudAssetAdapter?.isAuthenticationError(error)) {
        onImageUploadAuthRequired();
      }
      setNotice(error instanceof Error ? error.message : "Failed to upload image");
    }
  }

  async function uploadVideoForBlock(blockIndex: number, file: File | undefined) {
    if (!activeSlide || !file) return;
    const block = activeSlide.blocks[blockIndex];
    if (!block || block.type !== "VideoBlock") return;
    if (!assetAdapter) {
      setNotice("MP4 upload is available in the local OpenSlideX Workbench.");
      return;
    }
    if (file.type !== "video/mp4" && !file.name.toLowerCase().endsWith(".mp4")) {
      setNotice("Choose an MP4 video file");
      return;
    }

    try {
      setNotice("Uploading MP4 video...");
      const asset = await assetAdapter.import(file);
      updateBlock(blockIndex, { ...block.props, src: asset.source });
      setNotice("MP4 uploaded. PowerPoint export embeds this video.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to upload MP4 video");
    }
  }

  function importImageUrlForBlock(blockIndex: number, source: string) {
    if (!activeSlide) return false;
    const block = activeSlide.blocks[blockIndex];
    if (!block || (block.type !== "ImageBlock" && block.type !== "Shape")) return false;
    if (block.type === "Shape" && block.props.shape === "line") return false;

    const directSource = presentationId || assetAdapter
      ? normalizeDirectPitchImageSource(source)
      : normalizeAbsolutePitchImageSource(source);
    if (!directSource) {
      setNotice(
        presentationId
          ? "Enter a valid https URL or image path"
          : "Guests must use a complete https:// image URL"
      );
      return false;
    }

    if (block.type === "Shape") updateBlock(blockIndex, { ...block.props, shapeImageSrc: directSource });
    else {
      const imageProps = omitMotionDocProps(block.props, ["sourceUrl"]);
      updateBlock(blockIndex, { ...imageProps, src: directSource });
    }
    setNotice("Image path loaded");
    return true;
  }

  async function removeImageForBlock(blockIndex: number) {
    if (!activeSlide) return;
    if (!requestImageRemoval()) return;
    const block = activeSlide.blocks[blockIndex];
    if (!block || (block.type !== "ImageBlock" && block.type !== "Shape")) return;

    const source = stringValue(block.type === "Shape" ? block.props.shapeImageSrc : block.props.src)?.trim() ?? "";
    if (!source) return;

    const storagePath = presentationImageStoragePathFromSource(source);
    try {
      const referenceCount = presentationImageReferenceCount(scenes, source);
      if ((storagePath || assetAdapter) && referenceCount <= 1) {
        if (assetAdapter) {
          await assetAdapter.remove?.(source);
        } else if (!presentationId) {
          throw new PitchAssetFileError("Sign in before removing uploaded images");
        } else {
          if (!storagePath) throw new PitchAssetFileError("Image storage path is invalid");
          if (!cloudAssetAdapter) throw new PitchAssetFileError("Cloud image adapter is unavailable");
          await cloudAssetAdapter.remove(storagePath);
        }
      }

      if (block.type === "Shape") updateBlock(blockIndex, removeShapeImageProps(block.props));
      else {
        const imageProps = omitMotionDocProps(block.props, ["sourceUrl"]);
        updateBlock(blockIndex, { ...imageProps, src: "" });
      }
      setNotice(
        storagePath && referenceCount <= 1
          ? "Image removed from Supabase"
          : storagePath
            ? "Image removed from this layer; the shared Supabase file was kept"
            : "Image removed from this layer"
      );
    } catch (error) {
      if (cloudAssetAdapter?.isAuthenticationError(error)) {
        onImageRemovalAuthRequired();
      }
      setNotice(error instanceof Error ? error.message : "Failed to remove image");
    }
  }

  return {
    importImageUrlForBlock,
    imageSourceRequiresAbsoluteUrl: !presentationId && !assetAdapter,
    pasteImageFile,
    removeImageForBlock,
    requestImageRemoval,
    requestImageUpload,
    uploadImageForBlock,
    uploadVideoForBlock
  };
}
