import type { YggdrasilDoc } from "../model/types";

function getName(doc: YggdrasilDoc, id?: string): string {
	if (!id) return "-";
	const p = doc.persons.find((x) => x.id === id);
	if (p) {
		const n = p.names[0];
		return `${n?.forename || ""} ${n?.surname || ""}`.trim() || id;
	}
	const f = doc.families.find((x) => x.id === id);
	if (f) return `Family ${f.id}`;
	return id;
}

export function exportResearchMarkdown(doc: YggdrasilDoc): string {
	const lines: string[] = [];
	lines.push("# Yggdrasil FT — Research TODO");
	lines.push(`Updated: ${doc.updatedAt}`);
	lines.push("");
	lines.push("## Summary");
	const total = doc.tasks.length;
	const open = doc.tasks.filter((t) => t.status === "open").length;
	const done = doc.tasks.filter((t) => t.status === "done").length;
	const blocked = doc.tasks.filter((t) => t.status === "blocked").length;
	lines.push(`- Total: ${total}`);
	lines.push(`- Open: ${open}`);
	lines.push(`- Done: ${done}`);
	lines.push(`- Blocked: ${blocked}`);
	lines.push("");
	lines.push("## Tasks");
	for (const t of doc.tasks) {
		lines.push(`### [${t.status.toUpperCase()}] ${t.question || t.id}`);
		lines.push(`- Subject: ${t.subjectType} ${getName(doc, t.subjectId)}`);
		lines.push(`- Priority: ${t.priority}`);
		if (t.templateId) lines.push(`- Template: ${t.templateId}`);
		if (t.nextAction) lines.push(`- Next action: ${t.nextAction}`);
		if (t.hypothesis) lines.push(`- Hypothesis: ${t.hypothesis}`);
		if (t.whereToLook?.length) {
			lines.push("- Where to look:");
			for (const w of t.whereToLook) lines.push(`  - ${w}`);
		}
		if (t.outcome) lines.push(`- Outcome: ${t.outcome}`);
		if (t.sourceIds?.length)
			lines.push(`- Source IDs: ${t.sourceIds.join(", ")}`);
		lines.push("");
	}
	return lines.join("\n");
}
