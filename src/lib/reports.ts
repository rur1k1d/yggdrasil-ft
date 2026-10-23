import type { Person, YggdrasilDoc } from "../model/types";

function getName(p: Person) {
	const n = p.names[0];
	return `${n?.forename || ""} ${n?.surname || ""}`.trim() || p.id;
}

export function maskLiving(
	name: string,
	living?: boolean,
	privacy = false,
): string {
	if (privacy && living) return "[Living]";
	return name;
}

export function personReportMarkdown(
	doc: YggdrasilDoc,
	personId: string,
	privacy = false,
): string {
	const p = doc.persons.find((x) => x.id === personId);
	if (!p) return "# Person report";
	const lines: string[] = [];
	lines.push("# Person report");
	lines.push(`Name: ${maskLiving(getName(p), p.living, privacy)}`);
	lines.push(`Sex: ${p.sex}`);
	lines.push(`Living: ${p.living === false ? "No" : "Yes"}`);
	if (p.events?.length) {
		lines.push("");
		lines.push("## Events");
		for (const e of p.events) {
			lines.push(
				`- ${e.type}: ${e.date?.display || ""} ${e.place?.name || ""}`,
			);
		}
	}
	if (p.notes) {
		lines.push("");
		lines.push("## Notes");
		lines.push(p.notes);
	}
	lines.push("");
	return lines.join("\n");
}
