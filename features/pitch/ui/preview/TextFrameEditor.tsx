"use client";

import * as Popover from "@radix-ui/react-popover";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Bold,
  List,
  Minus,
  MoreHorizontal,
  Plus
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CompositionEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import * as Toolbar from "@radix-ui/react-toolbar";
import { numberValue } from "@/core/motion-doc/domain/frame";
import type { MotionDocProps, MotionDocTextBlock } from "@/core/motion-doc/domain/motionDocTypes";
import { motionDocDefaultFontSize } from "@/core/motion-doc/domain/typography";
import {
  applyBlockTextStyle,
  applyTextStyleSelection,
  rebaseTextStyleRanges,
  TEXT_STYLE_RANGES_PROP,
  textStyleRangesFromProps,
  textStyleSegments,
  type MotionDocTextStylePatch
} from "@/core/motion-doc/domain/textStyleRanges";
import { stringValue } from "@/features/pitch/application/previewCanvas";
import { autoSizeTextFrameProps } from "@/features/pitch/application/textFrameSizing";
import type { BlockUpdater } from "@/features/pitch/application/pitchCommandTypes";
import { useDynamicFont, useDynamicFonts } from "@/features/pitch/ui/hooks/useDynamicFont";
import { usePitchI18n } from "@/features/pitch/ui/pitchI18n";
import { FontPicker } from "@/features/pitch/ui/preview/controls/FontPicker";
import { editableFrameStyle, editableTextStyle } from "@/features/pitch/ui/preview/textEditorStyles";
import {
  TextColorPopover,
  TextOptionRow,
  TextPresetPicker,
  TextWeightInput,
  type TextPreset
} from "@/features/pitch/ui/preview/TextToolbarOptions";
import {
  editorTextSelection,
  renderEditableText,
  restoreEditorTextSelection,
  type TextSelectionRange
} from "@/features/pitch/ui/preview/textEditorDom";
import styles from "@/features/pitch/ui/preview/TextFrameEditor.module.css";

type TextFrameEditorProps = {
  block: MotionDocTextBlock;
  blockIndex: number;
  canvasScale: number;
  isEditingEnabled?: boolean;
  onBeginTextEdit: () => void;
  onRequestEdit?: () => void;
  onSelectBlock: (index: number) => void;
  onUpdateBlock: BlockUpdater;
  resizeDuringEdit?: boolean;
  showToolbar?: boolean;
  toolbarAlignment?: "left" | "right";
  toolbarPlacement?: "above" | "below";
};

