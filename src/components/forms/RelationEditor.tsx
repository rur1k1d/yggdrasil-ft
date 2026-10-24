import { t } from "../../i18n/t";
import {
	canLink,
	RELATED_IDS,
	RELATIVE_LINK,
	type RelativeRole,
} from "../../lib/relations";
import type { YggdrasilDoc } from "../../model/types";

type Props = {
	personId: string;
	doc: YggdrasilDoc;
	persons: { id: string; name: string }[];
	onSelect: (id: string) => void;
	onLink: (targetId: string, relative: RelativeRole) => void;
	onUnlink: (targetId: string, relative: RelativeRole) => void;
	onNew: (relative: RelativeRole) => void;
};

const GROUPS: ReadonlyArray<{
	relative: RelativeRole;
	labelKey: "relation.parents" | "relation.partners" | "relation.children";
	newKey:
		| "views.tree.newParent"
		| "views.tree.newPartner"
		| "views.tree.newChild";
}> = [
	{
		relative: "parent",
		labelKey: "relation.parents",
		newKey: "views.tree.newParent",
	},
	{
		relative: "partner",
		labelKey: "relation.partners",
		newKey: "views.tree.newPartner",
	},
	{
		relative: "child",
		labelKey: "relation.children",
		newKey: "views.tree.newChild",
	},
];

function canLinkRelative(
	doc: YggdrasilDoc,
	personId: string,
	targetId: string,
	relative: RelativeRole,
): boolean {
	const link = RELATIVE_LINK[relative](personId, targetId);
	return canLink(doc, link.fromId, link.toId, link.kind) === null;
}

export function RelationEditor(props: Props) {
	const names = new Map(
		props.persons.map((person) => [person.id, person.name]),
	);
	const hasRelations = GROUPS.some(
		(group) =>
			RELATED_IDS[group.relative](props.doc, props.personId).length > 0,
	);

	return (
		<div class="relations">
			<h2>{t("views.tree.relations")}</h2>
			{!hasRelations && <p class="empty-state">{t("relation.noRelations")}</p>}
			{GROUPS.map((group) => {
				const ids = RELATED_IDS[group.relative](props.doc, props.personId);
				const candidates = props.persons.filter(
					(person) =>
						person.id !== props.personId &&
						canLinkRelative(
							props.doc,
							props.personId,
							person.id,
							group.relative,
						),
				);
				return (
					<section key={group.relative} class="relation-group">
						<h3>{t(group.labelKey)}</h3>
						{ids.length > 0 && (
							<ul class="relation-chips">
								{ids.map((id) => (
									<li key={id} class="relation-chip">
										<button
											type="button"
											class="relation-chip__name"
											onClick={() => props.onSelect(id)}
										>
											{names.get(id) ?? id}
										</button>
										<button
											type="button"
											class="relation-chip__remove"
											aria-label={`${t("relation.unlink")}: ${names.get(id) ?? id}`}
											onClick={() => props.onUnlink(id, group.relative)}
										>
											×
										</button>
									</li>
								))}
							</ul>
						)}
						<div class="relation-add">
							<label>
								<span class="sr-only">{t("relation.linkExisting")}</span>
								<select
									value=""
									aria-label={`${t("relation.linkExisting")}: ${t(group.labelKey)}`}
									onChange={(event) => {
										const target = event.currentTarget.value;
										if (!target) return;
										props.onLink(target, group.relative);
										event.currentTarget.value = "";
									}}
								>
									<option value="">{t("relation.linkExisting")}</option>
									{candidates.map((person) => (
										<option key={person.id} value={person.id}>
											{person.name}
										</option>
									))}
								</select>
							</label>
							<button
								type="button"
								class="btn btn--small"
								onClick={() => props.onNew(group.relative)}
							>
								{t(group.newKey)}
							</button>
						</div>
					</section>
				);
			})}
		</div>
	);
}
