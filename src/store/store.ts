import { signal } from "@preact/signals";
import { cloneDoc, createEmptyDoc, migrate, safeParse } from "../model/schema";
import type { YggdrasilDoc } from "../model/types";
import { createSeedDoc } from "./seed";

export const STORAGE_KEY = "yggdrasil_ft_v1";
export const CHANGE_EVENT = "yggdrasil-ft:change";

export type StorageLike = {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
};

export const doc = signal<YggdrasilDoc>(createSeedDoc());
export const persisted = signal<boolean>(false);

const listeners = new Set<(next: YggdrasilDoc) => void>();

export { migrate, safeParse };

function getStorage(): StorageLike | null {
	try {
		if (typeof localStorage === "undefined") {
			return null;
		}
		return localStorage;
	} catch {
		return null;
	}
}

function readRaw(storage: StorageLike): string | null {
	try {
		return storage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

function writeRaw(storage: StorageLike, value: string): boolean {
	try {
		storage.setItem(STORAGE_KEY, value);
		return true;
	} catch {
		return false;
	}
}

function emitChange(): void {
	for (const listener of [...listeners]) {
		listener(doc.value);
	}
	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
	}
}

export function load(): YggdrasilDoc {
	const storage = getStorage();
	if (storage === null) {
		doc.value = createSeedDoc();
		persisted.value = false;
		return doc.value;
	}
	const raw = readRaw(storage);
	if (raw === null) {
		doc.value = createSeedDoc();
		persisted.value = writeRaw(storage, JSON.stringify(doc.value));
		return doc.value;
	}
	const parsed = safeParse(raw);
	if (parsed !== null) {
		doc.value = parsed;
		persisted.value = true;
		return doc.value;
	}
	doc.value = createEmptyDoc();
	persisted.value = false;
	return doc.value;
}

export function save(next: YggdrasilDoc): boolean {
	doc.value = next;
	const storage = getStorage();
	const ok = storage !== null && writeRaw(storage, JSON.stringify(next));
	persisted.value = ok;
	emitChange();
	return ok;
}

export function update(mutator: (draft: YggdrasilDoc) => void): YggdrasilDoc {
	const draft = cloneDoc(doc.value);
	mutator(draft);
	draft.updatedAt = new Date().toISOString();
	save(draft);
	return draft;
}

export function replaceDoc(next: YggdrasilDoc): void {
	save(next);
}

export function subscribe(listener: (next: YggdrasilDoc) => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function getDoc(): YggdrasilDoc {
	return doc.value;
}

export function isPersisted(): boolean {
	return persisted.value;
}
