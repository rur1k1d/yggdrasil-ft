#!/usr/bin/env node
// Pages-mount probe: copies the built dist under a temporary /yggdrasil-ft/
// directory, serves it from a dependency-free static server, and boots it in
// headless Chromium over CDP. Verifies relative manifest fields, icon and
// start_url resolution, service-worker scope, installability, and offline boot
// after the server is stopped.
// Fails (exit 1) on: absolute asset leaks, manifest errors, installability
// errors, wrong SW scope, console errors/exceptions, or external requests.

import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize, sep } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 4180;
const DEBUG_PORT = 9225;
const BASE = "/yggdrasil-ft/";
const ORIGIN = `http://127.0.0.1:${PORT}`;
const APP_URL = `${ORIGIN}${BASE}`;
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`;
const CHROMIUM = process.env.CHROMIUM_BIN ?? "/usr/bin/chromium";
const DIST = join(process.cwd(), "dist");

const MIME = {
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".ico": "image/x-icon",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json",
	".png": "image/png",
	".svg": "image/svg+xml",
	".webmanifest": "application/manifest+json",
	".woff2": "font/woff2",
};

const children = [];
const seenTargets = new Set();
let phase = "online";
const consoleErrors = [];
const exceptions = [];
const externalRequests = [];

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

function startStaticServer(root) {
	const server = createServer(async (req, res) => {
		const notFound = () => {
			res.writeHead(404, { "content-type": "text/plain" });
			res.end("not found");
		};
		try {
			const url = new URL(req.url ?? "/", ORIGIN);
			const pathname = decodeURIComponent(url.pathname);
			if (pathname === BASE.slice(0, -1)) {
				res.writeHead(301, { location: BASE });
				res.end();
				return;
			}
			const rel = pathname.startsWith(BASE)
				? pathname.slice(BASE.length)
				: null;
			if (rel === null) {
				notFound();
				return;
			}
			const target = normalize(join(root, rel || "index.html"));
			if (target !== root && !target.startsWith(root + sep)) {
				notFound();
				return;
			}
			const info = await stat(target).catch(() => null);
			const file = info?.isDirectory() ? join(target, "index.html") : target;
			const body = await readFile(file);
			res.writeHead(200, {
				"cache-control": "no-store",
				"content-type": MIME[extname(file)] ?? "application/octet-stream",
			});
			res.end(body);
		} catch {
			notFound();
		}
	});
	return new Promise((resolve) => {
		server.listen(PORT, "127.0.0.1", () => resolve(server));
	});
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

const INFO_EXPRESSION = `(async () => {
	const reg = await navigator.serviceWorker.getRegistration();
	const manifestUrl = document.querySelector('link[rel=manifest]').href;
	const manifest = await (await fetch(manifestUrl)).json();
	const base = new URL('.', manifestUrl).href;
	const icons = await Promise.all(manifest.icons.map(async (icon) => ({
		src: icon.src,
		resolved: new URL(icon.src, base).href,
		status: (await fetch(new URL(icon.src, base))).status,
	})));
	const startStatus = (await fetch(new URL(manifest.start_url, base))).status;
	const assets = performance.getEntriesByType('resource')
		.map((entry) => entry.name)
		.filter((name) => /\\.(js|css|svg|png|webmanifest)$/.test(name));
	const leaks = assets.filter((name) => {
		const path = new URL(name).pathname;
		return path.startsWith('/assets/') || path.startsWith('/icons/');
	});
	return {
		scope: reg?.scope,
		script: reg?.active?.scriptURL,
		manifestUrl,
		manifest: { start_url: manifest.start_url, scope: manifest.scope, display: manifest.display },
		icons,
		startStatus,
		absoluteAssetLeaks: leaks,
	};
})()`;

async function main() {
	const profile = await mkdtemp(join(tmpdir(), "ygg-mount-probe-"));
	const mount = await mkdtemp(join(tmpdir(), "ygg-mount-"));
	const appDir = join(mount, "yggdrasil-ft");
	let server = null;
	try {
		await cp(DIST, appDir, { recursive: true });
		server = await startStaticServer(appDir);
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
		await sleep(500);

		const appManifest = await client.send("Page.getAppManifest");
		const installability = await client
			.send("Page.getInstallabilityErrors")
			.catch(() => ({ installabilityErrors: [{ errorId: "unavailable" }] }));
		const info = await evaluate(client, INFO_EXPRESSION);

		phase = "offline";
		server.close();
		server.closeAllConnections?.();
		server = null;
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
		await sleep(500);

		const manifestErrors = appManifest.errors ?? [];
		const installabilityErrors = installability.installabilityErrors ?? [];
		const report = {
			onlineBoot,
			swControlled,
			manifest: {
				url: appManifest.url,
				errors: manifestErrors,
				installabilityErrors,
			},
			info,
			offlineBoot,
			offlineSwControlled,
			consoleErrors,
			exceptions,
			externalRequests,
		};
		console.log(JSON.stringify(report, null, 2));

		const passed =
			onlineBoot &&
			swControlled &&
			manifestErrors.length === 0 &&
			installabilityErrors.length === 0 &&
			info?.scope === `${ORIGIN}${BASE}` &&
			info?.script === `${ORIGIN}${BASE}sw.js` &&
			info?.icons?.length === 3 &&
			info.icons.every((icon) => icon.status === 200) &&
			info?.startStatus === 200 &&
			info?.absoluteAssetLeaks?.length === 0 &&
			offlineBoot &&
			offlineSwControlled &&
			consoleErrors.length === 0 &&
			exceptions.length === 0 &&
			externalRequests.length === 0;
		console.log(passed ? "MOUNT PROBE: PASS" : "MOUNT PROBE: FAIL");
		process.exitCode = passed ? 0 : 1;
	} finally {
		server?.close();
		server?.closeAllConnections?.();
		killAll();
		await sleep(300);
		await rm(profile, { recursive: true, force: true });
		await rm(mount, { recursive: true, force: true });
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
