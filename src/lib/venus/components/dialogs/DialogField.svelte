<script lang="ts">
	import type { Snippet } from 'svelte';
	/** Shared labeled input layout; callers retain input attributes and bindings. */
	type Props = {
		/** Required visible label, associated with the single nested input. */
		label: string;
		/** Required single native input; the caller owns its value and validation. */
		children: Snippet;
	};
	let { label, children }: Props = $props();
</script>

<!-- @component Compact dialog field with an implicit native label and theme-aware input styling. -->
<label class="dialog-field"><span>{label}</span>{@render children()}</label>

<style>
	.dialog-field {
		display: grid;
		grid-template-columns: 100px 1fr;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
	}
	.dialog-field > :global(input) {
		padding: 4px;
		border: 1px solid var(--theme-border, #9a9a9a);
		background: var(--theme-canvas, white);
	}
</style>
