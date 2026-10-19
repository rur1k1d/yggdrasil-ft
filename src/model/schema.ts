import type {
	AppLocale,
	DateFormat,
	Family,
	Note,
	Person,
	ResearchTask,
	Settings,
	Source,
	SurnameOrder,
	Theme,
	TreeDirection,
	YggdrasilDoc,
} from "./types";
import { SCHEMA_VERSION } from "./types";

export const DEFAULT_SETTINGS: Settings = {
	locale: "en",
	theme: "dark",
	privacyMode: false,
	dateFormat: "iso",
	surnameOrder: "given-first",
	treeDirection: "vertical",
	researchTemplates: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asOneOf<T extends string>(
	value: unknown,
	allowed: readonly T[],
	fallback: T,
): T {
	if (
		typeof value === "string" &&
		(allowed as readonly string[]).includes(value)
	) {
		return value as T;
	}
	return fallback;
}

function list<T>(raw: Record<string, unknown>, key: string): T[] | null {
	const value = raw[key];
	if (!Array.isArray(value)) {
		return null;
	}
	return value as T[];
}

function normalizeSettings(raw: Record<string, unknown>): Settings {
	return {
		locale: asOneOf<AppLocale>(
			raw.locale,
			["en", "pl"],
			DEFAULT_SETTINGS.locale,
		),
		theme: asOneOf<Theme>(raw.theme, ["dark", "light"], DEFAULT_SETTINGS.theme),
		privacyMode:
			typeof raw.privacyMode === "boolean"
				? raw.privacyMode
				: DEFAULT_SETTINGS.privacyMode,
		dateFormat: asOneOf<DateFormat>(
			raw.dateFormat,
			["iso", "dmy", "long"],
			DEFAULT_SETTINGS.dateFormat,
		),
		surnameOrder: asOneOf<SurnameOrder>(
			raw.surnameOrder,
			["given-first", "surname-first"],
			DEFAULT_SETTINGS.surnameOrder,
		),
		treeDirection: asOneOf<TreeDirection>(
			raw.treeDirection,
			["vertical", "horizontal"],
			DEFAULT_SETTINGS.treeDirection,
		),
		researchTemplates: Array.isArray(raw.researchTemplates)
			? raw.researchTemplates.filter(
					(item): item is string => typeof item === "string",
				)
			: [],
	};
}

export function createEmptyDoc(now?: string): YggdrasilDoc {
	return {
		schema: SCHEMA_VERSION,
		updatedAt: now ?? new Date().toISOString(),
		settings: { ...DEFAULT_SETTINGS, researchTemplates: [] },
		persons: [],
		families: [],
		sources: [],
		tasks: [],
		notes: [],
	};
}

export function migrate(raw: unknown): YggdrasilDoc | null {
	if (!isRecord(raw)) {
		return null;
	}
	if (raw.schema !== SCHEMA_VERSION) {
		return null;
	}
	if (!isRecord(raw.settings)) {
		return null;
	}
	const persons = list<Person>(raw, "persons");
	const families = list<Family>(raw, "families");
	const sources = list<Source>(raw, "sources");
	const tasks = list<ResearchTask>(raw, "tasks");
	const notes = list<Note>(raw, "notes");
	if (
		persons === null ||
		families === null ||
		sources === null ||
		tasks === null ||
		notes === null
	) {
		return null;
	}
	return {
		schema: SCHEMA_VERSION,
		updatedAt:
			typeof raw.updatedAt === "string"
				? raw.updatedAt
				: new Date().toISOString(),
		settings: normalizeSettings(raw.settings),
		persons,
		families,
		sources,
		tasks,
		notes,
	};
}

export function safeParse(raw: string): YggdrasilDoc | null {
	try {
		return migrate(JSON.parse(raw) as unknown);
	} catch {
		return null;
	}
}

export function cloneDoc(doc: YggdrasilDoc): YggdrasilDoc {
	return structuredClone(doc);
}