export function TextFrameEditor({
  block,
  blockIndex,
  canvasScale,
  isEditingEnabled = true,
  onBeginTextEdit,
  onRequestEdit,
  onSelectBlock,
  onUpdateBlock,
  resizeDuringEdit = false,
  showToolbar = true,
  toolbarAlignment = "left",
  toolbarPlacement = "above"
}: TextFrameEditorProps) {
  const { locale } = usePitchI18n();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const editStartedRef = useRef(false);
  const editingEnabledRef = useRef(isEditingEnabled);
  const isComposingRef = useRef(false);
  const textChangedDuringEditRef = useRef(false);
  const lastTextRef = useRef("");
  const lastPropsRef = useRef(block.props);
  const lastTextStyleRangesRef = useRef("");
  const [isTextOptionsOpen, setIsTextOptionsOpen] = useState(false);
  const [selectedTextRange, setSelectedTextRange] = useState<TextSelectionRange | null>(null);
  const inlineFontFamilies = textStyleRangesFromProps(block.props, block.text.length)
    .flatMap((range) => range.fontFamily ? [range.fontFamily] : []);
  useDynamicFonts(inlineFontFamilies);

  useEffect(() => {
    if (isEditingEnabled && !editingEnabledRef.current) {
      editStartedRef.current = true;
      textChangedDuringEditRef.current = false;
      editorRef.current?.focus();
    }

    if (!isEditingEnabled) {
      editStartedRef.current = false;
      textChangedDuringEditRef.current = false;
    }

    editingEnabledRef.current = isEditingEnabled;
  }, [isEditingEnabled]);

  useEffect(() => {
    const editor = editorRef.current;
    const textStyleRanges = stringValue(block.props[TEXT_STYLE_RANGES_PROP], "");

    if (!editor || isComposingRef.current) {
      return;
    }

    if (lastTextRef.current === block.text && lastTextStyleRangesRef.current === textStyleRanges) {
      lastPropsRef.current = block.props;
      return;
    }

    renderEditableText(editor, block.text, block.props);
    lastTextRef.current = block.text;
    lastPropsRef.current = block.props;
    lastTextStyleRangesRef.current = textStyleRanges;
    restoreEditorTextSelection(editor, selectedTextRange);
  }, [block.props, block.text, selectedTextRange]);

  useEffect(() => {
    function preserveEditorSelection() {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection?.anchorNode || !selection.focusNode) return;
      if (!editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) return;
      setSelectedTextRange(editorTextSelection(editor));
    }

    document.addEventListener("selectionchange", preserveEditorSelection);
    return () => document.removeEventListener("selectionchange", preserveEditorSelection);
  }, []);

  function beginTextEdit() {
    if (editStartedRef.current) {
      return;
    }

    onBeginTextEdit();
    editStartedRef.current = true;
  }

  function syncText(text: string, resizeFrame = false) {
    beginTextEdit();

    if (text !== lastTextRef.current) {
      textChangedDuringEditRef.current = true;
    }

    const rebasedProps = rebaseTextStyleRanges(lastPropsRef.current, lastTextRef.current, text);
    const nextProps = resizeFrame
      ? autoSizeTextFrameProps(block, text, { mode: "height", props: rebasedProps })
      : rebasedProps;
    lastTextRef.current = text;
    lastPropsRef.current = nextProps;
    lastTextStyleRangesRef.current = stringValue(nextProps[TEXT_STYLE_RANGES_PROP], "");
    onUpdateBlock(blockIndex, nextProps, text, { transient: true });
  }

  function finishTextEdit() {
    if (!editStartedRef.current) {
      return;
    }

    if (!resizeDuringEdit && textChangedDuringEditRef.current) {
      syncText(editorRef.current?.textContent ?? "", true);
    }

    editStartedRef.current = false;
    textChangedDuringEditRef.current = false;
  }

  function updateTextSelection() {
    setSelectedTextRange(editorTextSelection(editorRef.current));
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (
      (event.key !== "ArrowLeft" && event.key !== "ArrowRight") ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    const selection = window.getSelection() as (Selection & {
      modify?: (alter: "extend" | "move", direction: "backward" | "forward", granularity: "character") => void;
    }) | null;
    if (!selection?.modify) return;

    event.preventDefault();
    selection.modify(
      event.shiftKey ? "extend" : "move",
      event.key === "ArrowLeft" ? "backward" : "forward",
      "character"
    );
    updateTextSelection();
  }

  function applyInlineStyle(
    patch: MotionDocTextStylePatch,
    options: { resizeFrame?: boolean } = {}
  ) {
    if (!selectedTextRange || selectedTextRange.end <= selectedTextRange.start) return;
    beginTextEdit();
    const currentText = lastTextRef.current;
    const nextProps = applyTextStyleSelection(lastPropsRef.current, selectedTextRange, patch, currentText.length);
    const resolvedProps = options.resizeFrame
      ? autoSizeTextFrameProps(block, currentText, { mode: "height", props: nextProps })
      : nextProps;
    lastPropsRef.current = resolvedProps;
    lastTextStyleRangesRef.current = stringValue(resolvedProps[TEXT_STYLE_RANGES_PROP], "");
    onUpdateBlock(
      blockIndex,
      resolvedProps,
      currentText
    );
    window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (editor) restoreEditorTextSelection(editor, selectedTextRange);
    });
  }

  return (
    <>
      {showToolbar ? (
        <TextStyleToolbar
          alignment={toolbarAlignment}
          block={block}
          blockIndex={blockIndex}
          isOptionsOpen={isTextOptionsOpen}
          onApplyInlineStyle={applyInlineStyle}
          onOptionsOpenChange={setIsTextOptionsOpen}
          onUpdateBlock={onUpdateBlock}
          placement={toolbarPlacement}
          selectedTextRange={selectedTextRange}
        />
      ) : null}
      <div
        className={`absolute z-10 overflow-hidden border-0 bg-transparent p-0 text-current outline-none ${
          isEditingEnabled || onRequestEdit ? "cursor-text" : "pointer-events-none cursor-move"
        }`}
        onClick={(event) => {
          event.stopPropagation();
          if (!isEditingEnabled) onRequestEdit?.();
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          if (isEditingEnabled) onSelectBlock(blockIndex);
        }}
        style={{
          ...editableFrameStyle(block),
          inset: 0,
          width: "auto",
          height: "auto"
        }}
      >
        <div
          aria-label={locale === "zh-TW"
            ? (block.type === "Title" ? "編輯標題文字" : "編輯文字內容")
            : `Edit ${block.type} text`}
          className={`${styles.editor} w-full outline-none`}
          contentEditable={isEditingEnabled ? "plaintext-only" : false}
          onBeforeInput={beginTextEdit}
          onBlur={finishTextEdit}
          onCompositionEnd={(event: CompositionEvent<HTMLDivElement>) => {
            isComposingRef.current = false;
            syncText(event.currentTarget.textContent ?? "", resizeDuringEdit);
          }}
          onCompositionStart={() => {
            beginTextEdit();
            isComposingRef.current = true;
          }}
          onInput={(event) => {
            if (isComposingRef.current) {
              if ((event.currentTarget.textContent ?? "") !== lastTextRef.current) {
                textChangedDuringEditRef.current = true;
              }
              lastTextRef.current = event.currentTarget.textContent ?? "";
              return;
            }

            syncText(event.currentTarget.textContent ?? "", resizeDuringEdit);
            updateTextSelection();
          }}
          onKeyDown={handleEditorKeyDown}
          onKeyUp={updateTextSelection}
          onMouseUp={updateTextSelection}
          onPaste={beginTextEdit}
          onPointerUp={updateTextSelection}
          onSelect={updateTextSelection}
          ref={editorRef}
          role="textbox"
          spellCheck={false}
          style={editableTextStyle(block, canvasScale)}
          suppressContentEditableWarning
        />
      </div>
    </>
  );
}

