import { describe, expect, it } from "vitest";
import { exportJSON, importJSON } from "../src/io/json";
import { createEmptyDoc } from "../src/model/schema";
import { createSeedDoc } from "../src/store/seed";

describe("io/json", () => {
	it("round-trips the seed document: export -> import -> deep-equal", () => {
		const seed = createSeedDoc();
		const restored = importJSON(exportJSON(seed));
		expect(restored).not.toBeNull();
		expect(restored).toStrictEqual(seed);
	});

	it("round-trips an empty document", () => {
		const empty = createEmptyDoc("2026-10-19T00:00:00.000Z");
		expect(importJSON(exportJSON(empty))).toStrictEqual(empty);
	});

	it("export is pure: no mutation and stable output", () => {
		const seed = createSeedDoc();
		const snapshot = structuredClone(seed);
		const first = exportJSON(seed);
		const second = exportJSON(seed);
		expect(seed).toStrictEqual(snapshot);
		expect(first).toBe(second);
	});

	it("export produces pretty-printed valid JSON", () => {
		const raw = exportJSON(createSeedDoc());
		expect(raw.startsWith("{\n")).toBe(true);
		expect((JSON.parse(raw) as { schema: number }).schema).toBe(1);
	});

	it("import rejects garbage, wrong schema and non-object payloads", () => {
		expect(importJSON("")).toBeNull();
		expect(importJSON("{not json")).toBeNull();
		expect(importJSON("[1,2,3]")).toBeNull();
		expect(importJSON('"just a string"')).toBeNull();
		expect(importJSON('{"schema":99,"settings":{},"persons":[]}')).toBeNull();
	});

	it("import drops unknown top-level keys and normalizes settings", () => {
		const raw = JSON.stringify({
			schema: 1,
			updatedAt: "2030-02-02T00:00:00.000Z",
			settings: { locale: "pl", theme: "solarized", legacyFlag: true },
			persons: [],
			families: [],
			sources: [],
			tasks: [],
			notes: [],
			meta: { author: "x" },
		});
		const imported = importJSON(raw);
		expect(imported?.settings.locale).toBe("pl");
		expect(imported?.settings.theme).toBe("dark");
		expect(imported?.settings).not.toHaveProperty("legacyFlag");
		expect(imported).not.toHaveProperty("meta");
		expect(imported?.updatedAt).toBe("2030-02-02T00:00:00.000Z");
	});
});
