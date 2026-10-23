import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../../i18n/t";
import type { Person } from "../../model/types";

type Props = {
	persons: Person[];
};

export function TreeCanvas(props: Props) {
	const svgRef = useRef<SVGSVGElement>(null);
	const [scale, setScale] = useState(1);
	const [tx, setTx] = useState(0);
	const [ty, setTy] = useState(0);
	const [drag, setDrag] = useState<{
		x: number;
		y: number;
		tx: number;
		ty: number;
	} | null>(null);

	const getName = (p: Person) =>
		`${p.names[0]?.forename || ""} ${p.names[0]?.surname || ""}`.trim() || p.id;

	const onWheel = (e: WheelEvent) => {
		e.preventDefault();
		const delta = e.deltaY > 0 ? 0.9 : 1.1;
		setScale((s) => Math.max(0.3, Math.min(3, s * delta)));
	};

	const onDown = (e: MouseEvent) => {
		setDrag({ x: e.clientX, y: e.clientY, tx, ty });
	};

	const onMove = (e: MouseEvent) => {
		if (!drag) return;
		setTx(drag.tx + (e.clientX - drag.x));
		setTy(drag.ty + (e.clientY - drag.y));
	};

	const onUp = () => setDrag(null);

	const onKey = (e: KeyboardEvent) => {
		if (e.key === "ArrowUp") setTy((v) => v + 20);
		if (e.key === "ArrowDown") setTy((v) => v - 20);
		if (e.key === "ArrowLeft") setTx((v) => v + 20);
		if (e.key === "ArrowRight") setTx((v) => v - 20);
		if (e.key === "+" || e.key === "=") setScale((s) => Math.min(3, s * 1.1));
		if (e.key === "-") setScale((s) => Math.max(0.3, s * 0.9));
		if (e.key === "0") {
			setScale(1);
			setTx(0);
			setTy(0);
		}
	};

	useEffect(() => {
		const svg = svgRef.current;
		if (!svg) return;
		svg.addEventListener("wheel", onWheel as any, { passive: false });
		window.addEventListener("mousemove", onMove as any);
		window.addEventListener("mouseup", onUp);
		svg.addEventListener("keydown", onKey as any);
		return () => {
			svg.removeEventListener("wheel", onWheel as any);
			window.removeEventListener("mousemove", onMove as any);
			window.removeEventListener("mouseup", onUp);
			svg.removeEventListener("keydown", onKey as any);
		};
	});

	return (
		<div class="tree-canvas">
			<div class="tree-canvas-controls">
				<span>{t("tree.controls")}</span>
				<button
					type="button"
					class="btn"
					onClick={() => setScale((s) => Math.min(3, s * 1.1))}
				>
					{t("tree.zoomIn")}
				</button>
				<button
					type="button"
					class="btn"
					onClick={() => setScale((s) => Math.max(0.3, s * 0.9))}
				>
					{t("tree.zoomOut")}
				</button>
				<button
					type="button"
					class="btn"
					onClick={() => {
						setScale(1);
						setTx(0);
						setTy(0);
					}}
				>
					{t("tree.reset")}
				</button>
			</div>
			<svg
				ref={svgRef}
				class="tree-svg"
				viewBox="0 0 800 400"
				role="img"
				tabindex={0}
				aria-label={t("nav.tree")}
				aria-describedby="tree-pan-hint"
				onMouseDown={onDown as any}
			>
				<g transform={`translate(${tx},${ty}) scale(${scale})`}>
					{props.persons.slice(0, 20).map((p, i) => (
						<g key={p.id}>
							<rect
								x={40 + i * 90}
								y={180}
								width={80}
								height={40}
								rx={4}
								class="tree-node"
							/>
							<text x={80 + i * 90} y={205} text-anchor="middle" font-size="11">
								{getName(p).split(" ")[0]}
							</text>
						</g>
					))}
				</g>
			</svg>
			<p class="small" id="tree-pan-hint">
				{t("tree.panHint")}
			</p>
		</div>
	);
}
