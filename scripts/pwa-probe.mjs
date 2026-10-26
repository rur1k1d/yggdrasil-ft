#!/usr/bin/env node
// PWA/dist probe: boots the built app in headless Chromium over CDP,
// verifies app render + service-worker control, then kills the static
// server and reloads to prove offline (SW-served) boot.
// Fails (exit 1) on: no boot, no SW control, console errors/exceptions,
// or any request leaving 127.0.0.1/localhost.

import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 4173;
const DEBUG_PORT = 9223;
const APP_URL = `http://127.0.0.1:${PORT}/`;
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`;
const CHROMIUM = process.env.CHROMIUM_BIN ?? "/usr/bin/chromium";

const children = [];
const seenTargets = new Set();
let phase = "online";
const consoleErrors = [];
const exceptions = [];
const externalRequests = [];
const allRequests = [];

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
			if (res.ok) {
				return true;
			}
		} catch {
			// not up yet, retry
		}
		await sleep(200);
	}
	return false;
}

async function fetchJson(url) {
	const res = await fetch(url);
	return res.json();
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
				// ignore non-JSON frames
				return;
			}
			if (typeof msg.id === "number" && pending.has(msg.id)) {
				const { resolve: done, reject: fail } = pending.get(msg.id);
				pending.delete(msg.id);
				if (msg.error) {
					fail(new Error(msg.error.message));
				} else {
					done(msg.result);
				}
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
					if (!handlers.has(method)) {
						handlers.set(method, []);
					}
					handlers.get(method).push(handler);
				},
				close() {
					ws.close();
				},
			});
		});
	});
}

function remoteText(args = []) {
	return args
		.map(
			(arg) =>
				arg.value ??
				arg.description ??
				arg.unserializableValue ??
				arg.type ??
				"?",
		)
		.join(" ");
}

function isExternal(rawUrl) {
	let url;
	try {
		url = new URL(rawUrl);
	} catch {
		return false;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return false;
	}
	return !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
}

function hookCollectors(client) {
	client.on("Runtime.consoleAPICalled", (params) => {
		if (params.type === "error" || params.type === "assert") {
			consoleErrors.push({ phase, text: remoteText(params.args) });
		}
	});
	client.on("Runtime.exceptionThrown", (params) => {
		const details = params.exceptionDetails ?? {};
		const exception = details.exception ?? {};
		exceptions.push({
			phase,
			text: details.text ?? exception.description ?? "unknown exception",
		});
	});
	client.on("Log.entryAdded", (params) => {
		const entry = params.entry ?? {};
		if (entry.level === "error") {
			consoleErrors.push({
				phase,
				text: `${entry.source ?? "log"}: ${entry.text ?? ""}`,
			});
		}
	});
	client.on("Network.requestWillBeSent", (params) => {
		const url = params.request?.url ?? "";
		allRequests.push({ phase, url, fromSW: params.fromServiceWorker === true });
		if (isExternal(url)) {
			externalRequests.push({ phase, url });
		}
	});
}

async function evaluate(client, expression) {
	try {
		const result = await client.send("Runtime.evaluate", {
			expression,
			returnByValue: true,
			awaitPromise: true,
		});
		if (result.exceptionDetails) {
			return null;
		}
		return result.result?.value ?? null;
	} catch {
		return null;
	}
}

async function poll(expression, client, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const value = await evaluate(client, expression);
		if (value === true) {
			return true;
		}
		await sleep(250);
	}
	return false;
}

const BOOT_EXPRESSION =
	"document.querySelector('#app nav') !== null && document.querySelectorAll('#app nav a').length === 4 && document.querySelector('#app main') !== null";
const SW_EXPRESSION = "navigator.serviceWorker.controller !== null";

async function dismissIntro(client) {
	const seen = await poll(
		"document.querySelector('.intro-splash__skip') !== null",
		client,
		3_000,
	);
	if (seen) {
		await evaluate(
			client,
			"document.querySelector('.intro-splash__skip')?.click()",
		);
		await sleep(200);
	}
}

async function attachNewTargets() {
	let targets = [];
	try {
		targets = await fetchJson(`${DEBUG_URL}/json/list`);
	} catch {
		return;
	}
	for (const target of targets) {
		if (!["page", "service_worker"].includes(target.type)) {
			continue;
		}
		if (seenTargets.has(target.id)) {
			continue;
		}
		seenTargets.add(target.id);
		try {
			const client = await attachClient(target.webSocketDebuggerUrl);
			hookCollectors(client);
			await client.send("Runtime.enable");
			await client.send("Log.enable");
			await client.send("Network.enable");
		} catch {
			// target may have terminated between listing and attaching
		}
	}
}

async function main() {
	const profile = await mkdtemp(join(tmpdir(), "ygg-pwa-probe-"));
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
			throw new Error(`vite preview did not start: ${previewLog.slice(-500)}`);
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

		const targets = await fetchJson(`${DEBUG_URL}/json/list`);
		const pageTarget = targets.find((target) => target.type === "page");
		if (!pageTarget) {
			throw new Error("no page target exposed by chromium");
		}
		seenTargets.add(pageTarget.id);
		const client = await attachClient(pageTarget.webSocketDebuggerUrl);
		hookCollectors(client);
		await client.send("Page.enable");
		await client.send("Runtime.enable");
		await client.send("Log.enable");
		await client.send("Network.enable");

		const navResult = await client.send("Page.navigate", { url: APP_URL });
		if (navResult.errorText) {
			throw new Error(`navigation failed: ${navResult.errorText}`);
		}

		await dismissIntro(client);
		const onlineBoot = await poll(BOOT_EXPRESSION, client, 15_000);
		const swControlled = await poll(SW_EXPRESSION, client, 15_000);
		await attachNewTargets();

		phase = "offline";
		preview.kill("SIGTERM");
		await sleep(750);

		const reloadResult = await client.send("Page.reload", {
			ignoreCache: false,
		});
		if (reloadResult?.errorText) {
			throw new Error(`reload failed: ${reloadResult.errorText}`);
		}
		await dismissIntro(client);
		const offlineBoot = await poll(BOOT_EXPRESSION, client, 15_000);
		const offlineSwControlled = await poll(SW_EXPRESSION, client, 5_000);
		await attachNewTargets();
		await sleep(1_000);

		const report = {
			online: {
				appBooted: onlineBoot,
				serviceWorkerControlled: swControlled,
			},
			offline: {
				appBooted: offlineBoot,
				serviceWorkerControlled: offlineSwControlled,
			},
			consoleErrors,
			exceptions,
			externalRequests,
			requests: {
				total: allRequests.length,
				fromServiceWorker: allRequests.filter((req) => req.fromSW).length,
				uniqueHosts: [
					...new Set(
						allRequests.map((req) => {
							try {
								return new URL(req.url).host;
							} catch {
								return "unparseable";
							}
						}),
					),
				],
			},
		};
		console.log(JSON.stringify(report, null, 2));

		const passed =
			onlineBoot &&
			swControlled &&
			offlineBoot &&
			offlineSwControlled &&
			consoleErrors.length === 0 &&
			exceptions.length === 0 &&
			externalRequests.length === 0;
		console.log(passed ? "PROBE: PASS" : "PROBE: FAIL");
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
