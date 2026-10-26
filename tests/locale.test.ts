import { afterEach, describe, expect, it, vi } from "vitest";

function memoryStorage() {
	const store = new Map<string, string>();
	return {
		store,
		storage: {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => {
				store.set(key, value);
			},
			removeItem: (key: string) => {
				store.delete(key);
			},
		},
	};
}

describe("locale preference", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it("defaults to English without a stored choice", async () => {
		vi.stubGlobal("localStorage", undefined);
		vi.resetModules();
		const { getLocale } = await import("../src/i18n/t");
		expect(getLocale()).toBe("en");
	});

	it("hydrates a stored Polish choice", async () => {
		const { storage } = memoryStorage();
		vi.stubGlobal("localStorage", storage);
		storage.setItem("yggdrasil_locale_v1", "pl");
		vi.resetModules();
		const { getLocale } = await import("../src/i18n/t");
		expect(getLocale()).toBe("pl");
	});

	it("persists the language choice", async () => {
		const { store, storage } = memoryStorage();
		vi.stubGlobal("localStorage", storage);
		vi.resetModules();
		const { setLocale, toggleLocale } = await import("../src/i18n/t");
		setLocale("pl");
		expect(store.get("yggdrasil_locale_v1")).toBe("pl");
		toggleLocale();
		expect(store.get("yggdrasil_locale_v1")).toBe("en");
	});
});
