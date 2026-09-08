
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { ensureMotionDocSourceBlockIds } from "@/core/motion-doc/application/motionDocSerialize";
import { popSourceHistory, pushSourceHistory, type SourceHistoryEntry } from "@/features/pitch/application/sourceHistory";

type UsePitchUndoArgs = {
  clearBlockSelection: () => void;
  markProjectDirty: () => void;
  redoStackRef?: MutableRefObject<SourceHistoryEntry[]>;
  setNotice: Dispatch<SetStateAction<string>>;
  setSource: Dispatch<SetStateAction<string>>;
  source: string;
  undoStackRef: MutableRefObject<SourceHistoryEntry[]>;
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

      const last = undoStack.at(-1);
      if (last && "source" in last && last.source === snapshot) {
        return;
      }

      undoStackRef.current = pushSourceHistory(undoStack, snapshot);
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
    const previousSource = popSourceHistory(undoStackRef.current);

    if (previousSource === undefined) {
      setNotice("Nothing to undo");
      return;
    }

    if (redoStackRef) redoStackRef.current = pushSourceHistory(redoStackRef.current, source);
    setSource(previousSource);
    markProjectDirty();
    clearBlockSelection();
    setNotice("Undo");
  }, [clearBlockSelection, markProjectDirty, redoStackRef, setNotice, setSource, source, undoStackRef]);

  const redoLastChange = useCallback(() => {
    const nextSource = redoStackRef ? popSourceHistory(redoStackRef.current) : undefined;

    if (nextSource === undefined) {
      setNotice("Nothing to redo");
      return;
    }

    undoStackRef.current = pushSourceHistory(undoStackRef.current, source);
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
