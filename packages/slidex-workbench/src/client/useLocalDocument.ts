import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { summarizeMotionDoc } from "@open-slidex/sdk";

import { localWorkbenchApiPath, migrateDocument, readDocument, saveDocument } from "./api";
import { persistLocalDraft, readLocalDraft, removeLocalDraft } from "./draftStorage";
import { latestRequest } from "./latestRequest";
import { createSourceValidator } from "./sourceValidation";
import type {
  DocumentSnapshot,
  SaveState,
  ValidationResult
} from "./domain";

export const LOCAL_DRAFT_DELAY_MS = 250;
export const SOURCE_VALIDATION_DELAY_MS = 120;
// The Workspace API and its per-deck router can be launched independently of
// the Vite client. Keep the opening state while that local process finishes
// booting instead of briefly presenting a fatal error that a retry resolves.
export const INITIAL_DOCUMENT_READ_RETRY_DELAYS_MS = [250, 750, 1_500, 2_500] as const;

export function scheduleLocalDraftPersist(callback: () => void, delay = LOCAL_DRAFT_DELAY_MS) {
  const timeout = window.setTimeout(callback, delay);
  return () => window.clearTimeout(timeout);
}

export function scheduleSourceValidation(callback: () => void, delay = SOURCE_VALIDATION_DELAY_MS) {
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

export function canBeginExternalDocumentMutation(input: {
  externalMutationInFlight: boolean;
  saveInFlight: boolean;
  saveState: SaveState;
  savedSource: string;
  source: string;
}) {
  return !input.externalMutationInFlight
    && !input.saveInFlight
    && input.saveState === "saved"
    && input.source === input.savedSource;
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
  const sourceFormatRef = useRef<"mdx" | "tsx">("tsx");
  const saveInFlight = useRef(false);
  const externalMutationInFlight = useRef(false);
  const [externalMutationVersion, setExternalMutationVersion] = useState(0);
  const saveStateRef = useRef<SaveState>("loading");
  const validatorRef = useRef<ReturnType<typeof createSourceValidator> | null>(null);
  const validatedRef = useRef<{ source: string; validation: ValidationResult; title: string } | null>(null);
  useEffect(() => {
    const validator = createSourceValidator();
    validatorRef.current = validator;
    return () => { validator.dispose(); validatorRef.current = null; };
  }, []);

  const setState = useCallback((state: SaveState) => {
    saveStateRef.current = state;
    setSaveState(state);
  }, []);

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
    if (validatedRef.current?.source === deferredSource) return;
    let cancelled = false;
    const cancel = scheduleSourceValidation(async () => {
      if (!shouldValidateDeferredSource(projectIdRef.current, deferredSource, sourceRef.current)) return;
      const result = await validatorRef.current?.validate(deferredSource);
      if (cancelled || !result || deferredSource !== sourceRef.current) return;
      validatedRef.current = { source: deferredSource, ...result };
      const nextValidation = result.validation;
      setValidation(nextValidation);
      const dirty = deferredSource !== savedSourceRef.current;
      if (!saveInFlight.current && saveStateRef.current !== "conflict") setState(nextValidation.isValid ? (dirty ? "dirty" : "saved") : "invalid");
    });
    return () => { cancelled = true; cancel(); };
  }, [deferredSource, setState]);

  useEffect(() => {
    if (!projectIdRef.current || source === savedSourceRef.current) {
      if (projectIdRef.current) void removeLocalDraft(projectIdRef.current);
      return;
    }

    return scheduleLocalDraftPersist(() => {
      void persistLocalDraft(projectIdRef.current, {
        baseRevision: revisionRef.current,
        source,
        sourceFormat: sourceFormatRef.current,
        updatedAt: new Date().toISOString()
      });
    });
  }, [source]);

  const acceptSnapshot = useCallback((next: DocumentSnapshot, note = "") => {
    validatedRef.current = { source: next.source, validation: next.validation, title: next.title };
    revisionRef.current = next.revision;
    savedSourceRef.current = next.source;
    sourceRef.current = next.source;
    projectIdRef.current = next.projectId;
    sourceFormatRef.current = sourceFormatOf(next);
    setSnapshot(next);
    setSource(next.source);
    setValidation(next.validation);
    setState("saved");
    setMessage(note);
    void removeLocalDraft(next.projectId);
  }, [setState]);

  const beginExternalMutation = useCallback(() => {
    if (!canBeginExternalDocumentMutation({
      externalMutationInFlight: externalMutationInFlight.current,
      saveInFlight: saveInFlight.current,
      saveState: saveStateRef.current,
      savedSource: savedSourceRef.current,
      source: sourceRef.current
    })) return null;

    externalMutationInFlight.current = true;
    return {
      expectedRevision: revisionRef.current,
      source: sourceRef.current
    };
  }, []);

  const cancelExternalMutation = useCallback(() => {
    if (!externalMutationInFlight.current) return;
    externalMutationInFlight.current = false;
    setExternalMutationVersion((version) => version + 1);
  }, []);

  const acceptExternalMutation = useCallback((
    next: DocumentSnapshot,
    rebaseDraft?: (currentSource: string) => string,
    currentDraftSource = sourceRef.current
  ) => {
    if (!externalMutationInFlight.current) {
      throw new Error("No external document mutation is active.");
    }

    const currentSource = currentDraftSource;
    let nextSource = next.source;
    let rebaseError: unknown;
    if (rebaseDraft && currentSource !== savedSourceRef.current) {
      try {
        nextSource = rebaseDraft(currentSource);
      } catch (error) {
        nextSource = currentSource;
        rebaseError = error;
      }
    }

    externalMutationInFlight.current = false;
    revisionRef.current = next.revision;
    savedSourceRef.current = next.source;
    sourceRef.current = nextSource;
    projectIdRef.current = next.projectId;
    sourceFormatRef.current = sourceFormatOf(next);
    setSnapshot(next);
    setSource(nextSource);
    const nextValidation = nextSource === next.source ? next.validation : validateSource(nextSource);
    setValidation(nextValidation);
    if (rebaseError) {
      setState("conflict");
      setMessage("The HTML source was saved, but newer Canvas edits could not be rebased. Your browser draft was preserved.");
    } else {
      setState(nextValidation.isValid ? (nextSource === next.source ? "saved" : "dirty") : "invalid");
      setMessage("");
    }
    if (nextSource === next.source) {
      void removeLocalDraft(next.projectId);
    }
    setExternalMutationVersion((version) => version + 1);

    if (rebaseError) throw rebaseError;
    return nextSource;
  }, [setState]);

  useEffect(() => {
    let cancelled = false;
    void readInitialDocument(readDocument)
      .then(async (next) => {
        const draft = await readLocalDraft(next.projectId, sourceFormatOf(next));
        if (cancelled) return;
        projectIdRef.current = next.projectId;
        revisionRef.current = next.revision;
        savedSourceRef.current = next.source;
        sourceFormatRef.current = sourceFormatOf(next);
        setSnapshot(next);
        validatedRef.current = { source: next.source, validation: next.validation, title: next.title };
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
        setMessage(error instanceof Error ? error.message : "Could not open presentation.tsx.");
      });
    return () => {
      cancelled = true;
    };
  }, [setState]);

  const commit = useCallback(async (): Promise<DocumentSnapshot | undefined> => {
    const currentSource = sourceRef.current;
    if (saveInFlight.current || externalMutationInFlight.current || saveStateRef.current === "conflict") return undefined;
    if (currentSource === savedSourceRef.current) return snapshot ?? undefined;
    const result = validatedRef.current?.source === currentSource
      ? validatedRef.current
      : await validatorRef.current?.validate(currentSource);
    if (!result || currentSource !== sourceRef.current) return undefined;
    const currentValidation = result.validation;
    setValidation(currentValidation);
    if (
      !currentValidation.isValid ||
      (saveStateRef.current as SaveState) === "conflict" ||
      saveInFlight.current ||
      externalMutationInFlight.current
    ) {
      if (!currentValidation.isValid) setState("invalid");
      return undefined;
    }
    if (currentSource === savedSourceRef.current) {
      setState("saved");
      return snapshot ?? undefined;
    }

    saveInFlight.current = true;
    setState("saving");
    try {
      const next = await saveDocument({
        expectedRevision: revisionRef.current,
        source: currentSource,
        title: result.title
      });
      revisionRef.current = next.revision;
      savedSourceRef.current = next.source;
      setSnapshot(next);
      validatedRef.current = { source: next.source, validation: next.validation, title: next.title };
      void removeLocalDraft(projectIdRef.current);
      if (sourceRef.current === currentSource) {
        sourceRef.current = next.source;
        setSource(next.source);
        setValidation(next.validation);
        setState("saved");
      } else {
        setState("dirty");
      }
      setMessage("");
      return next;
    } catch (error) {
      const apiError = error as Error & { code?: string };
      if (apiError.code === "revision_conflict") {
        setState("conflict");
        setMessage("presentation.tsx changed outside the workbench. Your draft is still local.");
      } else {
        setState("error");
        setMessage(apiError.message);
      }
      return undefined;
    } finally {
      saveInFlight.current = false;
    }
  }, [setState, snapshot]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timeout = window.setTimeout(() => void commit(), 500);
    return () => window.clearTimeout(timeout);
  }, [commit, externalMutationVersion, saveState, source]);

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
    let disposed = false;
    const reads = latestRequest(async () => {
      if (!revisionRef.current) return;
      if (saveInFlight.current || externalMutationInFlight.current) { reads.schedule(undefined); return; }
      const requestedRevision = revisionRef.current;
      await readDocument().then((remote) => {
        if (disposed) return;
        if (saveInFlight.current || externalMutationInFlight.current) { reads.schedule(undefined); return; }
        if (requestedRevision !== revisionRef.current) { reads.schedule(undefined); return; }
        if (remote.revision === revisionRef.current) return;
        if (sourceRef.current === savedSourceRef.current) {
          acceptSnapshot(remote, "Reloaded an external file change.");
          return;
        }
        void persistLocalDraft(projectIdRef.current, {
          baseRevision: revisionRef.current,
          source: sourceRef.current,
          sourceFormat: sourceFormatRef.current,
          updatedAt: new Date().toISOString()
        });
        setState("conflict");
        setMessage("External change detected. Reload the file or keep a copy of this draft.");
      }).catch(() => undefined);
    });
    const onChange = () => reads.schedule(undefined);
    events.addEventListener("document.changed", onChange);
    return () => { disposed = true; reads.dispose(); events.close(); };
  }, [acceptSnapshot, setState]);

  const reload = useCallback(async (note = "Reloaded presentation.tsx.") => {
    if (!snapshot) setState("loading");
    try {
      const next = await (snapshot ? readDocument() : readInitialDocument(readDocument));
      acceptSnapshot(next, note);
      return next;
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not open presentation.tsx.");
      throw error;
    }
  }, [acceptSnapshot, setState, snapshot]);

  const downloadDraft = useCallback(() => {
    const url = URL.createObjectURL(
      new Blob([sourceRef.current], { type: "text/typescript;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "presentation.local-draft.tsx";
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const migrateLegacy = useCallback(async () => {
    if (!snapshot?.requiresMigration) return snapshot ?? undefined;
    setState("saving");
    try {
      const next = await migrateDocument(snapshot.revision);
      acceptSnapshot(next, "Upgraded to presentation.tsx. The original MDX is preserved in .open-slidex/legacy/.");
      return next;
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not upgrade the legacy MDX deck.");
      return undefined;
    }
  }, [acceptSnapshot, setState, snapshot]);

  return {
    acceptExternalMutation,
    applySource,
    beginExternalMutation,
    cancelExternalMutation,
    clearMessage: () => setMessage(""),
    commit,
    downloadDraft,
    message,
    migrateLegacy,
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

function waitForDocumentRetry(delay: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, delay));
}

function sourceFormatOf(snapshot: DocumentSnapshot): "mdx" | "tsx" {
  return snapshot.sourceFormat ?? (snapshot.requiresMigration ? "mdx" : "tsx");
}
