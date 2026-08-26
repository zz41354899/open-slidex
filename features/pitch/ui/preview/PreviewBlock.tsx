
import { memo, type CSSProperties } from "react";
import type { MotionDocFrame } from "@/core/motion-doc/domain/frame";
import type { MotionDocBlock } from "@/core/motion-doc/domain/motionDocTypes";
import { blockRotation } from "@/core/motion-doc/domain/blockTransform";
import { objectShadowCss } from "@/core/motion-doc/application/objectShadow";
import { MOTION_DOC_CANVAS_HEIGHT, MOTION_DOC_CANVAS_WIDTH } from "@/core/motion-doc/domain/viewport";
import type { BlockFrameOverrides } from "@/features/pitch/application/pitchGeometry";
import {
  booleanProp,
  enterProp,
  fitProp,
  isPositionedBlock,
  numberProp,
  opacityProp,
  optionalTextAlignProp,
  sizeNumberProp,
  spacingProp,
  stringProp
} from "@/features/pitch/application/previewProps";
import { blockFrame } from "@/features/pitch/application/previewCanvas";
import { ImageBlock, ShapeBlock, Text, VideoBlock } from "@/features/pitch/ui/preview/motion-blocks";
import { TableBlock } from "@/features/pitch/ui/preview/motion/TableBlock";
import { ChartBlock } from "@/features/pitch/ui/preview/motion/ChartBlock";
import { HtmlEmbedBlock, SvgStageBlock } from "@/features/pitch/ui/preview/motion/EmbeddedBlocks";

export type PreviewBlockItem = {
  block: MotionDocBlock;
  blockKey: string;
  originalIndex: number;
};

type PreviewBlockListProps = {
  frameOverrides?: BlockFrameOverrides;
  hiddenBlockIndices: Set<number>;
  imageFetchPriority?: "auto" | "high" | "low";
  imageLoading?: "eager" | "lazy";
  items: PreviewBlockItem[];
};

export function PreviewBlockList({
  frameOverrides,
  hiddenBlockIndices,
  imageFetchPriority,
  imageLoading,
  items
}: PreviewBlockListProps) {
  const visibleItems = items.filter(({ originalIndex }) => !hiddenBlockIndices.has(originalIndex));
  const flowBlocks = visibleItems.filter(({ block }) => !isPositionedBlock(block));
  const positionedBlocks = visibleItems.filter(({ block }) => isPositionedBlock(block));

  return (
    <>
      {flowBlocks.map(({ block, blockKey }) => (
        <div data-motion-doc-node-id={blockKey} key={blockKey} style={objectShadowCss(block.props) as CSSProperties}>
          <PreviewBlock block={block} imageFetchPriority={imageFetchPriority} imageLoading={imageLoading} />
        </div>
      ))}
      {positionedBlocks.map(({ block, blockKey, originalIndex }) => (
        <PositionedPreviewBlock
          block={block}
          blockKey={blockKey}
          frameOverride={frameOverrides?.get(blockKey)}
          imageFetchPriority={imageFetchPriority}
          imageLoading={imageLoading}
          key={blockKey}
          originalIndex={originalIndex}
        />
      ))}
    </>
  );
}

const PositionedPreviewBlock = memo(function PositionedPreviewBlock({
  block,
  blockKey,
  frameOverride,
  imageFetchPriority,
  imageLoading,
  originalIndex
}: PreviewBlockItem & {
  frameOverride?: MotionDocFrame;
  imageFetchPriority?: "auto" | "high" | "low";
  imageLoading?: "eager" | "lazy";
}) {
  const frame = frameOverride ?? blockFrame(block);

  return (
    <div
      className="motion-positioned-block"
      data-motion-doc-node-id={blockKey}
      style={positionedBlockStyle(block, originalIndex, frame)}
    >
      <PreviewBlock
        block={block}
        fillFrame
        frame={frame}
        frameAspectRatio={frame.h > 0 ? frame.w / frame.h * (16 / 9) : 16 / 9}
        imageFetchPriority={imageFetchPriority}
        imageLoading={imageLoading}
      />
    </div>
  );
}, positionedPreviewBlockPropsEqual);

function positionedPreviewBlockPropsEqual(
  previous: PreviewBlockItem & { frameOverride?: MotionDocFrame; imageFetchPriority?: "auto" | "high" | "low"; imageLoading?: "eager" | "lazy" },
  next: PreviewBlockItem & { frameOverride?: MotionDocFrame; imageFetchPriority?: "auto" | "high" | "low"; imageLoading?: "eager" | "lazy" }
) {
  return (
    previous.blockKey === next.blockKey
    && previous.originalIndex === next.originalIndex
    && previous.imageFetchPriority === next.imageFetchPriority
    && previous.imageLoading === next.imageLoading
    && framesEqual(previous.frameOverride, next.frameOverride)
    && motionDocBlocksEqual(previous.block, next.block)
  );
}