function TextStyleToolbar({
  alignment,
  block,
  blockIndex,
  isOptionsOpen,
  onApplyInlineStyle,
  onOptionsOpenChange,
  onUpdateBlock,
  placement,
  selectedTextRange
}: {
  alignment: "left" | "right";
  block: MotionDocTextBlock;
  blockIndex: number;
  isOptionsOpen: boolean;
  onApplyInlineStyle: (patch: MotionDocTextStylePatch, options?: { resizeFrame?: boolean }) => void;
  onOptionsOpenChange: (open: boolean) => void;
  onUpdateBlock: BlockUpdater;
  placement: "above" | "below";
  selectedTextRange: TextSelectionRange | null;
}) {
  const { tx } = usePitchI18n();
  const fontSize = numberValue(block.props.fontSize) ?? motionDocDefaultFontSize(block.type);
  const lineHeight = numberValue(block.props.lineHeight) ?? (block.type === "Title" ? 1.02 : 1.45);
  const fontWeight = numberValue(block.props.fontWeight) ?? (block.type === "Title" ? 600 : 400);
  const fontFamily = stringValue(block.props.fontFamily, "");
  const blockColor = stringValue(block.props.color ?? block.props.textColor, "#ffffff");
  const selectedStyles = selectedTextRange
    ? textStyleSegments(block.text, block.props).filter(
        (segment) => segment.end > selectedTextRange.start && segment.start < selectedTextRange.end
      )
    : [];
  const selectedWeights = new Set(selectedStyles.map((segment) => segment.fontWeight ?? fontWeight));
  const selectedColors = new Set(selectedStyles.map((segment) => segment.color ?? blockColor));
  const selectedFontFamilies = new Set(selectedStyles.map((segment) => segment.fontFamily ?? fontFamily));
  const selectedWeight = selectedWeights.size === 1 ? [...selectedWeights][0] : undefined;
  const selectedFontFamily = selectedFontFamilies.size === 1 ? [...selectedFontFamilies][0] : undefined;
  const color = selectedColors.size === 1 ? [...selectedColors][0] : blockColor;
  const textAlign = stringValue(block.props.textAlign, "left");
  const verticalAlign = stringValue(block.props.textVerticalAlign, "top");
  const listType = stringValue(block.props.listType, "");
  useDynamicFont(fontFamily);

  const hasTextSelection = Boolean(selectedTextRange && selectedTextRange.end > selectedTextRange.start);
  const effectiveFontWeight = hasTextSelection ? selectedWeight : fontWeight;
  const isBold = effectiveFontWeight !== undefined && effectiveFontWeight >= 700;
  const isBulletList = listType === "bullet";

  function updateProps(nextProps: MotionDocProps, resizeFrame = false) {
    const resolvedProps = resizeFrame
      ? autoSizeTextFrameProps(block, block.text, {
          mode: "height",
          props: nextProps
        })
      : nextProps;

    onUpdateBlock(blockIndex, resolvedProps, block.text);
  }

  function setProp(key: string, value: string | number | "", resizeFrame = false) {
    let nextProps: MotionDocProps;

    if (key === "color" || key === "fontFamily" || key === "fontWeight") {
      const patch: MotionDocTextStylePatch = {};
      if (key === "color") patch.color = value === "" ? null : String(value);
      if (key === "fontFamily") patch.fontFamily = value === "" ? null : String(value);
      if (key === "fontWeight") patch.fontWeight = value === "" ? null : Number(value);
      nextProps = applyBlockTextStyle(block.props, patch, block.text.length);
    } else {
      nextProps = { ...block.props };

      delete nextProps[key];

      if (value !== "") {
        nextProps[key] = value;
      }
    }

    updateProps(nextProps, resizeFrame);
  }

  function setWeight(value: number) {
    if (hasTextSelection) {
      onApplyInlineStyle({ fontWeight: value });
      return;
    }
    setProp("fontWeight", value);
  }

  function setColor(value: string) {
    if (hasTextSelection) {
      onApplyInlineStyle({ color: value });
      return;
    }
    setProp("color", value);
  }

  function setFontFamily(value: string) {
    if (hasTextSelection) {
      onApplyInlineStyle({ fontFamily: value || null }, { resizeFrame: true });
      return;
    }
    setProp("fontFamily", value, true);
  }

  function adjustFontSize(delta: number) {
    const nextSize = Math.round((fontSize + delta) * 2) / 2;
    setProp("fontSize", Math.min(Math.max(nextSize, 8), 128), true);
  }

  function applyTextPreset(preset: TextPreset) {
    const nextProps = applyBlockTextStyle({
      ...block.props,
      fontSize: preset.fontSize,
      lineHeight: preset.lineHeight,
      role: preset.role
    }, { fontWeight: preset.fontWeight }, block.text.length);

    updateProps(nextProps, true);
  }

  function toggleList() {
    let nextText = block.text;
    if (!isBulletList) {
      nextText = block.text.split("\n").map(line => line.startsWith("• ") ? line : `• ${line}`).join("\n");
    } else {
      nextText = block.text.split("\n").map(line => line.startsWith("• ") ? line.slice(2) : line).join("\n");
    }

    const nextProps = { ...block.props };
    if (isBulletList) {
      delete nextProps.listType;
    } else {
      nextProps.listType = "bullet";
    }

    onUpdateBlock(blockIndex, autoSizeTextFrameProps(block, nextText, { mode: "height", props: nextProps }), nextText);
  }

  return (
    <Toolbar.Root
      className={`absolute z-50 flex h-9 items-center gap-1 rounded-[10px] border border-white/[0.09] bg-[#1b1b1e]/95 px-1 shadow-[0_12px_32px_rgba(5,4,10,0.42),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl ${alignment === "right" ? "right-0" : "left-0"} ${placement === "below" ? "top-[calc(100%+12px)]" : "-top-[48px]"}`}
      data-group-focus-surface
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <TextPresetPicker
        block={block}
        onSelect={applyTextPreset}
        side={placement === "below" ? "bottom" : "top"}
      />

      <FontPicker
        displayValue={hasTextSelection && selectedFontFamilies.size > 1 ? tx("Mixed fonts") : undefined}
        onChange={setFontFamily}
        value={hasTextSelection ? selectedFontFamily ?? fontFamily : fontFamily}
      />

      <Toolbar.Separator className="mx-0.5 h-4 w-px shrink-0 bg-white/[0.08]" />

      <div className="flex h-7 shrink-0 items-center overflow-hidden rounded-md bg-black/20">
        <Toolbar.Button aria-label={tx("Decrease font size")} className="flex h-full w-7 items-center justify-center text-neutral-400 hover:bg-white/10 hover:text-white transition-colors outline-none focus-visible:ring-1 focus-visible:ring-white/50" onClick={() => adjustFontSize(-1)}>
          <Minus size={12} />
        </Toolbar.Button>
        <input
          aria-label={tx("Font size in points")}
          className="h-full w-11 [appearance:textfield] bg-transparent px-0.5 text-center font-mono text-[11px] text-neutral-200 outline-none focus:bg-white/5 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          max={128}
          min={8}
          onChange={(event) => setProp("fontSize", event.target.value === "" ? "" : Number(event.target.value), true)}
          type="number"
          value={fontSize}
        />
        <span aria-hidden="true" className="pr-1.5 text-[9px] text-neutral-500">
          pt
        </span>
        <Toolbar.Button aria-label={tx("Increase font size")} className="flex h-full w-7 items-center justify-center text-neutral-400 hover:bg-white/10 hover:text-white transition-colors outline-none focus-visible:ring-1 focus-visible:ring-white/50" onClick={() => adjustFontSize(1)}>
          <Plus size={12} />
        </Toolbar.Button>
      </div>

      <Toolbar.Separator className="mx-0.5 h-4 w-px shrink-0 bg-white/[0.08]" />

      <div className="flex shrink-0 items-center">
        <Toolbar.Button
          aria-label={tx("Bold")}
          className={toolbarButtonClass(isBold)}
          onClick={() => setWeight(isBold ? 400 : 700)}
          onPointerDown={(event) => event.preventDefault()}
        >
          <Bold size={13} />
        </Toolbar.Button>
      </div>

      <Popover.Root onOpenChange={onOptionsOpenChange} open={isOptionsOpen}>
        <Popover.Trigger asChild>
          <Toolbar.Button
            aria-label={tx("More text options")}
            className={toolbarButtonClass(isBulletList || textAlign !== "left" || verticalAlign !== "top")}
            onPointerDown={(event) => event.preventDefault()}
            title={tx("More text options")}
          >
            <MoreHorizontal size={14} />
          </Toolbar.Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            className="z-[110] w-[220px] rounded-xl border border-white/10 bg-[#1b1b1e] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.48)]"
            onCloseAutoFocus={(event) => event.preventDefault()}
            onOpenAutoFocus={(event) => event.preventDefault()}
            sideOffset={8}
          >
            <TextOptionRow label="Alignment">
              <button aria-label={tx("Align left")} className={toolbarButtonClass(textAlign === "left")} onClick={() => setProp("textAlign", "left")} type="button"><AlignLeft size={13} /></button>
              <button aria-label={tx("Align center")} className={toolbarButtonClass(textAlign === "center")} onClick={() => setProp("textAlign", "center")} type="button"><AlignCenter size={13} /></button>
              <button aria-label={tx("Align right")} className={toolbarButtonClass(textAlign === "right")} onClick={() => setProp("textAlign", "right")} type="button"><AlignRight size={13} /></button>
            </TextOptionRow>
            <TextOptionRow label="Vertical">
              <button aria-label={tx("Align top")} className={toolbarButtonClass(verticalAlign === "top")} onClick={() => setProp("textVerticalAlign", "top")} type="button"><AlignVerticalJustifyStart size={13} /></button>
              <button aria-label={tx("Align middle")} className={toolbarButtonClass(verticalAlign === "middle" || verticalAlign === "center")} onClick={() => setProp("textVerticalAlign", "middle")} type="button"><AlignVerticalJustifyCenter size={13} /></button>
              <button aria-label={tx("Align bottom")} className={toolbarButtonClass(verticalAlign === "bottom")} onClick={() => setProp("textVerticalAlign", "bottom")} type="button"><AlignVerticalJustifyEnd size={13} /></button>
            </TextOptionRow>
            <div className="my-1 h-px bg-white/[0.07]" />
            <div className="flex h-9 items-center justify-between px-1.5">
              <span className="text-[11px] text-neutral-400">{tx("Bullet list")}</span>
              <button aria-label={tx("Bullet list")} className={toolbarButtonClass(isBulletList)} onClick={toggleList} type="button"><List size={13} /></button>
            </div>
            <div className="flex h-9 items-center justify-between px-1.5">
              <span className="text-[11px] text-neutral-400">{tx("Weight")}</span>
              <TextWeightInput onCommit={setWeight} value={effectiveFontWeight} />
            </div>
            <div className="flex h-9 items-center justify-between px-1.5">
              <span className="text-[11px] text-neutral-400">{tx("Text color")}</span>
              <TextColorPopover color={color} onChange={setColor} />
            </div>
            <label className="flex h-9 items-center justify-between px-1.5">
              <span className="text-[11px] text-neutral-400">{tx("Line height")}</span>
              <input aria-label={tx("Line height")} className="h-7 w-14 rounded-md bg-black/25 px-2 text-center font-mono text-[11px] text-neutral-200 outline-none focus:ring-1 focus:ring-white/25" max={2.5} min={0.8} onChange={(event) => setProp("lineHeight", event.target.value === "" ? "" : Number(event.target.value), true)} step={0.05} type="number" value={lineHeight} />
            </label>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </Toolbar.Root>
  );
}

function toolbarButtonClass(active: boolean) {
  return `flex h-7 w-7 items-center justify-center rounded-[5px] transition-all outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${
    active ? "bg-white text-black shadow-sm" : "text-neutral-400 hover:bg-white/10 hover:text-white"
  }`;
}
