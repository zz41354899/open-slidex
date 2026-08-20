
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Code2,
  Grid3X3,
  Italic,
  List,
  ListOrdered,
  ListX,
  Maximize2,
  SendToBack,
  BringToFront
} from "lucide-react";
import { MotionFields } from "@/features/pitch/ui/inspector/MotionFields";
import { SlideSettings } from "@/features/pitch/ui/inspector/SlideSettings";
import { SlideLayoutSelector } from "@/features/pitch/ui/inspector/SlideLayoutSelector";
import { canArrangeSelectedBlocks, type SelectionAlignment, type SelectionDistribution } from "@/features/pitch/application/multiSelectionLayout";
import { selectedBlockColorItems } from "@/features/pitch/application/multiSelectionColors";
import {
  autoSizeTextFrameProps,
  textFramePropsWithLineHeight
} from "@/features/pitch/application/textFrameSizing";
import { MultiSelectionInspector } from "@/features/pitch/ui/inspector/MultiSelectionInspector";
import { Field, IconSegmentedControl, InspectorSection, NativeSelect, NumberInput } from "@/features/pitch/ui/inspector/InspectorControls";
import { getBlockFieldRegistryEntry } from "@/features/pitch/ui/inspector/blockFieldRegistry";
import { FontPicker } from "@/features/pitch/ui/preview/controls/FontPicker";
import { useDynamicFont } from "@/features/pitch/ui/hooks/useDynamicFont";
import type { MotionDocProps, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { applyBlockTextStyle } from "@/core/motion-doc/domain/textStyleRanges";
import {
  applyTextListStyle,
  type MotionDocTextListType
} from "@/core/motion-doc/application/textListStyle";
import {
  MOTION_DOC_FONT_SIZES,
  motionDocDefaultFontSize
} from "@/core/motion-doc/domain/typography";
import type { BlockUpdater } from "@/features/pitch/application/pitchCommandTypes";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { EditorInspectorHeader } from "@/common/ui/editor/EditorPrimitives";
import {
  Button,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/common/ui/shadcnPrimitives";

export function PitchInspector({
  activeSlide,
  activeSlideAccent,
  activeSlideBackground,
  activeSlideMutedColor,
  activeSlideShader,
  activeSlideShaderAngle,
  activeSlideShaderColor1,
  activeSlideShaderColor2,
  activeSlideShaderColor3,
  activeSlideShaderColor4,
  activeSlideShaderColor5,
  activeSlideShaderColor6,
  activeSlideShaderIntensity,
  activeSlideShaderEngine,
  activeSlideShaderPreset,
  activeSlideShaderSpeed,
  activeSlideShaderSoftness,
  activeSlideShaderScale,
  activeSlideShaderDetail,
  activeSlideTextColor,
  activeSlideTheme,
  addSlideWithLayout,
  alignSelectedBlocks,
  distributeSelectedBlocks,
  imageSourceRequiresAbsoluteUrl,
  inspectorExtension,
  localAssetsOnly = false,
  importImageUrlForBlock,
  isGridVisible,
  isSafeAreaVisible,
  isSnapEnabled,
  moveSelectedBlocksToEdge,
  onOpenMdxEditor,
  onPreloadMdxEditor,
  pushUndoSnapshot,
  removeImageForBlock,
  requestImageRemoval,
  requestImageUpload,
  selectedBlockIndex,
  selectedBlockIndices = [],
  setIsGridVisible,
  setIsSafeAreaVisible,
  setIsSnapEnabled,
  snapSelectedBlocksToGrid,
  updateAllSlidesStyle,
  updateActiveSlideStyle,
  updateBlock,
  updateSelectedBlockColor,
  uploadImageForBlock,
  uploadVideoForBlock
}: {
  activeSlide: MotionDocScene | undefined;
  activeSlideAccent: string;
  activeSlideBackground: string;
  activeSlideMutedColor: string;
  activeSlideShader: string;
  activeSlideShaderAngle: number;
  activeSlideShaderColor1: string;
  activeSlideShaderColor2: string;
  activeSlideShaderColor3: string;
  activeSlideShaderColor4: string;
  activeSlideShaderColor5: string;
  activeSlideShaderColor6: string;
  activeSlideShaderEngine: string;
  activeSlideShaderIntensity: number;
  activeSlideShaderPreset: string;
  activeSlideShaderSpeed: number;
  activeSlideShaderSoftness: number;
  activeSlideShaderScale: number;
  activeSlideShaderDetail: number;
  activeSlideTextColor: string;
  activeSlideTheme: string;
  addSlideWithLayout: (layoutSource: string, layoutId: string) => void;
  alignSelectedBlocks: (alignment: SelectionAlignment) => void;
  distributeSelectedBlocks: (distribution: SelectionDistribution) => void;
  imageSourceRequiresAbsoluteUrl: boolean;
  inspectorExtension?: React.ReactNode;
  localAssetsOnly?: boolean;
  importImageUrlForBlock: (blockIndex: number, source: string) => boolean;
  isGridVisible: boolean;
  isSafeAreaVisible: boolean;
  isSnapEnabled: boolean;
  moveSelectedBlocksToEdge: (edge: "back" | "front") => void;
  onOpenMdxEditor: () => void;
  onPreloadMdxEditor?: () => void;
  pushUndoSnapshot: () => void;
  removeImageForBlock: (blockIndex: number) => void;
  requestImageRemoval: () => boolean;
  requestImageUpload: () => boolean;
  selectedBlockIndex: number | null;
  selectedBlockIndices?: number[];
  setIsGridVisible: (value: boolean) => void;
  setIsSafeAreaVisible: (value: boolean) => void;
  setIsSnapEnabled: (value: boolean) => void;
  snapSelectedBlocksToGrid: () => void;
  updateAllSlidesStyle: (updates: MotionDocProps) => void;
  updateActiveSlideStyle: (updates: MotionDocProps) => void;
  updateBlock: BlockUpdater;
  updateSelectedBlockColor: (blockIndex: number, color: string) => void;
  uploadImageForBlock: (blockIndex: number, file: File | undefined) => void;
  uploadVideoForBlock: (blockIndex: number, file: File | undefined) => void;
}) {
  const isMultiSelection = selectedBlockIndices.length >= 2;
  const showsSelectedElement = selectedBlockIndex !== null && !isMultiSelection;
  const canArrangeSelection = canArrangeSelectedBlocks(activeSlide, selectedBlockIndices);
  const selectionColorItems = selectedBlockColorItems(activeSlide, selectedBlockIndices);
  const { tx } = usePitchI18n();

  return (
    <div id="inspector-v4" className="flex w-full sm:w-[300px] md:w-[320px] shrink-0 flex-col overflow-hidden border-l border-white/[0.08] bg-[#171717] select-none h-full relative z-10 transition-all duration-300 font-sans antialiased">

      <EditorInspectorHeader
        actions={(
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={tx("MDX Editor")}
                className="h-7 px-2 text-neutral-500 hover:bg-white/[0.05] hover:text-white"
                onClick={onOpenMdxEditor}
                onFocus={onPreloadMdxEditor}
                onPointerEnter={onPreloadMdxEditor}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Code2 size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">{tx("MDX Editor")}</TooltipContent>
          </Tooltip>
        )}
        title={tx(isMultiSelection
            ? "Multiple Items"
            : selectedBlockIndex === null
              ? "Slide"
              : activeSlide?.blocks[selectedBlockIndex]?.type || "Element")}
      />

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="flex flex-col">
          {isMultiSelection ? (
            <MultiSelectionInspector
              canArrange={canArrangeSelection}
              colorItems={selectionColorItems}
              onAlign={alignSelectedBlocks}
              onColorChange={updateSelectedBlockColor}
              onDistribute={distributeSelectedBlocks}
            />
          ) : !showsSelectedElement ? (
            <div className="flex flex-col">
              <SlideLayoutSelector
                localAssetsOnly={localAssetsOnly}
                onAddLayout={addSlideWithLayout}
              />
              <SlideSettings
                accent={activeSlideAccent}
                background={activeSlideBackground}
                duration={activeSlide?.duration ?? 5}
                isGridVisible={isGridVisible}
                isSafeAreaVisible={isSafeAreaVisible}
                isSnapEnabled={isSnapEnabled}
                mutedColor={activeSlideMutedColor}
                setIsGridVisible={setIsGridVisible}
                setIsSafeAreaVisible={setIsSafeAreaVisible}
                setIsSnapEnabled={setIsSnapEnabled}
                shader={activeSlideShader}
                shaderAngle={activeSlideShaderAngle}
                shaderColor1={activeSlideShaderColor1}
                shaderColor2={activeSlideShaderColor2}
                shaderColor3={activeSlideShaderColor3}
                shaderColor4={activeSlideShaderColor4}
                shaderColor5={activeSlideShaderColor5}
                shaderColor6={activeSlideShaderColor6}
                shaderEngine={activeSlideShaderEngine}
                shaderIntensity={activeSlideShaderIntensity}
                shaderPreset={activeSlideShaderPreset}
                shaderSpeed={activeSlideShaderSpeed}
                shaderSoftness={activeSlideShaderSoftness}
                shaderScale={activeSlideShaderScale}
                shaderDetail={activeSlideShaderDetail}
                slideTransition={activeSlide?.props.slideTransition}
                textColor={activeSlideTextColor}
                theme={activeSlideTheme}
                transitionDuration={activeSlide?.props.transitionDuration}
                updateAllSlidesStyle={updateAllSlidesStyle}
                updateActiveSlideStyle={updateActiveSlideStyle}
              />
            </div>
          ) : (
            <>
              <ElementSettings
                activeSlide={activeSlide}
                imageSourceRequiresAbsoluteUrl={imageSourceRequiresAbsoluteUrl}
                importImageUrlForBlock={importImageUrlForBlock}
                pushUndoSnapshot={pushUndoSnapshot}
                removeImageForBlock={removeImageForBlock}
                requestImageRemoval={requestImageRemoval}
                requestImageUpload={requestImageUpload}
                selectedBlockIndex={selectedBlockIndex}
                updateBlock={updateBlock}
                uploadImageForBlock={uploadImageForBlock}
                uploadVideoForBlock={uploadVideoForBlock}
              />
              <InspectorSection title="Layer & grid" defaultOpen={false}>
                <div className="flex flex-col gap-1.5">
                  <InspectorActionButton icon={<BringToFront size={14} />} label={tx("Bring to front")} onClick={() => moveSelectedBlocksToEdge("front")} />
                  <InspectorActionButton icon={<SendToBack size={14} />} label={tx("Send to back")} onClick={() => moveSelectedBlocksToEdge("back")} />
                  <InspectorActionButton icon={<Grid3X3 size={14} />} label={tx("Align to 8 px grid")} onClick={snapSelectedBlocksToGrid} />
                </div>
              </InspectorSection>
            </>
          )}
          {inspectorExtension}
        </div>
      </div>
    </div>
  );
}

function InspectorActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Button
      className="flex h-9 items-center gap-2.5 rounded-xl border border-white/[0.07] bg-[#2f2f2f] px-3 text-left text-[11px] font-medium text-neutral-300 transition hover:border-white/[0.13] hover:bg-[#383838] hover:text-white"
      onClick={onClick}
      type="button"
      variant="ghost"
    >
      <span className="text-neutral-500">{icon}</span>
      <span>{label}</span>
    </Button>
  );
}

