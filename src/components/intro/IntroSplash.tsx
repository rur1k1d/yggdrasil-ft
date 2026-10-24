import { useEffect, useState } from "preact/hooks";
import { t } from "../../i18n/t";
import DataRain from "./DataRain";

type Props = {
	onEnter: () => void;
};

export function IntroSplash(props: Props) {
	const [fading, setFading] = useState(false);
	useEffect(() => {
		const reduced =
			typeof window !== "undefined" &&
			typeof window.matchMedia === "function" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		const timeout = window.setTimeout(
			() => {
				setFading(true);
				window.setTimeout(() => props.onEnter(), reduced ? 200 : 900);
			},
			reduced ? 600 : 2200,
		);

		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				window.clearTimeout(timeout);
				setFading(true);
				window.setTimeout(() => props.onEnter(), reduced ? 150 : 700);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => {
			window.clearTimeout(timeout);
			window.removeEventListener("keydown", onKey);
		};
	}, []);

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
				<div class="intro-splash__hint">
					{t("app.introHint") || "Press Enter"}
				</div>
			</div>
		</div>
	);
}
