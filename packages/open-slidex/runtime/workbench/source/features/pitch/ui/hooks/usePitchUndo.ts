
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { ensureMotionDocSourceBlockIds } from "@/core/motion-doc/application/motionDocSerialize";

type UsePitchUndoArgs = {
  clearBlockSelection: () => void;
  markProjectDirty: () => void;
  redoStackRef?: MutableRefObject<string[]>;
  setNotice: Dispatch<SetStateAction<string>>;
  setSource: Dispatch<SetStateAction<string>>;
  source: string;
  undoStackRef: MutableRefObject<string[]>;
};

type CommitSourceOptions = {
  captureUndo?: boolean;
};

export function usePitchUndo({
  clearBlockSelection,
  markProjectDirty,
  redoStackRef,
  setNotice,
  setSource,
  source,
  undoStackRef
}: UsePitchUndoArgs) {
  const pushUndoSnapshot = useCallback(
    (snapshot = source) => {
      const undoStack = undoStackRef.current;

      if (undoStack[undoStack.length - 1] === snapshot) {
        return;
      }

      undoStackRef.current = [...undoStack.slice(-79), snapshot];
      if (redoStackRef) redoStackRef.current = [];
    },
    [redoStackRef, source, undoStackRef]
  );

  const commitSource = useCallback(
    (nextSource: string | ((current: string) => string), options: CommitSourceOptions = {}) => {
      setSource((current) => {
        const resolvedSource = ensureMotionDocSourceBlockIds(
          typeof nextSource === "function" ? nextSource(current) : nextSource
        );

        if (resolvedSource !== current && options.captureUndo !== false) {
          pushUndoSnapshot(current);
        }

        return resolvedSource;
      });
      markProjectDirty();
    },
    [markProjectDirty, pushUndoSnapshot, setSource]
  );

  const undoLastChange = useCallback(() => {
    const previousSource = undoStackRef.current.pop();

    if (!previousSource) {
      setNotice("Nothing to undo");
      return;
    }

    if (redoStackRef) redoStackRef.current = [...redoStackRef.current.slice(-79), source];
    setSource(previousSource);
    markProjectDirty();
    clearBlockSelection();
    setNotice("Undo");
  }, [clearBlockSelection, markProjectDirty, redoStackRef, setNotice, setSource, source, undoStackRef]);

  const redoLastChange = useCallback(() => {
    const nextSource = redoStackRef?.current.pop();

    if (!nextSource) {
      setNotice("Nothing to redo");
      return;
    }

    undoStackRef.current = [...undoStackRef.current.slice(-79), source];
    setSource(nextSource);
    markProjectDirty();
    clearBlockSelection();
    setNotice("Redo");
  }, [clearBlockSelection, markProjectDirty, redoStackRef, setNotice, setSource, source, undoStackRef]);

  return {
    commitSource,
    pushUndoSnapshot,
    redoLastChange,
    undoLastChange,
    undoStackRef
  };
}
