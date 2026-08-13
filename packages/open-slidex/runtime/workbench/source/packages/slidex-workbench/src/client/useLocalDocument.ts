import { useCallback, useEffect, useRef, useState } from "react";
import { parseMotionDoc, summarizeMotionDoc } from "@open-slidex/sdk";

import { localWorkbenchApiPath, readDocument, saveDocument } from "./api";
import type {
  DocumentSnapshot,
  SaveState,
  StoredDraft,
  ValidationResult
} from "./domain";

export function useLocalDocument() {
  const [source, setSource] = useState("");
  const [snapshot, setSnapshot] = useState<DocumentSnapshot | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: false,
    issues: []
  });
  const [message, setMessage] = useState("");
  const revisionRef = useRef("");
  const sourceRef = useRef("");
  const savedSourceRef = useRef("");
  const projectIdRef = useRef("");
  const saveInFlight = useRef(false);
  const saveStateRef = useRef<SaveState>("loading");

  const setState = useCallback((state: SaveState) => {
    saveStateRef.current = state;
    setSaveState(state);
  }, []);

  const draftKey = useCallback(
    () => `slidex-workbench:draft:${projectIdRef.current || "opening"}`,
    []
  );

  const storeDraft = useCallback((draft: StoredDraft) => {
    localStorage.setItem(draftKey(), JSON.stringify(draft));
  }, [draftKey]);

  const applySource = useCallback((nextSource: string) => {
    sourceRef.current = nextSource;
    setSource(nextSource);
    const nextValidation = validateSource(nextSource);
    setValidation(nextValidation);
    const dirty = nextSource !== savedSourceRef.current;
    setState(nextValidation.isValid ? (dirty ? "dirty" : "saved") : "invalid");
    if (dirty) {
      storeDraft({
        baseRevision: revisionRef.current,
        source: nextSource,
        updatedAt: new Date().toISOString()
      });
    } else {
      localStorage.removeItem(draftKey());
    }
  }, [draftKey, setState, storeDraft]);

  const acceptSnapshot = useCallback((next: DocumentSnapshot, note = "") => {
    revisionRef.current = next.revision;
    savedSourceRef.current = next.source;
    sourceRef.current = next.source;
    projectIdRef.current = next.projectId;
    setSnapshot(next);
    setSource(next.source);
    setValidation(next.validation);
    setState("saved");
    setMessage(note);
    localStorage.removeItem(`slidex-workbench:draft:${next.projectId}`);
  }, [setState]);

  useEffect(() => {
    let cancelled = false;
    void readDocument()
      .then((next) => {
        if (cancelled) return;
        projectIdRef.current = next.projectId;
        revisionRef.current = next.revision;
        savedSourceRef.current = next.source;
        setSnapshot(next);
        const draft = readDraft(`slidex-workbench:draft:${next.projectId}`);
        if (draft && draft.source !== next.source) {
          sourceRef.current = draft.source;
          setSource(draft.source);
          const draftValidation = validateSource(draft.source);
          setValidation(draftValidation);
          setState(
            draft.baseRevision === next.revision
              ? draftValidation.isValid
                ? "dirty"
                : "invalid"
              : "conflict"
          );
          setMessage(
            draft.baseRevision === next.revision
              ? "Recovered an unsaved browser draft."
              : "Recovered a draft based on an older file revision."
          );
          return;
        }
        sourceRef.current = next.source;
        setSource(next.source);
        setValidation(next.validation);
        setState("saved");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : "Could not open presentation.mdx.");
      });
    return () => {
      cancelled = true;
    };
  }, [setState]);

  const commit = useCallback(async () => {
    const currentSource = sourceRef.current;
    const currentValidation = validateSource(currentSource);
    setValidation(currentValidation);
    if (
      !currentValidation.isValid ||
      saveStateRef.current === "conflict" ||
      saveInFlight.current
    ) {
      if (!currentValidation.isValid) setState("invalid");
      return;
    }
    if (currentSource === savedSourceRef.current) {
      setState("saved");
      return;
    }

    saveInFlight.current = true;
    setState("saving");
    try {
      const next = await saveDocument({
        expectedRevision: revisionRef.current,
        source: currentSource,
        title: parseMotionDoc(currentSource).title
      });
      revisionRef.current = next.revision;
      savedSourceRef.current = next.source;
      setSnapshot(next);
      localStorage.removeItem(draftKey());
      if (sourceRef.current === currentSource) {
        sourceRef.current = next.source;
        setSource(next.source);
        setValidation(next.validation);
        setState("saved");
      } else {
        setState("dirty");
      }
      setMessage("");
    } catch (error) {
      const apiError = error as Error & { code?: string };
      if (apiError.code === "revision_conflict") {
        setState("conflict");
        setMessage("presentation.mdx changed outside the workbench. Your draft is still local.");
      } else {
        setState("error");
        setMessage(apiError.message);
      }
    } finally {
      saveInFlight.current = false;
    }
  }, [draftKey, setState]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timeout = window.setTimeout(() => void commit(), 500);
    return () => window.clearTimeout(timeout);
  }, [commit, saveState, source]);

  useEffect(() => {
    function saveShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void commit();
      }
    }
    window.addEventListener("keydown", saveShortcut);
    return () => window.removeEventListener("keydown", saveShortcut);
  }, [commit]);

  useEffect(() => {
    const events = new EventSource(localWorkbenchApiPath("/api/v1/events"));
    const onChange = () => {
      if (saveInFlight.current || !revisionRef.current) return;
      void readDocument().then((remote) => {
        if (remote.revision === revisionRef.current) return;
        if (sourceRef.current === savedSourceRef.current) {
          acceptSnapshot(remote, "Reloaded an external file change.");
          return;
        }
        storeDraft({
          baseRevision: revisionRef.current,
          source: sourceRef.current,
          updatedAt: new Date().toISOString()
        });
        setState("conflict");
        setMessage("External change detected. Reload the file or keep a copy of this draft.");
      }).catch(() => undefined);
    };
    events.addEventListener("document.changed", onChange);
    return () => events.close();
  }, [acceptSnapshot, setState, storeDraft]);

  const reload = useCallback(async (note = "Reloaded presentation.mdx.") => {
    const next = await readDocument();
    acceptSnapshot(next, note);
    return next;
  }, [acceptSnapshot]);

  const downloadDraft = useCallback(() => {
    const url = URL.createObjectURL(
      new Blob([sourceRef.current], { type: "text/mdx;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "presentation.local-draft.mdx";
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    applySource,
    clearMessage: () => setMessage(""),
    commit,
    downloadDraft,
    message,
    reload,
    saveState,
    snapshot,
    source,
    validation
  };
}

function validateSource(source: string): ValidationResult {
  return (
    summarizeMotionDoc(source) as { validation: ValidationResult }
  ).validation;
}

function readDraft(key: string): StoredDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null") as StoredDraft | null;
    return value &&
      typeof value.baseRevision === "string" &&
      typeof value.source === "string" &&
      typeof value.updatedAt === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}
