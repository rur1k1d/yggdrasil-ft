import { useEffect, useMemo, useState } from "preact/hooks";
import { PersonForm } from "../../components/forms/PersonForm";
import { RelationEditor } from "../../components/forms/RelationEditor";
import { LinkDialog } from "../../components/tree/LinkDialog";
import { TreeCanvas } from "../../components/tree/TreeCanvas";
import type { Dict } from "../../i18n/en";
import { t, tParams } from "../../i18n/t";
import { lifeYearLabel } from "../../lib/person-dates";
import {
	linkPeople,
	RELATIVE_LINK,
	type RelationError,
	type RelationKind,
	type RelativeRole,
	removePerson,
	unlinkPeople,
} from "../../lib/relations";
import { layoutTree } from "../../lib/tree-layout";
import { validateDoc } from "../../lib/validate";
import type { Person } from "../../model/types";
import { route } from "../../router";
import { doc, update } from "../../store/store";

const RELATION_ERROR_KEYS = {
	self: "views.tree.relationError.self",
	missing: "views.tree.relationError.missing",
	duplicate: "views.tree.relationError.duplicate",
	cycle: "views.tree.relationError.cycle",
	partnerChild: "views.tree.relationError.partnerChild",
	hasChildren: "views.tree.relationError.hasChildren",
	notLinked: "views.tree.relationError.notLinked",
} as const satisfies Record<RelationError, keyof Dict>;

type CreateState = {
	relative?: {
		anchorId: string;
		relative: RelativeRole;
	};
} | null;

type Notice = {
	kind: "ok" | "error";
	text: string;
} | null;

type LinkPrompt = {
	fromId: string;
	toId: string;
	suggested: RelationKind;
};

function personName(person: Person): string {
	const name = person.names[0];
	const value = `${name?.forename ?? ""} ${name?.surname ?? ""}`.trim();
	return value || person.id;
}

function searchText(person: Person): string {
	return person.names
		.map((name) => `${name.forename} ${name.surname ?? ""}`)
		.join(" ")
		.toLowerCase();
}

