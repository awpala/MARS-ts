<script lang="ts">
	import { asset } from '$app/paths';
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
			<span
				class="github-icon"
				style:mask-image={`url("${asset('icons/GitHub.svg')}")`}
				aria-hidden="true"
			></span>
		</a>
	{/snippet}
</Tooltip>

<style>
	.github-icon {
		width: 20px;
		height: 20px;
		background: currentColor;
		mask-position: center;
		mask-repeat: no-repeat;
		mask-size: contain;
	}
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
