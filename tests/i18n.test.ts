import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import { pl } from "../src/i18n/pl";

describe("i18n", () => {
	it("pl and en dictionaries have identical key sets", () => {
		expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
	});

	it("no dictionary value is empty or whitespace-only", () => {
		const values = [...Object.values(en), ...Object.values(pl)];
		expect(values.every((value) => value.trim().length > 0)).toBe(true);
	});
});
