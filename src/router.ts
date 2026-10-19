import { signal } from "@preact/signals";

export type RouteName = "tree" | "research" | "sources" | "settings";

export type Route = {
	name: RouteName;
	params: Record<string, string>;
};

const ROUTE_NAMES: readonly RouteName[] = [
	"tree",
	"research",
	"sources",
	"settings",
];

export function parseHash(hash: string): Route {
	const segments = hash.replace(/^#/, "").split("/").filter(Boolean);
	const head = segments[0] ?? "";
	const name: RouteName = (ROUTE_NAMES as readonly string[]).includes(head)
		? (head as RouteName)
		: "tree";
	const params: Record<string, string> = {};
	const id = segments[1];
	if (id !== undefined) {
		params.id = id;
	}
	return { name, params };
}

function readRoute(): Route {
	const hash = typeof location === "undefined" ? "#/" : location.hash;
	return parseHash(hash);
}

export const route = signal<Route>(readRoute());

if (typeof window !== "undefined") {
	window.addEventListener("hashchange", () => {
		route.value = readRoute();
	});
}
