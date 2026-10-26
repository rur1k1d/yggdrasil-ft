// @ts-nocheck

import { useEffect, useRef } from "preact/hooks";

export interface DataRainPalette {
	calm?: string;
	mid?: string;
	hot?: string;
}

export interface DataRainProps {
	className?: string;
	count?: number;
	flowSpeed?: number;
	obstacleRadius?: number;
	autopilot?: boolean;
	fullscreen?: boolean;
	palette?: DataRainPalette;
	onReady?: () => void;
}

interface EngineApi {
	refresh: () => void;
}

type RGB = readonly [number, number, number];

const MAX = 3500;
const L = 16;
const STEP = 1 / 60;
const PUFFS = 24;
const TAU = Math.PI * 2;
const AGE_BUCKETS = 6;
const SEGS_PER_BUCKET = 2;

const DEFAULT_CALM: RGB = [34, 230, 255];
const DEFAULT_MID: RGB = [201, 162, 39];
const DEFAULT_HOT: RGB = [255, 61, 154];
const DEFAULT_CORE: RGB = [234, 252, 255];

const BASE_ALPHA = [0.18, 0.28, 0.42];
const BASE_WIDTH = [0.6, 0.8, 1.0];
const ALPHA_GAIN = 1.2;
const HEAD_WIDTH = 1.2;

const K_RELAX = 1 - Math.exp(-STEP / 0.12);
const K_Q = 1 - Math.exp(-STEP * 8);
const K_CURSOR = 1 - Math.exp(-STEP * 18);
const K_VEL = 1 - Math.exp(-STEP * 10);
const K_IN = 1 - Math.exp(-STEP / 0.06);
const K_OUT = 1 - Math.exp(-STEP / 0.2);
const FIRE_P = 0.025 * STEP;
const FIRE_DECAY = Math.exp(-STEP / 0.45);
const PUFF_DECAY = Math.exp(-STEP / 1.1);

