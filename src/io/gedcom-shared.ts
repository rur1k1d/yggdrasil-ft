import type {
	DateQualifier,
	EventType,
	NameType,
	PartialDate,
	Place,
	Sex,
	SourceQuality,
} from "../model/types";

export const GEDCOM_VERSION = "5.5.1";

export const EVENT_TO_TAG: Record<EventType, string | null> = {
	birth: "BIRT",
	christening: "CHR",
	marriage: "MARR",
	divorce: "DIV",
	death: "DEAT",
	burial: "BURI",
	residence: "RESI",
	occupation: "OCCU",
	migration: "EMIG",
	other: null,
};

export const TAG_TO_EVENT: Record<string, EventType> = {
	BIRT: "birth",
	CHR: "christening",
	MARR: "marriage",
	DIV: "divorce",
	DEAT: "death",
	BURI: "burial",
	RESI: "residence",
	EMIG: "migration",
	IMMI: "migration",
};

export const SEX_TO_GEDCOM: Record<Sex, string> = {
	female: "F",
	male: "M",
	unknown: "U",
	other: "U",
};

export const GEDCOM_TO_SEX: Record<string, Sex> = {
	F: "female",
	M: "male",
	U: "unknown",
};

export const QUALITY_TO_QUAY: Record<SourceQuality, number | null> = {
	original: 3,
	derivative: 2,
	transcription: 1,
	index: 0,
	unknown: null,
};

export const QUAY_TO_QUALITY: Record<number, SourceQuality> = {
	3: "original",
	2: "derivative",
	1: "transcription",
	0: "index",
};

export const NAME_TYPES: readonly NameType[] = [
	"birth",
	"married",
	"alias",
	"religious",
	"other",
];

export const GEDCOM_MONTHS = [
	"JAN",
	"FEB",
	"MAR",
	"APR",
	"MAY",
	"JUN",
	"JUL",
	"AUG",
	"SEP",
	"OCT",
	"NOV",
	"DEC",
] as const;

/**
 * Tags we recognize but deliberately do not import. They land in the import
 * report's `ignoredTags` list instead of `unknownTags`.
 */
export const KNOWN_IGNORED_TAGS: ReadonlySet<string> = new Set([
	"FAMC",
	"FAMS",
	"CHAN",
	"RIN",
	"AUTH",
	"PUBL",
	"ABBR",
	"SUBM",
	"SUBN",
]);

export function escapeGedcomText(value: string): string {
	return value.replaceAll("@", "@@");
}

export function unescapeGedcomText(value: string): string {
	return value.replaceAll("@@", "@");
}

export function formatGedcomDate(date: PartialDate): string | null {
	if (date.display !== undefined && date.display.trim() !== "") {
		return date.display;
	}
	if (date.year === undefined) {
		if (date.month !== undefined) {
			return GEDCOM_MONTHS[date.month - 1] ?? null;
		}
		return null;
	}
	let core = String(date.year);
	if (date.month !== undefined) {
		const month = GEDCOM_MONTHS[date.month - 1];
		if (month !== undefined) {
			core =
				date.day !== undefined
					? `${date.day} ${month} ${core}`
					: `${month} ${core}`;
		}
	}
	switch (date.qualifier) {
		case "about":
			return `ABT ${core}`;
		case "before":
			return `BEF ${core}`;
		case "after":
			return `AFT ${core}`;
		case "between":
			return date.yearTo !== undefined
				? `BET ${core} AND ${date.yearTo}`
				: core;
		default:
			return core;
	}
}

function buildDate(
	year: number | undefined,
	month: number | undefined,
	day: number | undefined,
	qualifier: DateQualifier | undefined,
	yearTo?: number,
): PartialDate {
	const out: PartialDate = {};
	if (day !== undefined) out.day = day;
	if (month !== undefined) out.month = month;
	if (year !== undefined) out.year = year;
	if (qualifier !== undefined) out.qualifier = qualifier;
	if (yearTo !== undefined) out.yearTo = yearTo;
	return out;
}

