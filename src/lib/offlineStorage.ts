/**
 * IndexedDB wrapper for offline document pinning.
 * Database: digicam-offline
 * Stores: pinned-docs (metadata), pinned-blobs (file blobs)
 */

const DB_NAME = 'digicam-offline';
const DB_VERSION = 1;
const DOCS_STORE = 'pinned-docs';
const BLOBS_STORE = 'pinned-blobs';

export interface PinnedDocMeta {
  id: string;
  title: string;
  document_type: string;
  tags: string[];
  ocr_text: string | null;
  confidentiality_level: string;
  pinned_at: string;
  current_version: number;
  /** Document version at the time the blob was pinned (staleness vs server `current_version`). */
  pinned_version?: number;
  department_name?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        db.createObjectStore(DOCS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(BLOBS_STORE)) {
        db.createObjectStore(BLOBS_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function pinDocumentOffline(meta: PinnedDocMeta, blob: Blob): Promise<void> {
  if (meta.confidentiality_level === 'confidential') {
    throw new Error('Cannot pin confidential documents');
  }
  const db = await openDB();
  const tx = db.transaction([DOCS_STORE, BLOBS_STORE], 'readwrite');
  tx.objectStore(DOCS_STORE).put(meta);
  tx.objectStore(BLOBS_STORE).put(blob, meta.id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function unpinDocumentOffline(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([DOCS_STORE, BLOBS_STORE], 'readwrite');
  tx.objectStore(DOCS_STORE).delete(id);
  tx.objectStore(BLOBS_STORE).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPinnedDocs(): Promise<PinnedDocMeta[]> {
  const db = await openDB();
  const tx = db.transaction(DOCS_STORE, 'readonly');
  const store = tx.objectStore(DOCS_STORE);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getPinnedBlob(id: string): Promise<Blob | undefined> {
  const db = await openDB();
  const tx = db.transaction(BLOBS_STORE, 'readonly');
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(BLOBS_STORE).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function isPinnedOffline(id: string): Promise<boolean> {
  const db = await openDB();
  const tx = db.transaction(DOCS_STORE, 'readonly');
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(DOCS_STORE).get(id);
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getPinnedMeta(id: string): Promise<PinnedDocMeta | undefined> {
  const db = await openDB();
  const tx = db.transaction(DOCS_STORE, 'readonly');
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(DOCS_STORE).get(id);
    req.onsuccess = () => resolve(req.result as PinnedDocMeta | undefined);
    req.onerror = () => reject(req.error);
  });
}

export function searchPinned(docs: PinnedDocMeta[], query: string): PinnedDocMeta[] {
  if (!query.trim()) return docs;
  const q = query.toLowerCase();
  return docs.filter(d =>
    d.title.toLowerCase().includes(q) ||
    d.ocr_text?.toLowerCase().includes(q) ||
    d.tags?.some(tag => tag.toLowerCase().includes(q))
  );
}
