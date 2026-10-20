<script lang="ts">
	import { onMount } from 'svelte';
	import Tooltip from '../feedback/Tooltip.svelte';
	let dark = $state(false);

	onMount(() => {
		dark = document.documentElement.dataset.theme === 'dark';
	});

	function toggle() {
		dark = !dark;
		const theme = dark ? 'dark' : 'light';
		document.documentElement.dataset.theme = theme;
		try {
			// Keep the key aligned with the pre-paint initialization in app.html.
			localStorage.setItem('mars-ts:theme:v1', theme);
		} catch {
			/* Theme switching remains available when browser storage is blocked or full. */
		}
	}
</script>

<!-- @component Browser-owned appearance toggle. Restores the pre-paint theme on mount; persists explicit choices independently of machine and editor state. -->
<div class="theme-control">
	<span>Theme:</span>
	<Tooltip text={dark ? 'Switch to light theme' : 'Switch to dark theme'}>
		{#snippet children(trigger, description)}
			<button
				{@attach trigger}
				aria-describedby={description}
				type="button"
				class="theme-toggle"
				role="switch"
				aria-label="Dark theme"
				aria-checked={dark}
				onclick={toggle}
			>
				<span class="thumb" aria-hidden="true"></span>
				<svg
					class="sun"
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="4" />
					<path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
				</svg>
				<svg
					class="moon"
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					aria-hidden="true"
				>
					<path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z" />
				</svg>
			</button>
		{/snippet}
	</Tooltip>
</div>

<style>
	.theme-control {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: 0 4px 0 auto;
	}
	.theme-toggle {
		position: relative;
		flex: 0 0 52px;
		align-self: center;
		width: 52px;
		height: 24px;
		border: 1px solid var(--theme-accent-border, #849eb5);
		border-radius: 999px;
		background: var(--theme-selected, #d6e1ea);
		transition: background-color 180ms ease;
	}
	.theme-toggle:hover {
		background: var(--theme-selected-hover, #c6dcef);
	}
	.thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--theme-text, white);
		box-shadow: 0 1px 3px #0004;
		transform: translateX(0);
		transition: transform 300ms ease-in-out;
		will-change: transform;
	}
	[aria-checked='true'] .thumb {
		transform: translateX(28px);
	}
	svg {
		position: absolute;
		top: 5px;
		pointer-events: none;
	}
	.sun {
		left: 5px;
		color: var(--theme-text, #315e88);
	}
	.moon {
		right: 5px;
		color: var(--theme-background, #667);
	}
</style>
