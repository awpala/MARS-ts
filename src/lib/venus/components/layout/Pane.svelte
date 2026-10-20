<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	/** Sized content container; callers own its contents, geometry decisions, and resources. */
	type Props = {
		/** Required accessible region name. */
		label: string;
		/** Optional region ID for resize controls; absent by default. */
		id?: string;
		/** Native landmark; defaults to section, with aside available for sidebars. */
		element?: 'section' | 'aside';
		/** Content layout; defaults to a flex column, with row and normal block flow available. */
		layout?: 'column' | 'row' | 'block';
		/** Optional layout classes on the native region. */
		class?: ClassValue;
		/** CSS flex sizing; defaults to --pane-flex, or 1 when unset. */
		flex?: string;
		/** CSS width; defaults to --pane-width, or auto when unset. */
		width?: string;
		/** CSS height; defaults to --pane-height, or auto when unset. */
		height?: string;
		/** CSS minimum width; defaults to --pane-min-width, or zero when unset. */
		minWidth?: string;
		/** CSS minimum height; defaults to --pane-min-height, or zero when unset. */
		minHeight?: string;
		/** Overflow policy; defaults to --pane-overflow, or visible when unset. */
		overflow?: 'visible' | 'hidden' | 'clip' | 'scroll' | 'auto';
		/** Required content renderer; stays mounted for this container's lifetime. */
		children: Snippet;
	};
	let {
		label,
		id,
		element = 'section',
		layout = 'column',
		class: className,
		flex,
		width,
		height,
		minWidth,
		minHeight,
		overflow,
		children
	}: Props = $props();
</script>

<!-- @component Generic sized pane renderer. Provides a landmark, geometry, and themed surface; it owns no selection, headings, scrolling gestures, or domain state. Explicit sizes override the inherited --pane-* geometry defaults. -->
<svelte:element
	this={element}
	{id}
	aria-label={label}
	class={['pane', className]}
	style:display={layout === 'block' ? 'block' : 'flex'}
	style:flex-direction={layout === 'row' ? 'row' : 'column'}
	style:flex
	style:width
	style:height
	style:min-width={minWidth}
	style:min-height={minHeight}
	style:overflow
>
	{@render children()}
</svelte:element>

<style>
	.pane {
		flex: var(--pane-flex, 1);
		min-width: var(--pane-min-width, 0);
		width: var(--pane-width, auto);
		min-height: var(--pane-min-height, 0);
		height: var(--pane-height, auto);
		overflow: var(--pane-overflow, visible);
		border: 1px solid var(--pane-border-color, var(--theme-border, #8d969e));
		background: var(--pane-background, var(--theme-canvas, white));
	}
</style>