function ElementSettings({
  activeSlide,
  imageSourceRequiresAbsoluteUrl,
  importImageUrlForBlock,
  pushUndoSnapshot,
  removeImageForBlock,
  requestImageRemoval,
  requestImageUpload,
  selectedBlockIndex,
  updateBlock,
  uploadImageForBlock,
  uploadVideoForBlock
}: {
  activeSlide: MotionDocScene | undefined;
  imageSourceRequiresAbsoluteUrl: boolean;
  importImageUrlForBlock: (blockIndex: number, source: string) => boolean;
  pushUndoSnapshot: () => void;
  removeImageForBlock: (blockIndex: number) => void;
  requestImageRemoval: () => boolean;
  requestImageUpload: () => boolean;
  selectedBlockIndex: number;
  updateBlock: BlockUpdater;
  uploadImageForBlock: (blockIndex: number, file: File | undefined) => void;
  uploadVideoForBlock: (blockIndex: number, file: File | undefined) => void;
}) {
  const { tx } = usePitchI18n();
  const block = activeSlide?.blocks[selectedBlockIndex];

  if (!block) {
    return <div className="p-4 text-center text-[11px] italic text-neutral-500">{tx("Element no longer exists.")}</div>;
  }

  const isTextType = block.type === "Text" || block.type === "heading";
  const isTitleText = block.type === "Text" && block.props.role === "title";
  const textValue = isTextType ? ("text" in block ? block.text : "") : "";
  const slideTheme = stringValue(activeSlide?.props.theme) ?? "dark";
  const inheritedTextColor =
    stringValue(activeSlide?.props.textColor ?? activeSlide?.props.foreground ?? activeSlide?.props.color) ??
    (slideTheme === "light" || slideTheme === "paper" ? "#111827" : "#ffffff");
	  const inheritedBackgroundColor = "transparent";
	  const blockFieldEntry = getBlockFieldRegistryEntry(block.type);

	  return (
    <div className="flex flex-col gap-0 animate-[bubble-appear_0.2s_ease-out]">
      <div className="flex flex-col gap-0">
        {"props" in block && (
          <MotionFields
            block={block}
            inheritedBackgroundColor={inheritedBackgroundColor}
            inheritedTextColor={inheritedTextColor}
            isTextType={isTextType}
            selectedBlockIndex={selectedBlockIndex}
            textValue={textValue}
            updateBlock={updateBlock}
          />
        )}

        {isTextType && (
          <InspectorSection title="Text" defaultOpen={true}>
            {"props" in block ? (
              <TextTypeFields
                block={block}
                selectedBlockIndex={selectedBlockIndex}
                updateBlock={updateBlock}
              />
            ) : null}
            <textarea
              className="w-full resize-none rounded-lg bg-white/[0.03] px-3 py-2 text-[13px] leading-relaxed text-neutral-200 outline-none transition-colors placeholder:text-neutral-600 hover:bg-white/[0.05] focus:bg-white/[0.06] focus:ring-1 focus:ring-white/[0.12]"
              onChange={(event) => {
                event.target.style.height = "auto";
                event.target.style.height = `${event.target.scrollHeight}px`;
                updateBlock(selectedBlockIndex, "props" in block ? block.props : {}, event.target.value, { transient: true });
              }}
              onBlur={(event) => {
                if (!("props" in block)) {
                  return;
                }

                updateBlock(
                  selectedBlockIndex,
                  autoSizeTextFrameProps({ props: block.props, type: block.type }, event.currentTarget.value, {
                    mode: "height",
                    props: block.props
                  }),
                  event.currentTarget.value,
                  { transient: true }
                );
              }}
              onFocus={(event) => {
                pushUndoSnapshot();
                event.target.style.height = "auto";
                event.target.style.height = `${event.target.scrollHeight}px`;
              }}
              placeholder={tx("Enter text content...")}
              style={{ minHeight: isTitleText ? "64px" : "100px", overflow: "hidden" }}
              value={textValue}
            />
          </InspectorSection>
        )}

	        {blockFieldEntry && "props" in block ? (
	          <InspectorSection title={blockFieldEntry.title} defaultOpen={true}>
	            <div className="flex flex-col gap-4">
	              {blockFieldEntry.render({
	                block,
	                imageSourceRequiresAbsoluteUrl,
	                importImageUrlForBlock,
	                removeImageForBlock,
	                requestImageRemoval,
	                requestImageUpload,
                selectedBlockIndex,
                updateBlock,
                uploadImageForBlock,
                uploadVideoForBlock
	              })}
	            </div>
	          </InspectorSection>
	        ) : null}
      </div>
    </div>
  );
}

