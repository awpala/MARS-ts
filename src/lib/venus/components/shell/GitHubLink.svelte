<script lang="ts">
	import Tooltip from '../feedback/Tooltip.svelte';
</script>

<!-- @component Theme-aware repository link beside the appearance control; opens GitHub in a separate tab. -->
<Tooltip text="MARS-ts on GitHub (opens in a new tab)">
	{#snippet children(trigger, description)}
		<a
			{@attach trigger}
			aria-describedby={description}
			aria-label="MARS-ts on GitHub (opens in a new tab)"
			href="https://github.com/awpala/MARS-ts"
			target="_blank"
			rel="noopener noreferrer"
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path
					d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.68.08-.68 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.63 1.22 3.27.94.1-.73.39-1.22.71-1.5-2.5-.29-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.79 10.79 0 0 1 5.63 0c2.15-1.46 3.1-1.15 3.1-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.33-2.63 5.28-5.14 5.56.4.35.76 1.04.76 2.1v3.06c0 .3.2.65.77.54A11.25 11.25 0 0 0 12 .75Z"
				/>
			</svg>
		</a>
	{/snippet}
</Tooltip>

<style>
	a {
		display: grid;
		place-items: center;
		align-self: center;
		width: 28px;
		height: 28px;
		border: 1px solid transparent;
		color: var(--theme-text, #17202b);
	}
	a:hover {
		border-color: var(--theme-accent-border, #849eb5);
		background: var(--theme-hover, #dbe8f2);
	}
	a:focus-visible {
		outline: 2px solid var(--theme-accent-border, #849eb5);
		outline-offset: 1px;
	}
</style>