export function TreeView() {
	const d = doc.value;
	const currentRoute = route.value;
	const routeHead =
		currentRoute.name === "tree" ? currentRoute.params.id : undefined;
	const layout = useMemo(() => layoutTree(d, routeHead), [d, routeHead]);
	const warnings = validateDoc(d);
	const [selectedId, setSelectedId] = useState<string | null>(
		() => layout.focusId,
	);
	const [search, setSearch] = useState("");
	const [creating, setCreating] = useState<CreateState>(null);
	const [notice, setNotice] = useState<Notice>(null);
	const [linkPrompt, setLinkPrompt] = useState<LinkPrompt | null>(null);

	const selected = selectedId
		? (d.persons.find((person) => person.id === selectedId) ?? null)
		: null;
	const matches = d.persons.filter((person) => {
		if (!search.trim()) return true;
		return searchText(person).includes(search.trim().toLowerCase());
	});
	const matchIds = useMemo(
		() => new Set(matches.map((person) => person.id)),
		[matches],
	);

	useEffect(() => {
		if (selectedId && !d.persons.some((person) => person.id === selectedId)) {
			setSelectedId(null);
		}
	}, [d.persons, selectedId]);

	const showError = (error: RelationError) => {
		setNotice({ kind: "error", text: t(RELATION_ERROR_KEYS[error]) });
	};

	const selectPerson = (id: string) => {
		setCreating(null);
		setSelectedId(id);
		setNotice(null);
	};

	const setHead = (id: string) => {
		if (!d.persons.some((person) => person.id === id)) return;
		setSelectedId(id);
		setNotice(null);
		const hash = `#/tree/${id}`;
		if (typeof location !== "undefined" && location.hash !== hash) {
			location.hash = hash;
		}
	};

	const applyLink = (fromId: string, toId: string, kind: RelationKind) => {
		const errors: RelationError[] = [];
		update((draft) => {
			const result = linkPeople(draft, fromId, toId, kind);
			if (!result.ok) errors.push(result.error);
		});
		const error = errors[0];
		if (error) {
			showError(error);
			return;
		}
		setNotice({ kind: "ok", text: t("views.tree.relationAdded") });
	};

	const linkRelative = (targetId: string, relative: RelativeRole) => {
		if (!selectedId) return;
		const link = RELATIVE_LINK[relative](selectedId, targetId);
		applyLink(link.fromId, link.toId, link.kind);
	};

	const unlinkRelative = (targetId: string, relative: RelativeRole) => {
		if (!selectedId) return;
		const link = RELATIVE_LINK[relative](selectedId, targetId);
		const errors: RelationError[] = [];
		update((draft) => {
			const result = unlinkPeople(draft, link.fromId, link.toId, link.kind);
			if (!result.ok) errors.push(result.error);
		});
		const error = errors[0];
		if (error) {
			showError(error);
			return;
		}
		setNotice({ kind: "ok", text: t("views.tree.relationRemoved") });
	};

	const saveExisting = (person: Person) => {
		update((draft) => {
			const index = draft.persons.findIndex((entry) => entry.id === person.id);
			if (index >= 0) draft.persons[index] = person;
		});
	};

	const saveNew = (person: Person) => {
		const context = creating?.relative;
		const errors: RelationError[] = [];
		update((draft) => {
			draft.persons.push(person);
			if (!context) return;
			const result =
				context.relative === "parent"
					? linkPeople(draft, person.id, context.anchorId, "parent")
					: context.relative === "child"
						? linkPeople(draft, person.id, context.anchorId, "child")
						: linkPeople(draft, person.id, context.anchorId, "partner");
			if (!result.ok) errors.push(result.error);
		});
		setCreating(null);
		setSelectedId(person.id);
		const error = errors[0];
		if (error) showError(error);
	};

	const deletePerson = (id: string) => {
		const wasHead = layout.focusId === id;
		update((draft) => removePerson(draft, id));
		if (selectedId === id) setSelectedId(null);
		if (creating?.relative?.anchorId === id) setCreating(null);
		if (wasHead && typeof location !== "undefined") location.hash = "#/";
	};

	const requestLink = (
		fromId: string,
		toId: string,
		suggested: RelationKind,
	) => {
		setLinkPrompt({ fromId, toId, suggested });
	};

	const promptFrom = linkPrompt
		? d.persons.find((person) => person.id === linkPrompt.fromId)
		: undefined;
	const promptTo = linkPrompt
		? d.persons.find((person) => person.id === linkPrompt.toId)
		: undefined;

	return (
		<div class="tree-view">
			<div class="tree-header">
				<div>
					<h1 class="view-title">{t("views.tree.title")}</h1>
					<p class="view-subtitle">{t("views.tree.subtitle")}</p>
				</div>
			</div>
			<div class="tree-actions">
				<button
					type="button"
					class="btn primary"
					onClick={() => {
						setCreating({});
						setNotice(null);
					}}
				>
					{t("views.tree.newPerson")}
				</button>
				<label class="tree-search">
					<span class="sr-only">{t("views.tree.search")}</span>
					<input
						type="search"
						placeholder={t("views.tree.search")}
						value={search}
						onInput={(event) => setSearch(event.currentTarget.value)}
					/>
				</label>
				<p class="sr-only" role="status" aria-live="polite">
					{tParams("views.tree.resultCount", { count: matches.length })}
				</p>
			</div>
			{notice && (
				<p
					class={`tree-notice is-${notice.kind}`}
					role={notice.kind === "error" ? "alert" : "status"}
				>
					{notice.text}
				</p>
			)}

			<div class="tree-layout">
				<section class="tree-main">
					<TreeCanvas
						persons={d.persons}
						layout={layout}
						selectedId={selectedId}
						search={search}
						matchIds={matchIds}
						onSelect={selectPerson}
						onSetHead={setHead}
						onRequestLink={requestLink}
					/>
				</section>

				<aside class="tree-sidebar" aria-label={t("views.tree.people")}>
					<header class="panel-header">
						<h2>{t("views.tree.people")}</h2>
						<span class="count-badge">{d.persons.length}</span>
					</header>
					{matches.length === 0 && (
						<p class="empty-state">
							{search.trim()
								? t("views.tree.noResults")
								: t("views.tree.noPersons")}
						</p>
					)}
					<ul class="people-list">
						{matches.map((person) => {
							const years = lifeYearLabel(person);
							return (
								<li key={person.id}>
									<button
										type="button"
										class={`person-item ${person.id === selectedId ? "is-selected" : ""}`}
										aria-pressed={person.id === selectedId}
										onClick={() => selectPerson(person.id)}
									>
										<span class="person-item__name">{personName(person)}</span>
										<span class="person-item__meta">
											{years || t("views.tree.yearsUnknown")}
											{person.id === layout.focusId && (
												<span class="mini-badge">
													{t("views.tree.headBadge")}
												</span>
											)}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
					{warnings.length > 0 && (
						<section class="warnings tree-warnings" aria-live="polite">
							<h2>{t("views.tree.warnings")}</h2>
							<ul>
								{warnings.map((warning, index) => (
									<li key={index}>{t(warning.messageKey)}</li>
								))}
							</ul>
						</section>
					)}
				</aside>

				<aside class="tree-editor" aria-label={t("views.tree.details")}>
					{creating && (
						<>
							<header class="panel-header">
								<h2>
									{creating.relative
										? creating.relative.relative === "parent"
											? t("views.tree.newParent")
											: creating.relative.relative === "child"
												? t("views.tree.newChild")
												: t("views.tree.newPartner")
										: t("views.tree.newPerson")}
								</h2>
							</header>
							<PersonForm
								key="new-person"
								onSave={saveNew}
								onCancel={() => setCreating(null)}
							/>
						</>
					)}
					{!creating && selected && (
						<>
							<header class="tree-editor__head">
								<div>
									<h2>{personName(selected)}</h2>
									<p>
										{lifeYearLabel(selected) || t("views.tree.yearsUnknown")}
									</p>
								</div>
								{selected.id === layout.focusId ? (
									<span class="mini-badge">{t("views.tree.headBadge")}</span>
								) : (
									<button
										type="button"
										class="btn btn--small"
										onClick={() => setHead(selected.id)}
									>
										{t("views.tree.setHead")}
									</button>
								)}
							</header>
							<PersonForm
								key={selected.id}
								person={selected}
								onSave={saveExisting}
								onCancel={() => setSelectedId(null)}
								onDelete={deletePerson}
							/>
							<RelationEditor
								personId={selected.id}
								doc={d}
								persons={d.persons.map((person) => ({
									id: person.id,
									name: personName(person),
								}))}
								onSelect={selectPerson}
								onLink={linkRelative}
								onUnlink={unlinkRelative}
								onNew={(relative) =>
									setCreating({
										relative: { anchorId: selected.id, relative },
									})
								}
							/>
						</>
					)}
					{!creating && !selected && (
						<div class="tree-editor__empty">
							<p>{t("views.tree.selectPerson")}</p>
							<p>{t("views.tree.headHint")}</p>
						</div>
					)}
				</aside>
			</div>

			{linkPrompt && promptFrom && promptTo && (
				<LinkDialog
					key={`${linkPrompt.fromId}:${linkPrompt.toId}`}
					fromName={personName(promptFrom)}
					toName={personName(promptTo)}
					suggested={linkPrompt.suggested}
					onCancel={() => setLinkPrompt(null)}
					onConfirm={(kind) => {
						applyLink(linkPrompt.fromId, linkPrompt.toId, kind);
						setLinkPrompt(null);
					}}
				/>
			)}
		</div>
	);
}
