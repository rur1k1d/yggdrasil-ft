import { useState } from "preact/hooks";
import {
	RESEARCH_TEMPLATES,
	type ResearchTemplate,
} from "../../data/research-templates";
import type { Dict } from "../../i18n/en";
import { t } from "../../i18n/t";
import { uid } from "../../lib/ids";
import type {
	ResearchTask,
	TaskStatus,
	TaskSubjectType,
} from "../../model/types";
import { doc, update } from "../../store/store";

const STATUS_KEY: Record<TaskStatus, keyof Dict> = {
	open: "status.open",
	done: "status.done",
	blocked: "status.blocked",
	dropped: "status.dropped",
};

function getName(d: any, id?: string): string {
	if (!id) return "-";
	const p = d.persons.find((x: any) => x.id === id);
	if (p) {
		const n = p.names[0];
		return `${n?.forename || ""} ${n?.surname || ""}`.trim() || id;
	}
	const f = d.families.find((x: any) => x.id === id);
	if (f) return `${t("subject.family")} ${f.id}`;
	return id;
}

export function ResearchBoard() {
	const d = doc.value;
	const [template, setTemplate] = useState<ResearchTemplate | null>(null);
	const [selectedPerson, setSelectedPerson] = useState("");
	const tasks = d.tasks;

	const stats = {
		total: tasks.length,
		open: tasks.filter((x) => x.status === "open").length,
		done: tasks.filter((x) => x.status === "done").length,
		blocked: tasks.filter((x) => x.status === "blocked").length,
	};

	const applyTemplate = () => {
		if (!template) return;
		const now = new Date().toISOString();
		update((docDraft) => {
			for (const q of template.questions) {
				const tsk: ResearchTask = {
					id: uid("task"),
					subjectType: template.appliesTo as TaskSubjectType,
					subjectId: selectedPerson || undefined,
					question: q,
					whereToLook: template.whereToLook.slice(),
					status: "open",
					priority: "med",
					sourceIds: [],
					templateId: template.id,
					createdAt: now,
					updatedAt: now,
				};
				docDraft.tasks.push(tsk);
			}
		});
		setTemplate(null);
	};

	return (
		<div class="research-board">
			<h2>{t("views.research.title")}</h2>
			<p>{t("views.research.subtitle")}</p>
			<section class="stats">
				<h4>{t("research.stats")}</h4>
				<div>
					{t("research.total")}: {stats.total} | {t("research.open")}:{" "}
					{stats.open} | {t("research.done")}: {stats.done} |{" "}
					{t("research.blocked")}: {stats.blocked}
				</div>
			</section>
			<div class="actions">
				<select
					onChange={(e) => {
						const val = (e.target as HTMLSelectElement).value;
						setTemplate(RESEARCH_TEMPLATES.find((x) => x.id === val) || null);
					}}
				>
					<option value="">-- {t("research.applyTemplate")} --</option>
					{RESEARCH_TEMPLATES.map((x) => (
						<option key={x.id} value={x.id}>
							{x.title}
						</option>
					))}
				</select>
				{template && (
					<>
						<select
							onChange={(e) =>
								setSelectedPerson((e.target as HTMLSelectElement).value)
							}
						>
							<option value="">-- {t("subject.person")} --</option>
							{d.persons.map((p) => (
								<option key={p.id} value={p.id}>
									{getName(d, p.id)}
								</option>
							))}
						</select>
						<button type="button" class="btn primary" onClick={applyTemplate}>
							{t("research.applyTemplate")}
						</button>
					</>
				)}
			</div>
			<ul class="tasks">
				{tasks.map((tsk) => (
					<li key={tsk.id}>
						[{t(STATUS_KEY[tsk.status])}] {tsk.question}
					</li>
				))}
			</ul>
		</div>
	);
}
