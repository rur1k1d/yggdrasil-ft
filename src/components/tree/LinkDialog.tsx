import { useEffect, useRef, useState } from "preact/hooks";
import { t, tParams } from "../../i18n/t";
import type { RelationKind } from "../../lib/relations";

type Props = {
	fromName: string;
	toName: string;
	suggested: RelationKind;
	onConfirm: (kind: RelationKind) => void;
	onCancel: () => void;
};

const CHOICES = [
	{ kind: "parent", labelKey: "views.tree.linkParent" },
	{ kind: "child", labelKey: "views.tree.linkChild" },
	{ kind: "partner", labelKey: "views.tree.linkPartner" },
] as const satisfies ReadonlyArray<{
	kind: RelationKind;
	labelKey:
		| "views.tree.linkParent"
		| "views.tree.linkChild"
		| "views.tree.linkPartner";
}>;

function focusableElements(dialog: HTMLElement): HTMLElement[] {
	return [
		...dialog.querySelectorAll<HTMLElement>(
			'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
		),
	];
}

export function LinkDialog(props: Props) {
	const [choice, setChoice] = useState<RelationKind>(props.suggested);
	const dialogRef = useRef<HTMLDivElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);
	const cancelRef = useRef(props.onCancel);
	cancelRef.current = props.onCancel;

	useEffect(() => {
		setChoice(props.suggested);
	}, [props.suggested]);

	useEffect(() => {
		previousFocusRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		const dialog = dialogRef.current;
		const preferred = dialog?.querySelector<HTMLElement>(
			'[data-link-choice][aria-pressed="true"]',
		);
		(preferred ?? dialog)?.focus();

		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				cancelRef.current();
				return;
			}
			if (event.key !== "Tab" || !dialog) return;
			const focusable = focusableElements(dialog).filter((el) => el !== dialog);
			if (focusable.length === 0) {
				event.preventDefault();
				return;
			}
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (!first || !last) return;
			const active = document.activeElement;
			if (!(active instanceof HTMLElement) || !dialog.contains(active)) {
				event.preventDefault();
				first.focus();
				return;
			}
			if (event.shiftKey && active === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
		};

		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("keydown", onKey);
			document.body.style.overflow = previousOverflow;
			previousFocusRef.current?.focus();
		};
	}, []);

	return (
		<div class="modal-backdrop">
			<div
				ref={dialogRef}
				class="modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="link-dialog-title"
				aria-describedby="link-dialog-question"
				tabIndex={-1}
			>
				<h2 id="link-dialog-title">
					{tParams("views.tree.linkTitle", {
						from: props.fromName,
						to: props.toName,
					})}
				</h2>
				<p id="link-dialog-question">
					{tParams("views.tree.linkQuestion", {
						from: props.fromName,
						to: props.toName,
					})}
				</p>
				<div class="link-choices">
					{CHOICES.map((item) => (
						<button
							key={item.kind}
							type="button"
							class={`link-choice ${choice === item.kind ? "is-selected" : ""}`}
							data-link-choice={item.kind}
							aria-pressed={choice === item.kind}
							onClick={() => setChoice(item.kind)}
						>
							{tParams(item.labelKey, {
								from: props.fromName,
								to: props.toName,
							})}
						</button>
					))}
				</div>
				<div class="form-actions">
					<button
						type="button"
						class="btn primary"
						onClick={() => props.onConfirm(choice)}
					>
						{t("views.tree.linkConfirm")}
					</button>
					<button type="button" class="btn" onClick={props.onCancel}>
						{t("views.tree.linkCancel")}
					</button>
				</div>
			</div>
		</div>
	);
}
