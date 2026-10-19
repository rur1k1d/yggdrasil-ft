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

export function getLocale(): Locale {
	return locale.value;
}

export function setLocale(next: Locale): void {
	locale.value = next;
}

export function toggleLocale(): void {
	locale.value = locale.value === "en" ? "pl" : "en";
}
