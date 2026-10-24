import type { Person, YggdrasilDoc } from "../model/types";
import { lifeYear } from "./person-dates";

export const CARD_WIDTH = 184;
export const CARD_HEIGHT = 96;
const PARTNER_GAP = 16;
const UNIT_GAP = 44;
const ROW_GAP = 104;
const PADDING = 56;
const FOCUS_PASSES = 6;

export type TreeCard = {
	personId: string;
	unitId: string;
	generation: number;
	x: number;
	y: number;
	width: number;
	height: number;
};

export type TreeEdge = {
	id: string;
	kind: "partner" | "child";
	path: string;
};

export type TreeLayout = {
	focusId: string | null;
	cards: TreeCard[];
	edges: TreeEdge[];
	unlinkedIds: string[];
	width: number;
	height: number;
	minGeneration: number;
	maxGeneration: number;
};

type Unit = {
	id: string;
	members: string[];
	generation: number;
	x: number;
	width: number;
};

function displayName(person: Person): string {
	const name = person.names[0];
	const value = `${name?.forename ?? ""} ${name?.surname ?? ""}`.trim();
	return value || person.id;
}

function comparePersons(a: Person, b: Person): number {
	const birthA = lifeYear(a, "birth") ?? Number.POSITIVE_INFINITY;
	const birthB = lifeYear(b, "birth") ?? Number.POSITIVE_INFINITY;
	if (birthA !== birthB) return birthA - birthB;
	if (a.sex !== b.sex) {
		if (a.sex === "male") return -1;
		if (b.sex === "male") return 1;
	}
	return displayName(a).localeCompare(displayName(b));
}

function familyNeighbours(doc: YggdrasilDoc): Map<string, Set<string>> {
	const neighbours = new Map<string, Set<string>>();
	const connect = (a: string, b: string) => {
		if (a === b) return;
		const listA = neighbours.get(a) ?? new Set<string>();
		listA.add(b);
		neighbours.set(a, listA);
		const listB = neighbours.get(b) ?? new Set<string>();
		listB.add(a);
		neighbours.set(b, listB);
	};
	for (const family of doc.families) {
		const members = [...family.partnerIds, ...family.childIds];
		for (let i = 0; i < members.length; i += 1) {
			for (let j = i + 1; j < members.length; j += 1) {
				const first = members[i];
				const second = members[j];
				if (first && second) connect(first, second);
			}
		}
	}
	return neighbours;
}

function components(doc: YggdrasilDoc): string[][] {
	const neighbours = familyNeighbours(doc);
	const byId = new Map(doc.persons.map((person) => [person.id, person]));
	const seen = new Set<string>();
	const result: string[][] = [];

	for (const person of doc.persons) {
		if (seen.has(person.id)) continue;
		const stack = [person.id];
		const component: string[] = [];
		seen.add(person.id);
		while (stack.length > 0) {
			const current = stack.pop();
			if (current === undefined) continue;
			component.push(current);
			for (const next of neighbours.get(current) ?? []) {
				if (seen.has(next)) continue;
				seen.add(next);
				stack.push(next);
			}
		}
		component.sort((a, b) => {
			const first = byId.get(a);
			const second = byId.get(b);
			if (!first || !second) return 0;
			return comparePersons(first, second);
		});
		result.push(component);
	}

	result.sort((a, b) => b.length - a.length);
	return result;
}

export function pickHead(
	doc: YggdrasilDoc,
	preferredId?: string,
): string | null {
	if (preferredId && doc.persons.some((person) => person.id === preferredId)) {
		return preferredId;
	}
	const groups = components(doc);
	const largest = groups[0];
	if (!largest || largest.length === 0) return null;
	const byId = new Map(doc.persons.map((person) => [person.id, person]));
	const parentIds = new Set<string>();
	for (const family of doc.families) {
		for (const childId of family.childIds) {
			if (family.partnerIds.length > 0) parentIds.add(childId);
		}
	}
	const candidates = largest
		.map((id) => byId.get(id))
		.filter((person): person is Person => Boolean(person))
		.filter((person) => !parentIds.has(person.id));
	const pool =
		candidates.length > 0
			? candidates
			: largest
					.map((id) => byId.get(id))
					.filter((person): person is Person => Boolean(person));
	pool.sort(comparePersons);
	return pool[0]?.id ?? largest[0] ?? null;
}

