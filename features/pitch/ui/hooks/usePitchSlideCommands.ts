
import { useRef, type Dispatch, type SetStateAction } from "react";
import { insertMotionDocSlideSource } from "@/core/motion-doc/application/motionDocSourceEditor";
import { normalizeShaderFrame } from "@/core/motion-doc/application/shaderFrame";
import { numberValue } from "@/core/motion-doc/domain/frame";
import { parseMotionDoc } from "@/core/motion-doc/domain/motionDocParser";
import type { MotionDocProps, MotionDocScene } from "@/core/motion-doc/domain/motionDocTypes";
import { autoLinkSharedMorphScenes, setSharedMorphReturnLinkScenes, unlinkSharedMorphGroupScenes } from "@/core/motion-doc/domain/sharedMorph";
import {
  appendBlankSlideSource,
  applyAllSlidesStyleSource,
  applySlideStyleSource,
  deleteSlideSource,
  duplicateSlideSource,
  extendSharedMorphGroupSource,
  moveSlideIntoSharedMorphGroupSource,
  moveSlideOutOfSharedMorphGroupSource,
  preparePastedSlideSource,
  replaceSlideSource,
  insertBlankSlideSource,
  insertLayoutSlideSource,
  insertTemplateSlideSource,
  reorderSlideSource,
  type InsertSlidePlacement
} from "@/features/pitch/application/motionDocCommands";
import { applyTemplateDeckToSource } from "@/features/pitch/application/templateDeckApplication";
import {
  createMotionDocSlideClipboardPacket,
  readMotionDocSlideClipboardData,
  readMotionDocSlideSystemClipboard,
  writeMotionDocSlideSystemClipboard
} from "@/features/pitch/infrastructure/motionDocSlideClipboard";

type UsePitchSlideCommandsArgs = {
  activeSlide: MotionDocScene | undefined;
  activeSlideIndex: number;
  commitSource: (
    nextSource: string | ((current: string) => string),
    options?: { captureUndo?: boolean }
  ) => void;
  scenes: MotionDocScene[];
  selectSingleBlock: (index: number | null) => void;
  setActiveSlideIndex: Dispatch<SetStateAction<number>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setSelectedTemplateId: Dispatch<SetStateAction<string>>;
  source: string;
};

