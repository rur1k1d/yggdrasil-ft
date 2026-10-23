#!/usr/bin/env node
// Responsive probe: boots the built app in headless Chromium over CDP and checks
// every route in EN and PL at 320-1440px for horizontal overflow. Saves a small
// EN/PL screenshot set to docs/img/ for the README. Fails (exit 1) on overflow,
// missing routes or console errors/exceptions.

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 4173;
const DEBUG_PORT = 9224;
const APP_URL = `http://127.0.0.1:${PORT}/`;
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`;
const CHROMIUM = process.env.CHROMIUM_BIN ?? "/usr/bin/chromium";
const SHOT_DIR = join(process.cwd(), "docs", "img");

const WIDTHS = [320, 360, 390, 768, 1024, 1440];
const LOCALES = ["en", "pl"];
const ROUTES = [
	{ name: "tree", hash: "#/" },
	{ name: "research", hash: "#/research" },
	{ name: "sources", hash: "#/sources" },
	{ name: "settings", hash: "#/settings" },
];
const SHOTS = [
	{ width: 1440, locale: "en", route: "tree", file: "tree-desktop-en.png" },
	{ width: 1440, locale: "pl", route: "tree", file: "tree-desktop-pl.png" },
	{ width: 390, locale: "en", route: "tree", file: "tree-mobile-en.png" },
	{ width: 390, locale: "pl", route: "tree", file: "tree-mobile-pl.png" },
	{
		width: 1440,
		locale: "en",
		route: "research",
		file: "research-desktop-en.png",
	},
	{
		width: 1440,
		locale: "pl",
		route: "research",
		file: "research-desktop-pl.png",
	},
];

const children = [];
const failures = [];
const consoleErrors = [];
const exceptions = [];
const written = [];

function spawnChild(command, args) {
	const child = spawn(command, args, {
		stdio: ["ignore", "pipe", "pipe"],
		cwd: process.cwd(),
	});
	children.push(child);
	return child;
}

function killAll() {
	for (const child of children) {
		if (child.exitCode === null && child.signalCode === null) {
			child.kill("SIGTERM");
		}
	}
}

async function waitForHttp(url, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url);
			if (res.ok) return true;
		} catch {
			// not up yet, retry
		}
		await sleep(200);
	}
	return false;
}

function attachClient(wsUrl) {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(wsUrl);
		const pending = new Map();
		const handlers = new Map();
		let nextId = 0;

		ws.addEventListener("message", (event) => {
			let msg;
			try {
				msg = JSON.parse(String(event.data));
			} catch {
				return;
			}
			if (typeof msg.id === "number" && pending.has(msg.id)) {
				const { resolve: done, reject: fail } = pending.get(msg.id);
				pending.delete(msg.id);
				if (msg.error) fail(new Error(msg.error.message));
				else done(msg.result);
				return;
			}
			if (msg.method) {
				for (const handler of handlers.get(msg.method) ?? []) {
					handler(msg.params);
				}
			}
		});
		ws.addEventListener("error", () => {
			reject(new Error(`CDP websocket error: ${wsUrl}`));
		});
		ws.addEventListener("open", () => {
			resolve({
				send(method, params = {}) {
					const id = ++nextId;
					ws.send(JSON.stringify({ id, method, params }));
					return new Promise((done, fail) => {
						pending.set(id, { resolve: done, reject: fail });
					});
				},
				on(method, handler) {
					if (!handlers.has(method)) handlers.set(method, []);
					handlers.get(method).push(handler);
				},
			});
		});
	});
}

async function evaluate(client, expression) {
	const result = await client.send("Runtime.evaluate", {
		expression,
		returnByValue: true,
		awaitPromise: true,
	});
	if (result.exceptionDetails) return null;
	return result.result?.value ?? null;
}

async function poll(client, expression, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if ((await evaluate(client, expression)) === true) return true;
		await sleep(100);
	}
	return false;
}

function hookErrors(client) {
	client.on("Runtime.exceptionThrown", (params) => {
		const details = params.exceptionDetails ?? {};
		exceptions.push(details.text ?? "unknown exception");
	});
	client.on("Log.entryAdded", (params) => {
		const entry = params.entry ?? {};
		if (entry.level === "error") {
			consoleErrors.push(`${entry.source ?? "log"}: ${entry.text ?? ""}`);
		}
	});
}

const OVERFLOW_EXPRESSION = `(() => {
	const viewport = innerWidth;
	const offenders = [];
	for (const el of document.querySelectorAll("body *")) {
		const rect = el.getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) continue;
		if (rect.right > viewport + 1) {
			offenders.push({
				tag: el.tagName.toLowerCase(),
				cls: String(el.className ?? "").slice(0, 48),
				right: Math.round(rect.right),
			});
		}
	}
	return {
		innerWidth: viewport,
		scrollWidth: document.documentElement.scrollWidth,
		lang: document.documentElement.lang,
		title: document.querySelector(".view-title")?.textContent ?? null,
		offenders: offenders.slice(0, 6),
	};
})()`;

async function setLocale(client, locale) {
	const current = await evaluate(client, "document.documentElement.lang");
	if (current !== locale) {
		await evaluate(client, "document.querySelector('.lang-switch')?.click()");
		await sleep(200);
	}
}

async function main() {
	await mkdir(SHOT_DIR, { recursive: true });
	const profile = await mkdtemp(join(tmpdir(), "ygg-ui-probe-"));
	try {
		const preview = spawnChild(
			join(process.cwd(), "node_modules", ".bin", "vite"),
			[
				"preview",
				"--host",
				"127.0.0.1",
				"--port",
				String(PORT),
				"--strictPort",
			],
		);
		let previewLog = "";
		preview.stdout.on("data", (chunk) => {
			previewLog += String(chunk);
		});
		preview.stderr.on("data", (chunk) => {
			previewLog += String(chunk);
		});
		if (!(await waitForHttp(APP_URL, 20_000))) {
			throw new Error(
				`vite preview did not start (run npm run build first): ${previewLog.slice(-400)}`,
			);
		}

		spawnChild(CHROMIUM, [
			"--headless",
			"--no-sandbox",
			"--disable-gpu",
			"--disable-dev-shm-usage",
			"--no-first-run",
			"--no-default-browser-check",
			`--remote-debugging-port=${DEBUG_PORT}`,
			`--user-data-dir=${profile}`,
			"about:blank",
		]);
		if (!(await waitForHttp(`${DEBUG_URL}/json/version`, 20_000))) {
			throw new Error("chromium remote debugging port did not open");
		}

		const targets = await (await fetch(`${DEBUG_URL}/json/list`)).json();
		const pageTarget = targets.find((target) => target.type === "page");
		if (!pageTarget) throw new Error("no page target exposed by chromium");
		const client = await attachClient(pageTarget.webSocketDebuggerUrl);
		hookErrors(client);
		await client.send("Page.enable");
		await client.send("Runtime.enable");
		await client.send("Log.enable");

		await client.send("Page.navigate", { url: APP_URL });
		if (
			!(await poll(
				client,
				"document.querySelectorAll('.shell-nav a').length === 4",
				15_000,
			))
		) {
			throw new Error("app did not boot");
		}

		let checks = 0;
		for (const locale of LOCALES) {
			for (const width of WIDTHS) {
				const height = width < 600 ? 844 : 900;
				await client.send("Emulation.setDeviceMetricsOverride", {
					width,
					height,
					deviceScaleFactor: 1,
					mobile: false,
				});
				await client.send("Page.reload", { ignoreCache: false });
				await poll(
					client,
					"document.querySelectorAll('.shell-nav a').length === 4",
					10_000,
				);
				await setLocale(client, locale);

				for (const route of ROUTES) {
					await evaluate(
						client,
						`location.hash = ${JSON.stringify(route.hash)}`,
					);
					await sleep(120);
					const result = await evaluate(client, OVERFLOW_EXPRESSION);
					checks += 1;
					if (!result) {
						failures.push({
							locale,
							width,
							route: route.name,
							reason: "no render",
						});
						continue;
					}
					const overflow = result.scrollWidth > result.innerWidth + 1;
					const shot = SHOTS.find(
						(item) =>
							item.locale === locale &&
							item.width === width &&
							item.route === route.name,
					);
					if (shot) {
						const png = await client.send("Page.captureScreenshot", {
							format: "png",
						});
						await writeFile(
							join(SHOT_DIR, shot.file),
							Buffer.from(png.data, "base64"),
						);
						written.push(shot.file);
					}
					if (overflow || result.lang !== locale) {
						failures.push({
							locale,
							width,
							route: route.name,
							lang: result.lang,
							scrollWidth: result.scrollWidth,
							innerWidth: result.innerWidth,
							offenders: result.offenders,
						});
					}
				}
			}
		}

		const report = {
			checks,
			widths: WIDTHS,
			locales: LOCALES,
			routes: ROUTES.map((route) => route.name),
			screenshots: written,
			consoleErrors,
			exceptions,
			failures,
		};
		console.log(JSON.stringify(report, null, 2));
		const passed =
			failures.length === 0 &&
			consoleErrors.length === 0 &&
			exceptions.length === 0;
		console.log(passed ? "UI PROBE: PASS" : "UI PROBE: FAIL");
		process.exitCode = passed ? 0 : 1;
	} finally {
		killAll();
		await sleep(300);
		await rm(profile, { recursive: true, force: true });
	}
}

process.on("SIGINT", () => {
	killAll();
	process.exit(130);
});

try {
	await main();
} catch (error) {
	console.error(
		`PROBE ERROR: ${error instanceof Error ? error.message : error}`,
	);
	process.exitCode = 1;
} finally {
	killAll();
}
