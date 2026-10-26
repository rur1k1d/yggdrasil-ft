import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { t } from "../../i18n/t";
import DataRain from "./DataRain";

type Props = {
	onEnter: () => void;
};

const DISPLAY_MS = 5000;
const FADE_MS = 600;
const FADE_REDUCED_MS = 150;

function prefersReducedMotion(): boolean {
	return (
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

export function IntroSplash({ onEnter }: Props) {
	const [fading, setFading] = useState(false);
	const done = useRef(false);
	const exitTimer = useRef<number | null>(null);

	const finish = useCallback(() => {
		if (done.current) return;
		done.current = true;
		setFading(true);
		exitTimer.current = window.setTimeout(
			() => onEnter(),
			prefersReducedMotion() ? FADE_REDUCED_MS : FADE_MS,
		);
	}, [onEnter]);

	useEffect(() => {
		const auto = window.setTimeout(finish, DISPLAY_MS);
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				window.clearTimeout(auto);
				finish();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => {
			window.clearTimeout(auto);
			window.removeEventListener("keydown", onKey);
			if (exitTimer.current !== null) {
				window.clearTimeout(exitTimer.current);
			}
		};
	}, [finish]);

	return (
		<div class={`intro-splash ${fading ? "is-fading" : ""}`}>
			<DataRain
				fullscreen
				count={1600}
				flowSpeed={1.0}
				obstacleRadius={56}
				autopilot
			/>
			<div class="intro-splash__content">
				<div class="intro-splash__title">YGGDRASIL</div>
				<div class="intro-splash__subtitle">FAMILY TREE</div>
				<div class="intro-splash__hint">{t("app.introHint")}</div>
				<button
					type="button"
					class="btn primary intro-splash__skip"
					onClick={finish}
				>
					{t("app.introSkip")}
				</button>
			</div>
		</div>
	);
}
