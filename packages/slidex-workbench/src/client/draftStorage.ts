import type { StoredDraft } from "./domain";

export const LOCAL_DRAFT_SCHEMA_VERSION = 2 as const;

const databaseName = "open-slidex-workbench";
const databaseVersion = 1;
const storeName = "drafts";

type DraftSourceFormat = StoredDraft["sourceFormat"];
type DraftInput = Omit<StoredDraft, "schemaVersion">;
type IndexedDraftRecord = StoredDraft & { projectId: string };

let databasePromise: Promise<IDBDatabase> | undefined;

export function localDraftKey(projectId: string) {
  return `slidex-workbench:draft:v${LOCAL_DRAFT_SCHEMA_VERSION}:${projectId}`;
}

export function legacyLocalDraftKey(projectId: string) {
  return `slidex-workbench:draft:${projectId}`;
}

export async function readLocalDraft(
  projectId: string,
  expectedFormat: DraftSourceFormat
): Promise<StoredDraft | null> {
  const indexed = await readIndexedDraft(projectId).catch(() => null);
  if (indexed && indexed.sourceFormat === expectedFormat) return withoutProjectId(indexed);

  const versioned = readLocalStorageDraft(localDraftKey(projectId), expectedFormat);
  if (versioned) {
    void persistLocalDraft(projectId, versioned);
    return versioned;
  }

  const legacyKey = legacyLocalDraftKey(projectId);
  const legacy = readLegacyLocalStorageDraft(legacyKey, expectedFormat);
  if (!legacy) return null;
  void persistLocalDraft(projectId, legacy);
  removeLocalStorageItem(legacyKey);
  return legacy;
}

export async function persistLocalDraft(projectId: string, draft: DraftInput) {
  const record: IndexedDraftRecord = {
    ...draft,
    projectId,
    schemaVersion: LOCAL_DRAFT_SCHEMA_VERSION
  };
  try {
    await writeIndexedDraft(record);
    removeLocalStorageItem(localDraftKey(projectId));
    removeLocalStorageItem(legacyLocalDraftKey(projectId));
    return "indexeddb" as const;
  } catch {
    try {
      window.localStorage.setItem(localDraftKey(projectId), JSON.stringify(withoutProjectId(record)));
      return "localstorage" as const;
    } catch {
      return null;
    }
  }
}

export async function removeLocalDraft(projectId: string) {
  await deleteIndexedDraft(projectId).catch(() => undefined);
  removeLocalStorageItem(localDraftKey(projectId));
  removeLocalStorageItem(legacyLocalDraftKey(projectId));
}

export function parseStoredDraft(
  value: unknown,
  expectedFormat: DraftSourceFormat
): StoredDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<StoredDraft>;
  return draft.schemaVersion === LOCAL_DRAFT_SCHEMA_VERSION
    && draft.sourceFormat === expectedFormat
    && typeof draft.baseRevision === "string"
    && typeof draft.source === "string"
    && typeof draft.updatedAt === "string"
    ? draft as StoredDraft
    : null;
}

export function parseLegacyStoredDraft(
  value: unknown,
  expectedFormat: DraftSourceFormat
): StoredDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<StoredDraft>;
  if (
    typeof draft.baseRevision !== "string"
    || typeof draft.source !== "string"
    || typeof draft.updatedAt !== "string"
    || inferSourceFormat(draft.source) !== expectedFormat
  ) return null;
  return {
    baseRevision: draft.baseRevision,
    schemaVersion: LOCAL_DRAFT_SCHEMA_VERSION,
    source: draft.source,
    sourceFormat: expectedFormat,
    updatedAt: draft.updatedAt
  };
}

export function inferSourceFormat(source: string): DraftSourceFormat {
  return /(?:^|\n)\s*(?:import|export)\b|<Presentation\b/.test(source) ? "tsx" : "mdx";
}

function readLocalStorageDraft(key: string, expectedFormat: DraftSourceFormat) {
  try {
    return parseStoredDraft(JSON.parse(window.localStorage.getItem(key) ?? "null"), expectedFormat);
  } catch {
    return null;
  }
}

function readLegacyLocalStorageDraft(key: string, expectedFormat: DraftSourceFormat) {
  try {
    return parseLegacyStoredDraft(JSON.parse(window.localStorage.getItem(key) ?? "null"), expectedFormat);
  } catch {
    return null;
  }
}

function removeLocalStorageItem(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // The filesystem autosave remains available when browser storage is blocked.
  }
}

async function openDraftDatabase() {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB is unavailable.");
  databasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName, { keyPath: "projectId" });
    };
    request.onerror = () => reject(request.error ?? new Error("Could not open draft storage."));
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      resolve(database);
    };
  }).catch((error) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

async function readIndexedDraft(projectId: string) {
  const database = await openDraftDatabase();
  return new Promise<IndexedDraftRecord | null>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(projectId);
    request.onerror = () => reject(request.error ?? new Error("Could not read the local draft."));
    request.onsuccess = () => {
      const result = request.result as Partial<IndexedDraftRecord> | undefined;
      if (
        !result
        || result.projectId !== projectId
        || (result.sourceFormat !== "mdx" && result.sourceFormat !== "tsx")
      ) {
        resolve(null);
        return;
      }
      resolve(parseStoredDraft(result, result.sourceFormat) ? result as IndexedDraftRecord : null);
    };
  });
}

async function writeIndexedDraft(record: IndexedDraftRecord) {
  const database = await openDraftDatabase();
  await completeTransaction(database, "readwrite", (store) => store.put(record));
}

async function deleteIndexedDraft(projectId: string) {
  const database = await openDraftDatabase();
  await completeTransaction(database, "readwrite", (store) => store.delete(projectId));
}

function completeTransaction(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  mutate: (store: IDBObjectStore) => IDBRequest
) {
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    mutate(transaction.objectStore(storeName));
    transaction.onabort = () => reject(transaction.error ?? new Error("Draft storage transaction was aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("Draft storage transaction failed."));
    transaction.oncomplete = () => resolve();
  });
}

function withoutProjectId(record: IndexedDraftRecord): StoredDraft {
  const { projectId: _projectId, ...draft } = record;
  return draft;
}
