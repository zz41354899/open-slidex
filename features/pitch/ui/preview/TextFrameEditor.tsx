
import * as Popover from "@radix-ui/react-popover";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Bold,
  ChevronDown,
  GripHorizontal,
  Italic,
  List,
  ListOrdered,
  ListX,
  Minus,
  MoreHorizontal,
  Plus
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  ClipboardEvent as ReactClipboardEvent,
  CompositionEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent
} from "react";
import * as Toolbar from "@radix-ui/react-toolbar";
import {
  applyTextListStyle,
  type MotionDocTextListType
} from "@/core/motion-doc/application/textListStyle";
import {
  createMotionDocTextClipboardPacket,
  MOTION_DOC_TEXT_CLIPBOARD_FORMAT,
  motionDocTextClipboardHtml,
  motionDocTextClipboardPacketFromHtml,
  parseMotionDocTextClipboardPacket,
  pasteMotionDocTextClipboard
} from "@/core/motion-doc/application/motionDocTextClipboard";
import { numberValue } from "@/core/motion-doc/domain/frame";
import type { MotionDocProps, MotionDocTextBlock } from "@/core/motion-doc/domain/motionDocTypes";
import {
  matchingOfficeSpacingPreset,
  motionDocDefaultFontSize,
  OFFICE_CHARACTER_SPACING_PRESETS,
  OFFICE_LINE_HEIGHT_PRESETS
} from "@/core/motion-doc/domain/typography";
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
import {
  autoSizeTextFrameProps,
  textFramePropsWithLineHeight
} from "@/features/pitch/application/textFrameSizing";
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
  inheritedTextColor?: string;
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
  inheritedTextColor = "#ffffff",
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
  const lastTextRef = useRef(block.text);
  const lastPropsRef = useRef(block.props);
  const renderedTextRef = useRef<string | null>(null);
  const renderedTextStyleRangesRef = useRef<string | null>(null);
  const renderedCanvasScaleRef = useRef<number | null>(null);
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
      setSelectedTextRange(null);
    }

    editingEnabledRef.current = isEditingEnabled;
  }, [isEditingEnabled]);

  useEffect(() => {
    const editor = editorRef.current;
    const textStyleRanges = stringValue(block.props[TEXT_STYLE_RANGES_PROP], "");

    if (!editor || isComposingRef.current) {
      return;
    }

    lastTextRef.current = block.text;
    lastPropsRef.current = block.props;
    if (
      renderedTextRef.current === block.text &&
      renderedTextStyleRangesRef.current === textStyleRanges &&
      renderedCanvasScaleRef.current === canvasScale
    ) {
      return;
    }

    const selectionToRestore = editorTextSelection(editor) ?? selectedTextRange;
    renderEditableText(editor, block.text, block.props, canvasScale);
    renderedTextRef.current = block.text;
    renderedTextStyleRangesRef.current = textStyleRanges;
    renderedCanvasScaleRef.current = canvasScale;
    restoreEditorTextSelection(editor, selectionToRestore);
  }, [block.props, block.text, canvasScale, selectedTextRange]);

  useEffect(() => {
    function preserveEditorSelection() {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor) return;
      if (
        selection?.anchorNode &&
        selection.focusNode &&
        editor.contains(selection.anchorNode) &&
        editor.contains(selection.focusNode)
      ) {
        setSelectedTextRange(editorTextSelection(editor));
        return;
      }

      const activeElement = document.activeElement;
      if (activeElement instanceof Element && activeElement.closest("[data-text-edit-control]")) return;
      setSelectedTextRange(null);
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
    renderedTextRef.current = text;
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
      (event.metaKey || event.ctrlKey) &&
      !event.altKey &&
      event.key.toLowerCase() === "i" &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      const selection = editorTextSelection(editorRef.current);
      const hasSelection = Boolean(selection && selection.end > selection.start);
      const baseItalic = lastPropsRef.current.fontStyle === "italic";
      if (hasSelection && selection) {
        setSelectedTextRange(selection);
        const currentBlock = {
          ...block,
          props: lastPropsRef.current,
          text: lastTextRef.current
        } as MotionDocTextBlock;
        applyInlineStyle({ italic: !selectedTextIsItalic(currentBlock, selection, baseItalic) }, { selection });
      } else {
        const nextProps = applyBlockTextStyle(lastPropsRef.current, { italic: !baseItalic }, lastTextRef.current.length);
        lastPropsRef.current = nextProps;
        onUpdateBlock(blockIndex, nextProps, lastTextRef.current);
      }
      return;
    }
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
    options: { resizeFrame?: boolean; selection?: TextSelectionRange } = {}
  ) {
    const selection = options.selection ?? selectedTextRange;
    if (!selection || selection.end <= selection.start) return;
    beginTextEdit();
    const currentText = lastTextRef.current;
    const nextProps = applyTextStyleSelection(lastPropsRef.current, selection, patch, currentText.length);
    const resolvedProps = options.resizeFrame
      ? autoSizeTextFrameProps(block, currentText, { mode: "height", props: nextProps })
      : nextProps;
    lastPropsRef.current = resolvedProps;
    onUpdateBlock(
      blockIndex,
      resolvedProps,
      currentText
    );
    window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (editor) restoreEditorTextSelection(editor, selection);
    });
  }

  function handleCopy(event: ReactClipboardEvent<HTMLDivElement>) {
    const selection = editorTextSelection(editorRef.current);
    if (!selection || selection.end <= selection.start) return;
    const packet = createMotionDocTextClipboardPacket(
      { ...block, props: lastPropsRef.current, text: lastTextRef.current } as MotionDocTextBlock,
      selection
    );
    if (!packet) return;

    event.preventDefault();
    event.clipboardData.setData("text/plain", packet.text);
    event.clipboardData.setData("text/html", motionDocTextClipboardHtml(packet));
    try {
      event.clipboardData.setData(MOTION_DOC_TEXT_CLIPBOARD_FORMAT, JSON.stringify(packet));
    } catch {
      // Custom MIME types are optional; the same-editor-session fallback remains available.
    }
  }

  function handlePaste(event: ReactClipboardEvent<HTMLDivElement>) {
    const plainText = event.clipboardData.getData("text/plain");
    const clipboardPacket = parseMotionDocTextClipboardPacket(
      event.clipboardData.getData(MOTION_DOC_TEXT_CLIPBOARD_FORMAT)
    ) ?? motionDocTextClipboardPacketFromHtml(event.clipboardData.getData("text/html"));
    const packet = clipboardPacket ?? {
      ranges: [],
      text: plainText
    };
    if (!packet.text && packet.ranges.length === 0) return;

    event.preventDefault();
    event.stopPropagation();
    beginTextEdit();
    const currentText = lastTextRef.current;
    const selection = editorTextSelection(editorRef.current) ?? {
      end: currentText.length,
      start: currentText.length
    };
    const pasted = pasteMotionDocTextClipboard(lastPropsRef.current, currentText, selection, packet);
    const nextProps = resizeDuringEdit
      ? autoSizeTextFrameProps(block, pasted.text, { mode: "height", props: pasted.props })
      : pasted.props;
    const editor = editorRef.current;
    if (editor) {
      renderEditableText(editor, pasted.text, nextProps, canvasScale);
      restoreEditorTextSelection(editor, pasted.selection);
    }
    textChangedDuringEditRef.current = pasted.text !== currentText;
    lastTextRef.current = pasted.text;
    lastPropsRef.current = nextProps;
    renderedTextRef.current = pasted.text;
    renderedTextStyleRangesRef.current = stringValue(nextProps[TEXT_STYLE_RANGES_PROP], "");
    renderedCanvasScaleRef.current = canvasScale;
    setSelectedTextRange(pasted.selection);
    onUpdateBlock(blockIndex, nextProps, pasted.text, { transient: true });
  }

  return (
    <>
      {showToolbar ? (
        <TextStyleToolbar
          alignment={toolbarAlignment}
          block={block}
          blockIndex={blockIndex}
          isOptionsOpen={isTextOptionsOpen}
          inheritedTextColor={inheritedTextColor}
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
            ? (block.props.role === "title" ? "編輯標題文字" : "編輯文字內容")
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
          onCopy={handleCopy}
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
          onPaste={handlePaste}
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
  inheritedTextColor,
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
  inheritedTextColor: string;
  isOptionsOpen: boolean;
  onApplyInlineStyle: (patch: MotionDocTextStylePatch, options?: { resizeFrame?: boolean }) => void;
  onOptionsOpenChange: (open: boolean) => void;
  onUpdateBlock: BlockUpdater;
  placement: "above" | "below";
  selectedTextRange: TextSelectionRange | null;
}) {
  const { tx } = usePitchI18n();
  const [optionsOffset, setOptionsOffset] = useState({ x: 0, y: 0 });
  const optionsContentRef = useRef<HTMLDivElement | null>(null);
  const optionsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const optionsOffsetRef = useRef(optionsOffset);
  const optionsDragRef = useRef<{
    originX: number;
    originY: number;
    startX: number;
    startY: number;
  } | null>(null);
  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      moveOptions(event.clientX, event.clientY);
    }

    function handleMouseUp() {
      optionsDragRef.current = null;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);
  useEffect(() => {
    if (!isOptionsOpen) return;

    function closeOptionsOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (optionsTriggerRef.current?.contains(target) || optionsContentRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-text-options-floating-child]")) return;

      updateOptionsOffset({ x: 0, y: 0 });
      onOptionsOpenChange(false);
    }

    document.addEventListener("pointerdown", closeOptionsOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", closeOptionsOnOutsidePointer, true);
  }, [isOptionsOpen, onOptionsOpenChange]);
  const fontSize = numberValue(block.props.fontSize) ?? motionDocDefaultFontSize(block.type);
  const lineHeight = numberValue(block.props.lineHeight) ?? (block.props.role === "title" ? 1.02 : 1.45);
  const lineHeightPt = numberValue(block.props.lineHeightPt);
  const fontWeight = numberValue(block.props.fontWeight) ?? (block.props.role === "title" ? 600 : 400);
  const letterSpacing = numberValue(block.props.letterSpacing) ?? 0;
  const baseItalic = block.props.fontStyle === "italic";
  const fontFamily = stringValue(block.props.fontFamily, "");
  const blockColor = stringValue(block.props.color ?? block.props.textColor, inheritedTextColor);
  const selectedStyles = selectedTextRange
    ? textStyleSegments(block.text, block.props).filter(
        (segment) => segment.end > selectedTextRange.start && segment.start < selectedTextRange.end
      )
    : [];
  const selectedWeights = new Set(selectedStyles.map((segment) => segment.fontWeight ?? fontWeight));
  const selectedColors = new Set(selectedStyles.map((segment) => segment.color ?? blockColor));
  const selectedFontFamilies = new Set(selectedStyles.map((segment) => segment.fontFamily ?? fontFamily));
  const selectedFontSizes = new Set(selectedStyles.map((segment) => segment.fontSize ?? fontSize));
  const selectedItalics = new Set(selectedStyles.map((segment) => segment.italic ?? baseItalic));
  const selectedLetterSpacings = new Set(selectedStyles.map((segment) => segment.letterSpacing ?? letterSpacing));
  const selectedWeight = selectedWeights.size === 1 ? [...selectedWeights][0] : undefined;
  const selectedFontFamily = selectedFontFamilies.size === 1 ? [...selectedFontFamilies][0] : undefined;
  const selectedFontSize = selectedFontSizes.size === 1 ? [...selectedFontSizes][0] : undefined;
  const selectedItalic = selectedItalics.size === 1 ? [...selectedItalics][0] : undefined;
  const selectedLetterSpacing = selectedLetterSpacings.size === 1 ? [...selectedLetterSpacings][0] : undefined;
  const color = selectedColors.size === 1 ? [...selectedColors][0] : blockColor;
  const textAlign = stringValue(block.props.textAlign, "left");
  const verticalAlign = stringValue(block.props.textVerticalAlign, "top");
  const listType = stringValue(block.props.listType, "");
  useDynamicFont(fontFamily);

  const hasTextSelection = Boolean(selectedTextRange && selectedTextRange.end > selectedTextRange.start);
  const effectiveFontWeight = hasTextSelection ? selectedWeight : fontWeight;
  const effectiveFontSize = hasTextSelection ? selectedFontSize : fontSize;
  const effectiveItalic = hasTextSelection ? selectedItalic : baseItalic;
  const effectiveLetterSpacing = hasTextSelection ? selectedLetterSpacing : letterSpacing;
  const isBold = effectiveFontWeight !== undefined && effectiveFontWeight >= 700;
  const hasList = listType === "bullet" || listType === "ordered";

  function updateOptionsOffset(nextOffset: { x: number; y: number }) {
    optionsOffsetRef.current = nextOffset;
    setOptionsOffset(nextOffset);
  }

  function handleOptionsOpenChange(open: boolean) {
    if (!open) updateOptionsOffset({ x: 0, y: 0 });
    onOptionsOpenChange(open);
  }

  function beginOptionsDrag(event: ReactMouseEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    optionsDragRef.current = {
      originX: optionsOffsetRef.current.x,
      originY: optionsOffsetRef.current.y,
      startX: event.clientX,
      startY: event.clientY
    };
  }

  function moveOptions(clientX: number, clientY: number) {
    const drag = optionsDragRef.current;
    if (!drag) return;
    const content = optionsContentRef.current;
    if (!content) return;

    const currentOffset = optionsOffsetRef.current;
    const rect = content.getBoundingClientRect();
    const baseLeft = rect.left - currentOffset.x;
    const baseTop = rect.top - currentOffset.y;
    const proposedX = drag.originX + clientX - drag.startX;
    const proposedY = drag.originY + clientY - drag.startY;
    const viewportPadding = 8;
    updateOptionsOffset({
      x: Math.min(
        Math.max(proposedX, viewportPadding - baseLeft),
        window.innerWidth - viewportPadding - baseLeft - rect.width
      ),
      y: Math.min(
        Math.max(proposedY, viewportPadding - baseTop),
        window.innerHeight - viewportPadding - baseTop - rect.height
      )
    });
  }

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

    if (key === "color" || key === "fontFamily" || key === "fontSize" || key === "fontWeight" || key === "letterSpacing") {
      const patch: MotionDocTextStylePatch = {};
      if (key === "color") patch.color = value === "" ? null : String(value);
      if (key === "fontFamily") patch.fontFamily = value === "" ? null : String(value);
      if (key === "fontSize") patch.fontSize = value === "" ? null : Number(value);
      if (key === "fontWeight") patch.fontWeight = value === "" ? null : Number(value);
      if (key === "letterSpacing") patch.letterSpacing = value === "" ? null : Number(value);
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
      onApplyInlineStyle({ fontFamily: value || null });
      return;
    }
    setProp("fontFamily", value);
  }

  function adjustFontSize(delta: number) {
    const nextSize = Math.round(((effectiveFontSize ?? fontSize) + delta) * 2) / 2;
    setFontSize(Math.min(Math.max(nextSize, 8), 512));
  }

  function setFontSize(value: number | "") {
    if (hasTextSelection) {
      onApplyInlineStyle({ fontSize: value === "" ? null : value }, { resizeFrame: true });
      return;
    }
    setProp("fontSize", value, true);
  }

  function setItalic(value: boolean) {
    if (hasTextSelection) {
      onApplyInlineStyle({ italic: value });
      return;
    }
    updateProps(applyBlockTextStyle(block.props, { italic: value }, block.text.length));
  }

  function setLetterSpacing(value: number | "") {
    if (hasTextSelection) {
      onApplyInlineStyle({ letterSpacing: value === "" ? null : value }, { resizeFrame: true });
      return;
    }
    setProp("letterSpacing", value, true);
  }

  function setLineHeightMultiple(value: number | "") {
    onUpdateBlock(
      blockIndex,
      textFramePropsWithLineHeight(block.props, value, "multiple"),
      block.text
    );
  }

  function setLineHeightPoints(value: number | "") {
    onUpdateBlock(
      blockIndex,
      textFramePropsWithLineHeight(block.props, value, "points"),
      block.text
    );
  }

  function applyTextPreset(preset: TextPreset) {
    const presetProps: MotionDocProps = {
      ...block.props,
      lineHeight: preset.lineHeight,
      role: preset.role
    };
    delete presetProps.lineHeightPt;
    const nextProps = applyBlockTextStyle(
      presetProps,
      { fontSize: preset.fontSize, fontWeight: preset.fontWeight },
      block.text.length
    );

    updateProps(nextProps, true);
  }

  function setListStyle(value: MotionDocTextListType) {
    const next = applyTextListStyle(block.props, block.text, value);
    onUpdateBlock(
      blockIndex,
      autoSizeTextFrameProps(block, next.text, { mode: "height", props: next.props }),
      next.text
    );
  }

  return (
    <Toolbar.Root
      className={`absolute z-80 flex h-9 items-center gap-1 rounded-[10px] border border-white/[0.09] bg-[#1b1b1e]/95 px-1 shadow-[0_12px_32px_rgba(5,4,10,0.42),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl ${alignment === "right" ? "right-0" : "left-0"} ${placement === "below" ? "top-[calc(100%+12px)]" : "-top-[48px]"}`}
      data-group-focus-surface
      data-text-edit-control
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDownCapture={(event) => event.stopPropagation()}
    >
      <TextPresetPicker
        block={block}
        onSelect={applyTextPreset}
        side={placement === "below" ? "bottom" : "top"}
      />

      <FontPicker
        displayValue={hasTextSelection && selectedFontFamilies.size > 1 ? tx("Mixed fonts") : undefined}
        onChange={setFontFamily}
        preserveTextSelection
        value={hasTextSelection ? selectedFontFamily ?? fontFamily : fontFamily}
      />

      <TextColorPopover color={color} onChange={setColor} />

      <Toolbar.Separator className="mx-0.5 h-4 w-px shrink-0 bg-white/[0.08]" />

      <div className="flex h-7 shrink-0 items-center overflow-hidden rounded-md bg-black/20">
        <Toolbar.Button aria-label={tx("Decrease font size")} className="flex h-full w-7 items-center justify-center text-neutral-400 hover:bg-white/10 hover:text-white transition-colors outline-none focus-visible:ring-1 focus-visible:ring-white/50" onClick={() => adjustFontSize(-1)}>
          <Minus size={12} />
        </Toolbar.Button>
        <input
          aria-label={tx("Font size in points")}
          className="h-full w-14 [appearance:textfield] bg-transparent px-0.5 text-center font-mono text-[11px] text-neutral-200 outline-none focus:bg-white/5 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          max={512}
          min={8}
          onChange={(event) => setFontSize(event.target.value === "" ? "" : Number(event.target.value))}
          type="number"
          value={effectiveFontSize ?? ""}
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
        <Toolbar.Button
          aria-label={tx("Italic")}
          className={toolbarButtonClass(effectiveItalic === true)}
          onClick={() => setItalic(effectiveItalic !== true)}
          onPointerDown={(event) => event.preventDefault()}
        >
          <Italic size={13} />
        </Toolbar.Button>
      </div>

      <Popover.Root onOpenChange={handleOptionsOpenChange} open={isOptionsOpen}>
        <Popover.Trigger asChild>
          <Toolbar.Button
            aria-label={tx("More text options")}
            className={toolbarButtonClass(hasList || textAlign !== "left" || verticalAlign !== "top")}
            onPointerDown={(event) => event.preventDefault()}
            ref={optionsTriggerRef}
            title={tx("More text options")}
          >
            <MoreHorizontal size={14} />
          </Toolbar.Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            className="z-[110] w-[292px] rounded-xl border border-white/10 bg-[#1b1b1e] p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.48)]"
            data-text-edit-control
            data-text-options-popover
            onCloseAutoFocus={(event) => event.preventDefault()}
            onOpenAutoFocus={(event) => event.preventDefault()}
            ref={optionsContentRef}
            sideOffset={8}
            style={{ translate: `${optionsOffset.x}px ${optionsOffset.y}px` }}
          >
            <button
              aria-label={tx("Move text options")}
              className="mb-0.5 flex h-5 w-full cursor-grab touch-none items-center justify-center rounded-md text-neutral-700 outline-none hover:bg-white/[0.04] hover:text-neutral-500 active:cursor-grabbing focus-visible:ring-1 focus-visible:ring-white/30"
              onDragStart={(event) => event.preventDefault()}
              onMouseDown={beginOptionsDrag}
              title={tx("Move text options")}
              type="button"
            >
              <GripHorizontal aria-hidden size={14} />
            </button>
            <TextOptionSection title="Paragraph" />
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
            <TextOptionRow label="List style">
              <button aria-label={tx("No list")} aria-pressed={!hasList} className={toolbarButtonClass(!hasList)} onClick={() => setListStyle("")} title={tx("No list")} type="button"><ListX size={13} /></button>
              <button aria-label={tx("Bullet list")} aria-pressed={listType === "bullet"} className={toolbarButtonClass(listType === "bullet")} onClick={() => setListStyle("bullet")} title={tx("Bullet list")} type="button"><List size={13} /></button>
              <button aria-label={tx("Numbered list")} aria-pressed={listType === "ordered"} className={toolbarButtonClass(listType === "ordered")} onClick={() => setListStyle("ordered")} title={tx("Numbered list")} type="button"><ListOrdered size={13} /></button>
            </TextOptionRow>
            <div className="my-1.5 h-px bg-white/[0.07]" />
            <TextOptionSection title="Reading spacing" />
            <div className="px-1.5 pb-1 text-[8px] leading-4 text-neutral-600">
              {tx("Spacing calculation hint")}
            </div>
            <OfficeSpacingSelect
              customDefaultValue={Math.round(fontSize * lineHeight * 10) / 10}
              customMax={1584}
              customMin={1}
              customSuffix="pt"
              customValue={lineHeightPt ?? ""}
              label={tx("Line height")}
              onCommit={setLineHeightMultiple}
              onCustomCommit={setLineHeightPoints}
              options={[
                { label: tx("Single"), value: OFFICE_LINE_HEIGHT_PRESETS[0] },
                { label: "1.2", value: OFFICE_LINE_HEIGHT_PRESETS[1] },
                { label: "1.5", value: OFFICE_LINE_HEIGHT_PRESETS[2] },
                { label: tx("Double"), value: OFFICE_LINE_HEIGHT_PRESETS[3] }
              ]}
              step={0.5}
              suffix={tx("Times")}
              value={lineHeight}
            />
            <OfficeSpacingSelect
              label={tx("Letter spacing")}
              onCommit={setLetterSpacing}
              options={[
                { label: tx("Tight"), value: OFFICE_CHARACTER_SPACING_PRESETS[0] },
                { label: tx("Normal"), value: OFFICE_CHARACTER_SPACING_PRESETS[1] },
                { label: tx("Loose"), value: OFFICE_CHARACTER_SPACING_PRESETS[2] }
              ]}
              signed
              step={0.1}
              suffix="pt"
              value={effectiveLetterSpacing ?? ""}
            />
            <div className="my-1.5 h-px bg-white/[0.07]" />
            <TextOptionSection title="Text details" />
            <div className="flex h-9 items-center justify-between px-1.5">
              <span className="text-[11px] text-neutral-400">{tx("Weight")}</span>
              <TextWeightInput onCommit={setWeight} value={effectiveFontWeight} />
            </div>
            <div className="flex h-9 items-center justify-between px-1.5">
              <span className="text-[11px] text-neutral-400">{tx("Text color")}</span>
              <TextColorPopover color={color} onChange={setColor} />
            </div>
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

function TextOptionSection({ title }: { title: string }) {
  const { tx } = usePitchI18n();
  return (
    <div className="px-1.5 pb-1 pt-0.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-neutral-600">
      {tx(title)}
    </div>
  );
}

function OfficeSpacingSelect({
  customDefaultValue,
  customMax,
  customMin,
  label,
  onCommit,
  onCustomCommit = onCommit,
  options,
  signed = false,
  step,
  suffix,
  customSuffix = suffix,
  customValue,
  value
}: {
  customDefaultValue?: number;
  customMax?: number;
  customMin?: number;
  customSuffix?: string;
  customValue?: number | "";
  label: string;
  onCommit: (value: number | "") => void;
  onCustomCommit?: (value: number | "") => void;
  options: ReadonlyArray<{ label: string; value: number }>;
  signed?: boolean;
  step: number;
  suffix: string;
  value: number | "";
}) {
  const { tx } = usePitchI18n();
  const [forceCustom, setForceCustom] = useState(false);
  const numericValue = typeof value === "number" ? value : Number(value);
  const activePreset = Number.isFinite(numericValue)
    ? matchingOfficeSpacingPreset(numericValue, options.map((option) => option.value))
    : undefined;
  const numericCustomValue = typeof customValue === "number" ? customValue : Number(customValue);
  const hasCustomValue = customValue !== undefined && customValue !== "" && Number.isFinite(numericCustomValue);
  const displayedCustomValue = hasCustomValue
    ? numericCustomValue
    : customDefaultValue ?? numericValue;
  const isCustom = forceCustom || hasCustomValue || activePreset === undefined;
  const selectValue = isCustom ? "custom" : String(activePreset);
  const customLabel = Number.isFinite(displayedCustomValue)
    ? `${tx("Custom")} ${formatSpacingValue(displayedCustomValue, signed)}${customSuffix ? ` ${customSuffix}` : ""}`
    : tx("Custom");

  return (
    <div className="px-1.5 py-1">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <span className="text-[11px] text-neutral-400">{label}</span>
        <span className="relative flex h-8 w-[174px] items-center overflow-hidden rounded-md border border-white/[0.07] bg-black/25 focus-within:border-white/20">
          <select
            aria-label={label}
            className="h-full w-full appearance-none bg-transparent py-0 pl-2.5 pr-7 text-[10px] text-neutral-200 outline-none"
            onChange={(event) => {
              if (event.target.value === "custom") {
                setForceCustom(true);
                return;
              }
              setForceCustom(false);
              onCommit(Number(event.target.value));
            }}
            value={selectValue}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label === String(option.value)
                  ? `${option.label} ${suffix}`
                  : `${option.label} · ${formatSpacingValue(option.value, signed)} ${suffix}`}
              </option>
            ))}
            <option value="custom">{customLabel}</option>
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute right-2 text-neutral-500" size={12} />
        </span>
      </div>
      {isCustom ? (
        <div className="mt-1 flex h-8 items-center justify-end gap-2">
          <span className="text-[9px] text-neutral-600">{tx("Custom value")}</span>
          <span className="flex h-7 w-[92px] items-center overflow-hidden rounded-md bg-black/25">
            <CommitNumberInput
              ariaLabel={label}
              max={customMax ?? (suffix === "pt" ? 100 : 9.99)}
              min={customMin ?? (suffix === "pt" ? -20 : 0.5)}
              onCommit={onCustomCommit}
              step={step}
              value={Number.isFinite(displayedCustomValue) ? displayedCustomValue : ""}
            />
            {customSuffix ? <span className="pr-2 text-[8px] text-neutral-600">{customSuffix}</span> : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function formatSpacingValue(value: number, signed: boolean) {
  if (signed && value > 0) return `+${value}`;
  return String(value);
}

function CommitNumberInput({
  ariaLabel,
  max,
  min,
  onCommit,
  step,
  value
}: {
  ariaLabel: string;
  max: number;
  min: number;
  onCommit: (value: number | "") => void;
  step: number;
  value: number | "";
}) {
  const [draftValue, setDraftValue] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);
  const cancelCommitRef = useRef(false);

  useEffect(() => {
    if (!isFocused) setDraftValue(String(value));
  }, [isFocused, value]);

  return (
    <input
      aria-label={ariaLabel}
      className="h-9 w-full min-w-0 bg-transparent px-1.5 text-center font-mono text-[10px] text-neutral-200 outline-none focus:bg-white/[0.04]"
      inputMode="decimal"
      max={max}
      min={min}
      onBlur={() => {
        if (!cancelCommitRef.current) {
          const nextValue = draftValue.trim();
          const parsedValue = Number(nextValue);
          if (nextValue === "") onCommit("");
          else if (Number.isFinite(parsedValue)) onCommit(parsedValue);
        }
        cancelCommitRef.current = false;
        setIsFocused(false);
      }}
      onChange={(event) => setDraftValue(event.target.value)}
      onFocus={() => setIsFocused(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          cancelCommitRef.current = true;
          setDraftValue(String(value));
          event.currentTarget.blur();
        }
      }}
      step={step}
      type="number"
      value={isFocused ? draftValue : value}
    />
  );
}

function selectedTextIsItalic(block: MotionDocTextBlock, selection: TextSelectionRange, baseItalic: boolean) {
  const styles = textStyleSegments(block.text, block.props).filter(
    (segment) => segment.end > selection.start && segment.start < selection.end
  );
  return styles.length > 0 && styles.every((segment) => (segment.italic ?? baseItalic) === true);
}
