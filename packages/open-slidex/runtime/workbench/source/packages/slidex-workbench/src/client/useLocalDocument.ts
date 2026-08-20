import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { parseMotionDoc, summarizeMotionDoc } from "@open-slidex/sdk";

import { localWorkbenchApiPath, readDocument, saveDocument } from "./api";
import type {
  DocumentSnapshot,
  SaveState,
  StoredDraft,
  ValidationResult
} from "./domain";

export const LOCAL_DRAFT_DELAY_MS = 250;
// The Workspace API and its per-deck router can be launched independently of
// the Vite client. Keep the opening state while that local process finishes
// booting instead of briefly presenting a fatal error that a retry resolves.
export const INITIAL_DOCUMENT_READ_RETRY_DELAYS_MS = [250, 750, 1_500, 2_500] as const;

export function scheduleLocalDraftPersist(callback: () => void, delay = LOCAL_DRAFT_DELAY_MS) {
  const timeout = window.setTimeout(callback, delay);
  return () => window.clearTimeout(timeout);
}

export function shouldValidateDeferredSource(
  projectId: string,
  deferredSource: string,
  currentSource: string
) {
  return Boolean(projectId) && deferredSource === currentSource;
}

export async function readInitialDocument(
  read: () => Promise<DocumentSnapshot>,
  wait: (delay: number) => Promise<void> = waitForDocumentRetry
) {
  let lastError: unknown;
  for (const delay of [...INITIAL_DOCUMENT_READ_RETRY_DELAYS_MS, 0]) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      if (delay > 0) await wait(delay);
    }
  }
  throw lastError;
}

export function useLocalDocument() {
  const [source, setSource] = useState("");
  const [snapshot, setSnapshot] = useState<DocumentSnapshot | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: false,
    issues: []
  });
  const [message, setMessage] = useState("");
  const deferredSource = useDeferredValue(source);
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
    const dirty = nextSource !== savedSourceRef.current;
    // Source state must remain synchronous for controlled editors. Validation
    // and draft serialization run from deferred effects below instead.
    setState(dirty ? "dirty" : "saved");
  }, [setState]);

  useEffect(() => {
    if (!shouldValidateDeferredSource(projectIdRef.current, deferredSource, sourceRef.current)) return;
    const nextValidation = validateSource(deferredSource);
    setValidation(nextValidation);
    const dirty = deferredSource !== savedSourceRef.current;
    setState(nextValidation.isValid ? (dirty ? "dirty" : "saved") : "invalid");
  }, [deferredSource, setState]);

  useEffect(() => {
    if (!projectIdRef.current || source === savedSourceRef.current) {
      localStorage.removeItem(draftKey());
      return;
    }

    return scheduleLocalDraftPersist(() => {
      storeDraft({
        baseRevision: revisionRef.current,
        source,
        updatedAt: new Date().toISOString()
      });
    });
  }, [draftKey, source, storeDraft]);

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
    void readInitialDocument(readDocument)
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
        setMessage("");
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
    if (!snapshot) setState("loading");
    try {
      const next = await (snapshot ? readDocument() : readInitialDocument(readDocument));
      acceptSnapshot(next, note);
      return next;
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not open presentation.mdx.");
      throw error;
    }
  }, [acceptSnapshot, setState, snapshot]);

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

function waitForDocumentRetry(delay: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, delay));
}
