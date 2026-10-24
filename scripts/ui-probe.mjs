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

		const features = [];
		const checkFeature = (name, pass, detail) => {
			features.push({ name, pass, detail });
			if (!pass) {
				failures.push({ feature: name, reason: detail ?? "check failed" });
			}
		};

		await client.send("Emulation.setDeviceMetricsOverride", {
			width: 1440,
			height: 900,
			deviceScaleFactor: 1,
			mobile: false,
		});
		await evaluate(client, "location.hash = '#/'");
		await client.send("Page.reload", { ignoreCache: false });
		await poll(
			client,
			"document.querySelectorAll('.tree-card').length === 8",
			10_000,
		);
		await sleep(250);

		const initial = await evaluate(
			client,
			`(() => {
				const canvas = document.querySelector('.tree-canvas');
				const card = document.querySelector('.tree-card');
				return {
					cards: document.querySelectorAll('.tree-card').length,
					edges: document.querySelectorAll('.tree-edge').length,
					head: document.querySelector('.tree-head-select select')?.value,
					selected: document.querySelector('.tree-card.is-selected')?.dataset.treePerson,
					relations: Boolean(document.querySelector('.relations')),
					dateFields: document.querySelectorAll('input[name="birthYear"], input[name="deathYear"]').length,
					cardWidth: card ? Math.round(card.getBoundingClientRect().width) : 0,
					canvasWidth: canvas ? Math.round(canvas.getBoundingClientRect().width) : 0,
				};
			})()`,
		);
		checkFeature(
			"seed tree renders",
			initial?.cards === 8 &&
				initial?.edges === 7 &&
				initial?.head === "p2" &&
				initial?.selected === "p2",
			initial,
		);
		checkFeature(
			"details and life-date fields render",
			initial?.relations === true && initial?.dateFields === 2,
			initial,
		);
		checkFeature(
			"desktop cards are readable",
			(initial?.cardWidth ?? 0) >= 135,
			initial,
		);

		const search = await evaluate(
			client,
			`(async () => {
				const input = document.querySelector('.tree-search input');
				input.value = 'Astrith';
				input.dispatchEvent(new Event('input', { bubbles: true }));
				await new Promise((resolve) => setTimeout(resolve, 120));
				const dimmed = document.querySelectorAll('.tree-card.is-dimmed').length;
				const items = document.querySelectorAll('.people-list .person-item').length;
				const status = document.querySelector('[role="status"]')?.textContent;
				input.value = '';
				input.dispatchEvent(new Event('input', { bubbles: true }));
				await new Promise((resolve) => setTimeout(resolve, 120));
				return { dimmed, items, status };
			})()`,
		);
		checkFeature(
			"search dims cards but keeps the tree",
			search?.dimmed === 7 && search?.items === 1,
			search,
		);

		const head = await evaluate(
			client,
			`(async () => {
				const select = document.querySelector('.tree-head-select select');
				const setter = Object.getOwnPropertyDescriptor(
					HTMLSelectElement.prototype,
					'value',
				).set;
				setter.call(select, 'p7');
				select.dispatchEvent(new Event('change', { bubbles: true }));
				await new Promise((resolve) => setTimeout(resolve, 180));
				const after = {
					hash: location.hash,
					head: select.value,
					selected: document.querySelector('.tree-card.is-selected')?.dataset.treePerson,
				};
				setter.call(select, 'p2');
				select.dispatchEvent(new Event('change', { bubbles: true }));
				await new Promise((resolve) => setTimeout(resolve, 180));
				return after;
			})()`,
		);
		checkFeature(
			"head switch updates the route and selection",
			head?.hash === "#/tree/p7" &&
				head?.head === "p7" &&
				head?.selected === "p7",
			head,
		);

		const drag = await evaluate(
			client,
			`(async () => {
				const cards = [...document.querySelectorAll('.tree-card')];
				const from = cards.find((card) => card.dataset.treePerson === 'p2');
				const to = cards.find((card) => card.dataset.treePerson === 'p1');
				from.focus();
				const a = from.getBoundingClientRect();
				const b = to.getBoundingClientRect();
				const sx = a.left + a.width / 2;
				const sy = a.top + a.height / 2;
				const tx = b.left + b.width / 2;
				const ty = b.top + b.height / 2;
				from.dispatchEvent(
					new PointerEvent('pointerdown', {
						bubbles: true,
						button: 0,
						clientX: sx,
						clientY: sy,
						pointerId: 1,
					}),
				);
				await new Promise((resolve) => setTimeout(resolve, 60));
				window.dispatchEvent(
					new PointerEvent('pointermove', {
						bubbles: true,
						button: 0,
						clientX: tx,
						clientY: ty,
						pointerId: 1,
					}),
				);
				window.dispatchEvent(
					new PointerEvent('pointerup', {
						bubbles: true,
						button: 0,
						clientX: tx,
						clientY: ty,
						pointerId: 1,
					}),
				);
				await new Promise((resolve) => setTimeout(resolve, 100));
				const dialog = document.querySelector('.modal');
				const first = dialog?.querySelector('button');
				return {
					dialog: Boolean(dialog),
					title: dialog?.querySelector('h2')?.textContent,
					focused: document.activeElement?.getAttribute('data-link-choice'),
					pressed: document.activeElement?.getAttribute('aria-pressed'),
					bodyLocked: document.body.style.overflow,
					firstText: first?.textContent,
				};
			})()`,
		);
		checkFeature(
			"drag opens an accessible relation dialog",
			drag?.dialog === true &&
				drag?.focused === "partner" &&
				drag?.pressed === "true" &&
				drag?.bodyLocked === "hidden",
			drag,
		);

		const trap = await evaluate(
			client,
			`(async () => {
				const buttons = [...document.querySelectorAll('.modal button')];
				const last = buttons.at(-1);
				last.focus();
				window.dispatchEvent(
					new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
				);
				await new Promise((resolve) => setTimeout(resolve, 40));
				return {
					focused: document.activeElement?.getAttribute('data-link-choice'),
					first: buttons[0]?.getAttribute('data-link-choice'),
				};
			})()`,
		);
		checkFeature("dialog traps Tab focus", trap?.focused === trap?.first, trap);

		const closed = await evaluate(
			client,
			`(async () => {
				window.dispatchEvent(
					new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
				);
				await new Promise((resolve) => setTimeout(resolve, 80));
				return {
					dialog: Boolean(document.querySelector('.modal')),
					focused: document.activeElement?.dataset.treePerson,
					bodyLocked: document.body.style.overflow,
					edges: document.querySelectorAll('.tree-edge').length,
				};
			})()`,
		);
		checkFeature(
			"Escape closes and returns focus",
			closed?.dialog === false &&
				closed?.focused === "p2" &&
				closed?.bodyLocked === "" &&
				closed?.edges === 7,
			closed,
		);

		const zoom = await evaluate(
			client,
			`(async () => {
				const card = document.querySelector('.tree-card');
				card.focus();
				const before = document.querySelector('.tree-scale')?.textContent;
				card.dispatchEvent(
					new KeyboardEvent('keydown', { key: '+', bubbles: true }),
				);
				await new Promise((resolve) => setTimeout(resolve, 60));
				const zoomed = document.querySelector('.tree-scale')?.textContent;
				card.dispatchEvent(
					new KeyboardEvent('keydown', { key: '0', bubbles: true }),
				);
				await new Promise((resolve) => setTimeout(resolve, 60));
				const reset = document.querySelector('.tree-scale')?.textContent;
				return { before, zoomed, reset };
			})()`,
		);
		checkFeature(
			"keyboard zoom and reset work",
			zoom?.before !== zoom?.zoomed && zoom?.reset === zoom?.before,
			zoom,
		);

		await client.send("Emulation.setDeviceMetricsOverride", {
			width: 390,
			height: 844,
			deviceScaleFactor: 1,
			mobile: false,
		});
		await client.send("Page.reload", { ignoreCache: false });
		await poll(
			client,
			"document.querySelectorAll('.tree-card').length === 8",
			10_000,
		);
		await sleep(250);
		const mobile = await evaluate(
			client,
			`(() => {
				const card = document.querySelector('.tree-card');
				const viewport = document.querySelector('.tree-viewport');
				const canvas = document.querySelector('.tree-canvas');
				return {
					cardWidth: card ? Math.round(card.getBoundingClientRect().width) : 0,
					viewportWidth: viewport ? Math.round(viewport.getBoundingClientRect().width) : 0,
					canvasHeight: canvas ? Math.round(canvas.getBoundingClientRect().height) : 0,
					scrollWidth: document.documentElement.scrollWidth,
					innerWidth,
				};
			})()`,
		);
		checkFeature(
			"mobile tree opens at a readable zoom",
			(mobile?.cardWidth ?? 0) >= 100 &&
				(mobile?.scrollWidth ?? 1) <= (mobile?.innerWidth ?? 0) + 1,
			mobile,
		);

		const report = {
			checks: checks + features.length,
			routeChecks: checks,
			featureChecks: features.length,
			widths: WIDTHS,
			locales: LOCALES,
			routes: ROUTES.map((route) => route.name),
			screenshots: written,
			features,
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