function stringValue(value: string | number | undefined) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return undefined;
}

const textStyleOptions = [
  { description: "Large statement", label: "Display", lineHeight: 1, size: MOTION_DOC_FONT_SIZES.display, weight: 700, role: "title" },
  { description: "Section heading", label: "Heading", lineHeight: 1.08, size: MOTION_DOC_FONT_SIZES.heading, weight: 650, role: "title" },
  { description: "Introductory copy", label: "Lead", lineHeight: 1.28, size: MOTION_DOC_FONT_SIZES.lead, weight: 560, role: "content" },
  { description: "Comfortable reading", label: "Body", lineHeight: 1.45, size: MOTION_DOC_FONT_SIZES.body, weight: 400, role: "content" },
  { description: "Details and notes", label: "Caption", lineHeight: 1.35, size: MOTION_DOC_FONT_SIZES.caption, weight: 500, role: "content" }
];

function TextTypeFields({
  block,
  selectedBlockIndex,
  updateBlock
}: {
  block: { type: string; props?: MotionDocProps; text?: string };
  selectedBlockIndex: number;
  updateBlock: BlockUpdater;
}) {
  const { tx } = usePitchI18n();
  const props = "props" in block && block.props ? block.props : {};
  const text = "text" in block ? (block as { text: string }).text : "";
  const currentRole = String(props.role || "content");
  const isTitleText = currentRole === "title";
  const currentFontSize = Number(props.fontSize) || motionDocDefaultFontSize(block.type);
  const exactLineHeight = Number(props.lineHeightPt);
  const usesExactLineHeight = Number.isFinite(exactLineHeight) && exactLineHeight > 0;
  const fontFamily = String(props.fontFamily ?? "");

  useDynamicFont(fontFamily);

  const activeStyle = textStyleOptions.find((option) => option.role === currentRole && option.size === currentFontSize);

  function setTextStyle(value: string) {
    const option = textStyleOptions.find((item) => item.label === value);
    if (!option) return;

    const presetProps: MotionDocProps = {
      ...props,
      fontSize: option.size,
      lineHeight: option.lineHeight,
      role: option.role
    };
    delete presetProps.lineHeightPt;
    const nextProps = applyBlockTextStyle(presetProps, { fontWeight: option.weight }, text.length);
    updateBlock(selectedBlockIndex, autoSizeTextFrameProps({ props, type: block.type }, text, { mode: "height", props: nextProps }), text);
  }

  function setListStyle(value: MotionDocTextListType) {
    const next = applyTextListStyle(props, text, value);
    updateBlock(
      selectedBlockIndex,
      autoSizeTextFrameProps({ props, type: block.type }, next.text, { mode: "height", props: next.props }),
      next.text
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="Text style">
        <NativeSelect
          onChange={setTextStyle}
          options={[
            ...(!activeStyle ? [{ label: "Custom", value: "Custom" }] : []),
            ...textStyleOptions.map((option) => ({ label: `${tx(option.label)} · ${option.size} pt`, value: option.label }))
          ]}
          value={activeStyle?.label ?? "Custom"}
        />
      </Field>

      <Field label="Typography">
        <div className="flex flex-col gap-2">
          <FontPicker
            onChange={(value) => {
              const nextProps = applyBlockTextStyle(
                props,
                { fontFamily: value || null },
                text.length
              );
              updateBlock(selectedBlockIndex, nextProps, text);
            }}
            value={fontFamily}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <NumberInput showSteppers prefix={<span className="text-[9px] font-semibold text-neutral-500">{tx("Size")}</span>} min="8" max="512" onChange={(value) => {
              const nextProps = applyBlockTextStyle(props, { fontSize: value === "" ? null : value }, text.length);
              updateBlock(selectedBlockIndex, autoSizeTextFrameProps({ props, type: block.type }, text, { mode: "height", props: nextProps }), text);
            }} placeholder={String(motionDocDefaultFontSize(block.type))} step="0.5" suffix="pt" value={props.fontSize ?? ""} />
            <NumberInput prefix={<span className="text-[9px] font-semibold text-neutral-500">{tx("Weight")}</span>} min="100" max="900" onChange={(value) => {
              const nextProps = applyBlockTextStyle(
                props,
                { fontWeight: value === "" ? null : value },
                text.length
              );
              updateBlock(selectedBlockIndex, nextProps, text);
            }} placeholder={isTitleText ? "700" : "400"} step="50" value={props.fontWeight ?? ""} />
            <NumberInput commitOnBlur prefix={<span className="text-[9px] font-semibold text-neutral-500">{tx("Line height")}</span>} min={usesExactLineHeight ? "1" : "0.8"} max={usesExactLineHeight ? "1584" : "2.5"} onChange={(value) => {
              const nextProps = textFramePropsWithLineHeight(
                props,
                value,
                usesExactLineHeight ? "points" : "multiple"
              );
              updateBlock(selectedBlockIndex, nextProps, text);
            }} placeholder={usesExactLineHeight ? String(Math.round(currentFontSize * (isTitleText ? 1.02 : 1.45) * 10) / 10) : isTitleText ? "1" : "1.45"} step={usesExactLineHeight ? "0.5" : "0.05"} suffix={usesExactLineHeight ? "pt" : undefined} value={usesExactLineHeight ? props.lineHeightPt ?? "" : props.lineHeight ?? ""} />
            <NumberInput commitOnBlur prefix={<span className="text-[9px] font-semibold text-neutral-500">{tx("Letter spacing")}</span>} min="-20" max="100" onChange={(value) => {
              const nextProps = applyBlockTextStyle(props, {
                letterSpacing: value === "" ? null : value
              }, text.length);
              updateBlock(selectedBlockIndex, autoSizeTextFrameProps({ props, type: block.type }, text, { mode: "height", props: nextProps }), text);
            }} placeholder="0" step="0.1" suffix="pt" value={props.letterSpacing ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Toggle
              className={`flex h-8 items-center justify-center gap-1.5 rounded-lg border text-[11px] transition ${props.fontStyle === "italic" ? "border-white/20 bg-white text-black" : "border-white/[0.08] bg-white/[0.03] text-neutral-400 hover:bg-white/[0.07] hover:text-white"}`}
              onPressedChange={(pressed) => {
                const nextProps = applyBlockTextStyle(props, { italic: pressed }, text.length);
                updateBlock(selectedBlockIndex, nextProps, text);
              }}
              pressed={props.fontStyle === "italic"}
              size="sm"
            >
              <Italic size={13} />
              {tx("Italic")}
            </Toggle>
            <Button
              className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-[11px] text-neutral-400 transition hover:bg-white/[0.07] hover:text-white"
              onClick={() => updateBlock(selectedBlockIndex, autoSizeTextFrameProps({ props, type: block.type }, text, { mode: "fit", props }), text)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Maximize2 size={13} />
              {tx("Fit text box")}
            </Button>
          </div>
        </div>
      </Field>

      <Field label="Alignment">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
          <IconSegmentedControl
            label=""
            onChange={(value) => {
              const nextProps = { ...props, textAlign: value };
              updateBlock(selectedBlockIndex, nextProps, text);
            }}
            options={[
              { icon: <AlignLeft size={14} />, label: "Align left", value: "left" },
              { icon: <AlignCenter size={14} />, label: "Align center", value: "center" },
              { icon: <AlignRight size={14} />, label: "Align right", value: "right" }
            ]}
            value={String(props.textAlign ?? "left")}
          />
          <IconSegmentedControl
            label=""
            onChange={(value) => {
              const nextProps = { ...props, textVerticalAlign: value };
              updateBlock(selectedBlockIndex, nextProps, text);
            }}
            options={[
              { icon: <AlignVerticalJustifyStart size={14} />, label: "Align top", value: "top" },
              { icon: <AlignVerticalJustifyCenter size={14} />, label: "Align middle", value: "middle" },
              { icon: <AlignVerticalJustifyEnd size={14} />, label: "Align bottom", value: "bottom" }
            ]}
            value={String(props.textVerticalAlign ?? "top")}
          />
          <ToggleGroup
            aria-label={tx("List style")}
            className="grid grid-cols-3 gap-1 rounded-lg bg-white/[0.025] p-0.5"
            onValueChange={(value) => {
              if (value) setListStyle(value === "none" ? "" : value as MotionDocTextListType);
            }}
            type="single"
            value={String(props.listType || "none")}
          >
            {([
              { icon: <ListX size={14} />, label: "No list", value: "none" },
              { icon: <List size={14} />, label: "Bullet list", value: "bullet" },
              { icon: <ListOrdered size={14} />, label: "Numbered list", value: "ordered" }
            ] as const).map((option) => (
              <ToggleGroupItem
                aria-label={tx(option.label)}
                className={`flex h-[30px] w-[30px] items-center justify-center rounded-md transition-all ${String(props.listType || "none") === option.value ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:bg-white/[0.07] hover:text-neutral-200"}`}
                key={option.value}
                value={option.value}
              >
                {option.icon}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </Field>
    </div>
  );
}