type PreviewBlockProps = {
  block: MotionDocBlock;
  fillFrame?: boolean;
  frame?: MotionDocFrame;
  frameAspectRatio?: number;
  imageFetchPriority?: "auto" | "high" | "low";
  imageLoading?: "eager" | "lazy";
};

export const PreviewBlock = memo(function PreviewBlock({
  block,
  fillFrame = false,
  frame,
  frameAspectRatio,
  imageFetchPriority = "auto",
  imageLoading = "eager"
}: PreviewBlockProps) {
  if (block.type === "heading") {
    return (
      <Text
        background={stringProp(block.props.background ?? block.props.backgroundColor ?? block.props.bg)}
        delay={numberProp(block.props.delay)}
        duration={numberProp(block.props.duration)}
        enter={enterProp(block.props.enter)}
        fillFrame={fillFrame}
        fontFamily={stringProp(block.props.fontFamily)}
        fontSize={sizeNumberProp(block.props.fontSize, undefined)}
        fontStyle={stringProp(block.props.fontStyle)}
        fontWeight={spacingProp(block.props.fontWeight)}
        letterSpacing={spacingProp(block.props.letterSpacing)}
        lineHeight={spacingProp(block.props.lineHeight)}
        lineHeightPt={spacingProp(block.props.lineHeightPt)}
        textAlign={optionalTextAlignProp(block.props.textAlign)}
        textColor={stringProp(block.props.color ?? block.props.textColor)}
        textStyleRanges={stringProp(block.props.textStyleRanges)}
        textVerticalAlign={stringProp(block.props.textVerticalAlign)}
      >
        {block.text}
      </Text>
    );
  }

  if (block.type === "Text") {
    return (
      <Text
        background={stringProp(block.props.background ?? block.props.backgroundColor ?? block.props.bg)}
        delay={numberProp(block.props.delay)}
        duration={numberProp(block.props.duration)}
        enter={enterProp(block.props.enter)}
        fillFrame={fillFrame}
        fontFamily={stringProp(block.props.fontFamily)}
        fontSize={sizeNumberProp(block.props.fontSize, undefined)}
        fontStyle={stringProp(block.props.fontStyle)}
        fontWeight={spacingProp(block.props.fontWeight)}
        letterSpacing={spacingProp(block.props.letterSpacing)}
        lineHeight={spacingProp(block.props.lineHeight)}
        lineHeightPt={spacingProp(block.props.lineHeightPt)}
        listStart={numberProp(block.props.listStart)}
        listType={stringProp(block.props.listType)}
        textAlign={optionalTextAlignProp(block.props.textAlign)}
        textColor={stringProp(block.props.color ?? block.props.textColor)}
        textStyleRanges={stringProp(block.props.textStyleRanges)}
        textVerticalAlign={stringProp(block.props.textVerticalAlign)}
      >
        {block.text}
      </Text>
    );
  }

  if (block.type === "ImageBlock") {
    return (
      <ImageBlock
        alt={String(block.props.alt ?? "")}
        background={stringProp(block.props.background ?? block.props.backgroundColor ?? block.props.bg)}
        delay={numberProp(block.props.delay)}
        duration={numberProp(block.props.duration)}
        enter={enterProp(block.props.enter)}
        fillFrame={fillFrame}
        filter={stringProp(block.props.filter)}
        filterAngle={numberProp(block.props.filterAngle)}
        filterContrast={numberProp(block.props.filterContrast)}
        filterDetail={numberProp(block.props.filterDetail)}
        filterDistortion={numberProp(block.props.filterDistortion)}
        filterPreset={stringProp(block.props.filterPreset)}
        filterSize={numberProp(block.props.filterSize)}
        filterSpeed={numberProp(block.props.filterSpeed)}
        fetchPriority={imageFetchPriority}
        fit={fitProp(block.props.fit)}
        frameAspectRatio={frameAspectRatio}
        full={booleanProp(block.props.full)}
        loading={imageLoading}
        radius={spacingProp(block.props.radius ?? block.props.borderRadius)}
        cropX={numberProp(block.props.cropX)}
        cropY={numberProp(block.props.cropY)}
        scaleX={numberProp(block.props.scaleX)}
        scaleY={numberProp(block.props.scaleY)}
        src={String(block.props.src ?? "")}
      />
    );
  }

  if (block.type === "VideoBlock") {
    return (
      <VideoBlock
        background={stringProp(block.props.background ?? block.props.backgroundColor ?? block.props.bg)}
        controls={booleanProp(block.props.controls ?? "true")}
        delay={numberProp(block.props.delay)}
        duration={numberProp(block.props.duration)}
        enter={enterProp(block.props.enter)}
        fillFrame={fillFrame}
        fit={fitProp(block.props.fit)}
        full={booleanProp(block.props.full)}
        loop={booleanProp(block.props.loop ?? "true")}
        muted={booleanProp(block.props.muted ?? "true")}
        poster={stringProp(block.props.poster)}
        radius={spacingProp(block.props.radius ?? block.props.borderRadius)}
        src={String(block.props.src ?? "")}
      />
    );
  }

  if (block.type === "HtmlEmbedBlock") {
    return <HtmlEmbedBlock page={numberProp(block.props.page)} src={String(block.props.src ?? "")} />;
  }

  if (block.type === "SvgBlock") {
    return (
      <SvgStageBlock
        easing={stringProp(block.props.easing)}
        src={String(block.props.src ?? "")}
        stage={numberProp(block.props.stage)}
        stageDuration={numberProp(block.props.stageDuration)}
      />
    );
  }

  if (block.type === "Shape") {
    const frame = blockFrame(block);

    return (
      <ShapeBlock
        corner={spacingProp(block.props.corner)}
        delay={numberProp(block.props.delay)}
        duration={numberProp(block.props.duration)}
        enter={enterProp(block.props.enter)}
        fill={stringProp(block.props.fill)}
        fillFrame={fillFrame}
        frameHeight={frame.h / 100 * MOTION_DOC_CANVAS_HEIGHT}
        frameWidth={frame.w / 100 * MOTION_DOC_CANVAS_WIDTH}
        arrowEnd={stringProp(block.props.arrowEnd)}
        arrowEndSize={spacingProp(block.props.arrowEndSize)}
        arrowStart={stringProp(block.props.arrowStart)}
        arrowStartSize={spacingProp(block.props.arrowStartSize)}
        lineStyle={stringProp(block.props.lineStyle)}
        mask={stringProp(block.props.mask)}
        operation={stringProp(block.props.operation)}
        opacity={opacityProp(block.props.opacity)}
        points={spacingProp(block.props.points)}
        radius={spacingProp(block.props.radius ?? block.props.borderRadius)}
        shape={stringProp(block.props.shape)}
        shapeImageAlt={stringProp(block.props.shapeImageAlt)}
        shapeImageCropX={numberProp(block.props.shapeImageCropX)}
        shapeImageCropY={numberProp(block.props.shapeImageCropY)}
        shapeImageFit={stringProp(block.props.shapeImageFit)}
        shapeImageScaleX={numberProp(block.props.shapeImageScaleX)}
        shapeImageScaleY={numberProp(block.props.shapeImageScaleY)}
        shapeImageSrc={stringProp(block.props.shapeImageSrc)}
        sides={spacingProp(block.props.sides)}
        stroke={stringProp(block.props.stroke)}
        strokeWidth={spacingProp(block.props.strokeWidth)}
      />
    );
  }

  if (block.type === "Table") {
    return <TableBlock fillFrame={fillFrame} props={block.props} />;
  }

  if (block.type === "Chart") {
    return <ChartBlock frame={frame} props={block.props} />;
  }

  return null;
}, previewBlockPropsEqual);

