<script lang="ts">
	import type { Snippet } from 'svelte';
	import PaneTabs from './PaneTabs.svelte';
	/** Layout and tab contract; the caller owns selection, body state, and all resources. */
	type Props = {
		/** Required accessible region name. */
		label: string;
		/** Optional region ID for resize controls; absent by default. */
		id?: string;
		/** Optional CSS hook for the containing layout; empty by default. */
		class?: string;
		/** Region landmark; defaults to section, with aside available for sidebars. */
		element?: 'section' | 'aside';
		/** Required ordered tab labels. */
		tabs: readonly string[];
		/** Required parent-owned selected label, bindable. */
		selected: string;
		/** Required body template, receiving the selected tab. The caller decides whether bodies remain mounted. */
		children: Snippet<[string]>;
		/** Optional controls in the tab strip; omitted by default. */
		actions?: Snippet;
	};
	let {
		label,
		id,
		class: className = '',
		element = 'section',
		tabs,
		selected = $bindable(),
		children,
		actions
	}: Props = $props();
</script>

<!-- @component Composable pane shell. CSS custom properties control geometry; snippets supply tab content and actions. -->
<svelte:element this={element} {id} aria-label={label} class={['pane', className]}>
	<PaneTabs
		tabs={tabs.map((label) => ({ id: label, label }))}
		{selected}
		onselect={(tab) => (selected = tab)}
		{actions}
	/>
	{@render children(selected)}
</svelte:element>

<style>
	.pane {
		display: flex;
		flex-direction: column;
		flex: var(--pane-flex, 1);
		min-width: var(--pane-min-width, 0);
		width: var(--pane-width, auto);
		min-height: var(--pane-min-height, 0);
		height: var(--pane-height, auto);
		overflow: var(--pane-overflow, visible);
		border: 1px solid var(--theme-border, #8d969e);
		background: var(--pane-background, var(--theme-canvas, white));
	}
</style>
