import { useEffect, useState } from "preact/hooks";
import { IntroSplash } from "./components/intro/IntroSplash";
import { ResearchBoard } from "./components/research/ResearchBoard";
import { DataIO } from "./components/settings/DataIO";
import { SourceRegistry } from "./components/sources/SourceRegistry";
import { route } from "./router";
import { load } from "./store/store";
import { TreeView } from "./views/tree/TreeView";
import "./styles/app.css";

const INTRO_KEY = "yggdrasil_intro_seen_v1";

export function App() {
	const r = route.value;
	const [showIntro, setShowIntro] = useState(() => {
		if (typeof localStorage === "undefined") return true;
		try {
			return localStorage.getItem(INTRO_KEY) !== "1";
		} catch {
			return true;
		}
	});

	useEffect(() => {
		load();
	}, []);

	const handleEnter = () => {
		try {
			localStorage.setItem(INTRO_KEY, "1");
		} catch {
			// ignore
		}
		setShowIntro(false);
	};

	if (showIntro) {
		return <IntroSplash onEnter={handleEnter} />;
	}

	return (
		<div class="app">
			<header class="app-header">
				<h1>Yggdrasil-ft</h1>
				<nav class="app-nav">
					<a href="#/tree" class={r.name === "tree" ? "active" : ""}>
						Drzewo
					</a>
					<a href="#/research" class={r.name === "research" ? "active" : ""}>
						Badania
					</a>
					<a href="#/sources" class={r.name === "sources" ? "active" : ""}>
						Źródła
					</a>
					<a href="#/settings" class={r.name === "settings" ? "active" : ""}>
						Ustawienia
					</a>
				</nav>
			</header>
			<main class="main">
				{r.name === "tree" && <TreeView />}
				{r.name === "research" && <ResearchBoard />}
				{r.name === "sources" && <SourceRegistry />}
				{r.name === "settings" && <DataIO />}
			</main>
		</div>
	);
}