function assignGenerations(
	doc: YggdrasilDoc,
	focusId: string,
): Map<string, number> {
	const byId = new Map(doc.persons.map((person) => [person.id, person]));
	const generations = new Map<string, number>();
	const parents = new Map<string, Set<string>>();
	const children = new Map<string, Set<string>>();
	const partners = new Map<string, Set<string>>();

	const add = (map: Map<string, Set<string>>, key: string, value: string) => {
		if (key === value) return;
		const set = map.get(key) ?? new Set<string>();
		set.add(value);
		map.set(key, set);
	};

	for (const family of doc.families) {
		for (const partnerId of family.partnerIds) {
			for (const otherId of family.partnerIds) {
				add(partners, partnerId, otherId);
			}
			for (const childId of family.childIds) {
				add(children, partnerId, childId);
				add(parents, childId, partnerId);
			}
		}
	}

	if (!byId.has(focusId)) return generations;
	generations.set(focusId, 0);
	const queue: string[] = [];
	let head = 0;
	queue.push(focusId);
	const processed = new Set<string>();
	while (head < queue.length) {
		const current = queue[head++];
		if (current === undefined || processed.has(current)) continue;
		processed.add(current);
		const generation = generations.get(current) ?? 0;
		for (const partnerId of partners.get(current) ?? []) {
			if (processed.has(partnerId)) continue;
			if (!generations.has(partnerId)) {
				generations.set(partnerId, generation);
				queue.push(partnerId);
			}
		}
		for (const parentId of parents.get(current) ?? []) {
			if (processed.has(parentId)) continue;
			if (!generations.has(parentId)) {
				generations.set(parentId, generation - 1);
				queue.push(parentId);
			}
		}
		for (const childId of children.get(current) ?? []) {
			if (processed.has(childId)) continue;
			if (!generations.has(childId)) {
				generations.set(childId, generation + 1);
				queue.push(childId);
			}
		}
	}
	return generations;
}

function buildUnits(
	doc: YggdrasilDoc,
	generations: Map<string, number>,
): { units: Unit[]; unitByPerson: Map<string, Unit> } {
	const parent = new Map<string, string>();
	const find = (id: string): string => {
		let current = id;
		while (
			parent.get(current) !== undefined &&
			parent.get(current) !== current
		) {
			current = parent.get(current) ?? current;
		}
		return current;
	};
	const union = (a: string, b: string) => {
		const rootA = find(a);
		const rootB = find(b);
		if (rootA !== rootB) parent.set(rootA, rootB);
	};

	for (const personId of generations.keys()) parent.set(personId, personId);
	for (const family of doc.families) {
		const visible = family.partnerIds.filter((id) => generations.has(id));
		const first = visible[0];
		if (!first) continue;
		for (const id of visible.slice(1)) union(first, id);
	}

	const membersByRoot = new Map<string, string[]>();
	for (const personId of generations.keys()) {
		const root = find(personId);
		const members = membersByRoot.get(root) ?? [];
		members.push(personId);
		membersByRoot.set(root, members);
	}

	const byId = new Map(doc.persons.map((person) => [person.id, person]));
	const units: Unit[] = [];
	const unitByPerson = new Map<string, Unit>();

	for (const [root, members] of membersByRoot) {
		members.sort((a, b) => {
			const first = byId.get(a);
			const second = byId.get(b);
			if (!first || !second) return 0;
			return comparePersons(first, second);
		});
		const generation = generations.get(members[0] ?? "") ?? 0;
		const width =
			members.length * CARD_WIDTH +
			Math.max(0, members.length - 1) * PARTNER_GAP;
		const unit: Unit = {
			id: root,
			members,
			generation,
			x: 0,
			width,
		};
		units.push(unit);
		for (const member of members) unitByPerson.set(member, unit);
	}

	units.sort((a, b) => {
		if (a.generation !== b.generation) return a.generation - b.generation;
		const first = byId.get(a.members[0] ?? "");
		const second = byId.get(b.members[0] ?? "");
		if (!first || !second) return 0;
		return comparePersons(first, second);
	});
	return { units, unitByPerson };
}

