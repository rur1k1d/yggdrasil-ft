import type {
	Event,
	NamePart,
	Person,
	Source,
	YggdrasilDoc,
} from "../model/types";
import {
	EVENT_TO_TAG,
	escapeGedcomText,
	formatGedcomDate,
	formatGedcomPlace,
	GEDCOM_MONTHS,
	GEDCOM_VERSION,
	QUALITY_TO_QUAY,
	SEX_TO_GEDCOM,
} from "./gedcom-shared";

const CHUNK = 200;

function writeValue(
	out: string[],
	level: number,
	tag: string,
	value: string,
): void {
	const escaped = escapeGedcomText(value);
	if (escaped.length <= CHUNK) {
		out.push(`${level} ${tag} ${escaped}`);
		return;
	}
	let pos = 0;
	let first = true;
	while (pos < escaped.length) {
		const chunk = escaped.slice(pos, pos + CHUNK);
		if (first) {
			out.push(`${level} ${tag} ${chunk}`);
			first = false;
		} else {
			out.push(`${level + 1} CONC ${chunk}`);
		}
		pos += CHUNK;
	}
}

function writeText(
	out: string[],
	level: number,
	tag: string,
	text: string,
): void {
	const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
	const parts = normalized.split("\n");
	for (let i = 0; i < parts.length; i += 1) {
		const part = parts[i] ?? "";
		if (i === 0) {
			if (part === "") {
				out.push(`${level} ${tag}`);
			} else {
				writeValue(out, level, tag, part);
			}
			continue;
		}
		if (part === "") {
			out.push(`${level + 1} CONT`);
		} else {
			writeValue(out, level + 1, "CONT", part);
		}
	}
}

function writeName(out: string[], name: NamePart): void {
	const pieces: string[] = [];
	if (name.prefix) pieces.push(name.prefix);
	if (name.forename) pieces.push(name.forename);
	if (name.surname) pieces.push(`/${name.surname}/`);
	if (name.suffix) pieces.push(name.suffix);
	if (pieces.length === 0) {
		return;
	}
	writeValue(out, 1, "NAME", pieces.join(" "));
	if (name.prefix) writeValue(out, 2, "NPFX", name.prefix);
	if (name.forename) writeValue(out, 2, "GIVN", name.forename);
	if (name.surname) writeValue(out, 2, "SURN", name.surname);
	if (name.suffix) writeValue(out, 2, "NSFX", name.suffix);
	writeValue(out, 2, "TYPE", name.type);
}

function writeEventChildren(
	out: string[],
	event: Event,
	level: number,
	sourceIndex: ReadonlyMap<string, number>,
): void {
	if (event.date) {
		const dateText = formatGedcomDate(event.date);
		if (dateText !== null) {
			writeValue(out, level, "DATE", dateText);
		}
	}
	if (event.place) {
		const placeText = formatGedcomPlace(event.place);
		if (placeText !== null) {
			writeValue(out, level, "PLAC", placeText);
		}
	}
	for (const sourceId of event.sourceIds) {
		const num = sourceIndex.get(sourceId);
		if (num !== undefined) {
			out.push(`${level} SOUR @S${num}@`);
		}
	}
	if (event.note !== undefined && event.note.trim() !== "") {
		writeText(out, level, "NOTE", event.note);
	}
}

function writePersonEvent(
	out: string[],
	event: Event,
	sourceIndex: ReadonlyMap<string, number>,
): void {
	const tag = EVENT_TO_TAG[event.type];
	if (tag === null) {
		return;
	}
	out.push(`1 ${tag}`);
	writeEventChildren(out, event, 2, sourceIndex);
}

function headDate(iso: string): string | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(iso);
	if (!match) {
		return null;
	}
	const month = GEDCOM_MONTHS[Number(match[2]) - 1];
	if (!month) {
		return null;
	}
	return `${Number(match[3])} ${month} ${match[1]}`;
}