function parseMonthName(token: string): number | undefined {
	const idx = (GEDCOM_MONTHS as readonly string[]).indexOf(
		token.toUpperCase().slice(0, 3),
	);
	if (idx < 0) {
		return undefined;
	}
	return idx + 1;
}

function parseDateCore(raw: string): PartialDate | null {
	const s = raw.trim();
	if (/^\d{1,4}$/u.test(s)) {
		return buildDate(Number(s), undefined, undefined, undefined);
	}
	const monthName = /^([A-Za-z]{3,9})\s+(\d{1,4})$/u.exec(s);
	if (monthName) {
		const nameToken = monthName[1];
		const yearToken = monthName[2];
		if (nameToken === undefined || yearToken === undefined) {
			return null;
		}
		const month = parseMonthName(nameToken);
		if (month !== undefined) {
			return buildDate(Number(yearToken), month, undefined, undefined);
		}
		return null;
	}
	const full = /^(\d{1,2})?\s*([A-Za-z]{3,9})?\s*(\d{1,4})?$/u.exec(s);
	if (!full) {
		return null;
	}
	const [, dayRaw, monthRaw, yearRaw] = full;
	if (!dayRaw && !monthRaw && !yearRaw) {
		return null;
	}
	let month: number | undefined;
	if (monthRaw) {
		month = parseMonthName(monthRaw);
		if (month === undefined) {
			return null;
		}
	}
	const day = dayRaw !== undefined ? Number(dayRaw) : undefined;
	const year = yearRaw !== undefined ? Number(yearRaw) : undefined;
	if (day !== undefined && (day < 1 || day > 31)) {
		return null;
	}
	if (month !== undefined && (month < 1 || month > 12)) {
		return null;
	}
	return buildDate(year, month, day, undefined);
}

/**
 * Parse a GEDCOM 5.5.1 DATE value into our PartialDate.
 * Unparseable text is preserved verbatim in `display` (never thrown away).
 */
export function parseGedcomDate(raw: string): PartialDate | null {
	const s = raw.trim();
	if (s === "") {
		return null;
	}
	let qualifier: DateQualifier | undefined;
	let rest = s;
	const qualifierMatch = /^(ABT|BEF|AFT|CAL|EST|INT)\s+/iu.exec(rest);
	if (qualifierMatch) {
		const code = (qualifierMatch[1] ?? "").toUpperCase();
		rest = rest.slice(qualifierMatch[0].length);
		if (code === "BEF") qualifier = "before";
		else if (code === "AFT") qualifier = "after";
		else qualifier = "about";
	}
	const between = /^BET\s+(.+?)\s+AND\s+(.+)$/iu.exec(rest);
	if (between) {
		const first = /(\d{1,4})/u.exec(between[1] ?? "");
		const second = /(\d{1,4})/u.exec(between[2] ?? "");
		if (first && second) {
			return buildDate(
				Number(first[1]),
				undefined,
				undefined,
				"between",
				Number(second[1]),
			);
		}
		return { display: s };
	}
	const core = parseDateCore(rest);
	if (core) {
		if (qualifier !== undefined) {
			core.qualifier = qualifier;
		}
		return core;
	}
	return { display: s };
}

export function formatGedcomPlace(place: Place): string | null {
	const parts = [place.name, place.admin, place.country].filter(
		(part): part is string => part !== undefined && part.trim() !== "",
	);
	if (parts.length === 0) {
		return null;
	}
	return parts.join(", ");
}

/**
 * Best-effort split of a single PLAC string:
 * 1 part  -> name; 2 parts -> name + country; 3+ -> name + admin + country.
 */
export function parseGedcomPlace(raw: string): Place | null {
	const value = raw.trim();
	if (value === "") {
		return null;
	}
	const parts = value.split(",").map((part) => part.trim());
	if (parts.length >= 3) {
		const name = parts[0] ?? "";
		const country = parts[parts.length - 1] ?? "";
		const admin = parts.slice(1, parts.length - 1).join(", ");
		return { name, admin, country };
	}
	if (parts.length === 2) {
		return { name: parts[0] ?? "", country: parts[1] ?? "" };
	}
	return { name: parts[0] ?? "" };
}
