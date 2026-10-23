import { useState } from "preact/hooks";
import { PersonForm } from "../../components/forms/PersonForm";
import { RelationEditor } from "../../components/forms/RelationEditor";
import { TreeCanvas } from "../../components/tree/TreeCanvas";
import { t, tParams } from "../../i18n/t";
import { validateDoc } from "../../lib/validate";
import type { Person } from "../../model/types";
import { doc, update } from "../../store/store";

export function TreeView() {
	const d = doc.value;
	const warnings = validateDoc(d);
	const [editing, setEditing] = useState<string | "new" | null>(null);
	const [search, setSearch] = useState("");

	const persons = d.persons.filter((p) => {
		if (!search) return true;
		const name =
			`${p.names[0]?.forename || ""} ${p.names[0]?.surname || ""}`.toLowerCase();
		return name.includes(search.toLowerCase());
	});

	const getName = (p: Person) =>
		`${p.names[0]?.forename || ""} ${p.names[0]?.surname || ""}`.trim() || p.id;

	return (
		<div class="tree-view">
			<div class="tree-header">
				<h1 class="view-title">{t("views.tree.title")}</h1>
				<p class="view-subtitle">{t("views.tree.subtitle")}</p>
			</div>
			<div class="tree-actions">
				<button
					type="button"
					class="btn primary"
					onClick={() => setEditing("new")}
				>
					{t("views.tree.newPerson")}
				</button>
				<input
					type="search"
					placeholder={t("views.tree.search")}
					aria-label={t("views.tree.search")}
					value={search}
					onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
				/>
			</div>
			<p class="sr-only" role="status" aria-live="polite">
				{tParams("views.tree.resultCount", { count: persons.length })}
			</p>
			{warnings.length > 0 && (
				<section class="warnings" aria-live="polite">
					<h2>{t("views.tree.warnings")}</h2>
					<ul>
						{warnings.map((w, i) => (
							<li key={i}>{t(w.messageKey)}</li>
						))}
					</ul>
				</section>
			)}
			<div class="tree-layout">
				<aside class="tree-list">
					{persons.length === 0 && (
						<p class="empty-state">
							{search ? t("views.tree.noResults") : t("views.tree.noPersons")}
						</p>
					)}
					<ul>
						{persons.map((p) => (
							<li key={p.id}>
								<button
									type="button"
									class="person-item"
									onClick={() => setEditing(p.id)}
								>
									{getName(p)}
								</button>
							</li>
						))}
					</ul>
				</aside>
				<section class="tree-editor">
					{editing === null && <p>{t("views.tree.selectPerson")}</p>}
					{editing === "new" && (
						<PersonForm
							onSave={(p) => {
								update((d) => {
									d.persons.push(p);
								});
								setEditing(null);
							}}
							onCancel={() => setEditing(null)}
						/>
					)}
					{editing &&
						editing !== "new" &&
						(() => {
							const p = d.persons.find((x) => x.id === editing);
							if (!p) return <p>{t("views.tree.selectPerson")}</p>;
							return (
								<>
									<PersonForm
										person={p}
										onSave={(next) => {
											update((d) => {
												const idx = d.persons.findIndex(
													(x) => x.id === next.id,
												);
												if (idx >= 0) d.persons[idx] = next;
											});
											setEditing(null);
										}}
										onDelete={(id) => {
											update((d) => {
												d.persons = d.persons.filter((x) => x.id !== id);
												d.families = d.families.filter(
													(f) =>
														!f.partnerIds.includes(id) &&
														!f.childIds.includes(id),
												);
											});
											setEditing(null);
										}}
										onCancel={() => setEditing(null)}
									/>
									<RelationEditor
										personId={p.id}
										persons={d.persons.map((pp) => ({
											id: pp.id,
											name: getName(pp),
										}))}
										families={d.families}
										onAddFamily={(f) => {
											update((d) => {
												d.families.push(f);
											});
										}}
										onRemoveFamily={(id) => {
											update((d) => {
												d.families = d.families.filter((f) => f.id !== id);
											});
										}}
									/>
								</>
							);
						})()}
				</section>
				<TreeCanvas persons={persons} />
			</div>
		</div>
	);
}