export function usePitchSlideCommands({
  activeSlide,
  activeSlideIndex,
  commitSource,
  scenes,
  selectSingleBlock,
  setActiveSlideIndex,
  setNotice,
  setSelectedTemplateId,
  source
}: UsePitchSlideCommandsArgs) {
  const copiedSlideSourceRef = useRef<string | null>(null);
  function updateAllSlidesStyle(updates: MotionDocProps) {
    if (scenes.length === 0) return;
    commitSource((current) => applyAllSlidesStyleSource(current, scenes, updates));
    setNotice("Theme applied to all slides");
  }

  function addSlide() {
    commitSource((current) => appendBlankSlideSource(current, activeSlideIndex));
    setActiveSlideIndex(scenes.length);
    selectSingleBlock(null);
    setNotice("Blank slide added");
  }

  function addSlideFromTemplate(templateId: string, templateSlideSource: string) {
    commitSource((current) => insertTemplateSlideSource(
      current,
      activeSlideIndex,
      templateSlideSource
    ));
    setSelectedTemplateId(templateId);
    setActiveSlideIndex(Math.min(activeSlideIndex + 1, scenes.length));
    selectSingleBlock(null);
    setNotice("Template slide added");
  }

  function addAllSlidesFromTemplate(templateId: string, templateSlideSources: string[]) {
    if (templateSlideSources.length === 0) return;
    commitSource((current) => templateSlideSources.reduce(
      (nextSource, templateSlideSource, offset) => insertTemplateSlideSource(
        nextSource,
        activeSlideIndex + offset,
        templateSlideSource
      ),
      current
    ));
    setSelectedTemplateId(templateId);
    setActiveSlideIndex(activeSlideIndex + templateSlideSources.length);
    selectSingleBlock(null);
    setNotice("All template slides added");
  }

  function insertSlideNearActive(placement: InsertSlidePlacement) {
    commitSource((current) => insertBlankSlideSource(current, activeSlideIndex, placement));
    setActiveSlideIndex(placement === "before" ? activeSlideIndex : activeSlideIndex + 1);
    selectSingleBlock(null);
    setNotice(placement === "before" ? "Slide inserted before" : "Slide inserted after");
  }

  function addSlideWithLayout(layoutSource: string, layoutId: string) {
    commitSource((current) => insertLayoutSlideSource(current, activeSlideIndex, layoutSource, layoutId));
    setActiveSlideIndex(Math.min(activeSlideIndex + 1, scenes.length));
    selectSingleBlock(null);
    setNotice("Slide added with layout");
  }

  function applyTemplateDeck(templateId: string, templateSlideSources: string[]) {
    if (scenes.length === 0 || templateSlideSources.length === 0) return;
    commitSource((current) => applyTemplateDeckToSource(current, templateSlideSources));
    setSelectedTemplateId(templateId);
    selectSingleBlock(null);
    setNotice("Template applied to all slides");
  }

  function deleteSlide(slideIndex: number) {
    if (scenes.length <= 1) {
      setNotice("Cannot delete last slide");
      return;
    }
    commitSource((current) => deleteSlideSource(current, slideIndex));
    setActiveSlideIndex((current) => Math.min(current, scenes.length - 2));
    setNotice("Slide deleted");
  }

  function duplicateSlide(slideIndex: number) {
    if (!scenes[slideIndex]) return;
    commitSource((current) => duplicateSlideSource(current, slideIndex));
    setActiveSlideIndex(Math.min(slideIndex + 1, scenes.length));
    selectSingleBlock(null);
    setNotice("Slide duplicated");
  }

  function extendSharedMorphGroup(endIndex: number) {
    if (!scenes[endIndex]) return;
    commitSource((current) => extendSharedMorphGroupSource(current, endIndex));
    setActiveSlideIndex(Math.min(endIndex + 1, scenes.length));
    selectSingleBlock(null);
    setNotice("Morph slide added");
  }

  function copySlide(slideIndex: number) {
    const packet = createMotionDocSlideClipboardPacket(source, slideIndex);
    if (!packet) return;

    copiedSlideSourceRef.current = packet.slideSource;
    void writeMotionDocSlideSystemClipboard(packet);
    setNotice("Slide copied");
  }

  async function pasteSlide(slideIndex: number, data?: DataTransfer | null) {
    const packet = readMotionDocSlideClipboardData(data) ?? await readMotionDocSlideSystemClipboard();
    const slideSource = packet?.slideSource ?? copiedSlideSourceRef.current;
    if (!slideSource) return false;

    commitSource((current) => insertMotionDocSlideSource(current, slideIndex, preparePastedSlideSource(slideSource), "after"));
    setActiveSlideIndex(Math.min(slideIndex + 1, scenes.length));
    selectSingleBlock(null);
    setNotice("Slide pasted");
    return true;
  }

  function reorderSlide(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= scenes.length || toIndex >= scenes.length) return;
    commitSource((current) => reorderSlideSource(current, fromIndex, toIndex));
    setActiveSlideIndex((current) => {
      if (current === fromIndex) return toIndex;
      if (current > fromIndex && current <= toIndex) return current - 1;
      if (current < fromIndex && current >= toIndex) return current + 1;
      return current;
    });
  }

  function moveSlideIntoMorphGroup(slideIndex: number, groupStartIndex: number) {
    const nextSource = moveSlideIntoSharedMorphGroupSource(source, slideIndex, groupStartIndex);
    if (nextSource === source) return;
    const groupEndIndex = morphGroupEndIndex(scenes, groupStartIndex);
    const nextActiveSlideIndex = slideIndex < groupStartIndex
      ? groupEndIndex
      : groupEndIndex + 1;
    commitSource(nextSource);
    setActiveSlideIndex(nextActiveSlideIndex);
    selectSingleBlock(null);
    setNotice("Slide added to Morph");
  }

  function moveSlideOutOfMorphGroup(slideIndex: number, targetSlideIndex: number) {
    const nextSource = moveSlideOutOfSharedMorphGroupSource(source, slideIndex, targetSlideIndex);
    if (nextSource === source) return;
    commitSource(nextSource);
    setActiveSlideIndex((current) => current === slideIndex ? Math.min(targetSlideIndex, scenes.length - 1) : current);
    selectSingleBlock(null);
    setNotice("Slide removed from Morph");
  }

  function updateActiveSlideStyle(updates: MotionDocProps) {
    updateSlideStyle(activeSlideIndex, updates);
  }

  function updateSlideStyle(slideIndex: number, updates: MotionDocProps) {
    const slide = scenes[slideIndex];
    if (!slide) return;
    commitSource((current) => {
      const styledSource = applySlideStyleSource(current, slide, slideIndex, updates);
      if (updates.slideTransition !== "morph") return styledSource;
      const parsed = parseMotionDoc(styledSource);
      const sourceSlide = parsed.scenes[slideIndex];
      const targetSlide = parsed.scenes[slideIndex + 1];
      if (!sourceSlide || !targetSlide) return styledSource;
      const [linkedSource, linkedTarget] = autoLinkSharedMorphScenes(sourceSlide, targetSlide);
      return replaceSlideSource(replaceSlideSource(styledSource, slideIndex, linkedSource), slideIndex + 1, linkedTarget);
    });
    setNotice("Slide style updated");
  }

  function unlinkSharedMorphGroup(startIndex: number, endIndex: number) {
    commitSource((current) => {
      const parsed = parseMotionDoc(current);
      const unlinked = unlinkSharedMorphGroupScenes(parsed.scenes, startIndex, endIndex);
      return unlinked.reduce((next, scene, sceneIndex) => (
        sceneIndex >= startIndex && sceneIndex <= endIndex
          ? replaceSlideSource(next, sceneIndex, scene)
          : next
      ), current);
    });
    setNotice("Morph group unlinked");
  }

  function setSharedMorphReturnLink(groupStartIndex: number, detailSlideIndex: number, enabled: boolean) {
    commitSource((current) => {
      const parsed = parseMotionDoc(current);
      const linked = setSharedMorphReturnLinkScenes(parsed.scenes, groupStartIndex, detailSlideIndex, enabled);
      return [groupStartIndex, detailSlideIndex].reduce((next, sceneIndex) => {
        const scene = linked[sceneIndex];
        return scene ? replaceSlideSource(next, sceneIndex, scene) : next;
      }, current);
    });
    setNotice(enabled ? "Return Morph enabled" : "Return Morph disabled");
  }

  function persistActiveSlideShaderFrame(frame: number) {
    if (!activeSlide || numberValue(activeSlide.props.shaderSpeed) !== 0) return;

    const capturedFrame = normalizeShaderFrame(frame);
    const storedFrame = normalizeShaderFrame(numberValue(activeSlide.props.shaderFrame) ?? 0);
    if (capturedFrame === storedFrame) return;

    commitSource(
      (current) => applySlideStyleSource(current, activeSlide, activeSlideIndex, { shaderFrame: capturedFrame }),
      { captureUndo: false }
    );
  }

  function goToPreviousSlide() {
    setActiveSlideIndex((current) => Math.max(current - 1, 0));
  }

  function goToNextSlide() {
    setActiveSlideIndex((current) => Math.min(current + 1, Math.max(scenes.length - 1, 0)));
  }

  return {
    addAllSlidesFromTemplate,
    addSlide,
    addSlideFromTemplate,
    addSlideWithLayout,
    applyTemplateDeck,
    copySlide,
    deleteSlide,
    duplicateSlide,
    extendSharedMorphGroup,
    goToNextSlide,
    goToPreviousSlide,
    insertSlideNearActive,
    moveSlideIntoMorphGroup,
    moveSlideOutOfMorphGroup,
    pasteSlide,
    persistActiveSlideShaderFrame,
    reorderSlide,
    setSharedMorphReturnLink,
    unlinkSharedMorphGroup,
    updateActiveSlideStyle,
    updateSlideStyle,
    updateAllSlidesStyle
  };
}

function morphGroupEndIndex(scenes: MotionDocScene[], startIndex: number) {
  let endIndex = startIndex + 1;
  while (endIndex < scenes.length - 1 && scenes[endIndex]?.props.slideTransition === "morph") endIndex += 1;
  return endIndex;
}
