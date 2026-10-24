import { describe, expect, it } from "vitest";
import { layoutTree, pickHead } from "../src/lib/tree-layout";
import { createEmptyDoc } from "../src/model/schema";
import type { Family, Person, YggdrasilDoc } from "../src/model/types";

const NOW = "2026-10-23T12:00:00.000Z";

function person(
	id: string,
	forename: string,
	birth: number,
	sex: Person["sex"] = "unknown",
): Person {
	return {
		id,
		names: [{ forename, type: "birth" }],
		sex,
		living: false,
		events: [
			{ id: `e-${id}`, type: "birth", date: { year: birth }, sourceIds: [] },
		],
		notes: "",
		tags: [],
		confidence: "unverified",
		researchStatus: "open",
		createdAt: NOW,
		updatedAt: NOW,
	};
}

function family(id: string, partnerIds: string[], childIds: string[]): Family {
	return {
		id,
		partnerIds,
		childIds,
		type: partnerIds.length > 1 ? "marriage" : "unknown",
		sourceIds: [],
	};
}

function sampleDoc(): YggdrasilDoc {
	const doc = createEmptyDoc(NOW);
	doc.persons = [
		person("p1", "Aldric", 1800, "male"),
		person("p2", "Bera", 1804, "female"),
		person("p3", "Cedric", 1830, "male"),
		person("p4", "Dagny", 1832, "female"),
		person("p5", "Eirik", 1860, "male"),
		person("p6", "Freya", 1862, "female"),
		person("p7", "Gunnar", 1834, "male"),
	];
	doc.families = [
		family("f1", ["p1", "p2"], ["p3", "p7"]),
		family("f2", ["p3", "p4"], ["p5", "p6"]),
	];
	return doc;
}

function cardFor(layout: ReturnType<typeof layoutTree>, personId: string) {
	return layout.cards.find((card) => card.personId === personId);
}

describe("tree layout", () => {
	it("places a chosen head at generation zero with relatives around it", () => {
		const layout = layoutTree(sampleDoc(), "p5");

		expect(layout.focusId).toBe("p5");
		expect(layout.cards).toHaveLength(7);
		expect(layout.unlinkedIds).toEqual([]);
		expect(layout.minGeneration).toBe(-2);
		expect(layout.maxGeneration).toBe(0);

		const head = cardFor(layout, "p5");
		const father = cardFor(layout, "p3");
		const grandmother = cardFor(layout, "p2");
		const sibling = cardFor(layout, "p6");
		expect(head?.generation).toBe(0);
		expect(father?.generation).toBe(-1);
		expect(grandmother?.generation).toBe(-2);
		expect(sibling?.generation).toBe(0);
		expect(father && head ? father.y < head.y : false).toBe(true);
		expect(grandmother && father ? grandmother.y < father.y : false).toBe(true);
		expect(sibling?.y).toBe(head?.y);
	});

	it("keeps partners side by side and generates both edge kinds", () => {
		const layout = layoutTree(sampleDoc(), "p5");
		const father = cardFor(layout, "p3");
		const mother = cardFor(layout, "p4");

		expect(father?.y).toBe(mother?.y);
		expect(father && mother ? father.x < mother.x : false).toBe(true);
		expect(layout.edges.filter((edge) => edge.kind === "partner").length).toBe(
			2,
		);
		expect(layout.edges.filter((edge) => edge.kind === "child").length).toBe(4);
		expect(layout.edges.every((edge) => edge.path.length > 0)).toBe(true);
		expect(layout.width).toBeGreaterThan(0);
		expect(layout.height).toBeGreaterThan(0);
	});

	it("returns an empty layout for an empty document", () => {
		const layout = layoutTree(createEmptyDoc(NOW));
		expect(layout.focusId).toBeNull();
		expect(layout.cards).toEqual([]);
		expect(layout.width).toBe(0);
		expect(layout.height).toBe(0);
	});

	it("separates people who are not connected to the head", () => {
		const doc = sampleDoc();
		doc.persons.push(person("p8", "Hilda", 1900, "female"));

		const full = layoutTree(doc, "p5");
		expect(full.unlinkedIds).toEqual(["p8"]);
		expect(full.cards).toHaveLength(7);

		const isolated = layoutTree(doc, "p8");
		expect(isolated.focusId).toBe("p8");
		expect(isolated.cards.map((card) => card.personId)).toEqual(["p8"]);
		expect(isolated.unlinkedIds).toHaveLength(7);
	});

	it("falls back to the oldest root in the largest component", () => {
		const doc = sampleDoc();
		doc.persons.push(person("p8", "Hilda", 1900, "female"));
		expect(pickHead(doc)).toBe("p1");
		expect(pickHead(doc, "p3")).toBe("p3");
		expect(pickHead(doc, "missing")).toBe("p1");
	});

	it("survives an existing ancestry cycle", () => {
		const doc = createEmptyDoc(NOW);
		doc.persons = [person("p1", "Aldric", 1800), person("p2", "Bera", 1830)];
		doc.families = [family("f1", ["p1"], ["p2"]), family("f2", ["p2"], ["p1"])];

		const layout = layoutTree(doc, "p1");
		expect(layout.cards).toHaveLength(2);
		expect(layout.focusId).toBe("p1");
	});
});
