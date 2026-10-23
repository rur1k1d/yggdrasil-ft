import { createEmptyDoc } from "../model/schema";
import type {
	Event,
	Family,
	NamePart,
	Person,
	Sex,
	Source,
	SourceType,
	YggdrasilDoc,
} from "../model/types";
import {
	GEDCOM_TO_SEX,
	KNOWN_IGNORED_TAGS,
	NAME_TYPES,
	parseGedcomDate,
	parseGedcomPlace,
	QUAY_TO_QUALITY,
	TAG_TO_EVENT,
	unescapeGedcomText,
} from "./gedcom-shared";

export type GedcomImportErrorCode = "empty" | "syntax" | "charset" | "gedcom7";

export type GedcomImportError = {
	code: GedcomImportErrorCode;
	line?: number;
};

export type SkippedTag = {
	tag: string;
	line: number;
};

export type GedcomImportReport = {
	persons: number;
	families: number;
	sources: number;
	unknownTags: SkippedTag[];
	ignoredTags: SkippedTag[];
};

export type GedcomImportResult =
	| { ok: true; doc: YggdrasilDoc; report: GedcomImportReport }
	| { ok: false; errors: GedcomImportError[] };

export type GedcomImportOptions = {
	now?: string;
};

type RawLine = {
	level: number;
	xref?: string;
	tag: string;
	value: string;
	line: number;
};

type Node = RawLine & { children: Node[] };

const LINE_RE = /^(\d+)\s+(?:(@[^@\s]+@)\s+)?([A-Za-z0-9_]+)(?:\s+(.*))?$/u;
const XREF_RE = /^@[^@\s]+@$/u;
const SOURCE_TYPES: readonly SourceType[] = [
	"archive",
	"parish-register",
	"civil-register",
	"census",
	"book",
	"website",
	"database",
	"dna",
	"photograph",
	"interview",
	"family-record",
	"other",
];

function parseLines(raw: string): {
	lines: RawLine[];
	errors: GedcomImportError[];
} {
	const lines: RawLine[] = [];
	const errors: GedcomImportError[] = [];
	const parts = raw.split(/\r\n|\r|\n/u);
	for (let i = 0; i < parts.length; i += 1) {
		const text = parts[i] ?? "";
		if (text.trim() === "") {
			continue;
		}
		const match = LINE_RE.exec(text);
		if (!match || match[3] === undefined) {
			errors.push({ code: "syntax", line: i + 1 });
			continue;
		}
		const line: RawLine = {
			level: Number(match[1]),
			tag: match[3],
			value: match[4] ?? "",
			line: i + 1,
		};
		if (match[2] !== undefined) {
			line.xref = match[2];
		}
		lines.push(line);
	}
	return { lines, errors };
}

function buildTree(lines: RawLine[]): Node[] {
	const roots: Node[] = [];
	const stack: Node[] = [];
	for (const line of lines) {
		const node: Node = { ...line, children: [] };
		while (
			stack.length > 0 &&
			(stack[stack.length - 1]?.level ?? -1) >= line.level
		) {
			stack.pop();
		}
		const parent = stack[stack.length - 1];
		if (parent) {
			parent.children.push(node);
		} else {
			roots.push(node);
		}
		stack.push(node);
	}
	return roots;
}

function collectText(node: Node): string {
	let text = node.value;
	for (const child of node.children) {
		if (child.tag === "CONT") {
			text += `\n${child.value}`;
		} else if (child.tag === "CONC") {
			text += child.value;
		}
	}
	return unescapeGedcomText(text);
}

function childByTag(node: Node, tag: string): Node | undefined {
	return node.children.find((child) => child.tag === tag);
}

function childrenByTag(node: Node, tag: string): Node[] {
	return node.children.filter((child) => child.tag === tag);
}

function childText(node: Node, tag: string): string | undefined {
	const child = childByTag(node, tag);
	return child ? collectText(child) : undefined;
}

function optionalText(text: string | undefined): string | undefined {
	return text !== undefined && text !== "" ? text : undefined;
}

function joinNotes(node: Node): string | undefined {
	const notes = childrenByTag(node, "NOTE").map((child) => collectText(child));
	if (notes.length === 0) {
		return undefined;
	}
	return notes.join("\n");
}

