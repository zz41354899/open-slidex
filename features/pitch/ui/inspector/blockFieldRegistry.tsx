
import type { ReactNode } from "react";
import { ImageFields } from "@/features/pitch/ui/inspector/ImageFields";
import { ShapeFields } from "@/features/pitch/ui/inspector/ShapeFields";
import { TableFields } from "@/features/pitch/ui/inspector/TableFields";
import { VideoFields } from "@/features/pitch/ui/inspector/VideoFields";
import type { BlockFieldProps } from "@/features/pitch/ui/inspector/InspectorControls";
import type { MotionDocBlockType } from "@/core/motion-doc/domain/motionDocTypes";

type BlockFieldRegistryContext = BlockFieldProps & {
  imageSourceRequiresAbsoluteUrl: boolean;
  importImageUrlForBlock: (blockIndex: number, source: string) => boolean;
  removeImageForBlock: (blockIndex: number) => void;
  requestImageRemoval: () => boolean;
  requestImageUpload: () => boolean;
  uploadImageForBlock: (blockIndex: number, file: File | undefined) => void;
  uploadVideoForBlock: (blockIndex: number, file: File | undefined) => void;
};

type BlockFieldRegistryEntry = {
  render: (context: BlockFieldRegistryContext) => ReactNode;
  title: string;
};

const blockFieldRegistry: Partial<Record<MotionDocBlockType, BlockFieldRegistryEntry>> = {
  ImageBlock: {
    render: (context) => (
      <ImageFields
        {...context}
        imageSourceRequiresAbsoluteUrl={context.imageSourceRequiresAbsoluteUrl}
        importImageUrlForBlock={context.importImageUrlForBlock}
        removeImageForBlock={context.removeImageForBlock}
        requestImageRemoval={context.requestImageRemoval}
        requestImageUpload={context.requestImageUpload}
        uploadImageForBlock={context.uploadImageForBlock}
      />
    ),
    title: "Image properties"
  },
  Shape: {
    render: (context) => (
      <ShapeFields
        {...context}
        removeImageForBlock={context.removeImageForBlock}
        requestImageRemoval={context.requestImageRemoval}
        requestImageUpload={context.requestImageUpload}
        uploadImageForBlock={context.uploadImageForBlock}
      />
    ),
    title: "Shape properties"
  },
  Table: {
    render: (context) => <TableFields {...context} />,
    title: "Table properties"
  },
  VideoBlock: {
    render: (context) => <VideoFields {...context} uploadVideoForBlock={context.uploadVideoForBlock} />,
    title: "Video properties"
  }
};

export function getBlockFieldRegistryEntry(type: MotionDocBlockType) {
  return blockFieldRegistry[type] ?? null;
}
