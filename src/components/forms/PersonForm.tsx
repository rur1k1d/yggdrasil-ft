import type { JSX } from "preact";
import { t, tParams } from "../../i18n/t";
import { uid } from "../../lib/ids";
import { lifeYear, setLifeYear } from "../../lib/person-dates";
import type { NamePart, Person, Sex } from "../../model/types";

type Props = {
	person?: Person;
	onSave: (person: Person) => void;
	onCancel: () => void;
	onDelete?: (id: string) => void;
};

const SEX_VALUES = [
	"female",
	"male",
	"unknown",
	"other",
] as const satisfies readonly Sex[];

function parseSex(value: FormDataEntryValue | null): Sex {
	const text = String(value ?? "");
	return SEX_VALUES.find((sex) => sex === text) ?? "unknown";
}

function parseYear(value: FormDataEntryValue | null): number | undefined {
	const text = String(value ?? "").trim();
	if (!text) return undefined;
	const year = Number(text);
	if (!Number.isInteger(year) || year < 1 || year > 9999) return undefined;
	return year;
}

export function PersonForm(props: Props) {
	const isNew = !props.person;
	const now = new Date().toISOString();

	const onSubmit = (e: JSX.TargetedSubmitEvent<HTMLFormElement>) => {
		e.preventDefault();
		const fd = new FormData(e.currentTarget);
		const given = String(fd.get("given") || "");
		const surname = String(fd.get("surname") || "");
		const sex = parseSex(fd.get("sex"));
		const living = fd.get("living") === "on";

		const names: NamePart[] = [
			{
				forename: given,
				surname: surname || undefined,
				type: "birth",
			},
		];

		let person: Person = {
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
		person = setLifeYear(person, "birth", parseYear(fd.get("birthYear")));
		person = setLifeYear(person, "death", parseYear(fd.get("deathYear")));

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
			<fieldset class="form-dates">
				<legend>{t("person.dates")}</legend>
				<div class="form-row">
					<label>
						<span>{t("person.birthYear")}</span>
						<input
							type="number"
							name="birthYear"
							min="1"
							max="9999"
							step="1"
							inputMode="numeric"
							defaultValue={
								props.person ? (lifeYear(props.person, "birth") ?? "") : ""
							}
						/>
					</label>
					<label>
						<span>{t("person.deathYear")}</span>
						<input
							type="number"
							name="deathYear"
							min="1"
							max="9999"
							step="1"
							inputMode="numeric"
							defaultValue={
								props.person ? (lifeYear(props.person, "death") ?? "") : ""
							}
						/>
					</label>
				</div>
				<p class="form-hint">{t("person.yearsHint")}</p>
			</fieldset>
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
							if (!props.person) return;
							const n = props.person.names[0];
							const name =
								`${n?.forename || ""} ${n?.surname || ""}`.trim() ||
								props.person.id;
							if (window.confirm(tParams("person.deleteConfirm", { name }))) {
								props.onDelete?.(props.person.id);
							}
						}}
					>
						{t("person.delete")}
					</button>
				)}
			</div>
		</form>
	);
}
