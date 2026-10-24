import { describe, expect, it } from "vitest";
import { exportGedcom } from "../src/io/gedcom-export";
import { importGedcom } from "../src/io/gedcom-import";
import { createEmptyDoc } from "../src/model/schema";
import type { YggdrasilDoc } from "../src/model/types";
import { createSeedDoc } from "../src/store/seed";

const NOW = "2026-10-20T00:00:00.000Z";

function importSeedRoundTrip(): YggdrasilDoc {
	const result = importGedcom(exportGedcom(createSeedDoc()), { now: NOW });
	if (!result.ok) {
		throw new Error(`seed round-trip failed: ${result.errors[0]?.code}`);
	}
	return result.doc;
}

function makeUnicodeDoc(): YggdrasilDoc {
	const doc = createEmptyDoc(NOW);
	doc.persons.push({
		id: "p1",
		names: [
			{
				forename: "Żaneta",
				surname: "Zażółć",
				type: "birth",
			},
		],
		sex: "female",
		events: [
			{
				id: "e1",
				type: "birth",
				date: { year: 1901, month: 3, day: 12 },
				place: { name: "Gdańsk", admin: "Pomorze", country: "Polska" },
				sourceIds: ["s1"],
				note: "Księga urodzeń @parafia@ — wpis nr 17",
			},
		],
		occupations: ["tkaczka"],
		notes: "Notatka z badania: Zażółć gęślą jaźń.",
		tags: [],
		confidence: "unverified",
		researchStatus: "open",
		createdAt: NOW,
		updatedAt: NOW,
	});
	doc.sources.push({
		id: "s1",
		type: "parish-register",
		title: "Księga urodzeń parafii Gdańskiej (próbka testowa)",
		repository: "Archiwum Państwowe",
		reference: "3/12/1901",
		quality: "original",
		transcription: "Strona 12, wpis 17 — imię Żaneta.",
		createdAt: NOW,
		updatedAt: NOW,
	});
	return doc;
}

describe("io/gedcom round-trip", () => {
	it("is stable: import(export(doc1)) deep-equals import(export(seed))", () => {
		const doc1 = importSeedRoundTrip();
		const doc2 = importGedcom(exportGedcom(doc1), { now: NOW });
		expect(doc2.ok).toBe(true);
		if (!doc2.ok) return;
		expect(doc2.doc).toStrictEqual(doc1);
	});

	it("preserves the seed's persons, names, sex, events and relations", () => {
		const doc = importSeedRoundTrip();
		expect(doc.persons).toHaveLength(8);
		expect(doc.families).toHaveLength(3);
		expect(doc.sources).toHaveLength(2);

		const p1 = doc.persons[0];
		expect(p1?.id).toBe("p1");
		expect(p1?.sex).toBe("female");
		expect(p1?.names).toStrictEqual([
			{ forename: "Astrith", surname: "Vindottir", type: "birth" },
			{
				forename: "Astrith",
				surname: "Halgrimsdottir",
				type: "married",
			},
		]);
		expect(p1?.events[0]?.date).toStrictEqual({
			year: 1848,
			qualifier: "about",
		});
		expect(p1?.events[0]?.place).toStrictEqual({
			name: "Fictionalvik",
			country: "Fictland",
		});
		expect(p1?.events[0]?.sourceIds).toStrictEqual(["s1"]);
		expect(p1?.occupations).toStrictEqual(["weaver"]);

		const family = doc.families[0];
		expect(family?.partnerIds).toStrictEqual(["p2", "p1"]);
		expect(family?.childIds).toStrictEqual(["p3", "p4"]);
		expect(family?.type).toBe("marriage");
		expect(family?.start?.date).toStrictEqual({
			year: 1870,
			qualifier: "between",
			yearTo: 1873,
		});
		expect(family?.start?.sourceIds).toStrictEqual(["s2"]);
		expect(family?.note).toContain("marriage year not yet pinned down");

		const s1 = doc.sources[0];
		expect(s1?.type).toBe("parish-register");
		expect(s1?.repository).toBe("Fictional State Archive");
		expect(s1?.reference).toBe("fond 12, opis 3, sprava 44");
		expect(s1?.quality).toBe("derivative");
	});

	it("drops JSON-only fields on purpose (tasks, notes, tags, settings)", () => {
		const doc = importSeedRoundTrip();
		expect(doc.tasks).toStrictEqual([]);
		expect(doc.notes).toStrictEqual([]);
		expect(doc.persons.every((p) => p.tags.length === 0)).toBe(true);
		expect(doc.persons[0]).not.toHaveProperty("living");
	});

	it("export is pure: no mutation and stable output", () => {
		const seed = createSeedDoc();
		const snapshot = structuredClone(seed);
		const first = exportGedcom(seed);
		const second = exportGedcom(seed);
		expect(seed).toStrictEqual(snapshot);
		expect(first).toBe(second);
	});

	it("exports a GEDCOM 5.5.1 skeleton (HEAD, TRLR, CHAR UTF-8)", () => {
		const raw = exportGedcom(createSeedDoc());
		expect(raw.startsWith("0 HEAD\n")).toBe(true);
		expect(raw).toContain("2 VERS 5.5.1");
		expect(raw).toContain("1 CHAR UTF-8");
		expect(raw.trimEnd().endsWith("0 TRLR")).toBe(true);
	});

	it("round-trips an empty document exactly", () => {
		const empty = createEmptyDoc(NOW);
		const result = importGedcom(exportGedcom(empty), { now: NOW });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.doc).toStrictEqual(empty);
	});

	it("round-trips UTF-8 characters, places, notes and source text", () => {
		const doc1 = makeUnicodeDoc();
		const result = importGedcom(exportGedcom(doc1), { now: NOW });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const p1 = result.doc.persons[0];
		expect(p1?.names[0]).toStrictEqual({
			forename: "Żaneta",
			surname: "Zażółć",
			type: "birth",
		});
		expect(p1?.events[0]?.place).toStrictEqual({
			name: "Gdańsk",
			admin: "Pomorze",
			country: "Polska",
		});
		expect(p1?.events[0]?.note).toContain("@parafia@");
		expect(p1?.notes).toBe("Notatka z badania: Zażółć gęślą jaźń.");
		expect(p1?.occupations).toStrictEqual(["tkaczka"]);
		expect(result.doc.sources[0]?.transcription).toContain("Żaneta");
		expect(result.doc.sources[0]?.quality).toBe("original");
	});
});

