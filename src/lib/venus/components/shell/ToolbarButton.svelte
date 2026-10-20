<script lang="ts">
	import ToolbarIcon, { type ToolbarIconName } from './ToolbarIcon.svelte';
	import Tooltip from '../feedback/Tooltip.svelte';
	/** Stateless toolbar control; caller provides labeling, enablement, and activation. */
	type Props = {
		/** Required accessible button label. */
		label: string;
		/** Optional tooltip, defaulting to the label. */
		title?: string;
		/** Optional keyboard shortcut shown as keycaps in the tooltip. */
		shortcut?: string;
		/** Required decorative image or SVG glyph. */
		icon: { glyph: ToolbarIconName } | { src: string };
		/** Disabled state; false by default. */
		disabled?: boolean;
		/** Current toggle value; omitted for momentary actions. */
		pressed?: boolean;
		/** Required activation callback; owns any asynchronous work. */
		onclick: () => void;
	};
	let { label, title, shortcut, icon, disabled = false, pressed, onclick }: Props = $props();
</script>

<!-- @component Reusable labeled toolbar button for SVG glyphs and bundled image assets. -->
<Tooltip text={title ?? label} {shortcut}>
	{#snippet children(trigger, description)}
		<button
			{@attach trigger}
			aria-describedby={description}
			aria-label={label}
			aria-pressed={pressed}
			{disabled}
			{onclick}
		>
			{#if 'glyph' in icon}
				<ToolbarIcon name={icon.glyph} />
			{:else}
				<img src={icon.src} alt="" width="22" height="22" />
			{/if}
		</button>
	{/snippet}
</Tooltip>

<style>
	button {
		width: 29px;
		height: 29px;
		display: grid;
		place-items: center;
		border: 1px solid transparent;
	}
	button:hover:enabled {
		border-color: var(--theme-accent-border, #849eb5);
		background: var(--theme-hover, #dbe8f2);
	}
	button:disabled {
		opacity: 0.35;
	}
	button[aria-pressed='true'] {
		background: var(--theme-selected, #c4ddef);
		border-color: var(--theme-accent-border, #648eae);
		color: var(--theme-accent-text, #164c75);
	}
	button[aria-pressed='true']:hover {
		background: var(--theme-selected-hover, #b1d1e8);
	}
</style>
