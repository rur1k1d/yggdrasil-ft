import type { Family, YggdrasilDoc } from "../model/types";
import { uid } from "./ids";

export type RelationKind = "parent" | "child" | "partner";
export type RelativeRole = "parent" | "child" | "partner";

export type RelationLink = {
	fromId: string;
	toId: string;
	kind: RelationKind;
};

export const RELATIVE_LINK: Record<
	RelativeRole,
	(anchorId: string, targetId: string) => RelationLink
> = {
	parent: (anchorId, targetId) => ({
		fromId: targetId,
		toId: anchorId,
		kind: "parent",
	}),
	child: (anchorId, targetId) => ({
		fromId: anchorId,
		toId: targetId,
		kind: "parent",
	}),
	partner: (anchorId, targetId) => ({
		fromId: anchorId,
		toId: targetId,
		kind: "partner",
	}),
};

export const RELATED_IDS: Record<
	RelativeRole,
	(doc: YggdrasilDoc, personId: string) => string[]
> = {
	parent: parentsOf,
	child: childrenOf,
	partner: partnersOf,
};

export type RelationError =
	| "self"
	| "missing"
	| "duplicate"
	| "cycle"
	| "partnerChild"
	| "hasChildren"
	| "notLinked";

export type RelationResult = { ok: true } | { ok: false; error: RelationError };

function personExists(doc: YggdrasilDoc, id: string): boolean {
	return doc.persons.some((person) => person.id === id);
}

export function parentsOf(doc: YggdrasilDoc, personId: string): string[] {
	const parents = new Set<string>();
	for (const family of doc.families) {
		if (!family.childIds.includes(personId)) continue;
		for (const partnerId of family.partnerIds) parents.add(partnerId);
	}
	parents.delete(personId);
	return [...parents];
}

export function childrenOf(doc: YggdrasilDoc, personId: string): string[] {
	const children = new Set<string>();
	for (const family of doc.families) {
		if (!family.partnerIds.includes(personId)) continue;
		for (const childId of family.childIds) children.add(childId);
	}
	children.delete(personId);
	return [...children];
}

export function partnersOf(doc: YggdrasilDoc, personId: string): string[] {
	const partners = new Set<string>();
	for (const family of doc.families) {
		if (!family.partnerIds.includes(personId)) continue;
		for (const partnerId of family.partnerIds) partners.add(partnerId);
	}
	partners.delete(personId);
	return [...partners];
}

export function isParentOf(
	doc: YggdrasilDoc,
	parentId: string,
	childId: string,
): boolean {
	return doc.families.some(
		(family) =>
			family.partnerIds.includes(parentId) && family.childIds.includes(childId),
	);
}

export function arePartners(
	doc: YggdrasilDoc,
	firstId: string,
	secondId: string,
): boolean {
	return doc.families.some(
		(family) =>
			family.partnerIds.includes(firstId) &&
			family.partnerIds.includes(secondId),
	);
}

export function isAncestor(
	doc: YggdrasilDoc,
	ancestorId: string,
	personId: string,
): boolean {
	if (ancestorId === personId) return false;
	const parents = new Map<string, string[]>();
	for (const family of doc.families) {
		for (const partnerId of family.partnerIds) {
			const list = parents.get(partnerId) ?? [];
			for (const childId of family.childIds) {
				if (!list.includes(childId)) list.push(childId);
			}
			parents.set(partnerId, list);
		}
	}

	const stack = [...(parents.get(ancestorId) ?? [])];
	const seen = new Set<string>();
	while (stack.length > 0) {
		const current = stack.pop();
		if (current === undefined || seen.has(current)) continue;
		if (current === personId) return true;
		seen.add(current);
		stack.push(...(parents.get(current) ?? []));
	}
	return false;
}

export function canLink(
	doc: YggdrasilDoc,
	fromId: string,
	toId: string,
	kind: RelationKind,
): RelationError | null {
	if (!personExists(doc, fromId) || !personExists(doc, toId)) return "missing";
	if (fromId === toId) return "self";

	if (kind === "partner") {
		if (arePartners(doc, fromId, toId)) return "duplicate";
		if (isAncestor(doc, fromId, toId) || isAncestor(doc, toId, fromId)) {
			return "partnerChild";
		}
		return null;
	}

	const parentId = kind === "parent" ? fromId : toId;
	const childId = kind === "parent" ? toId : fromId;
	if (isParentOf(doc, parentId, childId)) return "duplicate";
	if (isAncestor(doc, childId, parentId)) return "cycle";
	return null;
}