export function exportGedcom(doc: YggdrasilDoc): string {
	const out: string[] = [];
	const sourceIndex = new Map<string, number>();
	doc.sources.forEach((source: Source, index: number) => {
		sourceIndex.set(source.id, index + 1);
	});
	const personIndex = new Map<string, number>();
	doc.persons.forEach((person: Person, index: number) => {
		personIndex.set(person.id, index + 1);
	});

	out.push("0 HEAD");
	out.push("1 SOUR Yggdrasil FT");
	out.push("1 GEDC");
	out.push(`2 VERS ${GEDCOM_VERSION}`);
	out.push("2 FORM LINEAGE-LINKED");
	out.push("1 CHAR UTF-8");
	const dateText = headDate(doc.updatedAt);
	if (dateText !== null) {
		out.push(`1 DATE ${dateText}`);
	}

	for (const person of doc.persons) {
		const num = personIndex.get(person.id);
		if (num === undefined) {
			continue;
		}
		out.push(`0 @I${num}@ INDI`);
		for (const name of person.names) {
			writeName(out, name);
		}
		out.push(`1 SEX ${SEX_TO_GEDCOM[person.sex]}`);
		for (const event of person.events) {
			writePersonEvent(out, event, sourceIndex);
		}
		for (const occupation of person.occupations ?? []) {
			writeValue(out, 1, "OCCU", occupation);
		}
		if (person.notes.trim() !== "") {
			writeText(out, 1, "NOTE", person.notes);
		}
		doc.families.forEach((family, famIdx) => {
			const famNum = famIdx + 1;
			if (family.partnerIds.includes(person.id)) {
				out.push(`1 FAMS @F${famNum}@`);
			}
			if (family.childIds.includes(person.id)) {
				out.push(`1 FAMC @F${famNum}@`);
			}
		});
	}

	doc.families.forEach((family, famIdx) => {
		const famNum = famIdx + 1;
		out.push(`0 @F${famNum}@ FAM`);
		const husb = family.partnerIds[0];
		const wife = family.partnerIds[1];
		const husbNum = husb !== undefined ? personIndex.get(husb) : undefined;
		const wifeNum = wife !== undefined ? personIndex.get(wife) : undefined;
		if (husbNum !== undefined) {
			out.push(`1 HUSB @I${husbNum}@`);
		}
		if (wifeNum !== undefined) {
			out.push(`1 WIFE @I${wifeNum}@`);
		}
		for (const childId of family.childIds) {
			const childNum = personIndex.get(childId);
			if (childNum !== undefined) {
				out.push(`1 CHIL @I${childNum}@`);
			}
		}
		if (family.start) {
			const tag = EVENT_TO_TAG[family.start.type];
			if (tag !== null) {
				out.push(`1 ${tag}`);
				writeEventChildren(out, family.start, 2, sourceIndex);
			}
		}
		if (family.end) {
			const tag = EVENT_TO_TAG[family.end.type];
			if (tag !== null) {
				out.push(`1 ${tag}`);
				writeEventChildren(out, family.end, 2, sourceIndex);
			}
		}
		for (const sourceId of family.sourceIds) {
			const num = sourceIndex.get(sourceId);
			if (num !== undefined) {
				out.push(`1 SOUR @S${num}@`);
			}
		}
		if (family.note !== undefined && family.note.trim() !== "") {
			writeText(out, 1, "NOTE", family.note);
		}
	});

	const repoIndex = new Map<string, number>();
	for (const source of doc.sources) {
		const num = sourceIndex.get(source.id);
		if (num === undefined) {
			continue;
		}
		out.push(`0 @S${num}@ SOUR`);
		writeValue(out, 1, "TITL", source.title);
		if (source.repository !== undefined && source.repository.trim() !== "") {
			let repoNum = repoIndex.get(source.repository);
			if (repoNum === undefined) {
				repoNum = repoIndex.size + 1;
				repoIndex.set(source.repository, repoNum);
			}
			out.push(`1 REPO @R${repoNum}@`);
		}
		if (source.reference !== undefined && source.reference.trim() !== "") {
			writeValue(out, 1, "REFN", source.reference);
		}
		if (source.quality !== undefined) {
			const quay = QUALITY_TO_QUAY[source.quality];
			if (quay !== null) {
				out.push(`1 QUAY ${quay}`);
			}
		}
		if (source.url !== undefined && source.url.trim() !== "") {
			writeValue(out, 1, "_URL", source.url);
		}
		if (source.accessedAt !== undefined && source.accessedAt.trim() !== "") {
			writeValue(out, 1, "_ACCESSED", source.accessedAt);
		}
		if (source.type !== undefined) {
			writeValue(out, 1, "_TYPE", source.type);
		}
		if (
			source.transcription !== undefined &&
			source.transcription.trim() !== ""
		) {
			out.push("1 DATA");
			writeText(out, 2, "TEXT", source.transcription);
		}
		if (source.note !== undefined && source.note.trim() !== "") {
			writeText(out, 1, "NOTE", source.note);
		}
	}
	for (const [name, repoNum] of repoIndex) {
		out.push(`0 @R${repoNum}@ REPO`);
		writeValue(out, 1, "NAME", name);
	}

	out.push("0 TRLR");
	return `${out.join("\n")}\n`;
}