function layoutUnits(
	units: Unit[],
	unitByPerson: Map<string, Unit>,
	focusId: string,
	doc: YggdrasilDoc,
): void {
	const rows = new Map<number, Unit[]>();
	for (const unit of units) {
		const row = rows.get(unit.generation) ?? [];
		row.push(unit);
		rows.set(unit.generation, row);
	}
	const generations = [...rows.keys()].sort((a, b) => a - b);
	for (const generation of generations) {
		let x = 0;
		for (const unit of rows.get(generation) ?? []) {
			unit.x = x;
			x += unit.width + UNIT_GAP;
		}
	}

	const focusUnit = unitByPerson.get(focusId);
	const normalize = () => {
		if (!focusUnit) return;
		const center = focusUnit.x + focusUnit.width / 2;
		for (const unit of units) unit.x -= center;
	};
	normalize();

	const adjacency = new Map<string, Set<string>>();
	for (const family of doc.families) {
		const parentUnits = new Set<Unit>();
		for (const id of family.partnerIds) {
			const unit = unitByPerson.get(id);
			if (unit) parentUnits.add(unit);
		}
		const childUnits = new Set<Unit>();
		for (const id of family.childIds) {
			const unit = unitByPerson.get(id);
			if (unit) childUnits.add(unit);
		}
		for (const parentUnit of parentUnits) {
			for (const childUnit of childUnits) {
				if (parentUnit === childUnit) continue;
				const parentNeighbours =
					adjacency.get(parentUnit.id) ?? new Set<string>();
				parentNeighbours.add(childUnit.id);
				adjacency.set(parentUnit.id, parentNeighbours);
				const childNeighbours =
					adjacency.get(childUnit.id) ?? new Set<string>();
				childNeighbours.add(parentUnit.id);
				adjacency.set(childUnit.id, childNeighbours);
			}
		}
	}

	for (let pass = 0; pass < FOCUS_PASSES; pass += 1) {
		const direction = pass % 2 === 0 ? generations : [...generations].reverse();
		for (const generation of direction) {
			const row = rows.get(generation) ?? [];
			const desired = new Map<Unit, number>();
			for (const unit of row) {
				const neighbours = [...(adjacency.get(unit.id) ?? [])]
					.map((id) => units.find((candidate) => candidate.id === id))
					.filter((candidate): candidate is Unit => Boolean(candidate))
					.filter((candidate) => candidate.generation !== unit.generation);
				if (neighbours.length === 0) continue;
				const average =
					neighbours.reduce(
						(sum, candidate) => sum + candidate.x + candidate.width / 2,
						0,
					) / neighbours.length;
				desired.set(unit, average);
			}
			if (desired.size === 0) continue;
			row.sort((a, b) => {
				const first = desired.get(a) ?? a.x;
				const second = desired.get(b) ?? b.x;
				if (first !== second) return first - second;
				return a.id.localeCompare(b.id);
			});
			const totalWidth = row.reduce(
				(sum, unit, index) => sum + unit.width + (index > 0 ? UNIT_GAP : 0),
				0,
			);
			const anchor =
				row.reduce((sum, unit) => sum + (desired.get(unit) ?? 0), 0) /
				desired.size;
			let cursor = anchor - totalWidth / 2;
			for (const unit of row) {
				unit.x = cursor;
				cursor += unit.width + UNIT_GAP;
			}
		}
		normalize();
	}
}

