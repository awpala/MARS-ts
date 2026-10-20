<script module lang="ts">
	/** A stable tab identity and its display label. */
	export type PaneTab<T extends string | number> = {
		/** Unique identity within the strip. */
		id: T;
		/** Visible label, including any caller-owned dirty marker. */
		label: string;
	};
</script>

<script lang="ts" generics="T extends string | number">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';
	/** Stateless navigation strip; the parent owns selection and tab resources. */
	type Props = {
		/** Required ordered tabs with unique IDs. */
		tabs: readonly PaneTab<T>[];
		/** Parent-selected ID, undefined when no tab is open. */
		selected: T | undefined;
		/** Required callback selecting a tab in its owner. */
		onselect: (id: T) => void;
		/** Presentation variant, defaulting to pane tabs. Documents use a scrollable strip. */
		variant?: 'pane' | 'documents';
		/** Optional content after all tabs; omitted by default. */
		actions?: Snippet;
		/** Optional per-document controls, such as Close; rendered only by the documents variant. */
		tabActions?: Snippet<[T]>;
		/** Optional replacement for the selection button. The caller owns its styling, accessible interaction, and selection callback; omitted by default. */
		tabControl?: Snippet<[PaneTab<T>]>;
	};
	let {
		tabs,
		selected,
		onselect,
		variant = 'pane',
		actions,
		tabActions,
		tabControl
	}: Props = $props();
</script>

<!-- @component Generic tab strip for panes and nested documents, with stable keys and caller-supplied actions. -->
{#snippet tabButton(tab: PaneTab<T>)}
	{#if tabControl}
		{@render tabControl(tab)}
	{:else}
		<Button
			class={[
				'whitespace-nowrap',
				variant === 'documents'
					? 'px-[7px] py-1'
					: 'rounded-t-[3px] border border-b-0 border-[var(--theme-border,#a6aeb5)] p-[var(--tab-padding,4px_12px)]',
				{ active: selected === tab.id },
				variant === 'pane' && selected === tab.id && 'bg-[var(--theme-canvas,white)] font-semibold'
			]}
			aria-pressed={selected === tab.id}
			onclick={() => onselect(tab.id)}>{tab.label}</Button
		>
	{/if}
{/snippet}
<div class={variant === 'documents' ? 'source-tabs' : 'tabs'}>
	{#each tabs as tab (tab.id)}
		{#if variant === 'documents'}
			<div class={{ active: selected === tab.id }}>
				{@render tabButton(tab)}
				{@render tabActions?.(tab.id)}
			</div>
		{:else}
			{@render tabButton(tab)}
		{/if}
	{/each}
	{@render actions?.()}
</div>

<style>
	.tabs {
		display: flex;
		flex-shrink: 0;
		background: var(--theme-chrome, #e4e4e4);
		border-bottom: 1px solid var(--theme-border, #9ca7b0);
		padding: 2px 3px 0;
		gap: 2px;
	}
	.source-tabs {
		display: flex;
		min-height: 28px;
		background: var(--theme-chrome, #e7e7e7);
		overflow-x: auto;
		flex-shrink: 0;
	}
	.source-tabs > div {
		display: flex;
		border-right: 1px solid var(--theme-border, #aaa);
	}
	.source-tabs .active {
		background: var(--theme-canvas, white);
	}
</style>
