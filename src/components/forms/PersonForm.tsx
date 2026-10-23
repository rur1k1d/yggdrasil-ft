import { t } from "../../i18n/t";
import { uid } from "../../lib/ids";
import type { NamePart, Person, Sex } from "../../model/types";

type Props = {
	person?: Person;
	onSave: (person: Person) => void;
	onCancel: () => void;
	onDelete?: (id: string) => void;
};

export function PersonForm(props: Props) {
	const isNew = !props.person;
	const now = new Date().toISOString();

	const onSubmit = (e: Event) => {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const fd = new FormData(form);
		const given = String(fd.get("given") || "");
		const surname = String(fd.get("surname") || "");
		const sex = String(fd.get("sex") || "unknown") as Sex;
		const living = fd.get("living") === "on";

		const names: NamePart[] = [
			{
				forename: given,
				surname: surname || undefined,
				type: "birth",
			},
		];

		const person: Person = {
			id: props.person?.id || uid("person"),
			names,
			sex,
			living,
			events: props.person?.events || [],
			occupations: props.person?.occupations,
			notes: props.person?.notes || "",
			tags: props.person?.tags || [],
			confidence: props.person?.confidence || "unverified",
			researchStatus: props.person?.researchStatus || "open",
			createdAt: props.person?.createdAt || now,
			updatedAt: now,
		};

		props.onSave(person);
	};

	return (
		<form class="form" onSubmit={onSubmit}>
			<div class="form-row">
				<label>
					<span>{t("person.given")}</span>
					<input
						name="given"
						defaultValue={props.person?.names[0]?.forename || ""}
						required
					/>
				</label>
				<label>
					<span>{t("person.surname")}</span>
					<input
						name="surname"
						defaultValue={props.person?.names[0]?.surname || ""}
					/>
				</label>
			</div>
			<div class="form-row">
				<label>
					<span>{t("person.sex")}</span>
					<select name="sex" defaultValue={props.person?.sex || "unknown"}>
						<option value="female">{t("sex.female")}</option>
						<option value="male">{t("sex.male")}</option>
						<option value="unknown">{t("sex.unknown")}</option>
						<option value="other">{t("sex.other")}</option>
					</select>
				</label>
				<label class="checkbox">
					<input
						type="checkbox"
						name="living"
						defaultChecked={props.person?.living !== false}
					/>
					<span>{t("person.living")}</span>
				</label>
			</div>
			<div class="form-actions">
				<button type="submit" class="btn primary">
					{t("person.save")}
				</button>
				<button type="button" class="btn" onClick={props.onCancel}>
					{t("person.cancel")}
				</button>
				{!isNew && props.onDelete && (
					<button
						type="button"
						class="btn danger"
						onClick={() => {
							if (props.person) props.onDelete?.(props.person.id);
						}}
					>
						{t("person.delete")}
					</button>
				)}
			</div>
		</form>
	);
}
