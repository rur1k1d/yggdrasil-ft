import type { YggdrasilDoc } from "../model/types";

export type ValidationWarning = {
	key: "cycle" | "impossibleDate" | "duplicate";
	ids: string[];
	messageKey: "warn.cycle" | "warn.impossibleDate" | "warn.duplicate";
};

function getParents(doc: YggdrasilDoc, personId: string): string[] {
	const parents: string[] = [];
	for (const fam of doc.families) {
		if (fam.childIds.includes(personId)) {
			parents.push(...fam.partnerIds);
		}
	}
	return [...new Set(parents)];
}

function hasCycle(doc: YggdrasilDoc): boolean {
	const visited = new Set<string>();
	const stack = new Set<string>();
	const dfs = (id: string): boolean => {
		if (stack.has(id)) return true;
		if (visited.has(id)) return false;
		visited.add(id);
		stack.add(id);
		for (const p of getParents(doc, id)) {
			if (dfs(p)) return true;
		}
		stack.delete(id);
		return false;
	};
	for (const p of doc.persons) {
		if (dfs(p.id)) return true;
	}
	return false;
}

function impossibleDates(doc: YggdrasilDoc): boolean {
	for (const fam of doc.families) {
		const start = fam.start?.date?.year;
		const end = fam.end?.date?.year;
		if (start !== undefined && end !== undefined && end < start) {
			return true;
		}
	}
	for (const p of doc.persons) {
		const birth = p.events.find((e) => e.type === "birth");
		const death = p.events.find((e) => e.type === "death");
		const by = birth?.date?.year;
		const dy = death?.date?.year;
		if (by !== undefined && dy !== undefined && dy < by) {
			return true;
		}
	}
	return false;
}

function duplicates(doc: YggdrasilDoc): boolean {
	const seen = new Map<string, string>();
	for (const p of doc.persons) {
		const first = p.names[0]?.forename?.toLowerCase().trim() || "";
		const last = p.names[0]?.surname?.toLowerCase().trim() || "";
		const birth = p.events.find((e) => e.type === "birth");
		const by = birth?.date?.year?.toString() || "";
		const key = `${first}|${last}|${by}`;
		if (first && last && seen.has(key)) {
			return true;
		}
		if (first && last) seen.set(key, p.id);
	}
	return false;
}

export function validateDoc(doc: YggdrasilDoc): ValidationWarning[] {
	const warnings: ValidationWarning[] = [];
	if (hasCycle(doc)) {
		warnings.push({ key: "cycle", ids: [], messageKey: "warn.cycle" });
	}
	if (impossibleDates(doc)) {
		warnings.push({
			key: "impossibleDate",
			ids: [],
			messageKey: "warn.impossibleDate",
		});
	}
	if (duplicates(doc)) {
		warnings.push({ key: "duplicate", ids: [], messageKey: "warn.duplicate" });
	}
	return warnings;
}