export function linkPeople(
	doc: YggdrasilDoc,
	fromId: string,
	toId: string,
	kind: RelationKind,
): RelationResult {
	const error = canLink(doc, fromId, toId, kind);
	if (error) return { ok: false, error };

	if (kind === "partner") {
		doc.families.push(newFamily([fromId, toId], []));
		return { ok: true };
	}

	const parentId = kind === "parent" ? fromId : toId;
	const childId = kind === "parent" ? toId : fromId;
	addParentChild(doc, parentId, childId);
	return { ok: true };
}

function addParentChild(
	doc: YggdrasilDoc,
	parentId: string,
	childId: string,
): void {
	const childFamilies = doc.families.filter((family) =>
		family.childIds.includes(childId),
	);
	if (childFamilies.some((family) => family.partnerIds.includes(parentId))) {
		return;
	}

	const openFamily = childFamilies.find(
		(family) =>
			family.partnerIds.length === 1 && !family.partnerIds.includes(parentId),
	);
	if (openFamily) {
		openFamily.partnerIds.push(parentId);
		return;
	}

	doc.families.push(newFamily([parentId], [childId]));
}

function newFamily(partnerIds: string[], childIds: string[]): Family {
	return {
		id: uid("family"),
		partnerIds,
		childIds,
		type: partnerIds.length > 1 ? "marriage" : "unknown",
		sourceIds: [],
		note: "",
	};
}

export function unlinkPeople(
	doc: YggdrasilDoc,
	fromId: string,
	toId: string,
	kind: RelationKind,
): RelationResult {
	if (!personExists(doc, fromId) || !personExists(doc, toId)) {
		return { ok: false, error: "missing" };
	}
	if (fromId === toId) return { ok: false, error: "self" };

	if (kind === "partner") return unlinkPartners(doc, fromId, toId);

	const parentId = kind === "parent" ? fromId : toId;
	const childId = kind === "parent" ? toId : fromId;
	let removed = false;
	for (const family of doc.families) {
		if (!family.partnerIds.includes(parentId)) continue;
		const index = family.childIds.indexOf(childId);
		if (index < 0) continue;
		family.childIds.splice(index, 1);
		removed = true;
	}
	removeEmptyFamilies(doc);
	return removed ? { ok: true } : { ok: false, error: "notLinked" };
}

function unlinkPartners(
	doc: YggdrasilDoc,
	firstId: string,
	secondId: string,
): RelationResult {
	const shared = doc.families.filter(
		(family) =>
			family.partnerIds.includes(firstId) &&
			family.partnerIds.includes(secondId),
	);
	if (shared.length === 0) return { ok: false, error: "notLinked" };
	if (shared.some((family) => family.childIds.length > 0)) {
		return { ok: false, error: "hasChildren" };
	}

	for (const family of shared) {
		family.partnerIds = family.partnerIds.filter(
			(id) => id !== firstId && id !== secondId,
		);
	}
	removeEmptyFamilies(doc);
	return { ok: true };
}

export function removePerson(doc: YggdrasilDoc, personId: string): void {
	if (!personExists(doc, personId)) return;
	doc.persons = doc.persons.filter((person) => person.id !== personId);
	for (const family of doc.families) {
		family.partnerIds = family.partnerIds.filter((id) => id !== personId);
		family.childIds = family.childIds.filter((id) => id !== personId);
	}
	removeEmptyFamilies(doc);
}

function removeEmptyFamilies(doc: YggdrasilDoc): void {
	doc.families = doc.families.filter(
		(family) =>
			family.partnerIds.length > 0 &&
			(family.childIds.length > 0 || family.partnerIds.length > 1),
	);
}

export function suggestedKindByGeneration(
	fromGeneration: number,
	toGeneration: number,
): RelationKind {
	if (fromGeneration < toGeneration) return "parent";
	if (fromGeneration > toGeneration) return "child";
	return "partner";
}

export function suggestedKind(
	doc: YggdrasilDoc,
	fromId: string,
	toId: string,
	fromGeneration: number | undefined,
	toGeneration: number | undefined,
): RelationKind {
	if (fromGeneration !== undefined && toGeneration !== undefined) {
		return suggestedKindByGeneration(fromGeneration, toGeneration);
	}
	if (isParentOf(doc, fromId, toId)) return "parent";
	if (isParentOf(doc, toId, fromId)) return "child";
	return "partner";
}
