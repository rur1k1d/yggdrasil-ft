import { signal } from "@preact/signals";
import type { Dict } from "./en";
import { en } from "./en";
import { pl } from "./pl";

export type Locale = "en" | "pl";

const dictionaries: Record<Locale, Dict> = { en, pl };

function detect(): Locale {
	if (typeof navigator === "undefined") {
		return "en";
	}
	return navigator.language.toLowerCase().startsWith("pl") ? "pl" : "en";
}

export const locale = signal<Locale>(detect());

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
}

export function toggleLocale(): void {
	locale.value = locale.value === "en" ? "pl" : "en";
}
