import { safeParse } from "../model/schema";
import type { YggdrasilDoc } from "../model/types";

export function exportJSON(doc: YggdrasilDoc): string {
	return JSON.stringify(doc, null, 2);
}

export function importJSON(raw: string): YggdrasilDoc | null {
	return safeParse(raw);
}
