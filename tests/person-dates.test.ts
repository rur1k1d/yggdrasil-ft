import { describe, expect, it } from "vitest";
import { lifeYear, lifeYearLabel, setLifeYear } from "../src/lib/person-dates";
import { createEmptyDoc } from "../src/model/schema";
import type { Person } from "../src/model/types";

const NOW = "2026-10-23T12:00:00.000Z";

function person(events: Person["events"] = []): Person {
	return {
		id: "p1",
		names: [{ forename: "Aldric", type: "birth" }],
		sex: "male",
		living: false,
		events,
		notes: "",
		tags: [],
		confidence: "unverified",
		researchStatus: "open",
		createdAt: NOW,
		updatedAt: NOW,
	};
}

describe("person life dates", () => {
	it("both", () => {
		const source = person([
			{ id: "b", type: "birth", date: { year: 1800 }, sourceIds: [] },
			{ id: "d", type: "death", date: { year: 1860 }, sourceIds: [] },
		]);
		expect(lifeYearLabel(source)).toBe("1800-1860");
	});

	it("adds a birth year and keeps the rest of the event", () => {
		const source = person([
			{
				id: "b",
				type: "birth",
				date: { month: 5 },
				place: { name: "Fictionalvik" },
				sourceIds: ["s1"],
			},
		]);
		const next = setLifeYear(source, "birth", 1800);
		expect(lifeYear(next, "birth")).toBe(1800);
		expect(next.events[0]?.date).toEqual({ month: 5, year: 1800 });
		expect(next.events[0]?.place?.name).toBe("Fictionalvik");
	});

	it("removes an empty year-only event", () => {
		const source = person([
			{ id: "b", type: "birth", date: { year: 1800 }, sourceIds: [] },
		]);
		const next = setLifeYear(source, "birth", undefined);
		expect(next.events).toHaveLength(0);
	});

	it("keeps a partial date when the year is cleared", () => {
		const source = person([
			{
				id: "b",
				type: "birth",
				date: { year: 1800, month: 5, qualifier: "about" },
				sourceIds: [],
			},
		]);
		const next = setLifeYear(source, "birth", undefined);
		expect(next.events).toHaveLength(1);
		expect(next.events[0]?.date).toEqual({ month: 5, qualifier: "about" });
	});

	it("does not mutate the original person", () => {
		const source = person();
		const snapshot = structuredClone(source);
		setLifeYear(source, "death", 1900);
		expect(source).toStrictEqual(snapshot);
	});

	it("returns an empty label without dates", () => {
		expect(lifeYearLabel(person())).toBe("");
	});

	it("uses an open range for a birth-only person", () => {
		expect(lifeYearLabel(setLifeYear(person(), "birth", 1800))).toBe("1800-");
	});

	it("keeps an event that has a place but no date", () => {
		const source = person([
			{
				id: "b",
				type: "birth",
				place: { name: "Fictionalvik" },
				sourceIds: [],
			},
		]);
		const next = setLifeYear(source, "birth", undefined);
		expect(next.events).toHaveLength(1);
		expect(next.events[0]?.date).toBeUndefined();
	});
});

describe("empty document fixture", () => {
	it("is valid", () => {
		expect(createEmptyDoc(NOW).persons).toEqual([]);
	});
});
