import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createEmptyDoc,
	DEFAULT_SETTINGS,
	migrate,
	safeParse,
} from "../src/model/schema";
import { createSeedDoc } from "../src/store/seed";
import {
	CHANGE_EVENT,
	doc,
	getDoc,
	isPersisted,
	load,
	replaceDoc,
	STORAGE_KEY,
	type StorageLike,
	save,
	subscribe,
	update,
} from "../src/store/store";

type FakeStorage = StorageLike & {
	dump(): Record<string, string>;
};

function makeStorage(initial?: Record<string, string>): FakeStorage {
	const map = new Map<string, string>(Object.entries(initial ?? {}));
	return {
		getItem: (key) => map.get(key) ?? null,
		setItem: (key, value) => {
			map.set(key, value);
		},
		removeItem: (key) => {
			map.delete(key);
		},
		dump: () => Object.fromEntries(map),
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-10-19T12:00:00.000Z"));
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("model/schema", () => {
	it("creates an empty v1 document with default settings", () => {
		const empty = createEmptyDoc("2026-10-19T00:00:00.000Z");
		expect(empty.schema).toBe(1);
		expect(empty.updatedAt).toBe("2026-10-19T00:00:00.000Z");
		expect(empty.settings).toEqual(DEFAULT_SETTINGS);
		expect(empty.persons).toHaveLength(0);
		expect(empty.families).toHaveLength(0);
		expect(empty.sources).toHaveLength(0);
		expect(empty.tasks).toHaveLength(0);
		expect(empty.notes).toHaveLength(0);
	});

	it("migrate rejects non-objects, wrong schema and missing lists", () => {
		expect(migrate(null)).toBeNull();
		expect(migrate("text")).toBeNull();
		expect(migrate([1, 2])).toBeNull();
		expect(migrate({ schema: 2, settings: {}, persons: [] })).toBeNull();
		expect(
			migrate({ schema: 1, settings: {}, persons: "not-an-array" }),
		).toBeNull();
		expect(migrate({ schema: 1, persons: [] })).toBeNull();
	});

	it("migrate normalizes settings, filling defaults and dropping unknown keys", () => {
		const docMigrated = migrate({
			schema: 1,
			updatedAt: "2026-10-19T00:00:00.000Z",
			settings: { locale: "pl", treeOptions: { layout: "horizontal" } },
			persons: [],
			families: [],
			sources: [],
			tasks: [],
			notes: [],
		});
		expect(docMigrated).not.toBeNull();
		expect(docMigrated?.settings.locale).toBe("pl");
		expect(docMigrated?.settings.theme).toBe("dark");
		expect(docMigrated?.settings.treeDirection).toBe("vertical");
		expect(docMigrated?.settings).not.toHaveProperty("treeOptions");
		expect(Object.keys(docMigrated?.settings ?? {}).sort()).toEqual(
			[
				"dateFormat",
				"locale",
				"privacyMode",
				"researchTemplates",
				"surnameOrder",
				"theme",
				"treeDirection",
			].sort(),
		);
	});

	it("safeParse returns null for invalid JSON and unknown schema", () => {
		expect(safeParse("{nope")).toBeNull();
		expect(safeParse('{"schema":99,"settings":{},"persons":[]}')).toBeNull();
		expect(safeParse(JSON.stringify(createEmptyDoc()))).toEqual(
			createEmptyDoc(),
		);
	});
});

describe("seed", () => {
	it("creates the fictional demo document with consistent counts", () => {
		const seed = createSeedDoc();
		expect(seed.schema).toBe(1);
		expect(seed.persons).toHaveLength(8);
		expect(seed.families).toHaveLength(3);
		expect(seed.sources).toHaveLength(2);
		expect(seed.tasks).toHaveLength(3);
		expect(seed.notes).toHaveLength(1);
		expect(seed.settings.locale).toBe("en");
		expect(seed.persons.every((person) => person.id.length > 0)).toBe(true);
		expect(seed.persons.every((person) => Array.isArray(person.tags))).toBe(
			true,
		);
		expect(
			seed.persons.every((person) =>
				person.events.every((event) => Array.isArray(event.sourceIds)),
			),
		).toBe(true);
	});
});

describe("store", () => {
	it("first load with empty storage persists the seed document", () => {
		const storage = makeStorage();
		vi.stubGlobal("localStorage", storage);
		const loaded = load();
		expect(loaded.persons).toHaveLength(8);
		expect(isPersisted()).toBe(true);
		const stored = storage.dump()[STORAGE_KEY];
		expect(stored).toBeDefined();
		expect(JSON.parse(stored ?? "{}").persons).toHaveLength(8);
	});

	it("load returns a stored document when present", () => {
		const stored = { ...createEmptyDoc("2030-01-01T00:00:00.000Z") };
		stored.settings.locale = "pl";
		const storage = makeStorage({ [STORAGE_KEY]: JSON.stringify(stored) });
		vi.stubGlobal("localStorage", storage);
		const loaded = load();
		expect(loaded.updatedAt).toBe("2030-01-01T00:00:00.000Z");
		expect(loaded.settings.locale).toBe("pl");
		expect(isPersisted()).toBe(true);
	});

	it("corrupt stored data falls back to an empty in-memory doc and keeps the raw value", () => {
		const storage = makeStorage({ [STORAGE_KEY]: "{corrupt" });
		vi.stubGlobal("localStorage", storage);
		const loaded = load();
		expect(loaded.persons).toHaveLength(0);
		expect(isPersisted()).toBe(false);
		expect(storage.dump()[STORAGE_KEY]).toBe("{corrupt");
	});

	it("falls back to an in-memory seed when no storage exists", () => {
		vi.stubGlobal("localStorage", undefined);
		const loaded = load();
		expect(loaded.persons).toHaveLength(8);
		expect(isPersisted()).toBe(false);
	});

	it("update persists changes, bumps updatedAt and isolates the draft", () => {
		const storage = makeStorage();
		vi.stubGlobal("localStorage", storage);
		load();
		const before = getDoc();
		const seen: Array<{ locale: string; updatedAt: string }> = [];
		const unsubscribe = subscribe((next) => {
			seen.push({
				locale: next.settings.locale,
				updatedAt: next.updatedAt,
			});
		});
		const next = update((draft) => {
			draft.settings.locale = "pl";
			draft.notes.push({
				id: "n_new",
				text: "added in test",
				at: "2026-10-19T12:00:00.000Z",
			});
		});
		unsubscribe();
		expect(next.settings.locale).toBe("pl");
		expect(next.updatedAt).toBe("2026-10-19T12:00:00.000Z");
		expect(before.settings.locale).toBe("en");
		expect(before.notes).toHaveLength(1);
		expect(doc.value.notes).toHaveLength(2);
		expect(isPersisted()).toBe(true);
		expect(seen).toHaveLength(1);
		expect(seen[0]?.locale).toBe("pl");
		const roundtrip = JSON.parse(storage.dump()[STORAGE_KEY] ?? "{}");
		expect(roundtrip.settings.locale).toBe("pl");
		expect(roundtrip.notes).toHaveLength(2);
	});

	it("save keeps the document in memory when storage throws", () => {
		vi.stubGlobal("localStorage", {
			getItem: () => null,
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
			removeItem: () => {},
		});
		load();
		const next = update((draft) => {
			draft.settings.theme = "light";
		});
		expect(next.settings.theme).toBe("light");
		expect(doc.value.settings.theme).toBe("light");
		expect(isPersisted()).toBe(false);
	});

	it("emits the yggdrasil-ft:change window event on save", () => {
		const events: Event[] = [];
		vi.stubGlobal("window", {
			dispatchEvent: (event: Event) => {
				events.push(event);
				return true;
			},
			addEventListener: () => {},
			removeEventListener: () => {},
		});
		const storage = makeStorage();
		vi.stubGlobal("localStorage", storage);
		load();
		update((draft) => {
			draft.settings.privacyMode = false;
		});
		const changeEvents = events.filter((event) => event.type === CHANGE_EVENT);
		expect(changeEvents).toHaveLength(1);
	});

	it("replaceDoc swaps the whole document", () => {
		const storage = makeStorage();
		vi.stubGlobal("localStorage", storage);
		load();
		const replacement = createEmptyDoc("2031-05-05T00:00:00.000Z");
		replacement.persons.push({
			id: "px",
			names: [{ forename: "Test", type: "birth" }],
			sex: "unknown",
			events: [],
			notes: "",
			tags: [],
			confidence: "unverified",
			researchStatus: "open",
			createdAt: "2031-05-05T00:00:00.000Z",
			updatedAt: "2031-05-05T00:00:00.000Z",
		});
		replaceDoc(replacement);
		expect(doc.value.persons).toHaveLength(1);
		expect(doc.value.updatedAt).toBe("2031-05-05T00:00:00.000Z");
		const stored = JSON.parse(storage.dump()[STORAGE_KEY] ?? "{}");
		expect(stored.persons[0].id).toBe("px");
	});

	it("save returns false and marks unpersisted when storage is missing entirely", () => {
		vi.stubGlobal("localStorage", undefined);
		load();
		const ok = save(getDoc());
		expect(ok).toBe(false);
		expect(isPersisted()).toBe(false);
	});
});
