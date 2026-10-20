<script module lang="ts">
	/** Names of the original SVG glyphs used by file actions, debugger actions, and view toggles. */
	export type ToolbarIconName =
		| 'autoSave'
		| 'import'
		| 'export'
		| 'exportAll'
		| 'assemble'
		| 'go'
		| 'step'
		| 'backstep'
		| 'pause'
		| 'stop'
		| 'reset'
		| 'clearBreakpoints'
		| 'breakpoints'
		| 'breakpointsDisabled'
		| 'labels'
		| 'addresses'
		| 'ascii'
		| 'values'
		| 'lines'
		| 'input';
</script>

<script lang="ts">
	/** Decorative toolbar icon; its owning button provides the accessible name and tooltip. */
	type Props = {
		/** Required glyph name; this component owns no interaction or session state. */
		name: ToolbarIconName;
	};
	let { name }: Props = $props();
</script>

<!-- @component Original, compact file, debugger, and display SVG glyphs. The parent button owns labeling and state. -->
<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	width="22"
	height="22"
	aria-hidden="true"
	fill="none"
	stroke="currentColor"
	stroke-width="1.7"
	stroke-linecap="round"
	stroke-linejoin="round"
>
	{#if name === 'autoSave'}
		<path d="M3 3h13l5 5v13H3ZM7 3v6h9V3M7 21v-8h10v8m-7-5 2 2 4-4" stroke="#236ba5" />
	{:else if name === 'import'}
		<path d="M4 3h10l5 5v13H4ZM14 3v5h5M1 12h12m-4-4 4 4-4 4" stroke="#236ba5" />
	{:else if name === 'export' || name === 'exportAll'}
		{#if name === 'exportAll'}<path d="M2 4v18h15" />{/if}
		<path d="M6 2h10l5 5v6M16 2v5h5M6 2v17h5M16 12v9m-4-4 4 4 4-4" stroke="#278443" />
	{:else if name === 'go'}
		<path d="M7 4 20 12 7 20Z" fill="#278443" stroke="#278443" />
	{:else if name === 'pause'}
		<path d="M8 5v14M16 5v14" stroke="#236ba5" stroke-width="3" />
	{:else if name === 'stop'}
		<rect x="5" y="5" width="14" height="14" rx="1" fill="#bc4141" stroke="#bc4141" />
	{:else if name === 'reset'}
		<path d="M5 9a8 8 0 1 1 0 7M5 3v6h6" stroke="#278443" />
	{:else if name === 'clearBreakpoints'}
		<circle cx="9" cy="10" r="6" stroke="#bc4141" />
		<path d="m15 15 6 6m0-6-6 6" />
	{:else if name === 'breakpoints'}
		<circle cx="12" cy="12" r="7" fill="#bc4141" stroke="#bc4141" />
	{:else if name === 'breakpointsDisabled'}
		<circle cx="12" cy="12" r="7" stroke="#697681" />
		<path d="m3 3 18 18" stroke="#697681" />
	{:else if name === 'step'}
		<path d="M12 3v12m-5-5 5 5 5-5M5 20h14" stroke="#236ba5" />
	{:else if name === 'backstep'}
		<path d="M10 4 5 9l5 5M5 9h9a5 5 0 0 1 0 10h-3" stroke="#236ba5" />
	{:else if name === 'assemble'}
		<g transform="rotate(40 12 12)" stroke-width="1.3">
			<rect x="10" y="9" width="4" height="12" rx="1" fill="#b17b45" stroke="#724a27" />
			<path d="M4 5h11c3 0 5 2 5 5l-4-2-2 3H4Z" fill="#66849c" stroke="#344b5d" />
			<path d="M7 5v6" stroke="#344b5d" />
		</g>
	{:else if name === 'labels'}
		<path d="M3 4h8l10 10-7 7L3 10Z" /><circle cx="7" cy="8" r="1" />
	{:else if name === 'addresses'}
		<path d="M9 9a4 4 0 1 0-8 0c0 3 4 6 4 6s4-3 4-6Z" />
		<circle cx="5" cy="8" r="1" />
		<text
			x="10"
			y="18"
			fill="currentColor"
			stroke="none"
			font-family="monospace"
			font-size="11"
			font-weight="bold">0x</text
		>
	{:else if name === 'ascii'}
		<text
			x="2"
			y="17"
			fill="currentColor"
			stroke="none"
			font-family="monospace"
			font-size="13"
			font-weight="bold">Aa</text
		>
	{:else if name === 'values'}
		<path d="M3 4h18v16H3ZM3 9h18M8 9v11" />
		<text
			x="10"
			y="17"
			fill="currentColor"
			stroke="none"
			font-family="monospace"
			font-size="9"
			font-weight="bold">0x</text
		>
	{:else if name === 'lines'}
		<path d="M10 5h11M10 12h11M10 19h11" />
		<text x="2" y="8" fill="currentColor" stroke="none" font-family="monospace" font-size="8"
			>1</text
		>
		<text x="2" y="15" fill="currentColor" stroke="none" font-family="monospace" font-size="8"
			>2</text
		>
		<text x="2" y="22" fill="currentColor" stroke="none" font-family="monospace" font-size="8"
			>3</text
		>
	{:else if name === 'input'}
		<path d="M3 4h18v14h-9l-5 3v-3H3ZM3 8h18M7 12h1m3 0h6M7 15h10" />
	{/if}
</svg>