function clamp(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function parseHex(input: string | undefined, fallback: RGB): RGB {
	if (!input) return fallback;
	let s = input.trim().replace(/^#/, "");
	if (s.length === 3) {
		s =
			s.charAt(0) +
			s.charAt(0) +
			s.charAt(1) +
			s.charAt(1) +
			s.charAt(2) +
			s.charAt(2);
	}
	if (!/^[0-9a-fA-F]{6}$/.test(s)) return fallback;
	const n = parseInt(s, 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface Wave {
	kx: number;
	ky: number;
	om: number;
	ph: number;
	au: number;
	av: number;
}

function makeWave(
	lambda: number,
	angle: number,
	omega: number,
	phase: number,
	amp: number,
): Wave {
	const k = TAU / lambda;
	return {
		kx: k * Math.cos(angle),
		ky: k * Math.sin(angle),
		om: omega,
		ph: phase,
		au: amp * Math.sin(angle),
		av: -amp * Math.cos(angle),
	};
}

const WAVE_0 = makeWave(380, 0.35, 0.18, 0.7, 14);
const WAVE_1 = makeWave(620, 1.9, 0.27, 2.1, 11);
const WAVE_2 = makeWave(900, 3.4, 0.35, 4.2, 9);

export default function DataRain(props: DataRainProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	const mainRef = useRef<HTMLCanvasElement>(null);
	const bloomRef = useRef<HTMLCanvasElement>(null);
	const propsRef = useRef<DataRainProps>(props);
	const apiRef = useRef<EngineApi | null>(null);
	propsRef.current = props;

	useEffect(() => {
		const rootEl = rootRef.current;
		const main = mainRef.current;
		const bloom = bloomRef.current;
		if (!rootEl || !main || !bloom) return;
		const root = rootEl;
		const ctx = main.getContext("2d") as any;
		const bctx = bloom.getContext("2d") as any;
		if (!ctx || !bctx) return;

		const reduced =
			typeof window !== "undefined" &&
			typeof window.matchMedia === "function" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		const rand = mulberry32(7);

		let disposed = false;
		let initialised = false;
		let live = false;

		let w = 0;
		let h = 0;
		let dpr = 1;
		let bw = 1;
		let bh = 1;

		const px = new Float32Array(MAX);
		const py = new Float32Array(MAX);
		const vx = new Float32Array(MAX);
		const vy = new Float32Array(MAX);
		const pz = new Float32Array(MAX);
		const v0 = new Float32Array(MAX);
		const qv = new Float32Array(MAX);
		const fire = new Float32Array(MAX);
		const lenArr = new Uint8Array(MAX);
		const hx = new Float32Array(MAX * L);
		const hy = new Float32Array(MAX * L);
		let head = 0;

		const groupList: Int32Array[] = [];
		for (let g = 0; g < 6; g++) groupList.push(new Int32Array(MAX));
		const groupCountArr = new Int32Array(6);

		const strokeStyles: string[] = new Array<string>(6 * AGE_BUCKETS).fill("");
		const strokeWidths = new Float32Array(6 * AGE_BUCKETS);
		const headStyles: string[] = ["", ""];
		let haloGradient: CanvasGradient | null = null;

		const pX = new Float32Array(PUFFS);
		const pY = new Float32Array(PUFFS);
		const pGamma = new Float32Array(PUFFS);
		const pAge = new Float32Array(PUFFS);
		const pAliveArr = new Uint8Array(PUFFS);
		const aX = new Float32Array(PUFFS);
		const aY = new Float32Array(PUFFS);
		const aG = new Float32Array(PUFFS);
		const aC2 = new Float32Array(PUFFS);
		const aR2 = new Float32Array(PUFFS);
		let aCount = 0;
		let puffCursor = 0;
		let shedSign = 1;
		let shedAcc = 0;

		let simTime = 0;
		let liveTime = 0;
		let activeCount = 0;
		let targetCount = 0;
		let quality = 1;

		let pointerActive = false;
		let pointerX = 0;
		let pointerY = 0;
		let idleSince = 0;
		let idleDelay = 1.2;
		let prevSrc = 0;
		let tgtX = 0;
		let tgtY = 0;
		let cx = 0;
		let cy = 0;
		let pcx = 0;
		let pcy = 0;
		let vcx = 0;
		let vcy = 0;
		let influence = 0;
		let curA = 48;

		let raf = 0;
		let last = 0;
		let acc = 0;
		let frameEma = 16.7;
		let workEma = 4;
		let slowFrames = 0;
		let fastFrames = 0;

		const buildStyles = () => {
			const cs = getComputedStyle(root);
			const pal = propsRef.current.palette;
			const calm = parseHex(
				pal?.calm ?? (cs.getPropertyValue("--dr-calm") || "#22e6ff"),
				DEFAULT_CALM,
			);
			const mid = parseHex(
				pal?.mid ?? (cs.getPropertyValue("--dr-mid") || "#c9a227"),
				DEFAULT_MID,
			);
			const hot = parseHex(
				pal?.hot ?? (cs.getPropertyValue("--dr-hot") || "#ff3d9a"),
				DEFAULT_HOT,
			);
			const core = parseHex(
				cs.getPropertyValue("--dr-core") || "#eafcff",
				DEFAULT_CORE,
			);
			const colours: RGB[] = [calm, mid, hot];

			for (let g = 0; g < 6; g++) {
				const depth = g < 3 ? 0 : 1;
				const bucket = g % 3;
				const c = colours[bucket]!;
				for (let ab = 0; ab < AGE_BUCKETS; ab++) {
					const falloff = (1 - (ab + 0.5) / AGE_BUCKETS) ** 1.5;
					const alpha = Math.min(
						0.9,
						(BASE_ALPHA[bucket] ?? 0.3) *
							(depth === 0 ? 0.5 : 0.9) *
							falloff *
							ALPHA_GAIN,
					);
					strokeStyles[g * AGE_BUCKETS + ab] =
						`rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(3)})`;
					const width =
						(BASE_WIDTH[bucket] ?? 0.8) *
						(depth === 0 ? 0.7 : 0.9) *
						(1 - (0.4 * ab) / AGE_BUCKETS);
					strokeWidths[g * AGE_BUCKETS + ab] = clamp(width, 0.5, 1.1);
				}
			}
			headStyles[0] = `rgba(${core[0]},${core[1]},${core[2]},0.4)`;
			headStyles[1] = `rgba(${core[0]},${core[1]},${core[2]},0.75)`;

			const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
			grad.addColorStop(0, `rgba(${mid[0]},${mid[1]},${mid[2]},0.9)`);
			grad.addColorStop(0.45, `rgba(${mid[0]},${mid[1]},${mid[2]},0.25)`);
			grad.addColorStop(1, `rgba(${mid[0]},${mid[1]},${mid[2]},0)`);
			haloGradient = grad;
		};

		const seedParticle = (i: number, uniform: boolean) => {
			let x: number;
			let y: number;
			if (uniform) {
				x = rand() * w;
				y = rand() * h;
			} else {
				x = -40 + rand() * (w + 80);
				y = -40 - rand() * 80;
			}
			const z = 0.35 + 0.65 * rand();
			const nominal = 60 + 70 * z * z;
			const flow = clamp(propsRef.current.flowSpeed ?? 1, 0.05, 5);
			pz[i] = z;
			v0[i] = nominal;
			lenArr[i] = 8 + Math.floor(rand() * 9);
			px[i] = x;
			py[i] = y;
			vx[i] = 0;
			vy[i] = nominal * flow;
			qv[i] = 1;
			fire[i] = 0;
			const base = i * L;
			for (let k = 0; k < L; k++) {
				hx[base + k] = x;
				hy[base + k] = y;
			}
		};

		const seedAll = () => {
			for (let i = 0; i < MAX; i++) seedParticle(i, true);
		};

		const setActive = (n: number, uniform: boolean) => {
			const next = clamp(Math.round(n), 1, MAX);
			for (let i = activeCount; i < next; i++) seedParticle(i, uniform);
			activeCount = next;
		};

		const applyCount = (uniform: boolean) => {
			const auto = clamp(Math.round((w * h) / 650), 800, 2600);
			const requested = propsRef.current.count;
			targetCount = clamp(
				Math.round(requested !== undefined ? requested : auto),
				1,
				MAX,
			);
			setActive(targetCount * quality, uniform);
		};

		const spawnPuff = (a: number, speed: number) => {
			const dxn = vcx / speed;
			const dyn = vcy / speed;
			const sign = shedSign;
			shedSign = -shedSign;
			const j = puffCursor;
			puffCursor = (puffCursor + 1) % PUFFS;
			pX[j] = cx - dxn * 0.6 * a - dyn * sign * 0.7 * a;
			pY[j] = cy - dyn * 0.6 * a + dxn * sign * 0.7 * a;
			pGamma[j] = clamp(sign * Math.min(speed, 900) * a * 1.2, -80000, 80000);
			pAge[j] = 0;
			pAliveArr[j] = 1;
		};

		const simulate = () => {
			const p = propsRef.current;
			const flow = clamp(p.flowSpeed ?? 1, 0.05, 5);
			const obsR = p.obstacleRadius ?? 56;
			const autopilotOn = p.autopilot ?? true;

			head = (head + 1) % L;
			simTime += STEP;
			if (live) liveTime += STEP;

			const ghostOn =
				!reduced &&
				autopilotOn &&
				!pointerActive &&
				live &&
				liveTime - idleSince >= idleDelay;
			const src = pointerActive ? 2 : ghostOn ? 1 : 0;
			if (src === 1) {
				tgtX = w * (0.5 + 0.28 * Math.sin(0.37 * liveTime));
				tgtY = h * (0.5 + 0.24 * Math.sin(0.53 * liveTime + 1.2));
			} else if (src === 2) {
				tgtX = pointerX;
				tgtY = pointerY;
			}
			const snap = src !== 0 && prevSrc === 0 && influence < 0.05;
			prevSrc = src;

			if (snap) {
				cx = tgtX;
				cy = tgtY;
				pcx = cx;
				pcy = cy;
				vcx = 0;
				vcy = 0;
			} else {
				pcx = cx;
				pcy = cy;
				cx += (tgtX - cx) * K_CURSOR;
				cy += (tgtY - cy) * K_CURSOR;
				vcx += ((cx - pcx) / STEP - vcx) * K_VEL;
				vcy += ((cy - pcy) / STEP - vcy) * K_VEL;
			}

			influence +=
				((src !== 0 ? 1 : 0) - influence) * (src !== 0 ? K_IN : K_OUT);
			const infl = influence;

			const vcMag = Math.sqrt(vcx * vcx + vcy * vcy);
			const a = obsR + Math.min(vcMag * 0.02, 28);
			curA = a;

			if (infl > 0.3 && vcMag > 50) {
				const dxm = cx - pcx;
				const dym = cy - pcy;
				shedAcc += Math.sqrt(dxm * dxm + dym * dym);
				let guard = 0;
				while (shedAcc >= 32 && guard < 3) {
					shedAcc -= 32;
					guard++;
					spawnPuff(a, vcMag);
				}
				if (shedAcc >= 32) shedAcc = 0;
			} else {
				shedAcc = 0;
			}

			aCount = 0;
			const puffDrift = 0.4 * 100 * flow * STEP;
			for (let j = 0; j < PUFFS; j++) {
				if (pAliveArr[j] === 0) continue;
				const age = pAge[j] + STEP;
				if (age > 2.0) {
					pAliveArr[j] = 0;
					continue;
				}
				pAge[j] = age;
				pGamma[j] *= PUFF_DECAY;
				pY[j] += puffDrift;
				const c2 = 576 + 80 * age;
				aX[aCount] = pX[j];
				aY[aCount] = pY[j];
				aG[aCount] = pGamma[j] / TAU;
				aC2[aCount] = c2;
				aR2[aCount] = 32 * c2;
				aCount++;
			}

			const ph0 = WAVE_0.om * simTime + WAVE_0.ph;
			const ph1 = WAVE_1.om * simTime + WAVE_1.ph;
			const ph2 = WAVE_2.om * simTime + WAVE_2.ph;
			const k0x = WAVE_0.kx;
			const k0y = WAVE_0.ky;
			const k1x = WAVE_1.kx;
			const k1y = WAVE_1.ky;
			const k2x = WAVE_2.kx;
			const k2y = WAVE_2.ky;
			const a0u = WAVE_0.au;
			const a0v = WAVE_0.av;
			const a1u = WAVE_1.au;
			const a1v = WAVE_1.av;
			const a2u = WAVE_2.au;
			const a2v = WAVE_2.av;

			const obsOn = infl > 0.002;
			const projectOn = infl > 0.05;
			const projScale = Math.min(1, infl * 1.5);
			const respawnBottom = h + 40;
			const respawnRight = w + 120;

			for (let i = 0; i < activeCount; i++) {
				const x0 = px[i] ?? 0;
				const y0 = py[i] ?? 0;
				const z = pz[i] ?? 0.5;
				const v0e = (v0[i] ?? 60) * flow;

				const c0 = Math.cos(k0x * x0 + k0y * y0 + ph0);
				const c1 = Math.cos(k1x * x0 + k1y * y0 + ph1);
				const c2 = Math.cos(k2x * x0 + k2y * y0 + ph2);
				let tx = (a0u * c0 + a1u * c1 + a2u * c2) * z;
				let ty = v0e + (a0v * c0 + a1v * c1 + a2v * c2) * z;

				const zf = 0.55 + 0.45 * z;
				const aE = a * zf;
				const rx = x0 - cx;
				const ry = y0 - cy;

				let pertX = 0;
				let pertY = 0;
				let deficit = 0;

				if (obsOn) {
					const d2 = rx * rx + ry * ry;
					let Ux = -vcx;
					let Uy = v0e - vcy;
					let U = Math.sqrt(Ux * Ux + Uy * Uy);
					if (U > 1e-3) {
						if (U > 800) {
							const sc = 800 / U;
							Ux *= sc;
							Uy *= sc;
							U = 800;
						}
						const ex = Ux / U;
						const ey = Uy / U;
						const s = rx * ex + ry * ey;
						const n = -rx * ey + ry * ex;

						if (s > 0 && s < 10 * aE) {
							const wd = 0.8 * aE + 0.18 * s;
							const nn = n / wd;
							deficit = 0.5 * Math.exp(-s / (2.8 * aE)) * Math.exp(-nn * nn);
						}

						const near = 8 * aE;
						if (d2 < near * near) {
							const rho2 = Math.max(s * s + n * n, aE * aE * 0.6);
							const k = (aE * aE) / (rho2 * rho2);
							const ds = -U * k * (s * s - n * n);
							const dn = -U * k * 2 * s * n;
							let win = 1;
							const inner = 4.5 * aE;
							if (d2 > inner * inner) {
								const t = (Math.sqrt(d2) - inner) / (3.5 * aE);
								win = 1 - t * t * (3 - 2 * t);
							}
							pertX = (ds * ex - dn * ey) * win;
							pertY = (ds * ey + dn * ex) * win;
						}
					}
				}

				let vorX = 0;
				let vorY = 0;
				for (let j = 0; j < aCount; j++) {
					const dx = x0 - (aX[j] ?? 0);
					const dy = y0 - (aY[j] ?? 0);
					const d2p = dx * dx + dy * dy + 1e-3;
					const r2 = aR2[j] ?? 0;
					if (d2p < r2) {
						const f =
							((aG[j] ?? 0) * (1 - Math.exp(-d2p / (aC2[j] ?? 1)))) / d2p;
						const wnd = 1 - d2p / r2;
						const fw = f * wnd * wnd * zf;
						vorX += -dy * fw;
						vorY += dx * fw;
					}
				}

				const keep = 1 - deficit * infl;
				tx = tx * keep + pertX * infl + vorX;
				ty = ty * keep + pertY * infl + vorY;

				let ux = vx[i] + (tx - vx[i]) * K_RELAX;
				let uy = vy[i] + (ty - vy[i]) * K_RELAX;
				const sp2 = ux * ux + uy * uy;
				if (sp2 > 640000) {
					const sc = 800 / Math.sqrt(sp2);
					ux *= sc;
					uy *= sc;
				}
				let x = (x0 ?? 0) + ux * STEP;
				let y = (y0 ?? 0) + uy * STEP;

				if (projectOn) {
					const aP = aE * projScale;
					const qx = x - cx;
					const qy = y - cy;
					const q2 = qx * qx + qy * qy;
					const lim = 0.98 * aP;
					if (q2 < lim * lim) {
						const rr = Math.sqrt(q2);
						const nx = rr < 1e-3 ? 0 : qx / rr;
						const ny = rr < 1e-3 ? 1 : qy / rr;
						x = cx + nx * aP;
						y = cy + ny * aP;
						const vn = (ux - vcx) * nx + (uy - vcy) * ny;
						if (vn < 0) {
							ux -= vn * nx;
							uy -= vn * ny;
						}
					}
				}

				vx[i] = ux;
				vy[i] = uy;
				(px as any)[i] = x;
				(py as any)[i] = y;

				if (y > respawnBottom || x < -120 || x > respawnRight || y < -600) {
					seedParticle(i, false);
					continue;
				}

				(qv as any)[i] =
					((qv as any)[i] ?? 1) +
					(Math.sqrt(ux * ux + uy * uy) / v0e - ((qv as any)[i] ?? 1)) * K_Q;

				if (rand() < FIRE_P) {
					(fire as any)[i] = 1;
				} else {
					const f = ((fire as any)[i] ?? 0) * FIRE_DECAY;
					(fire as any)[i] = f < 0.01 ? 0 : f;
				}

				const slot = i * L + head;
				(hx as any)[slot] = x;
				(hy as any)[slot] = y;
			}
		};

		const render = () => {
			(ctx as any).setTransform(dpr, 0, 0, dpr, 0, 0);
			(ctx as any).clearRect(0, 0, w, h);
			(ctx as any).globalCompositeOperation = "lighter";
			(ctx as any).lineCap = "round";
			(ctx as any).lineJoin = "round";

			if ((influence as any) > 0.02 && haloGradient) {
				const speed = Math.sqrt(
					(vcx as any) * (vcx as any) + (vcy as any) * (vcy as any),
				);
				const r = 1.4 * (curA as any);
				(ctx as any).globalAlpha = Math.min(
					1,
					(0.04 + Math.min(speed / 4000, 0.06)) * (influence as any),
				);
				(ctx as any).setTransform(
					dpr * r,
					0,
					0,
					dpr * r,
					(dpr as any) * (cx as any),
					(dpr as any) * (cy as any),
				);
				(ctx as any).fillStyle = haloGradient as any;
				(ctx as any).fillRect(-1, -1, 2, 2);
				(ctx as any).globalAlpha = 1;
				(ctx as any).setTransform(dpr, 0, 0, dpr, 0, 0);
			}

			groupCountArr.fill(0);
			for (let i = 0; i < activeCount; i++) {
				const qq = qv[i] ?? 1;
				let b = qq < 1.25 ? 0 : qq < 1.85 ? 1 : 2;
				if ((fire[i] ?? 0) > 0.35 && b < 2) b++;
				const gIdx = (pz[i] ?? 0.5) < 0.62 ? 0 : 3;
				const g = gIdx + b;
				const gl = groupList[g];
				if (gl) gl[groupCountArr[g]++] = i;
			}

			for (let g = 0; g < 6; g++) {
				const cnt = groupCountArr[g] ?? 0;
				if (cnt === 0) continue;
				const list = groupList[g]!;
				for (let ab = 0; ab < AGE_BUCKETS; ab++) {
					const k0 = ab * SEGS_PER_BUCKET;
					const k1 = k0 + SEGS_PER_BUCKET;
					const style = (strokeStyles as any)[g * AGE_BUCKETS + ab];
					if (style) (ctx as any).strokeStyle = style;
					(ctx as any).lineWidth =
						(strokeWidths as any)[g * AGE_BUCKETS + ab] ?? 0.8;
					(ctx as any).beginPath();
					for (let j = 0; j < cnt; j++) {
						const i = list[j]!;
						const segs = (lenArr[i] ?? 1) - 1;
						if (k0 >= segs) continue;
						const base = i * L;
						const kEnd = Math.min(k1, segs);
						let idx = (head - k0 + L) % L;
						(ctx as any).moveTo(hx[base + idx] ?? 0, hy[base + idx] ?? 0);
						for (let k = k0; k < kEnd; k++) {
							idx = idx === 0 ? L - 1 : idx - 1;
							(ctx as any).lineTo(hx[base + idx] ?? 0, hy[base + idx] ?? 0);
						}
					}
					(ctx as any).stroke();
				}
			}

			const prevHead = head === 0 ? L - 1 : head - 1;
			(ctx as any).lineWidth = HEAD_WIDTH;
			for (let depth = 0; depth < 2; depth++) {
				const hs = (headStyles as any)[depth];
				if (hs) (ctx as any).strokeStyle = hs;
				(ctx as any).beginPath();
				for (let bb = 1; bb < 3; bb++) {
					const g = depth * 3 + bb;
					const cnt = (groupCountArr as any)[g] ?? 0;
					const list = (groupList as any)[g];
					if (!list) continue;
					for (let j = 0; j < cnt; j++) {
						const i = list[j];
						if (bb === 1 && ((fire as any)[i] ?? 0) <= 0.5) continue;
						const base = i * L;
						(ctx as any).moveTo(
							(hx as any)[base + head] ?? 0,
							(hy as any)[base + head] ?? 0,
						);
						(ctx as any).lineTo(
							(hx as any)[base + prevHead] ?? 0,
							(hy as any)[base + prevHead] ?? 0,
						);
					}
				}
				(ctx as any).stroke();
			}

			(bctx as any).clearRect(0, 0, bw, bh);
			(bctx as any).drawImage(main, 0, 0, bw, bh);
		};

		const presim = (seconds: number) => {
			const n = Math.round(seconds / STEP);
			for (let s = 0; s < n; s++) simulate();
		};

		const rebuildStatic = () => {
			seedAll();
			activeCount = 0;
			applyCount(true);
			pointerActive = true;
			pointerX = w * 0.4;
			pointerY = h * 0.45;
			tgtX = pointerX;
			tgtY = pointerY;
			cx = pcx = pointerX;
			cy = pcy = pointerY;
			vcx = 0;
			vcy = 0;
			influence = 1;
			prevSrc = 2;
			aCount = 0;
			for (let j = 0; j < PUFFS; j++) pAliveArr[j] = 0;
			presim(2.2);
			render();
		};

		const resize = () => {
			const rect = root?.getBoundingClientRect();
			if (!rect) return;
			const nw = Math.max(
				1,
				rect.width || (typeof window !== "undefined" ? window.innerWidth : 1),
			);
			const nh = Math.max(
				1,
				rect.height || (typeof window !== "undefined" ? window.innerHeight : 1),
			);
			let d = 1;
			if (typeof window !== "undefined") {
				d = Math.min(window.devicePixelRatio || 1, 1.6);
			}
			if (nw * nh * d * d > 4e6) d = Math.sqrt(4e6 / (nw * nh));
			if (nw === w && nh === h && d === dpr) return;

			w = nw;
			h = nh;
			dpr = d;
			main.width = Math.max(1, Math.round(w * dpr));
			main.height = Math.max(1, Math.round(h * dpr));
			bw = Math.max(1, Math.ceil(w / 4));
			bh = Math.max(1, Math.ceil(h / 4));
			bloom.width = bw;
			bloom.height = bh;
			(bctx as any).imageSmoothingEnabled = true;
			(bctx as any).imageSmoothingQuality = "medium";

			if (!initialised) return;
			if (reduced) {
				rebuildStatic();
				return;
			}
			for (let i = 0; i < activeCount; i++) {
				if (
					(px[i] ?? 0) < -120 ||
					(px[i] ?? 0) > w + 120 ||
					(py[i] ?? 0) > h + 40
				)
					seedParticle(i, false);
			}
			applyCount(true);
			render();
		};

		const onMove = (e: PointerEvent) => {
			const r = root?.getBoundingClientRect();
			if (!r) return;
			pointerX = e.clientX - r.left;
			pointerY = e.clientY - r.top;
			pointerActive = true;
		};
		const onLeave = () => {
			if (!pointerActive) return;
			pointerActive = false;
			idleSince = liveTime;
			idleDelay = 3.5;
		};
		const onUp = (e: PointerEvent) => {
			if (e.pointerType !== "mouse") onLeave();
		};

		const frame = (now: number) => {
			if (disposed) return;
			const dtRaw = Math.max(0, now - last);
			last = now;
			acc += Math.min(0.05, dtRaw / 1000);

			const t0 = performance.now();
			let n = 0;
			while (acc >= STEP && n < 2) {
				simulate();
				acc -= STEP;
				n++;
			}
			if (n === 2) acc = 0;
			if (n > 0) render();
			const work = performance.now() - t0;

			if (dtRaw > 0 && dtRaw < 100) {
				frameEma += (dtRaw - frameEma) * 0.05;
				workEma += (work - workEma) * 0.05;
			}
			if (frameEma > 20) {
				slowFrames++;
				fastFrames = 0;
			} else if (frameEma < 18.5 && workEma < 10) {
				fastFrames++;
				slowFrames = 0;
			} else {
				slowFrames = 0;
				fastFrames = 0;
			}
			if (slowFrames >= 60 && quality > 0.4) {
				quality = Math.max(0.4, quality - 0.1);
				slowFrames = 0;
				applyCount(false);
			} else if (fastFrames >= 160 && quality < 1) {
				quality = Math.min(1, quality + 0.05);
				fastFrames = 0;
				applyCount(false);
			}

			raf = requestAnimationFrame(frame);
		};

		const start = () => {
			cancelAnimationFrame(raf);
			last = performance.now();
			acc = 0;
			raf = requestAnimationFrame(frame);
		};

		const onVisibility = () => {
			if (document.hidden) {
				cancelAnimationFrame(raf);
				raf = 0;
			} else if (live && !disposed) {
				start();
			}
		};

		resize();
		buildStyles();
		seedAll();
		applyCount(true);
		cx = pcx = tgtX = w * 0.5;
		cy = pcy = tgtY = h * 0.5;

		const ro = new ResizeObserver(() => resize());
		try {
			ro.observe(root as any);
		} catch (_e) {}

		apiRef.current = {
			refresh: () => {
				if (disposed || !initialised) return;
				buildStyles();
				if (reduced) {
					rebuildStatic();
				} else {
					applyCount(false);
				}
			},
		};

		if (reduced) {
			initialised = true;
			rebuildStatic();
			props.onReady?.();
		} else {
			presim(1.8);
			render();
			initialised = true;
			live = true;
			window.addEventListener("pointermove", onMove, { passive: true });
			window.addEventListener("pointerdown", onMove, { passive: true });
			window.addEventListener("pointerup", onUp, { passive: true });
			window.addEventListener("pointercancel", onLeave, { passive: true });
			window.addEventListener("blur", onLeave);
			document.documentElement.addEventListener("pointerleave", onLeave);
			document.addEventListener("visibilitychange", onVisibility);
			start();
			props.onReady?.();
		}

		return () => {
			disposed = true;
			live = false;
			cancelAnimationFrame(raf);
			raf = 0;
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerdown", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onLeave);
			window.removeEventListener("blur", onLeave);
			document.documentElement.removeEventListener("pointerleave", onLeave);
			document.removeEventListener("visibilitychange", onVisibility);
			ro.disconnect();
			apiRef.current = null;
			haloGradient = null;
		};
	}, []);

	useEffect(() => {
		apiRef.current?.refresh();
	}, [
		props.count,
		props.palette?.calm,
		props.palette?.mid,
		props.palette?.hot,
	]);

	const fullscreen = props.fullscreen ?? true;
	const cls = [
		"dr-root",
		fullscreen ? null : "dr-root--contained",
		props.className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div ref={rootRef} class={cls} aria-hidden="true">
			<canvas ref={bloomRef} class="dr-bloom" />
			<canvas ref={mainRef} class="dr-main" />
			<div class="dr-vignette" />
			<div class="dr-grain" />
		</div>
	);
}