function isXrefPointer(value: string): boolean {
	return XREF_RE.test(value.trim());
}

function parseNameValue(raw: string): {
	forename: string;
	surname?: string;
	suffix?: string;
} {
	const value = unescapeGedcomText(raw);
	const match = /^(.*?)\/([^/]*)(?:\/(.*))?$/u.exec(value);
	if (!match) {
		return { forename: value.trim() };
	}
	const forename = (match[1] ?? "").trim();
	const surname = (match[2] ?? "").trim();
	const suffix = match[3]?.trim();
	return {
		forename,
		...(surname !== "" ? { surname } : {}),
		...(suffix ? { suffix } : {}),
	};
}

function parseNameNode(node: Node): NamePart {
	const parsed = parseNameValue(node.value);
	const givn = optionalText(childText(node, "GIVN"));
	const surn = optionalText(childText(node, "SURN"));
	const npfx = optionalText(childText(node, "NPFX"));
	const nsfx = optionalText(childText(node, "NSFX"));
	const typeText = childText(node, "TYPE")?.trim().toLowerCase();
	let type: NamePart["type"] = "birth";
	if (typeText !== undefined) {
		type = (NAME_TYPES as readonly string[]).includes(typeText)
			? (typeText as NamePart["type"])
			: "other";
	}
	const surname = surn ?? parsed.surname;
	const suffix = nsfx ?? parsed.suffix;
	return {
		forename: givn ?? parsed.forename,
		...(surname !== undefined ? { surname } : {}),
		...(npfx !== undefined ? { prefix: npfx } : {}),
		...(suffix !== undefined ? { suffix } : {}),
		type,
	};
}

function classify(node: Node, report: GedcomImportReport): void {
	const entry = { tag: node.tag, line: node.line };
	if (KNOWN_IGNORED_TAGS.has(node.tag)) {
		report.ignoredTags.push(entry);
	} else {
		report.unknownTags.push(entry);
	}
}

type LookupMaps = {
	repos: Map<string, string>;
	notes: Map<string, string>;
};

function noteText(node: Node, maps: LookupMaps): string {
	if (maps.notes.size > 0 && isXrefPointer(node.value)) {
		const resolved = maps.notes.get(node.value.trim());
		if (resolved !== undefined) {
			return resolved;
		}
	}
	return collectText(node);
}

function collectSourceIds(
	node: Node,
	sourceByXref: ReadonlyMap<string, number>,
	report: GedcomImportReport,
): string[] {
	const ids: string[] = [];
	for (const child of childrenByTag(node, "SOUR")) {
		const pointer = child.value.trim();
		const num = pointer !== "" ? sourceByXref.get(pointer) : undefined;
		if (num !== undefined) {
			ids.push(`s${num}`);
		} else {
			report.ignoredTags.push({ tag: "SOUR:dangling", line: child.line });
		}
	}
	return ids;
}

function buildEvent(
	node: Node,
	id: string,
	type: Event["type"],
	sourceIds: string[],
): Event {
	const dateText = childText(node, "DATE");
	const date = dateText !== undefined ? parseGedcomDate(dateText) : undefined;
	const placeText = childText(node, "PLAC");
	const place =
		placeText !== undefined ? parseGedcomPlace(placeText) : undefined;
	const note = joinNotes(node);
	return {
		id,
		type,
		...(date ? { date } : {}),
		...(place ? { place } : {}),
		sourceIds,
		...(note !== undefined ? { note } : {}),
	};
}