export function layoutTree(
	doc: YggdrasilDoc,
	preferredHeadId?: string,
): TreeLayout {
	const focusId = pickHead(doc, preferredHeadId);
	if (!focusId) {
		return {
			focusId: null,
			cards: [],
			edges: [],
			unlinkedIds: doc.persons.map((person) => person.id),
			width: 0,
			height: 0,
			minGeneration: 0,
			maxGeneration: 0,
		};
	}

	const generations = assignGenerations(doc, focusId);
	const { units: allUnits, unitByPerson } = buildUnits(doc, generations);
	const componentIds = new Set(generations.keys());
	const units = allUnits.filter((unit) =>
		unit.members.some((id) => componentIds.has(id)),
	);
	layoutUnits(units, unitByPerson, focusId, doc);

	const visibleUnits = units.filter((unit) =>
		unit.members.some((id) => componentIds.has(id)),
	);
	const minGeneration = Math.min(...generations.values());
	const maxGeneration = Math.max(...generations.values());
	const rowCount = maxGeneration - minGeneration + 1;
	const rawCards: TreeCard[] = [];
	for (const unit of visibleUnits) {
		unit.members.forEach((personId, index) => {
			rawCards.push({
				personId,
				unitId: unit.id,
				generation: unit.generation,
				x: unit.x + index * (CARD_WIDTH + PARTNER_GAP),
				y: (unit.generation - minGeneration) * (CARD_HEIGHT + ROW_GAP),
				width: CARD_WIDTH,
				height: CARD_HEIGHT,
			});
		});
	}

	const minX = Math.min(...rawCards.map((card) => card.x));
	const maxX = Math.max(...rawCards.map((card) => card.x + card.width));
	const cards = rawCards.map((card) => ({
		...card,
		x: card.x - minX + PADDING,
		y: card.y + PADDING,
	}));
	const cardById = new Map(cards.map((card) => [card.personId, card]));

	const edges: TreeEdge[] = [];
	for (const unit of visibleUnits) {
		for (let index = 1; index < unit.members.length; index += 1) {
			const leftId = unit.members[index - 1];
			const rightId = unit.members[index];
			const left = leftId ? cardById.get(leftId) : undefined;
			const right = rightId ? cardById.get(rightId) : undefined;
			if (!left || !right) continue;
			const y = left.y + left.height / 2;
			edges.push({
				id: `partner-${left.personId}-${right.personId}`,
				kind: "partner",
				path: `M ${left.x + left.width} ${y} H ${right.x}`,
			});
		}
	}

	for (const family of doc.families) {
		const parents = family.partnerIds
			.map((id) => cardById.get(id))
			.filter((card): card is TreeCard => Boolean(card));
		const children = family.childIds
			.map((id) => cardById.get(id))
			.filter((card): card is TreeCard => Boolean(card));
		if (parents.length === 0 || children.length === 0) continue;
		const parentX =
			parents.reduce((sum, card) => sum + card.x + card.width / 2, 0) /
			parents.length;
		const parentBottom = Math.max(
			...parents.map((card) => card.y + card.height),
		);
		const childTop = Math.min(...children.map((card) => card.y));
		if (childTop <= parentBottom) continue;
		const busY = parentBottom + (childTop - parentBottom) * 0.45;
		for (const child of children) {
			const childX = child.x + child.width / 2;
			edges.push({
				id: `child-${family.id}-${child.personId}`,
				kind: "child",
				path: `M ${parentX} ${parentBottom} V ${busY} H ${childX} V ${child.y}`,
			});
		}
	}

	const width = maxX - minX + PADDING * 2;
	const height =
		rowCount * CARD_HEIGHT + (rowCount - 1) * ROW_GAP + PADDING * 2;
	const unlinkedIds = doc.persons
		.filter((person) => !componentIds.has(person.id))
		.map((person) => person.id);

	return {
		focusId,
		cards,
		edges,
		unlinkedIds,
		width,
		height,
		minGeneration,
		maxGeneration,
	};
}
