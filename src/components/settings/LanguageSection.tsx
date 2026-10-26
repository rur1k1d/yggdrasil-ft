import { locale, setLocale, t } from "../../i18n/t";

const OPTIONS = [
	{ code: "en", label: "language.en" },
	{ code: "pl", label: "language.pl" },
] as const;

export function LanguageSection() {
	const current = locale.value;

	return (
		<section class="settings-language" aria-labelledby="language-title">
			<h2 id="language-title">{t("language.title")}</h2>
			<p class="view-note">{t("language.hint")}</p>
			<div class="lang-options">
				{OPTIONS.map((option) => (
					<button
						key={option.code}
						type="button"
						class="btn lang-option"
						aria-pressed={current === option.code}
						onClick={() => setLocale(option.code)}
					>
						{t(option.label)}
					</button>
				))}
			</div>
		</section>
	);
}
