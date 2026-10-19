import { effect } from "@preact/signals";
import { h, render } from "preact";
import { App } from "./app";
import { locale, t } from "./i18n/t";
import { load } from "./store/store";
import "./styles/app.css";

load();

const root = document.getElementById("app");

if (root !== null) {
	render(h(App, null), root);
}

effect(() => {
	document.title = t("app.title");
	document.documentElement.lang = locale.value;
});
