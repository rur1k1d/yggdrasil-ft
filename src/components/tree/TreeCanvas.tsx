import type { JSX } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { t, tParams } from "../../i18n/t";
import { lifeYearLabel } from "../../lib/person-dates";
import {
	type RelationKind,
	suggestedKindByGeneration,
} from "../../lib/relations";
import type { TreeLayout } from "../../lib/tree-layout";
import type { Person } from "../../model/types";

type Props = {
	persons: Person[];
	layout: TreeLayout;
	selectedId: string | null;
	search: string;
	matchIds: ReadonlySet<string>;
	onSelect: (id: string) => void;
	onSetHead: (id: string) => void;
	onRequestLink: (
		fromId: string,
		toId: string,
		suggested: RelationKind,
	) => void;
};

type View = {
	scale: number;
	tx: number;
	ty: number;
};

type Drag = {
	sourceId: string;
	startX: number;
	startY: number;
	x: number;
	y: number;
	active: boolean;
};

type Pan = {
	pointerId: number;
	startX: number;
	startY: number;
	tx: number;
	ty: number;
};

const MIN_SCALE = 0.18;
const MAX_SCALE = 1.6;
const DRAG_THRESHOLD = 8;

function displayName(person: Person): string {
	const name = person.names[0];
	const value = `${name?.forename ?? ""} ${name?.surname ?? ""}`.trim();
	return value || person.id;
}

function initials(person: Person): string {
	const name = person.names[0];
	const first = name?.forename?.trim().charAt(0) ?? "";
	const last = name?.surname?.trim().charAt(0) ?? "";
	return `${first}${last}`.toUpperCase() || "?";
}

function clampScale(value: number): number {
	return Math.max(MIN_SCALE, Math.min(MAX_SCALE, value));
}

