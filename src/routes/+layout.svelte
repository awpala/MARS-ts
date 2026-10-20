<script lang="ts">
	import './layout.css';
	import { asset } from '$app/paths';
	import type { Snippet } from 'svelte';
	/** Root layout contract; the router owns its child content. */
	type Props = {
		/** Required route content, rendered once with no additional state ownership. */
		children: Snippet;
	};
	let { children }: Props = $props();
</script>

<!-- @component Root static application layout, preserving the original MARS favicon. -->
<svelte:head><link rel="icon" href={asset('favicon.ico')} /></svelte:head>
{@render children()}
