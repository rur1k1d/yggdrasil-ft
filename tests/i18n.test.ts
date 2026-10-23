import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import { pl } from "../src/i18n/pl";
import { setLocale, tParams } from "../src/i18n/t";

const KEYS = Object.keys(en) as (keyof typeof en)[];

function placeholders(value: string): string[] {
	return [...value.matchAll(/\{(\w+)\}/g)]
		.map((m) => m[1] ?? "")
		.filter(Boolean)
		.sort();
}

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...sourceFiles(full));
		} else if (/\.(ts|tsx)$/.test(entry.name) && !full.includes("i18n/")) {
			out.push(full);
		}
	}
	return out;
}

describe("i18n", () => {
	it("pl and en dictionaries have identical key sets", () => {
		expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
	});

	it("no dictionary value is empty, padded or whitespace-only", () => {
		for (const key of KEYS) {
			expect(en[key].trim().length, `en ${key}`).toBeGreaterThan(0);
			expect(pl[key].trim().length, `pl ${key}`).toBeGreaterThan(0);
			expect(en[key], `en ${key}`).toBe(en[key].trim());
			expect(pl[key], `pl ${key}`).toBe(pl[key].trim());
		}
	});

	it("placeholders match between en and pl for every key", () => {
		for (const key of KEYS) {
			expect(placeholders(pl[key]), `pl ${key}`).toEqual(placeholders(en[key]));
		}
	});

	it("every literal t()/tParams() key used in src exists in the dictionary", () => {
		const missing: string[] = [];
		for (const file of sourceFiles(path.resolve("src"))) {
			const code = fs.readFileSync(file, "utf8");
			for (const match of code.matchAll(/\b(?:t|tParams)\(\s*"([^"]+)"/g)) {
				const key = match[1];
				if (key && !(key in en)) {
					missing.push(`${path.relative("src", file)}: ${key}`);
				}
			}
		}
		expect(missing).toEqual([]);
	});

	it("tParams fills every declared placeholder", () => {
		for (const locale of ["en", "pl"] as const) {
			setLocale(locale);
			for (const key of KEYS) {
				const names = placeholders(en[key]);
				if (names.length === 0) continue;
				const vars = Object.fromEntries(names.map((n) => [n, "x"]));
				expect(tParams(key, vars), `${locale} ${key}`).not.toMatch(/\{\w+\}/);
			}
		}
		setLocale("en");
	});
});