export function TreeCanvas(props: Props) {
	const canvasRef = useRef<HTMLElement>(null);
	const viewportRef = useRef<HTMLDivElement>(null);
	const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
	const [panning, setPanning] = useState(false);
	const [fullscreen, setFullscreen] = useState(false);
	const [drag, setDrag] = useState<Drag | null>(null);
	const [dropId, setDropId] = useState<string | null>(null);
	const viewRef = useRef(view);
	const panRef = useRef<Pan | null>(null);
	const dragRef = useRef<Drag | null>(null);
	const dropRef = useRef<string | null>(null);
	const layoutRef = useRef(props.layout);
	const suppressClickRef = useRef(false);
	const callbacksRef = useRef({
		onSelect: props.onSelect,
		onRequestLink: props.onRequestLink,
	});
	viewRef.current = view;
	layoutRef.current = props.layout;
	callbacksRef.current = {
		onSelect: props.onSelect,
		onRequestLink: props.onRequestLink,
	};

	const personById = new Map(
		props.persons.map((person) => [person.id, person] as const),
	);
	const hasSearch = props.search.trim().length > 0;

	const zoomAt = useCallback(
		(factor: number, clientX: number, clientY: number) => {
			const viewport = viewportRef.current;
			if (!viewport) return;
			const current = viewRef.current;
			const nextScale = clampScale(current.scale * factor);
			if (Math.abs(nextScale - current.scale) < 0.0001) return;
			const rect = viewport.getBoundingClientRect();
			const px = clientX - rect.left;
			const py = clientY - rect.top;
			const worldX = (px - current.tx) / current.scale;
			const worldY = (py - current.ty) / current.scale;
			setView({
				scale: nextScale,
				tx: px - worldX * nextScale,
				ty: py - worldY * nextScale,
			});
		},
		[],
	);

	const zoomCenter = useCallback(
		(factor: number) => {
			const viewport = viewportRef.current;
			if (!viewport) return;
			const rect = viewport.getBoundingClientRect();
			zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
		},
		[zoomAt],
	);

	const layoutW = props.layout.width;
	const layoutH = props.layout.height;
	const focusId = props.layout.focusId;
	const cardsRef = useRef(props.layout.cards);
	cardsRef.current = props.layout.cards;

	const fitTree = useCallback(() => {
		const viewport = viewportRef.current;
		if (!viewport || layoutW === 0 || layoutH === 0) {
			setView({ scale: 1, tx: 0, ty: 0 });
			return;
		}
		const width = viewport.clientWidth;
		const height = viewport.clientHeight;
		const nextScale = clampScale(
			Math.min((width - 32) / layoutW, (height - 32) / layoutH, 1.15),
		);
		setView({
			scale: nextScale,
			tx: (width - layoutW * nextScale) / 2,
			ty: (height - layoutH * nextScale) / 2,
		});
	}, [layoutW, layoutH]);

	const frameTree = useCallback(() => {
		const viewport = viewportRef.current;
		if (!viewport || layoutW === 0 || layoutH === 0) {
			fitTree();
			return;
		}
		const width = viewport.clientWidth;
		const height = viewport.clientHeight;
		if (width >= 640) {
			fitTree();
			return;
		}
		const nextScale = clampScale(Math.min(0.68, (height - 32) / layoutH));
		const focus = cardsRef.current.find((card) => card.personId === focusId);
		const focusX = focus ? focus.x + focus.width / 2 : layoutW / 2;
		const scaledWidth = layoutW * nextScale;
		setView({
			scale: nextScale,
			tx:
				scaledWidth <= width - 20
					? (width - scaledWidth) / 2
					: width / 2 - focusX * nextScale,
			ty: (height - layoutH * nextScale) / 2,
		});
	}, [fitTree, layoutW, layoutH, focusId]);

	useEffect(() => {
		frameTree();
	}, [frameTree]);

	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => frameTree());
		observer.observe(viewport);
		return () => observer.disconnect();
	}, [frameTree]);

	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) return;
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			zoomAt(event.deltaY > 0 ? 0.9 : 1.1, event.clientX, event.clientY);
		};
		viewport.addEventListener("wheel", onWheel, { passive: false });
		return () => viewport.removeEventListener("wheel", onWheel);
	}, [zoomAt]);

	useEffect(() => {
		const onChange = () => {
			setFullscreen(
				typeof document !== "undefined" &&
					document.fullscreenElement === canvasRef.current,
			);
		};
		document.addEventListener("fullscreenchange", onChange);
		return () => document.removeEventListener("fullscreenchange", onChange);
	}, []);

	useEffect(() => {
		if (!drag) return;
		const sourceId = drag.sourceId;
		const onMove = (event: PointerEvent) => {
			const current = dragRef.current;
			if (!current) return;
			const distance = Math.hypot(
				event.clientX - current.startX,
				event.clientY - current.startY,
			);
			const active = current.active || distance > DRAG_THRESHOLD;
			const element = document.elementFromPoint(event.clientX, event.clientY);
			const target = element?.closest<HTMLElement>("[data-tree-person]");
			const targetId = target?.dataset.treePerson ?? null;
			const next = {
				...current,
				x: event.clientX,
				y: event.clientY,
				active,
			};
			dragRef.current = next;
			setDrag(next);
			dropRef.current =
				active && targetId && targetId !== sourceId ? targetId : null;
			setDropId(dropRef.current);
		};
		const finish = () => {
			const current = dragRef.current;
			const targetId = dropRef.current;
			if (current?.active && targetId && targetId !== current.sourceId) {
				suppressClickRef.current = true;
				window.setTimeout(() => {
					suppressClickRef.current = false;
				}, 0);
				const from = layoutRef.current.cards.find(
					(card) => card.personId === current.sourceId,
				);
				const to = layoutRef.current.cards.find(
					(card) => card.personId === targetId,
				);
				const suggested =
					from && to
						? suggestedKindByGeneration(from.generation, to.generation)
						: "partner";
				callbacksRef.current.onRequestLink(
					current.sourceId,
					targetId,
					suggested,
				);
			}
			dragRef.current = null;
			dropRef.current = null;
			setDrag(null);
			setDropId(null);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", finish);
		window.addEventListener("pointercancel", finish);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", finish);
			window.removeEventListener("pointercancel", finish);
		};
	}, [drag?.sourceId]);

	const startDrag = (
		id: string,
		event: {
			button: number;
			clientX: number;
			clientY: number;
			stopPropagation: () => void;
		},
	) => {
		if (event.button !== 0) return;
		event.stopPropagation();
		props.onSelect(id);
		const next: Drag = {
			sourceId: id,
			startX: event.clientX,
			startY: event.clientY,
			x: event.clientX,
			y: event.clientY,
			active: false,
		};
		dragRef.current = next;
		setDrag(next);
	};

	const onViewportDown = (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		const target = event.target;
		if (target instanceof Element && target.closest("[data-tree-person]")) {
			return;
		}
		event.currentTarget.setPointerCapture(event.pointerId);
		const current = viewRef.current;
		panRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			tx: current.tx,
			ty: current.ty,
		};
		setPanning(true);
	};

	const onViewportMove = (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
		const pan = panRef.current;
		if (!pan || pan.pointerId !== event.pointerId) return;
		setView((previous) => ({
			...previous,
			tx: pan.tx + event.clientX - pan.startX,
			ty: pan.ty + event.clientY - pan.startY,
		}));
	};

	const endPan = (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
		const pan = panRef.current;
		if (!pan || pan.pointerId !== event.pointerId) return;
		try {
			event.currentTarget.releasePointerCapture?.(event.pointerId);
		} catch {
			// ignore
		}
		panRef.current = null;
		setPanning(false);
	};

	const onViewportKey = (event: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
		const viewport = viewportRef.current;
		if (!viewport) return;
		const rect = viewport.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		if (event.key === "+" || event.key === "=") {
			event.preventDefault();
			zoomAt(1.1, centerX, centerY);
		} else if (event.key === "-") {
			event.preventDefault();
			zoomAt(0.9, centerX, centerY);
		} else if (event.key === "0") {
			event.preventDefault();
			fitTree();
		} else if (event.key === "ArrowLeft") {
			event.preventDefault();
			setView((previous) => ({ ...previous, tx: previous.tx + 40 }));
		} else if (event.key === "ArrowRight") {
			event.preventDefault();
			setView((previous) => ({ ...previous, tx: previous.tx - 40 }));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setView((previous) => ({ ...previous, ty: previous.ty + 40 }));
		} else if (event.key === "ArrowDown") {
			event.preventDefault();
			setView((previous) => ({ ...previous, ty: previous.ty - 40 }));
		}
	};

	const toggleFullscreen = () => {
		if (document.fullscreenElement) {
			void document.exitFullscreen().catch(() => undefined);
			return;
		}
		void canvasRef.current?.requestFullscreen().catch(() => undefined);
	};

	const bands = new Map<number, { y: number; height: number }>();
	for (const card of props.layout.cards) {
		if (bands.has(card.generation)) continue;
		bands.set(card.generation, {
			y: card.y - 20,
			height: card.height + 40,
		});
	}

	const isMatch = (id: string) => !hasSearch || props.matchIds.has(id);
	const shownName = (id: string) => {
		const person = personById.get(id);
		return person ? displayName(person) : id;
	};

	return (
		<section ref={canvasRef} class="tree-canvas" aria-label={t("nav.tree")}>
			<div class="tree-canvas-toolbar">
				<label class="tree-head-select">
					<span>{t("views.tree.head")}</span>
					<select
						value={props.layout.focusId ?? ""}
						disabled={props.persons.length === 0}
						onChange={(event) => {
							const id = event.currentTarget.value;
							if (id) props.onSetHead(id);
						}}
					>
						{props.persons.map((person) => (
							<option key={person.id} value={person.id}>
								{displayName(person)}
							</option>
						))}
					</select>
				</label>
				<div class="tree-controls">
					<span class="tree-scale" aria-live="polite">
						{tParams("views.tree.scale", {
							value: Math.round(view.scale * 100),
						})}
					</span>
					<button
						type="button"
						class="btn btn--icon"
						aria-label={t("tree.zoomOut")}
						onClick={() => zoomCenter(0.9)}
					>
						−
					</button>
					<button
						type="button"
						class="btn btn--icon"
						aria-label={t("tree.zoomIn")}
						onClick={() => zoomCenter(1.1)}
					>
						+
					</button>
					<button type="button" class="btn btn--small" onClick={fitTree}>
						{t("views.tree.fit")}
					</button>
					<button
						type="button"
						class="btn btn--small"
						onClick={toggleFullscreen}
					>
						{fullscreen
							? t("views.tree.exitFullscreen")
							: t("views.tree.fullscreen")}
					</button>
				</div>
			</div>

			<section
				ref={viewportRef}
				class={`tree-viewport ${panning ? "is-panning" : ""}`}
				aria-label={t("tree.controls")}
				aria-describedby="tree-pan-hint"
				onPointerDown={onViewportDown}
				onPointerMove={onViewportMove}
				onPointerUp={endPan}
				onPointerCancel={endPan}
				onKeyDown={onViewportKey}
			>
				{props.layout.cards.length === 0 ? (
					<p class="tree-empty">{t("views.tree.empty")}</p>
				) : (
					<div
						class="tree-stage"
						style={{
							width: `${props.layout.width}px`,
							height: `${props.layout.height}px`,
							transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
						}}
					>
						<div class="tree-surface">
							{[...bands.entries()].map(([generation, band]) => (
								<div
									key={generation}
									class="tree-generation-band"
									style={{
										top: `${band.y}px`,
										height: `${band.height}px`,
									}}
								/>
							))}
							<svg
								class="tree-connectors"
								width={props.layout.width}
								height={props.layout.height}
								viewBox={`0 0 ${props.layout.width} ${props.layout.height}`}
								aria-hidden="true"
								focusable="false"
							>
								{props.layout.edges.map((edge) => (
									<path
										key={edge.id}
										class={`tree-edge tree-edge--${edge.kind}`}
										d={edge.path}
									/>
								))}
							</svg>
							{props.layout.cards.map((card) => {
								const person = personById.get(card.personId);
								if (!person) return null;
								const name = displayName(person);
								const years = lifeYearLabel(person);
								const classes = [
									"tree-card",
									card.personId === props.layout.focusId ? "is-head" : "",
									card.personId === props.selectedId ? "is-selected" : "",
									card.personId === dropId ? "is-drop-target" : "",
									isMatch(card.personId) ? "is-match" : "is-dimmed",
								]
									.filter(Boolean)
									.join(" ");
								return (
									<button
										key={card.personId}
										type="button"
										class={classes}
										style={{
											left: `${card.x}px`,
											top: `${card.y}px`,
											width: `${card.width}px`,
											height: `${card.height}px`,
										}}
										data-tree-person={card.personId}
										aria-pressed={card.personId === props.selectedId}
										aria-label={`${name}${years ? `, ${years}` : ""}`}
										onPointerDown={(event) => startDrag(card.personId, event)}
										onClick={() => {
											if (suppressClickRef.current) {
												suppressClickRef.current = false;
												return;
											}
											props.onSelect(card.personId);
										}}
									>
										<span class="tree-card__portrait" aria-hidden="true">
											{initials(person)}
										</span>
										<span class="tree-card__body">
											<span class="tree-card__name">{name}</span>
											<span class="tree-card__years">
												{years || t("views.tree.yearsUnknown")}
											</span>
										</span>
										{card.personId === props.layout.focusId && (
											<span class="tree-card__badge">
												{t("views.tree.headBadge")}
											</span>
										)}
									</button>
								);
							})}
						</div>
					</div>
				)}
				<p id="tree-pan-hint" class="sr-only">
					{t("tree.panHint")}
				</p>
			</section>

			{props.layout.unlinkedIds.length > 0 && (
				<aside class="tree-unlinked" aria-label={t("views.tree.unlinked")}>
					<header>
						<strong>{t("views.tree.unlinked")}</strong>
						<span>
							{tParams("views.tree.unlinkedBadge", {
								count: props.layout.unlinkedIds.length,
							})}
						</span>
					</header>
					<ul>
						{props.layout.unlinkedIds.map((id) => {
							const person = personById.get(id);
							if (!person) return null;
							return (
								<li key={id}>
									<button
										type="button"
										class={`tree-unlinked__item ${isMatch(id) ? "" : "is-dimmed"}`}
										data-tree-person={id}
										onPointerDown={(event) => startDrag(id, event)}
										onClick={() => {
											if (suppressClickRef.current) {
												suppressClickRef.current = false;
												return;
											}
											props.onSelect(id);
										}}
									>
										<span>{displayName(person)}</span>
										<small>{t("views.tree.addHint")}</small>
									</button>
								</li>
							);
						})}
					</ul>
					<p>{t("views.tree.unlinkedHint")}</p>
				</aside>
			)}

			{drag?.active && (
				<div
					class="tree-drag-ghost"
					style={{ left: `${drag.x + 16}px`, top: `${drag.y + 16}px` }}
					aria-hidden="true"
				>
					<strong>{shownName(drag.sourceId)}</strong>
					<span>{t("views.tree.dropHint")}</span>
				</div>
			)}
		</section>
	);
}
