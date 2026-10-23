import { useState } from "preact/hooks";
import { t } from "../../i18n/t";
import { uid } from "../../lib/ids";
import type { Source, SourceQuality, SourceType } from "../../model/types";
import { doc, update } from "../../store/store";

export function SourceRegistry() {
	const d = doc.value;
	const [editing, setEditing] = useState<string | "new" | null>(null);
	const [form, setForm] = useState<Partial<Source>>({});

	const SOURCE_TYPES: SourceType[] = [
		"archive",
		"parish-register",
		"civil-register",
		"census",
		"book",
		"website",
		"database",
		"dna",
		"photograph",
		"interview",
		"family-record",
		"other",
	];

	const SOURCE_QUALITIES: SourceQuality[] = [
		"original",
		"derivative",
		"transcription",
		"index",
		"unknown",
	];

	const save = () => {
		const now = new Date().toISOString();
		const source: Source = {
			id: form.id || uid("source"),
			type: (form.type as SourceType) || "archive",
			title: form.title || "",
			repository: form.repository || "",
			reference: form.reference || "",
			url: form.url || "",
			accessedAt: form.accessedAt || now,
			quality: (form.quality as SourceQuality) || "unknown",
			transcription: form.transcription || "",
			note: form.note || "",
			createdAt: form.createdAt || now,
			updatedAt: now,
		};
		update((docDraft) => {
			const idx = docDraft.sources.findIndex((s) => s.id === source.id);
			if (idx >= 0) docDraft.sources[idx] = source;
			else docDraft.sources.push(source);
		});
		setEditing(null);
		setForm({});
	};

	return (
		<div class="sources">
			<h1 class="view-title">{t("views.sources.title")}</h1>
			<p class="view-subtitle">{t("views.sources.subtitle")}</p>
			<button
				type="button"
				class="btn primary"
				onClick={() => {
					setEditing("new");
					setForm({});
				}}
			>
				{t("sources.new")}
			</button>
			{d.sources.length === 0 && (
				<p class="empty-state">{t("sources.empty")}</p>
			)}
			<ul>
				{d.sources.map((s) => (
					<li key={s.id}>
						<strong>{s.title}</strong> ({t(`sourceType.${s.type}`)}) [
						{t(`sourceQuality.${s.quality ?? "unknown"}`)}] [{s.reference}]
						<button
							type="button"
							class="btn"
							onClick={() => {
								setEditing(s.id);
								setForm(s);
							}}
						>
							{t("views.tree.edit")}
						</button>
					</li>
				))}
			</ul>
			{editing && (
				<div class="form">
					<h2>{t(editing === "new" ? "sources.new" : "views.tree.edit")}</h2>
					<label>
						<span>{t("sources.title")}</span>
						<input
							value={form.title || ""}
							onInput={(e) =>
								setForm({
									...form,
									title: (e.target as HTMLInputElement).value,
								})
							}
						/>
					</label>
					<label>
						<span>{t("sources.type")}</span>
						<select
							value={form.type || "archive"}
							onChange={(e) =>
								setForm({
									...form,
									type: (e.target as HTMLSelectElement).value as SourceType,
								})
							}
						>
							{SOURCE_TYPES.map((type) => (
								<option key={type} value={type}>
									{t(`sourceType.${type}`)}
								</option>
							))}
						</select>
					</label>
					<label>
						<span>{t("sources.repository")}</span>
						<input
							value={form.repository || ""}
							onInput={(e) =>
								setForm({
									...form,
									repository: (e.target as HTMLInputElement).value,
								})
							}
						/>
					</label>
					<label>
						<span>{t("sources.reference")}</span>
						<input
							value={form.reference || ""}
							onInput={(e) =>
								setForm({
									...form,
									reference: (e.target as HTMLInputElement).value,
								})
							}
						/>
					</label>
					<label>
						<span>{t("sources.quality")}</span>
						<select
							value={form.quality || "unknown"}
							onChange={(e) =>
								setForm({
									...form,
									quality: (e.target as HTMLSelectElement)
										.value as SourceQuality,
								})
							}
						>
							{SOURCE_QUALITIES.map((quality) => (
								<option key={quality} value={quality}>
									{t(`sourceQuality.${quality}`)}
								</option>
							))}
						</select>
					</label>
					<label>
						<span>{t("sources.url")}</span>
						<input
							value={form.url || ""}
							onInput={(e) =>
								setForm({ ...form, url: (e.target as HTMLInputElement).value })
							}
						/>
					</label>
					<label>
						<span>{t("sources.transcription")}</span>
						<textarea
							value={form.transcription || ""}
							onInput={(e) =>
								setForm({
									...form,
									transcription: (e.target as HTMLTextAreaElement).value,
								})
							}
						></textarea>
					</label>
					<label>
						<span>{t("sources.note")}</span>
						<textarea
							value={form.note || ""}
							onInput={(e) =>
								setForm({
									...form,
									note: (e.target as HTMLTextAreaElement).value,
								})
							}
						></textarea>
					</label>
					<div class="form-actions">
						<button type="button" class="btn primary" onClick={save}>
							{t("sources.save")}
						</button>
						<button type="button" class="btn" onClick={() => setEditing(null)}>
							{t("sources.cancel")}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
