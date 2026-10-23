import { useEffect, useRef } from "preact/hooks";
import { ResearchBoard } from "./components/research/ResearchBoard";
import { DataIO } from "./components/settings/DataIO";
import { SourceRegistry } from "./components/sources/SourceRegistry";
import type { Dict } from "./i18n/en";
import { locale, t, toggleLocale } from "./i18n/t";
import { type Route, type RouteName, route } from "./router";
import { TreeView } from "./views/tree/TreeView";

const NAV: ReadonlyArray<{ href: string; name: RouteName; label: keyof Dict }> =
	[
		{ href: "#/", name: "tree", label: "nav.tree" },
		{ href: "#/research", name: "research", label: "nav.research" },
		{ href: "#/sources", name: "sources", label: "nav.sources" },
		{ href: "#/settings", name: "settings", label: "nav.settings" },
	];

function renderView(current: Route) {
	switch (current.name) {
		case "tree":
			return <TreeView />;
		case "research":
			return <ResearchBoard />;
		case "sources":
			return <SourceRegistry />;
		case "settings":
			return (
				<>
					<h1 class="view-title">{t("views.settings.title")}</h1>
					<p class="view-note">{t("views.settings.note")}</p>
					<DataIO />
				</>
			);
		default:
			return (
				<>
					<h1 class="view-title">{t("views.notFound.title")}</h1>
					<p class="view-note">{t("views.notFound.note")}</p>
					<a class="view-back" href="#/">
						{t("views.notFound.back")}
					</a>
				</>
			);
	}
}

export function App() {
	const current = route.value;
	const langLabel = locale.value === "en" ? "PL" : "EN";
	const mainRef = useRef<HTMLElement>(null);
	const previousRoute = useRef(current.name);

	useEffect(() => {
		document.documentElement.lang = locale.value;
		document.title = t("app.title");
	}, [locale.value]);

	useEffect(() => {
		if (previousRoute.current !== current.name) {
			previousRoute.current = current.name;
			mainRef.current?.focus();
		}
	}, [current.name]);

	return (
		<>
			<a class="skip-link" href="#main">
				{t("shell.skipToContent")}
			</a>
			<header class="shell-header">
				<span class="brand">
					<span class="brand__mark">{t("app.name")}</span>
				</span>
				<button
					type="button"
					class="lang-switch"
					onClick={toggleLocale}
					aria-label={t("shell.langSwitch")}
				>
					{langLabel}
				</button>
			</header>
			<nav class="shell-nav" aria-label={t("shell.mainNav")}>
				{NAV.map((item) => (
					<a
						href={item.href}
						aria-current={current.name === item.name ? "page" : undefined}
					>
						{t(item.label)}
					</a>
				))}
			</nav>
			<main id="main" class="shell-main" tabIndex={-1} ref={mainRef}>
				{renderView(current)}
			</main>
			<footer class="shell-footer">
				<span>{t("app.privacyNote")}</span>
				<span>{t("app.dataNote")}</span>
			</footer>
		</>
	);
}
