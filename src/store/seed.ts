import seedFile from "../../data/seed/sample-family.json";
import { migrate } from "../model/schema";
import type { YggdrasilDoc } from "../model/types";

export function createSeedDoc(): YggdrasilDoc {
	const doc = migrate(seedFile);
	if (doc === null) {
		throw new Error("Invalid seed dataset: data/seed/sample-family.json");
	}
	return doc;
}
