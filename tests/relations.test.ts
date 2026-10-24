import { describe, expect, it } from "vitest";
import {
	arePartners,
	childrenOf,
	isAncestor,
	linkPeople,
	parentsOf,
	partnersOf,
	removePerson,
	suggestedKind,
	unlinkPeople,
} from "../src/lib/relations";
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

function docWith(...people: Person[]): YggdrasilDoc {
	const doc = createEmptyDoc(NOW);
	doc.persons = people;
	return doc;
}

function threeGenerations(): YggdrasilDoc {
	const doc = docWith(
		person("p1", "Aldric", 1800, "male"),
		person("p2", "Bera", 1804, "female"),
		person("p3", "Cedric", 1830, "male"),
		person("p4", "Dagny", 1832, "female"),
		person("p5", "Eirik", 1860, "male"),
		person("p6", "Freya", 1862, "female"),
	);
	doc.families = [
		family("f1", ["p1", "p2"], ["p3"]),
		family("f2", ["p3", "p4"], ["p5", "p6"]),
	];
	return doc;
}

describe("relations", () => {
	it("links a parent into an existing single-parent family", () => {
		const doc = threeGenerations();
		doc.families = [family("f2", ["p3"], ["p5"])];

		expect(linkPeople(doc, "p4", "p5", "parent")).toEqual({ ok: true });
		expect(parentsOf(doc, "p5").sort()).toEqual(["p3", "p4"]);
		expect(doc.families).toHaveLength(1);
		expect(doc.families[0]?.partnerIds).toEqual(["p3", "p4"]);
	});

	it("links a child through the child direction", () => {
		const doc = docWith(
			person("p1", "Aldric", 1800),
			person("p2", "Bera", 1830),
		);

		expect(linkPeople(doc, "p2", "p1", "child")).toEqual({ ok: true });
		expect(parentsOf(doc, "p2")).toEqual(["p1"]);
		expect(childrenOf(doc, "p1")).toEqual(["p2"]);
	});

	it("rejects duplicate, self, missing and cyclic links", () => {
		const doc = threeGenerations();
		expect(linkPeople(doc, "p1", "p3", "parent")).toEqual({
			ok: false,
			error: "duplicate",
		});
		expect(linkPeople(doc, "p1", "p1", "partner")).toEqual({
			ok: false,
			error: "self",
		});
		expect(linkPeople(doc, "ghost", "p1", "parent")).toEqual({
			ok: false,
			error: "missing",
		});
		expect(linkPeople(doc, "p5", "p1", "parent")).toEqual({
			ok: false,
			error: "cycle",
		});
	});

	it("rejects a partner who is a direct ancestor", () => {
		const doc = threeGenerations();
		expect(linkPeople(doc, "p1", "p5", "partner")).toEqual({
			ok: false,
			error: "partnerChild",
		});
		expect(arePartners(doc, "p1", "p5")).toBe(false);
	});

	it("keeps a couple when their last child link is removed", () => {
		const doc = threeGenerations();

		expect(unlinkPeople(doc, "p3", "p6", "parent")).toEqual({ ok: true });
		expect(parentsOf(doc, "p6")).toEqual([]);
		expect(arePartners(doc, "p3", "p4")).toBe(true);
		expect(partnersOf(doc, "p3")).toEqual(["p4"]);
	});

	it("removes a single-parent family when its only child link is removed", () => {
		const doc = docWith(
			person("p1", "Aldric", 1800),
			person("p2", "Bera", 1830),
		);
		doc.families = [family("f1", ["p1"], ["p2"])];

		expect(unlinkPeople(doc, "p1", "p2", "parent")).toEqual({ ok: true });
		expect(doc.families).toHaveLength(0);
	});

	it("protects a partnership that still has children", () => {
		const doc = threeGenerations();
		expect(unlinkPeople(doc, "p3", "p4", "partner")).toEqual({
			ok: false,
			error: "hasChildren",
		});
		expect(arePartners(doc, "p3", "p4")).toBe(true);
	});

	it("removes a person without deleting unrelated families", () => {
		const doc = threeGenerations();

		removePerson(doc, "p4");
		expect(doc.persons.map((entry) => entry.id)).not.toContain("p4");
		expect(parentsOf(doc, "p5")).toEqual(["p3"]);
		expect(arePartners(doc, "p1", "p2")).toBe(true);
	});

	it("detects ancestry through several generations", () => {
		const doc = threeGenerations();
		expect(isAncestor(doc, "p1", "p5")).toBe(true);
		expect(isAncestor(doc, "p5", "p1")).toBe(false);
	});

	it("suggests a relation kind from generations", () => {
		const doc = threeGenerations();
		expect(suggestedKind(doc, "p1", "p3", -1, 0)).toBe("parent");
		expect(suggestedKind(doc, "p3", "p1", 0, -1)).toBe("child");
		expect(suggestedKind(doc, "p3", "p4", 0, 0)).toBe("partner");
	});
});