function previewBlockPropsEqual(previous: PreviewBlockProps, next: PreviewBlockProps) {
  return (
    previous.fillFrame === next.fillFrame &&
    framesEqual(previous.frame, next.frame) &&
    previous.frameAspectRatio === next.frameAspectRatio &&
    previous.imageFetchPriority === next.imageFetchPriority &&
    previous.imageLoading === next.imageLoading &&
    motionDocBlocksEqual(previous.block, next.block)
  );
}

function framesEqual(previous: MotionDocFrame | undefined, next: MotionDocFrame | undefined) {
  if (previous === next) return true;
  if (!previous || !next) return false;
  return previous.x === next.x && previous.y === next.y && previous.w === next.w && previous.h === next.h;
}

function motionDocBlocksEqual(previous: MotionDocBlock, next: MotionDocBlock) {
  if (previous === next) return true;
  if (previous.type !== next.type) return false;
  if ("text" in previous && "text" in next && previous.text !== next.text) return false;
  if (!("props" in previous) || !("props" in next)) return true;

  const previousEntries = Object.entries(previous.props);
  const nextEntries = Object.entries(next.props);
  return (
    previousEntries.length === nextEntries.length &&
    previousEntries.every(([key, value]) => next.props[key] === value)
  );
}

function positionedBlockStyle(block: MotionDocBlock, index: number, frameOverride?: MotionDocFrame): CSSProperties {
  const frame = frameOverride ?? blockFrame(block);
  const h = "props" in block ? block.props.h : undefined;

  return {
    left: `${frame.x}%`,
    position: "absolute",
    rotate: `${blockRotation(block.props)}deg`,
    top: `${frame.y}%`,
    transformOrigin: "center",
    width: `${frame.w}%`,
    ...(h === undefined ? {} : { height: `${frame.h}%` }),
    ...objectShadowCss(block.props),
    zIndex: 20 + index
  };
}
