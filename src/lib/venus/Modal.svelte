<script lang="ts">
	import type { Snippet } from 'svelte';
	/** Contract for a same-tab modal. The caller owns its open state and content. */
	type Props = {
		/** Required accessible heading. */
		title: string;
		/** Required modal body; caller handles form submission. */
		children: Snippet;
		/** Required dismissal callback; removes the modal from its parent. */
		onclose: () => void;
	};
	let { title, children, onclose }: Props = $props();
	const id = $props.id();
	let backdropPointer: number | null = null;
	function outsideDialog(event: PointerEvent, dialog: HTMLDialogElement): boolean {
		const bounds = dialog.getBoundingClientRect();
		return (
			event.clientX < bounds.left ||
			event.clientX > bounds.right ||
			event.clientY < bounds.top ||
			event.clientY > bounds.bottom
		);
	}
	function attachDialog(dialog: HTMLDialogElement) {
		const previous = document.activeElement;
		dialog.showModal();
		dialog
			.querySelector<HTMLElement>(
				'.dialog-body input:not([disabled]), .dialog-body button:not([disabled]), .dialog-body textarea:not([disabled])'
			)
			?.focus();
		return () => {
			dialog.close();
			if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
		};
	}
</script>

<!-- @component Native same-tab dialog with focus containment, Escape/backdrop dismissal, and focus restoration. -->
<dialog
	{@attach attachDialog}
	aria-labelledby={id}
	onpointerdown={(event) => {
		backdropPointer =
			event.button === 0 && outsideDialog(event, event.currentTarget) ? event.pointerId : null;
	}}
	onpointerup={(event) => {
		const dismiss =
			backdropPointer === event.pointerId && outsideDialog(event, event.currentTarget);
		backdropPointer = null;
		if (dismiss) onclose();
	}}
	onpointercancel={() => {
		backdropPointer = null;
	}}
	oncancel={(event) => {
		event.preventDefault();
		onclose();
	}}
>
	<header>
		<h2 {id}>{title}</h2>
		<button aria-label="Close dialog" onclick={onclose}>×</button>
	</header>
	<div class="dialog-body">{@render children()}</div>
</dialog>

<style>
	dialog {
		margin: auto;
		width: min(560px, 90vw);
		border: 1px solid var(--theme-border, #6a7786);
		padding: 0;
		color: var(--theme-text, #17202b);
		background: var(--theme-surface, #f0f0f0);
		box-shadow: 0 8px 32px #0005;
	}
	dialog::backdrop {
		background: #0005;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--theme-heading, #d9e4ef);
		padding: 5px 9px;
		border-bottom: 1px solid var(--theme-border, #94a3b8);
	}
	h2 {
		font-weight: 600;
	}
	.dialog-body {
		padding: 16px;
	}
</style>
