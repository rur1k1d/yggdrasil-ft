import { useState } from "preact/hooks";
import { t } from "../../i18n/t";
import { uid } from "../../lib/ids";
import type { Family } from "../../model/types";

type Props = {
	personId: string;
	persons: { id: string; name: string }[];
	families: Family[];
	onAddFamily: (family: Family) => void;
	onRemoveFamily: (id: string) => void;
};

export function RelationEditor(props: Props) {
	const [relType, setRelType] = useState<"partner" | "parentChild">("partner");
	const [partner, setPartner] = useState("");
	const [parent, setParent] = useState("");
	const [child, setChild] = useState("");

	const addPartner = () => {
		if (!partner) return;
		const family: Family = {
			id: uid("family"),
			partnerIds: [props.personId, partner],
			childIds: [],
			type: "marriage",
			sourceIds: [],
			note: "",
		};
		props.onAddFamily(family);
		setPartner("");
	};

	const addParentChild = () => {
		if (!parent && !child) return;
		let childIds: string[] = [];
		if (parent && child) {
			childIds = [child, props.personId].filter(
				(x, i, arr) => arr.indexOf(x) === i,
			);
		} else if (parent) {
			childIds = [props.personId];
		} else if (child) {
			childIds = [child, props.personId].filter(
				(x, i, arr) => arr.indexOf(x) === i,
			);
		}
		const family: Family = {
			id: uid("family"),
			partnerIds: parent ? [parent] : [],
			childIds,
			type: "unknown",
			sourceIds: [],
			note: "",
		};
		props.onAddFamily(family);
		setParent("");
		setChild("");
	};

	const relatedFamilies = props.families.filter(
		(f) =>
			f.partnerIds.includes(props.personId) ||
			f.childIds.includes(props.personId),
	);

	return (
		<div class="relations">
			<h4>{t("views.tree.relations")}</h4>
			<div class="relation-rows">
				{relatedFamilies.map((f) => (
					<div key={f.id} class="relation-row">
						<span>
							{f.partnerIds.length
								? t("relation.partner")
								: t("relation.parentChild")}
						</span>
						<button
							type="button"
							class="btn"
							onClick={() => props.onRemoveFamily(f.id)}
						>
							{t("relation.remove")}
						</button>
					</div>
				))}
			</div>
			<div class="form-row">
				<label>
					<span>{t("relation.type")}</span>
					<select
						value={relType}
						onChange={(e) =>
							setRelType((e.target as HTMLSelectElement).value as any)
						}
					>
						<option value="partner">{t("relation.partner")}</option>
						<option value="parentChild">{t("relation.parentChild")}</option>
					</select>
				</label>
			</div>
			{relType === "partner" && (
				<div class="form-row">
					<select
						value={partner}
						onChange={(e) => setPartner((e.target as HTMLSelectElement).value)}
					>
						<option value="">--</option>
						{props.persons
							.filter((p) => p.id !== props.personId)
							.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name}
								</option>
							))}
					</select>
					<button type="button" class="btn primary" onClick={addPartner}>
						{t("relation.add")}
					</button>
				</div>
			)}
			{relType === "parentChild" && (
				<div class="form-row">
					<label>
						<span>{t("relation.parent")}</span>
						<select
							value={parent}
							onChange={(e) => setParent((e.target as HTMLSelectElement).value)}
						>
							<option value="">--</option>
							{props.persons
								.filter((p) => p.id !== props.personId)
								.map((p) => (
									<option key={p.id} value={p.id}>
										{p.name}
									</option>
								))}
						</select>
					</label>
					<label>
						<span>{t("relation.child")}</span>
						<select
							value={child}
							onChange={(e) => setChild((e.target as HTMLSelectElement).value)}
						>
							<option value="">--</option>
							{props.persons
								.filter((p) => p.id !== props.personId)
								.map((p) => (
									<option key={p.id} value={p.id}>
										{p.name}
									</option>
								))}
						</select>
					</label>
					<button type="button" class="btn primary" onClick={addParentChild}>
						{t("relation.add")}
					</button>
				</div>
			)}
		</div>
	);
}
