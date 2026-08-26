import { useEffect, useRef } from "react";
import {
  canvasKeyboardZoomCommand,
  emitCanvasKeyboardIntent,
  isCanvasSpaceKey
} from "@/features/pitch/application/canvasKeyboard";
import { canvasToolFromShortcut, type CanvasTool } from "@/features/pitch/application/canvasTools";
import {
  arrowDelta,
  isArrowKey,
  isEditableShortcutTargetDescriptor
} from "@/features/pitch/application/keyboard";
import { clipboardImageFile } from "@/features/pitch/infrastructure/pitchClipboard";

type UsePitchShortcutsArgs = {
  activeSlideIndex: number;
  blocked: boolean;
  closeCodeEditor: () => void;
  closeExportMenu: () => void;
  closeMobileInspector: () => void;
  closeMobileSidebar: () => void;
  closePresentationPreview: () => void;
  closeTemplateModal: () => void;
  copySelectedBlock: () => void;
  copySlide: (slideIndex: number) => void;
  cutSelectedBlocks: () => void;
  deleteSelectedBlocks: () => void;
  deleteSlide: (slideIndex: number) => void;
  duplicateSelectedBlock: () => void;

  goToNextSlide: () => void;
  goToPreviousSlide: () => void;
  groupSelectedBlocks: () => void;
  isCodeEditorOpen: boolean;
  isExportMenuOpen: boolean;
  isMobileInspectorOpen: boolean;
  isMobileSidebarOpen: boolean;
  isPresentationPreviewOpen: boolean;
  isTemplateModalOpen: boolean;
  navigationOnly?: boolean;
  newProject: () => void;
  nudgeSelectedBlocks: (delta: { x: number; y: number }) => void;
  pasteCopiedBlock: (data?: DataTransfer | null) => void | Promise<void>;
  pasteSlide: (slideIndex: number, data?: DataTransfer | null) => Promise<boolean>;
  pasteImageFile: (file: File) => Promise<void>;
  redoLastChange?: () => void;
  selectedBlockIndex: number | null;
  selectedBlockIndices: number[];
  setActiveCanvasTool: (tool: CanvasTool) => void;
  undoLastChange: () => void;
  ungroupSelectedBlocks: () => void;
};

