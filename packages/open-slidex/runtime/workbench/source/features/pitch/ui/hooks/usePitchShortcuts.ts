import { useEffect, useRef } from "react";
import { canvasToolFromShortcut, type CanvasTool } from "@/features/pitch/application/canvasTools";
import {
  arrowDelta,
  isArrowKey,
  isEditableShortcutTargetDescriptor
} from "@/features/pitch/application/keyboard";
import { clipboardImageFile } from "@/features/pitch/infrastructure/pitchClipboard";

type UsePitchShortcutsArgs = {
  activeCanvasTool: CanvasTool;
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
  activeCanvasTool,
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
  const canvasToolRef = useRef<CanvasTool>(activeCanvasTool);
  const spaceRestoreToolRef = useRef<CanvasTool | null>(null);

  useEffect(() => {
    canvasToolRef.current = activeCanvasTool;
  }, [activeCanvasTool]);

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

    function restoreSpaceTool() {
      const restoreTool = spaceRestoreToolRef.current;

      if (!restoreTool) {
        return;
      }

      spaceRestoreToolRef.current = null;
      canvasToolRef.current = restoreTool;
      setActiveCanvasTool(restoreTool);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (!isSpaceKey(event)) {
        return;
      }

      if (spaceRestoreToolRef.current) {
        event.preventDefault();
      }

      restoreSpaceTool();
    }

    function handleWindowBlur() {
      restoreSpaceTool();
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

      if (blocked) return;

      if (isSpaceKey(event)) {
        event.preventDefault();

        if (!spaceRestoreToolRef.current) {
          const currentTool = canvasToolRef.current;
          spaceRestoreToolRef.current = currentTool;
          canvasToolRef.current = "hand";
          setActiveCanvasTool("hand");
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

      const nextCanvasTool = !event.metaKey && !event.ctrlKey && !event.altKey
        ? canvasToolFromShortcut(event.key)
        : null;

      if (nextCanvasTool) {
        event.preventDefault();
        canvasToolRef.current = nextCanvasTool;
        setActiveCanvasTool(nextCanvasTool);
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

function isSpaceKey(event: KeyboardEvent) {
  return event.code === "Space" || event.key === " " || event.key === "Spacebar";
}