describe("io/gedcom import gates", () => {
	it("rejects empty input", () => {
		const result = importGedcom("");
		expect(result).toStrictEqual({
			ok: false,
			errors: [{ code: "empty" }],
		});
	});

	it("rejects non-UTF-8 charsets", () => {
		const raw = ["0 HEAD", "1 CHAR ISO-8859-1", "0 TRLR"].join("\n");
		const result = importGedcom(raw);
		expect(result).toStrictEqual({
			ok: false,
			errors: [{ code: "charset" }],
		});
	});

	it("rejects GEDCOM 7 files", () => {
		const raw = [
			"0 HEAD",
			"1 GEDC",
			"2 VERS 7.0.0",
			"1 CHAR UTF-8",
			"0 TRLR",
		].join("\n");
		const result = importGedcom(raw);
		expect(result).toStrictEqual({
			ok: false,
			errors: [{ code: "gedcom7" }],
		});
	});

	it("reports malformed lines with their line numbers", () => {
		const raw = ["0 HEAD", "garbage line without level", "0 TRLR"].join("\n");
		const result = importGedcom(raw);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors[0]).toStrictEqual({
			code: "syntax",
			line: 2,
		});
	});

	it("reports unknown tags and classifies known-ignored tags", () => {
		const raw = [
			"0 HEAD",
			"1 CHAR UTF-8",
			"0 @I1@ INDI",
			"1 NAME Jan /Kowalski/",
			"1 SEX M",
			"1 XYZW mystery tag",
			"1 CHAN",
			"1 FAMS @F9@",
			"0 TRLR",
		].join("\n");
		const result = importGedcom(raw, { now: NOW });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.report.unknownTags).toStrictEqual([{ tag: "XYZW", line: 6 }]);
		const ignored = result.report.ignoredTags.map((entry) => entry.tag);
		expect(ignored).toContain("CHAN");
		expect(ignored).toContain("FAMS");
	});

	it("fills the import report with record counts", () => {
		const result = importGedcom(exportGedcom(createSeedDoc()), { now: NOW });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.report).toMatchObject({
			persons: 8,
			families: 3,
			sources: 2,
		});
	});
});