export function usePitchShortcuts({
  activeSlideIndex,
  blocked,
  closeCodeEditor,
  closeExportMenu,
  closeMobileInspector,
  closeMobileSidebar,
  closePresentationPreview,
  closeTemplateModal,
  copySelectedBlock,
  copySlide,
  cutSelectedBlocks,
  deleteSelectedBlocks,
  deleteSlide,
  duplicateSelectedBlock,
  goToNextSlide,
  goToPreviousSlide,
  groupSelectedBlocks,
  isCodeEditorOpen,
  isExportMenuOpen,
  isMobileInspectorOpen,
  isMobileSidebarOpen,
  isPresentationPreviewOpen,
  isTemplateModalOpen,
  navigationOnly = false,
  nudgeSelectedBlocks,
  pasteCopiedBlock,
  pasteSlide,
  pasteImageFile,
  redoLastChange,
  selectedBlockIndex,
  selectedBlockIndices,
  setActiveCanvasTool,
  undoLastChange,
  ungroupSelectedBlocks
}: UsePitchShortcutsArgs) {
  const temporaryHandActiveRef = useRef(false);

  useEffect(() => {
    function isModalOrPanelOpen() {
      return isCodeEditorOpen || isExportMenuOpen || isTemplateModalOpen || isMobileSidebarOpen || isMobileInspectorOpen || isPresentationPreviewOpen;
    }

    function shouldIgnoreTypingTarget(event: Event) {
      return event.composedPath().some((target) => {
        if (!(target instanceof HTMLElement)) return false;
        return isEditableShortcutTargetDescriptor({
          contentEditable: target.getAttribute("contenteditable"),
          isContentEditable: target.isContentEditable,
          role: target.getAttribute("role"),
          tagName: target.tagName
        });
      });
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (isCanvasSpaceKey(event) && temporaryHandActiveRef.current) {
        event.preventDefault();
        temporaryHandActiveRef.current = false;
        emitCanvasKeyboardIntent({ active: false, kind: "temporary-hand" });
      }
    }

    function handleWindowBlur() {
      if (!temporaryHandActiveRef.current) return;
      temporaryHandActiveRef.current = false;
      emitCanvasKeyboardIntent({ active: false, kind: "temporary-hand" });
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (isCodeEditorOpen) {
          event.preventDefault();
          closeCodeEditor();
          return;
        }
        if (isExportMenuOpen) {
          event.preventDefault();
          closeExportMenu();
          return;
        }
        if (isPresentationPreviewOpen) {
          event.preventDefault();
          closePresentationPreview();
          return;
        }
        if (isTemplateModalOpen) {
          event.preventDefault();
          closeTemplateModal();
          return;
        }
        if (isMobileSidebarOpen) {
          event.preventDefault();
          closeMobileSidebar();
          return;
        }
        if (isMobileInspectorOpen) {
          event.preventDefault();
          closeMobileInspector();
          return;
        }
      }

      if (shouldIgnoreTypingTarget(event)) {
        return;
      }

      if (isModalOrPanelOpen()) {
        return;
      }

      if (blocked && !navigationOnly) return;

      if (isCanvasSpaceKey(event)) {
        event.preventDefault();
        if (!temporaryHandActiveRef.current) {
          temporaryHandActiveRef.current = true;
          emitCanvasKeyboardIntent({ active: true, kind: "temporary-hand" });
        }
        return;
      }

      const zoomCommand = canvasKeyboardZoomCommand(event);
      if (zoomCommand) {
        event.preventDefault();
        emitCanvasKeyboardIntent({ command: zoomCommand, kind: "zoom" });
        return;
      }

      const nextCanvasTool = !event.metaKey && !event.ctrlKey && !event.altKey
        ? canvasToolFromShortcut(event.key)
        : null;

      if (nextCanvasTool) {
        event.preventDefault();
        setActiveCanvasTool(nextCanvasTool);
        return;
      }

      if (navigationOnly) {
        if (event.key === "ArrowLeft" || event.key === "<") {
          event.preventDefault();
          goToPreviousSlide();
        } else if (event.key === "ArrowRight" || event.key === ">") {
          event.preventDefault();
          goToNextSlide();
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        if (selectedBlockIndex === null && selectedBlockIndices.length === 0) copySlide(activeSlideIndex);
        else copySelectedBlock();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "x") {
        event.preventDefault();
        cutSelectedBlocks();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelectedBlock();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "g") {
        event.preventDefault();
        if (event.shiftKey) ungroupSelectedBlocks();
        else groupSelectedBlocks();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undoLastChange();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && event.shiftKey && redoLastChange) {
        event.preventDefault();
        redoLastChange();
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && (selectedBlockIndex !== null || selectedBlockIndices.length > 0)) {
        event.preventDefault();
        deleteSelectedBlocks();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSlide(activeSlideIndex);
        return;
      }

      if (isArrowKey(event.key) && (selectedBlockIndex !== null || selectedBlockIndices.length > 0)) {
        event.preventDefault();
        nudgeSelectedBlocks(arrowDelta(event.key, event.shiftKey, event.altKey));
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "<") {
        event.preventDefault();
        goToPreviousSlide();
      }

      if (event.key === "ArrowRight" || event.key === ">") {
        event.preventDefault();
        goToNextSlide();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    function handlePaste(event: ClipboardEvent) {
      if (blocked || isModalOrPanelOpen()) return;
      const slideThumbnail = event.composedPath().find((target) => (
        target instanceof HTMLElement && target.dataset.slideThumbnailIndex !== undefined
      ));
      if (slideThumbnail instanceof HTMLElement) {
        const slideIndex = Number(slideThumbnail.dataset.slideThumbnailIndex);
        if (Number.isInteger(slideIndex)) {
          event.preventDefault();
          event.stopPropagation();
          void pasteSlide(slideIndex, event.clipboardData);
          return;
        }
      }
      const image = clipboardImageFile(event);
      if (image) {
        event.preventDefault();
        event.stopPropagation();
        void pasteImageFile(image);
        return;
      }
      if (shouldIgnoreTypingTarget(event)) return;
      event.preventDefault();
      if (selectedBlockIndex === null && selectedBlockIndices.length === 0) {
        void pasteSlide(activeSlideIndex, event.clipboardData).then((didPasteSlide) => {
          if (!didPasteSlide) return pasteCopiedBlock(event.clipboardData);
          return undefined;
        });
      } else {
        void pasteCopiedBlock(event.clipboardData);
      }
    }
    window.addEventListener("paste", handlePaste, true);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("paste", handlePaste, true);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [
    activeSlideIndex,
    blocked,
    closeCodeEditor,
    closeExportMenu,
    closeMobileInspector,
    closeMobileSidebar,
    closePresentationPreview,
    closeTemplateModal,
    copySelectedBlock,
    copySlide,
    cutSelectedBlocks,
    deleteSelectedBlocks,
    deleteSlide,
    duplicateSelectedBlock,
    goToNextSlide,
    goToPreviousSlide,
    groupSelectedBlocks,
    isCodeEditorOpen,
    isExportMenuOpen,
    isMobileInspectorOpen,
    isMobileSidebarOpen,
    isPresentationPreviewOpen,
    isTemplateModalOpen,
    navigationOnly,
    nudgeSelectedBlocks,
    pasteCopiedBlock,
    pasteSlide,
    pasteImageFile,
    redoLastChange,
    selectedBlockIndex,
    selectedBlockIndices,
    setActiveCanvasTool,
    undoLastChange,
    ungroupSelectedBlocks
  ]);
}
