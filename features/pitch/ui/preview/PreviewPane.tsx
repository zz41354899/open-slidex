
import { memo, useMemo } from "react";
import type { CSSProperties } from "react";
import type { MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { isHtmlSourceTextBlock } from "@/core/motion-doc/domain/htmlPresentation";
import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import { motionDocBlockKey } from "@/core/motion-doc/application/motionDocBlockIdentity";
import type { BlockFrameOverrides } from "@/features/pitch/application/pitchGeometry";
import {
  alignXProp,
  alignYProp,
  isPositionedBlock,
  layoutProp,
  numberProp,
  stringProp,
  textAlignProp
} from "@/features/pitch/application/previewProps";
import { PreviewBlock, PreviewBlockList } from "@/features/pitch/ui/preview/PreviewBlock";
import { Scene, Text } from "@/features/pitch/ui/preview/motion-blocks";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";

type PreviewPaneProps = {
  activeSlideIndex?: number;
  allowOverflow?: boolean;
  autoHeight?: boolean;
  frameOverrides?: BlockFrameOverrides;
  hiddenBlockIndices?: number[];
  imageFetchPriority?: "auto" | "high" | "low";
  imageLoading?: "eager" | "lazy";
  hideHtmlEmbedBlocks?: boolean;
  hideHtmlSourceTextBlocks?: boolean;
  hideSharedSvgBlocks?: boolean;
  hideSharedHtmlBlocks?: boolean;
  onShaderFrameCapture?: (frame: number) => void;
  replayNonce: number;
  scene?: MotionDocScene;
  shaderMaxPixelCount?: number;
  shaderMinPixelRatio?: number;
  shaderPlaybackActive?: boolean;
  source?: string;
  transparentCanvas?: boolean;
};

export const PreviewPane = memo(function PreviewPane({
  activeSlideIndex = 0,
  allowOverflow = false,
  autoHeight = false,
  frameOverrides,
  hiddenBlockIndices = [],
  imageFetchPriority = "high",
  imageLoading = "eager",
  hideHtmlEmbedBlocks = false,
  hideHtmlSourceTextBlocks = false,
  hideSharedSvgBlocks = false,
  hideSharedHtmlBlocks = false,
  onShaderFrameCapture,
  replayNonce,
  scene,
  shaderMaxPixelCount,
  shaderMinPixelRatio,
  shaderPlaybackActive = true,
  source,
  transparentCanvas = false
}: PreviewPaneProps) {
  const { tx } = usePitchI18n();
  const document = useMemo(() => scene ? null : parseMotionDoc(source ?? ""), [scene, source]);
  const hiddenBlockIndexSet = useMemo(() => new Set(hiddenBlockIndices), [hiddenBlockIndices]);
  const activeSlide = scene ?? document?.scenes[activeSlideIndex] ?? document?.scenes[0];
  const hasSlides = Boolean(scene) || Boolean(document?.scenes.length);

  if (!hasSlides) {
    return <PreviewCompileError />;
  }

  if (!activeSlide) {
    return null;
  }

  const layout = layoutProp(activeSlide.props.layout);
  const blockItems = activeSlide.blocks.map((block, originalIndex) => ({
    block,
    blockKey: motionDocBlockKey(block, originalIndex),
    originalIndex
  })).filter(({ block }) => {
    if (hideHtmlEmbedBlocks && block.type === "HtmlEmbedBlock") return false;
    if (hideHtmlSourceTextBlocks && isHtmlSourceTextBlock(block)) return false;
    const shared = typeof block.props.sharedScene === "string" && block.props.sharedScene.trim();
    if (hideSharedSvgBlocks && block.type === "SvgBlock" && shared) return false;
    if (hideSharedHtmlBlocks && block.type === "HtmlEmbedBlock" && shared) return false;
    return true;
  });
  const imageItems = blockItems.filter(({ block }) => block.type === "ImageBlock");
  const contentItems = blockItems.filter(({ block }) => block.type !== "ImageBlock");
  const hasPositionedBlocks = activeSlide.blocks.some(isPositionedBlock);
  const shouldSplit = !hasPositionedBlocks && layout !== "default" && imageItems.length > 0;
  const textOrder = layout === "split-left" ? 1 : 2;
  const imageOrder = layout === "split-left" ? 2 : 1;

  return (
    <div key={replayNonce} style={autoHeight ? { minHeight: "100%", position: "relative" } : { inset: 0, position: "absolute" }}>
      <Scene
        accent={stringProp(activeSlide.props.accent)}
        allowOverflow={allowOverflow}
        alignX={alignXProp(activeSlide.props.alignX)}
        alignY={alignYProp(activeSlide.props.alignY)}
        autoHeight={autoHeight}
        background={stringProp(activeSlide.props.background)}
        backgroundFit={stringProp(activeSlide.props.backgroundFit)}
        backgroundImage={stringProp(activeSlide.props.backgroundImage)}
        duration={activeSlide.duration}
        freeform={hasPositionedBlocks}
        key={activeSlideIndex}
        layout={shouldSplit ? layout : "default"}
        mutedColor={stringProp(activeSlide.props.mutedColor)}
        onShaderFrameCapture={onShaderFrameCapture}
        shader={stringProp(activeSlide.props.shader)}
        shaderAngle={numberProp(activeSlide.props.shaderAngle)}
        shaderColor1={stringProp(activeSlide.props.shaderColor1)}
        shaderColor2={stringProp(activeSlide.props.shaderColor2)}
        shaderColor3={stringProp(activeSlide.props.shaderColor3)}
        shaderColor4={stringProp(activeSlide.props.shaderColor4)}
        shaderColor5={stringProp(activeSlide.props.shaderColor5)}
        shaderColor6={stringProp(activeSlide.props.shaderColor6)}
        shaderDetail={numberProp(activeSlide.props.shaderDetail)}
        shaderEngine={stringProp(activeSlide.props.shaderEngine)}
        shaderFrame={numberProp(activeSlide.props.shaderFrame)}
        shaderIntensity={numberProp(activeSlide.props.shaderIntensity)}
        shaderMaxPixelCount={shaderMaxPixelCount}
        shaderMinPixelRatio={shaderMinPixelRatio}
        shaderPlaybackActive={shaderPlaybackActive}
        shaderPreset={stringProp(activeSlide.props.shaderPreset)}
        shaderScale={numberProp(activeSlide.props.shaderScale)}
        shaderSoftness={numberProp(activeSlide.props.shaderSoftness)}
        shaderSpeed={numberProp(activeSlide.props.shaderSpeed)}
        slideTransition={stringProp(activeSlide.props.slideTransition)}
        textAlign={textAlignProp(activeSlide.props.textAlign)}
        textColor={stringProp(activeSlide.props.textColor ?? activeSlide.props.foreground ?? activeSlide.props.color)}
        theme={stringProp(activeSlide.props.theme)}
        transitionDuration={numberProp(activeSlide.props.transitionDuration)}
        transparentBackground={transparentCanvas}
      >
        {shouldSplit ? (
          <>
            <div style={{ ...splitContentStyle, order: textOrder }}>
              {contentItems.length > 0 ? (
                <PreviewBlockList
                  frameOverrides={frameOverrides}
                  hiddenBlockIndices={hiddenBlockIndexSet}
                  imageFetchPriority={imageFetchPriority}
                  imageLoading={imageLoading}
                  items={contentItems}
                />
              ) : (
                <Text>{tx("Add a text layer for this side.")}</Text>
              )}
            </div>
            <div style={{ ...splitImageStyle, order: imageOrder }}>
              {imageItems
                .filter(({ originalIndex }) => !hiddenBlockIndexSet.has(originalIndex))
                .map(({ block, blockKey }) => (
                  <div
                    data-motion-doc-node-id={blockKey}
                    key={blockKey}
                    style={{ width: "100%" }}
                  >
                    <PreviewBlock
                      block={block}
                      imageFetchPriority={imageFetchPriority}
                      imageLoading={imageLoading}
                    />
                  </div>
                ))}
            </div>
          </>
        ) : activeSlide.blocks.length > 0 ? (
          <PreviewBlockList
            frameOverrides={frameOverrides}
            hiddenBlockIndices={hiddenBlockIndexSet}
            imageFetchPriority={imageFetchPriority}
            imageLoading={imageLoading}
            items={blockItems}
          />
        ) : null}
      </Scene>
    </div>
  );
});

function PreviewCompileError() {
  const { tx } = usePitchI18n();
  return (
    <div style={{ alignItems: "center", display: "flex", inset: 0, justifyContent: "center", padding: 32, position: "absolute" }}>
      <div style={{ background: "rgba(127,29,29,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 12, color: "#f87171", fontFamily: "monospace", fontSize: 13, maxWidth: 420, padding: 16 }}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>{tx("Compile Error")}</p>
        <p style={{ whiteSpace: "pre-wrap" }}>{tx("No <Slide> blocks found. Add a slide or load one of the presets.")}</p>
      </div>
    </div>
  );
}

const splitContentStyle: CSSProperties = {
  display: "flex",
  flex: "1 1 0",
  flexDirection: "column",
  justifyContent: "center",
  minHeight: 0,
  minWidth: 0
};

const splitImageStyle: CSSProperties = {
  alignItems: "center",
  display: "flex",
  flex: "1 1 0",
  justifyContent: "center",
  minHeight: 0,
  minWidth: 0
};
