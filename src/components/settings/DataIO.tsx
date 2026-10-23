import { useRef, useState } from "preact/hooks";
import { t, tParams } from "../../i18n/t";
import { exportGedcom } from "../../io/gedcom-export";
import { type GedcomImportError, importGedcom } from "../../io/gedcom-import";
import { exportJSON, importJSON } from "../../io/json";
import type { YggdrasilDoc } from "../../model/types";
import { doc, getDoc, replaceDoc } from "../../store/store";

type Status = { kind: "ok" | "err"; text: string } | null;

function fileStamp(): string {
	return new Date().toISOString().slice(0, 10);
}

function download(filename: string, mime: string, data: string): void {
	const blob = new Blob([data], { type: mime });
	const url = URL.createObjectURL(blob);
	try {
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = filename;
		anchor.click();
	} finally {
		URL.revokeObjectURL(url);
	}
}

function gedcomErrorMessage(error: GedcomImportError): string {
	switch (error.code) {
		case "empty":
			return t("settings.io.err.empty");
		case "charset":
			return t("settings.io.err.charset");
		case "gedcom7":
			return t("settings.io.err.gedcom7");
		case "syntax":
			return tParams("settings.io.err.syntax", { line: error.line ?? "?" });
	}
}

function importSuccessText(doc: YggdrasilDoc, skipped: number): string {
	let text = tParams("settings.io.okImport", {
		persons: doc.persons.length,
		families: doc.families.length,
		sources: doc.sources.length,
	});
	if (skipped > 0) {
		text += ` ${tParams("settings.io.warnUnknown", { count: skipped })}`;
	}
	return text;
}

export function DataIO() {
	const [status, setStatus] = useState<Status>(null);
	const jsonInput = useRef<HTMLInputElement>(null);
	const gedcomInput = useRef<HTMLInputElement>(null);
	const current = doc.value;
	const isEmpty =
		current.persons.length === 0 &&
		current.families.length === 0 &&
		current.sources.length === 0 &&
		current.tasks.length === 0;

	const handleExportJson = () => {
		const name = `yggdrasil-ft-${fileStamp()}.json`;
		download(name, "application/json;charset=utf-8", exportJSON(getDoc()));
		setStatus({
			kind: "ok",
			text: tParams("settings.io.okExport", { file: name }),
		});
	};

	const handleExportGedcom = () => {
		const name = `yggdrasil-ft-${fileStamp()}.ged`;
		download(name, "text/plain;charset=utf-8", exportGedcom(getDoc()));
		setStatus({
			kind: "ok",
			text: tParams("settings.io.okExport", { file: name }),
		});
	};

	const readFile = async (file: File): Promise<string | null> => {
		try {
			return await file.text();
		} catch {
			setStatus({ kind: "err", text: t("settings.io.err.read") });
			return null;
		}
	};

	const handleJsonFile = async (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = "";
		if (!file) return;
		const raw = await readFile(file);
		if (raw === null) return;
		const imported = importJSON(raw);
		if (imported === null) {
			setStatus({ kind: "err", text: t("settings.io.err.json") });
			return;
		}
		replaceDoc(imported);
		setStatus({ kind: "ok", text: importSuccessText(imported, 0) });
	};

	const handleGedcomFile = async (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = "";
		if (!file) return;
		const raw = await readFile(file);
		if (raw === null) return;
		const result = importGedcom(raw, { now: new Date().toISOString() });
		if (!result.ok) {
			setStatus({
				kind: "err",
				text: gedcomErrorMessage(result.errors[0] ?? { code: "empty" }),
			});
			return;
		}
		result.doc.settings = getDoc().settings;
		replaceDoc(result.doc);
		setStatus({
			kind: "ok",
			text: importSuccessText(result.doc, result.report.unknownTags.length),
		});
	};

	return (
		<section class="settings-io">
			<h2>{t("settings.io.title")}</h2>
			<p class="view-note">{t("settings.io.hint")}</p>
			{isEmpty && (
				<p class="empty-state">
					{t("settings.io.empty")} <a href="#/">{t("settings.io.emptyCta")}</a>
				</p>
			)}
			<div class="io-actions">
				<button type="button" class="btn" onClick={handleExportJson}>
					{t("settings.io.exportJson")}
				</button>
				<button type="button" class="btn" onClick={handleExportGedcom}>
					{t("settings.io.exportGedcom")}
				</button>
				<button
					type="button"
					class="btn primary"
					onClick={() => jsonInput.current?.click()}
				>
					{t("settings.io.importJson")}
				</button>
				<button
					type="button"
					class="btn primary"
					onClick={() => gedcomInput.current?.click()}
				>
					{t("settings.io.importGedcom")}
				</button>
			</div>
			<input
				ref={jsonInput}
				class="io-file"
				type="file"
				accept=".json,application/json"
				tabIndex={-1}
				aria-hidden="true"
				onChange={(event) => void handleJsonFile(event)}
			/>
			<input
				ref={gedcomInput}
				class="io-file"
				type="file"
				accept=".ged,.gedcom,text/plain"
				tabIndex={-1}
				aria-hidden="true"
				onChange={(event) => void handleGedcomFile(event)}
			/>
			{status !== null && (
				<p class={`io-status ${status.kind}`} role="status">
					{status.text}
				</p>
			)}
		</section>
	);
}
