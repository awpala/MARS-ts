<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import KeyboardShortcut from './KeyboardShortcut.svelte';
	/** Tooltip contract; the caller owns the trigger's label and behavior. */
	type Props = {
		/** Required plain-text description, displayed on hover or focus. Empty text suppresses the tooltip. */
		text: string;
		/** Optional keyboard hint displayed as keycaps after the description. */
		shortcut?: string;
		/** Required trigger template. Attach the supplied attachment to one element and apply the description ID to its focusable control. */
		children: Snippet<[Attachment<HTMLElement>, string | undefined]>;
	};
	let { text, shortcut, children }: Props = $props();
	const id = $props.id();
	let visible = $state(false);
	let position = $state.raw<{ left: number; top: number }>();
	let anchor: HTMLElement | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let hovered = false;
	let focused = false;
	let tooltipHovered = false;
	let dismissed = false;

	function cancelTimer() {
		if (timer !== undefined) clearTimeout(timer);
		timer = undefined;
	}
	function hide() {
		cancelTimer();
		visible = false;
		position = undefined;
		tooltipHovered = false;
	}
	function show() {
		cancelTimer();
		if (!dismissed && anchor?.isConnected && text.trim()) visible = true;
	}
	function leave() {
		cancelTimer();
		if (!hovered && !focused && !tooltipHovered) timer = setTimeout(hide, 120);
	}
	function dismiss() {
		dismissed = true;
		hide();
	}
	function attachTrigger(element: HTMLElement) {
		anchor = element;
		const enter = () => {
			hovered = true;
			dismissed = false;
			cancelTimer();
			timer = setTimeout(show, 350);
		};
		const exit = () => {
			hovered = false;
			dismissed = false;
			leave();
		};
		const focus = () => {
			// Mouse activation may leave the trigger focused after a popup or tab returns.
			// Only keyboard-visible focus should keep its description open after pointer exit.
			focused = element.matches(':focus-visible');
			if (focused) show();
		};
		const blur = () => {
			focused = false;
			dismissed = false;
			leave();
		};
		const activate = () => {
			focused = false;
			dismiss();
		};
		element.addEventListener('pointerenter', enter);
		element.addEventListener('pointerleave', exit);
		element.addEventListener('focusin', focus);
		element.addEventListener('focusout', blur);
		element.addEventListener('pointerdown', activate);
		return () => {
			element.removeEventListener('pointerenter', enter);
			element.removeEventListener('pointerleave', exit);
			element.removeEventListener('focusin', focus);
			element.removeEventListener('focusout', blur);
			element.removeEventListener('pointerdown', activate);
			anchor = undefined;
			hovered = focused = false;
			hide();
		};
	}
	function place(element: HTMLElement) {
		// Re-measure when a live description changes, without recreating trigger listeners.
		void text;
		void shortcut;
		if (!anchor) return;
		const bounds = anchor.getBoundingClientRect();
		const tooltip = element.getBoundingClientRect();
		position = {
			left: Math.max(
				8,
				Math.min(
					bounds.left + (bounds.width - tooltip.width) / 2,
					window.innerWidth - tooltip.width - 8
				)
			),
			top: Math.max(
				8,
				bounds.bottom + tooltip.height + 16 > window.innerHeight
					? bounds.top - tooltip.height - 8
					: bounds.bottom + 8
			)
		};
	}
	$effect(() => {
		if (!visible) return;
		const escape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				dismiss();
			}
		};
		const scroll = (event: Event) => {
			if (!(event.target instanceof Element) || event.target.id !== id) dismiss();
		};
		window.addEventListener('keydown', escape);
		window.addEventListener('scroll', scroll, true);
		window.addEventListener('resize', dismiss);
		window.addEventListener('blur', dismiss);
		return () => {
			window.removeEventListener('keydown', escape);
			window.removeEventListener('scroll', scroll, true);
			window.removeEventListener('resize', dismiss);
			window.removeEventListener('blur', dismiss);
		};
	});
</script>

<!-- @component Theme-aware hover/focus description with viewport clamping and Escape dismissal. Owns and releases its trigger listeners, visible-only window listeners, and timers. -->
{@render children(attachTrigger, visible ? id : undefined)}
{#if visible}
	<div
		{id}
		class="tooltip"
		role="tooltip"
		{@attach place}
		style:left={`${position?.left ?? 0}px`}
		style:top={`${position?.top ?? 0}px`}
		style:visibility={position ? 'visible' : 'hidden'}
		onpointerenter={() => {
			tooltipHovered = true;
			cancelTimer();
		}}
		onpointerleave={() => {
			tooltipHovered = false;
			leave();
		}}
	>
		{text}
		{#if shortcut}<KeyboardShortcut {shortcut} />{/if}
	</div>
{/if}

<style>
	.tooltip {
		position: fixed;
		display: flex;
		align-items: center;
		gap: 8px;
		z-index: 60;
		width: max-content;
		max-width: min(320px, calc(100vw - 16px));
		max-height: calc(100dvh - 16px);
		overflow: auto;
		padding: 6px 9px;
		border: 1px solid var(--theme-border, #8d969e);
		border-radius: 3px;
		background: var(--theme-tooltip, #ffffe1);
		color: var(--theme-text, #17202b);
		box-shadow: 2px 3px 8px #0003;
		font:
			12px/1.4 system-ui,
			sans-serif;
		font-weight: normal;
		text-align: left;
		white-space: normal;
		overflow-wrap: anywhere;
	}
</style>
