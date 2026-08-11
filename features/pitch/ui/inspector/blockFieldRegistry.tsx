"use client";

import type { ReactNode } from "react";
import { CardFields } from "@/features/pitch/ui/inspector/CardFields";
import { IconFields } from "@/features/pitch/ui/inspector/IconFields";
import { ImageFields } from "@/features/pitch/ui/inspector/ImageFields";
import { MetricFields } from "@/features/pitch/ui/inspector/MetricFields";
import { ShapeFields } from "@/features/pitch/ui/inspector/ShapeFields";
import { StackFields } from "@/features/pitch/ui/inspector/StackFields";
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
};

type BlockFieldRegistryEntry = {
  render: (context: BlockFieldRegistryContext) => ReactNode;
  title: string;
};

const blockFieldRegistry: Partial<Record<MotionDocBlockType, BlockFieldRegistryEntry>> = {
  Card: {
    render: (context) => <CardFields {...context} />,
    title: "Card properties"
  },
  Icon: {
    render: (context) => <IconFields {...context} />,
    title: "Icon properties"
  },
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
  Metric: {
    render: (context) => <MetricFields {...context} />,
    title: "Metric properties"
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
  Stack: {
    render: (context) => <StackFields {...context} />,
    title: "Stack properties"
  },
  Table: {
    render: (context) => <TableFields {...context} />,
    title: "Table properties"
  },
  VideoBlock: {
    render: (context) => <VideoFields {...context} />,
    title: "Video properties"
  }
};

export function getBlockFieldRegistryEntry(type: MotionDocBlockType) {
  return blockFieldRegistry[type] ?? null;
}
