import type { Design } from "../model/types";
import { loadDesign, clearSavedDesign } from "../persistence/storage";
import { makeId } from "../model/defaults";

// Local, offline design library backed by IndexedDB (Phase 5b). Replaces the
// single-slot localStorage autosave with a multi-design store. No backend.

export interface DesignRecord {
  id: string;
  name: string;
  createdAt: number;
  modifiedAt: number;
  thumbnail?: string; // small PNG data URL (Part A captureView)
  design: Design;
}

const DB_NAME = "home-design";
const DB_VERSION = 1;
const STORE = "designs";
const MIGRATED_FLAG = "home-design:library-migrated:v1";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// Run a transaction and resolve with `result` once it commits.
async function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => void,
  result: () => T,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    fn(store);
    tx.oncomplete = () => resolve(result());
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function reqValue<T>(makeReq: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = makeReq(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

// All records, most recently modified first.
export async function listDesigns(): Promise<DesignRecord[]> {
  const all = await reqValue<DesignRecord[]>((s) => s.getAll());
  return (all ?? []).sort((a, b) => b.modifiedAt - a.modifiedAt);
}

export async function getDesignRecord(
  id: string,
): Promise<DesignRecord | undefined> {
  return reqValue<DesignRecord | undefined>((s) => s.get(id));
}

export async function putDesignRecord(record: DesignRecord): Promise<void> {
  await run("readwrite", (s) => s.put(record), () => undefined);
}

export async function deleteDesignRecord(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id), () => undefined);
}

// Create a brand-new record from a design (a fresh id + timestamps).
export async function createDesignRecord(
  design: Design,
  name?: string,
): Promise<DesignRecord> {
  const now = Date.now();
  const record: DesignRecord = {
    id: makeId("design"),
    name: name ?? design.name,
    createdAt: now,
    modifiedAt: now,
    design,
  };
  await putDesignRecord(record);
  return record;
}

// Upsert the open design into its record: keep `createdAt`, bump `modifiedAt`,
// mirror the design's name, and refresh the thumbnail when a fresh one is given
// (undefined keeps the previous one — thumbnails refresh on save, not keystroke).
export async function saveOpenDesign(
  id: string,
  design: Design,
  thumbnail?: string,
): Promise<DesignRecord> {
  const existing = await getDesignRecord(id);
  const now = Date.now();
  const record: DesignRecord = {
    id,
    name: design.name,
    createdAt: existing?.createdAt ?? now,
    modifiedAt: now,
    thumbnail: thumbnail ?? existing?.thumbnail,
    design,
  };
  await putDesignRecord(record);
  return record;
}

// Copy a record under a fresh id + " (copy)" name.
export async function duplicateDesignRecord(
  id: string,
): Promise<DesignRecord | undefined> {
  const src = await getDesignRecord(id);
  if (!src) return undefined;
  const copyName = `${src.name} (copy)`;
  const design = { ...structuredClone(src.design), name: copyName };
  const now = Date.now();
  const record: DesignRecord = {
    id: makeId("design"),
    name: copyName,
    createdAt: now,
    modifiedAt: now,
    thumbnail: src.thumbnail,
    design,
  };
  await putDesignRecord(record);
  return record;
}

// Rename a record (and the design it holds) in place.
export async function renameDesignRecord(
  id: string,
  name: string,
): Promise<void> {
  const src = await getDesignRecord(id);
  if (!src) return;
  src.name = name;
  src.design = { ...src.design, name };
  src.modifiedAt = Date.now();
  await putDesignRecord(src);
}

// One-time import of the legacy single-slot localStorage autosave into the
// library, so an existing design is never lost when the library lands.
export async function migrateLegacyAutosave(): Promise<void> {
  try {
    if (localStorage.getItem(MIGRATED_FLAG)) return;
  } catch {
    return; // localStorage unavailable — nothing to migrate
  }
  const legacy = loadDesign();
  if (legacy) {
    await createDesignRecord(legacy);
    clearSavedDesign();
  }
  try {
    localStorage.setItem(MIGRATED_FLAG, "1");
  } catch {
    // ignore (private mode / quota)
  }
}