export function importGedcom(
	raw: string,
	options: GedcomImportOptions = {},
): GedcomImportResult {
	const now = options.now ?? new Date().toISOString();
	if (raw.trim() === "") {
		return { ok: false, errors: [{ code: "empty" }] };
	}
	const { lines, errors } = parseLines(raw);
	if (errors.length > 0) {
		return { ok: false, errors };
	}
	const roots = buildTree(lines);

	const head = roots.find((node) => node.tag === "HEAD");
	if (head) {
		const gedc = childByTag(head, "GEDC");
		const vers = gedc ? childText(gedc, "VERS") : undefined;
		if (vers?.trim().startsWith("7")) {
			return { ok: false, errors: [{ code: "gedcom7" }] };
		}
		const char = childText(head, "CHAR");
		if (char !== undefined && !/^utf-?8$/iu.test(char.trim())) {
			return { ok: false, errors: [{ code: "charset" }] };
		}
	}

	const report: GedcomImportReport = {
		persons: 0,
		families: 0,
		sources: 0,
		unknownTags: [],
		ignoredTags: [],
	};

	const maps: LookupMaps = {
		repos: new Map<string, string>(),
		notes: new Map<string, string>(),
	};
	for (const node of roots) {
		if (node.tag === "REPO" && node.xref !== undefined) {
			const name = childText(node, "NAME");
			if (name !== undefined) {
				maps.repos.set(node.xref, name);
			}
		} else if (node.tag === "NOTE" && node.xref !== undefined) {
			maps.notes.set(node.xref, collectText(node));
		}
	}

	const indiNodes = roots.filter((node) => node.tag === "INDI");
	const famNodes = roots.filter((node) => node.tag === "FAM");
	const sourNodes = roots.filter((node) => node.tag === "SOUR");

	const sourceByXref = new Map<string, number>();
	sourNodes.forEach((node, index) => {
		if (node.xref !== undefined) {
			sourceByXref.set(node.xref, index + 1);
		}
	});

	const sourceKnownTags = new Set([
		"TITL",
		"REPO",
		"REFN",
		"QUAY",
		"DATA",
		"NOTE",
		"CONT",
		"CONC",
		"_URL",
		"_ACCESSED",
		"_TYPE",
	]);
	const sources: Source[] = [];
	for (const node of sourNodes) {
		const title = childText(node, "TITL") ?? "";
		let repository = childText(node, "REPO");
		if (repository !== undefined && isXrefPointer(repository)) {
			repository = maps.repos.get(repository.trim());
		}
		const reference = childText(node, "REFN");
		const quayText = childText(node, "QUAY");
		let quality: Source["quality"];
		if (quayText !== undefined) {
			quality = QUAY_TO_QUALITY[Number(quayText.trim())];
		}
		const data = childByTag(node, "DATA");
		const transcription = data ? childText(data, "TEXT") : undefined;
		const url = optionalText(childText(node, "_URL"));
		const accessedAt = optionalText(childText(node, "_ACCESSED"));
		const typeText = optionalText(childText(node, "_TYPE"));
		const sourceType: SourceType =
			typeText !== undefined &&
			(SOURCE_TYPES as readonly string[]).includes(typeText)
				? (typeText as SourceType)
				: "other";
		const note = joinNotes(node);
		for (const child of node.children) {
			if (!sourceKnownTags.has(child.tag)) {
				classify(child, report);
			}
		}
		sources.push({
			id: `s${sources.length + 1}`,
			type: sourceType,
			title,
			...(repository !== undefined && repository !== "" ? { repository } : {}),
			...(reference !== undefined && reference !== "" ? { reference } : {}),
			...(url !== undefined ? { url } : {}),
			...(accessedAt !== undefined ? { accessedAt } : {}),
			...(quality !== undefined ? { quality } : {}),
			...(transcription !== undefined && transcription !== ""
				? { transcription }
				: {}),
			...(note !== undefined ? { note } : {}),
			createdAt: now,
			updatedAt: now,
		});
	}
	report.sources = sources.length;

	const personByXref = new Map<string, number>();
	indiNodes.forEach((node, index) => {
		if (node.xref !== undefined) {
			personByXref.set(node.xref, index + 1);
		}
	});

	let eventSeq = 0;
	const personHandledTags = new Set([
		"NAME",
		"SEX",
		"OCCU",
		"NOTE",
		"CONT",
		"CONC",
	]);
	const persons: Person[] = [];
	for (const node of indiNodes) {
		if (node.xref === undefined) {
			report.ignoredTags.push({ tag: "INDI:no-xref", line: node.line });
			continue;
		}
		const names: NamePart[] = childrenByTag(node, "NAME").map((child) =>
			parseNameNode(child),
		);
		const sexText = childText(node, "SEX")?.trim().toUpperCase() ?? "";
		const sex: Sex = GEDCOM_TO_SEX[sexText] ?? "unknown";
		const events: Event[] = [];
		for (const child of node.children) {
			if (personHandledTags.has(child.tag)) {
				continue;
			}
			const eventType = TAG_TO_EVENT[child.tag];
			if (eventType !== undefined) {
				eventSeq += 1;
				events.push(
					buildEvent(
						child,
						`e${eventSeq}`,
						eventType,
						collectSourceIds(child, sourceByXref, report),
					),
				);
			} else {
				classify(child, report);
			}
		}
		const occupations = childrenByTag(node, "OCCU").map((child) =>
			collectText(child),
		);
		const notes = childrenByTag(node, "NOTE").map((child) =>
			noteText(child, maps),
		);
		persons.push({
			id: `p${persons.length + 1}`,
			names,
			sex,
			events,
			...(occupations.length > 0 ? { occupations } : {}),
			notes: notes.join("\n"),
			tags: [],
			confidence: "unverified",
			researchStatus: "open",
			createdAt: now,
			updatedAt: now,
		});
	}
	report.persons = persons.length;

	const personIdByXref = (xref: string): string | undefined => {
		const num = personByXref.get(xref);
		return num !== undefined ? `p${num}` : undefined;
	};

	const famHandledTags = new Set([
		"HUSB",
		"WIFE",
		"CHIL",
		"NOTE",
		"CONT",
		"CONC",
	]);
	const families: Family[] = [];
	for (const node of famNodes) {
		const partnerIds: string[] = [];
		const husb = childByTag(node, "HUSB");
		if (husb) {
			const id = personIdByXref(husb.value.trim());
			if (id !== undefined) {
				partnerIds.push(id);
			} else {
				report.ignoredTags.push({ tag: "HUSB:dangling", line: husb.line });
			}
		}
		const wife = childByTag(node, "WIFE");
		if (wife) {
			const id = personIdByXref(wife.value.trim());
			if (id !== undefined) {
				partnerIds.push(id);
			} else {
				report.ignoredTags.push({ tag: "WIFE:dangling", line: wife.line });
			}
		}
		const childIds: string[] = [];
		for (const child of childrenByTag(node, "CHIL")) {
			const id = personIdByXref(child.value.trim());
			if (id !== undefined) {
				childIds.push(id);
			} else {
				report.ignoredTags.push({ tag: "CHIL:dangling", line: child.line });
			}
		}
		let start: Event | undefined;
		let end: Event | undefined;
		for (const child of node.children) {
			if (child.tag === "MARR") {
				if (start === undefined) {
					eventSeq += 1;
					start = buildEvent(
						child,
						`e${eventSeq}`,
						"marriage",
						collectSourceIds(child, sourceByXref, report),
					);
				} else {
					classify(child, report);
				}
				continue;
			}
			if (child.tag === "DIV") {
				if (end === undefined) {
					eventSeq += 1;
					end = buildEvent(
						child,
						`e${eventSeq}`,
						"divorce",
						collectSourceIds(child, sourceByXref, report),
					);
				} else {
					classify(child, report);
				}
				continue;
			}
			if (famHandledTags.has(child.tag)) {
				continue;
			}
			classify(child, report);
		}
		const sourceIds = collectSourceIds(node, sourceByXref, report);
		const note = joinNotes(node);
		families.push({
			id: `f${families.length + 1}`,
			partnerIds,
			childIds,
			type: start !== undefined || end !== undefined ? "marriage" : "unknown",
			...(start ? { start } : {}),
			...(end ? { end } : {}),
			sourceIds,
			...(note !== undefined ? { note } : {}),
		});
	}
	report.families = families.length;

	for (const node of roots) {
		if (
			["INDI", "FAM", "SOUR", "HEAD", "TRLR", "REPO", "NOTE"].includes(node.tag)
		) {
			continue;
		}
		classify(node, report);
	}

	const doc = createEmptyDoc(now);
	doc.persons = persons;
	doc.families = families;
	doc.sources = sources;
	return { ok: true, doc, report };
}
