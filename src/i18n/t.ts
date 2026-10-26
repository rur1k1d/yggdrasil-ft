import { signal } from "@preact/signals";
import type { Dict } from "./en";
import { en } from "./en";
import { pl } from "./pl";

export type Locale = "en" | "pl";

const dictionaries: Record<Locale, Dict> = { en, pl };
const LOCALE_KEY = "yggdrasil_locale_v1";
const DEFAULT_LOCALE: Locale = "en";

function isLocale(value: string | null): value is Locale {
	return value === "en" || value === "pl";
}

function readStoredLocale(): Locale | null {
	if (typeof localStorage === "undefined") return null;
	try {
		const stored = localStorage.getItem(LOCALE_KEY);
		return isLocale(stored) ? stored : null;
	} catch {
		return null;
	}
}

function persistLocale(next: Locale): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(LOCALE_KEY, next);
	} catch {
		return;
	}
}

export const locale = signal<Locale>(readStoredLocale() ?? DEFAULT_LOCALE);

export function t(key: keyof Dict): string {
	return dictionaries[locale.value][key];
}

export function tParams(
	key: keyof Dict,
	vars: Record<string, string | number>,
): string {
	let text = dictionaries[locale.value][key];
	for (const [name, value] of Object.entries(vars)) {
		text = text.replaceAll(`{${name}}`, String(value));
	}
	return text;
}

export function getLocale(): Locale {
	return locale.value;
}

export function setLocale(next: Locale): void {
	locale.value = next;
	persistLocale(next);
}

export function toggleLocale(): void {
	setLocale(locale.value === "en" ? "pl" : "en");
}
