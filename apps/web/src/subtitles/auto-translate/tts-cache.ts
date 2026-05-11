import { hashString } from "./random-utils";

const DB_NAME = "cn-vi-auto-tts";
const STORE = "pcm";
const VERSION = 1;

interface CachedEntry {
	pcm: Float32Array;
	sampleRate: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) {
				db.createObjectStore(STORE);
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
	});
	return dbPromise;
}

export function cacheKeyForText(text: string): string {
	return String(hashString(text));
}

export async function readCache({
	text,
}: {
	text: string;
}): Promise<CachedEntry | null> {
	try {
		const db = await openDb();
		return await new Promise<CachedEntry | null>((resolve, reject) => {
			const tx = db.transaction(STORE, "readonly");
			const req = tx.objectStore(STORE).get(cacheKeyForText(text));
			req.onsuccess = () =>
				resolve((req.result as CachedEntry | undefined) ?? null);
			req.onerror = () => reject(req.error);
		});
	} catch {
		return null;
	}
}

export async function writeCache({
	text,
	entry,
}: {
	text: string;
	entry: CachedEntry;
}): Promise<void> {
	try {
		const db = await openDb();
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE, "readwrite");
			const req = tx.objectStore(STORE).put(entry, cacheKeyForText(text));
			req.onsuccess = () => resolve();
			req.onerror = () => reject(req.error);
		});
	} catch {
		// Cache write failure is non-fatal.
	}
}
