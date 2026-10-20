<script lang="ts">
	import PaneTabs from '../controls/PaneTabs.svelte';
	import Button from '../controls/Button.svelte';
	/** Open-document navigation; buffers, dirty state, and close confirmation belong to the owner. */
	type Props = {
		/** Required ordered document summaries with unique IDs. */
		tabs: readonly { id: number; name: string; dirty: boolean }[];
		/** Selected document ID; absent when no source is open. */
		selected?: number;
		/** Required callback selecting a buffer. */
		onselect: (id: number) => void;
		/** Required callback requesting the owning desktop's close workflow. */
		onclose: (id: number) => void;
		/** Required availability of inline renaming; false while execution or another desktop workflow blocks it. */
		canRename: boolean;
		/** Required callback committing a proposed filename through the workspace's validation and rename workflow. */
		onrename: (id: number, filename: string) => void;
	};
	let { tabs, selected, onselect, onclose, canRename, onrename }: Props = $props();
	let editing = $state<number>();
	let filename = $state('');
	let focusAfterRename: number | undefined;

	function beginRename(id: number) {
		const tab = tabs.find((tab) => tab.id === id);
		if (!tab || !canRename) return;
		onselect(id);
		filename = tab.name;
		editing = id;
	}

	function renameKeydown(event: KeyboardEvent, id: number) {
		if (event.isComposing || !['Enter', 'Escape'].includes(event.key)) return;
		event.preventDefault();
		event.stopPropagation();
		focusAfterRename = id;
		finishRename(id, event.key === 'Enter');
	}

	function finishRename(id: number, commit = true) {
		if (editing !== id) return;
		editing = undefined;
		if (commit && canRename) onrename(id, filename);
	}
</script>

<!-- @component Document navigation and transient filename editing through the generic tab strip. Closing and renaming delegate to the desktop's file workflows. -->
<PaneTabs
	variant="documents"
	tabs={tabs.map((tab) => ({ id: tab.id, label: `${tab.dirty ? '* ' : ''}${tab.name}` }))}
	{selected}
	{onselect}
>
	{#snippet tabControl(tab)}
		{#if editing === tab.id && selected === tab.id && canRename}
			<input
				class="source-name-input"
				aria-label="Rename source file"
				bind:value={filename}
				size={Math.max(12, filename.length)}
				{@attach (input) => {
					input.focus();
					input.select();
				}}
				onkeydown={(event) => renameKeydown(event, tab.id)}
				onblur={() => finishRename(tab.id)}
				autocomplete="off"
				spellcheck="false"
			/>
		{:else}
			<Button
				class="source-name px-[7px] py-1 whitespace-nowrap"
				aria-pressed={selected === tab.id}
				attachment={(button) => {
					if (focusAfterRename === tab.id) {
						focusAfterRename = undefined;
						button.focus();
					}
				}}
				onclick={() => onselect(tab.id)}
				ondblclick={() => beginRename(tab.id)}
				onkeydown={(event) => {
					if (event.key === 'F2' && canRename) {
						event.preventDefault();
						beginRename(tab.id);
					}
				}}>{tab.label}</Button
			>
		{/if}
	{/snippet}
	{#snippet tabActions(id)}
		<Button
			class="close-source px-[7px] py-1 whitespace-nowrap"
			aria-label={`Close ${tabs.find((tab) => tab.id === id)?.name}`}
			onclick={() => onclose(id)}>×</Button
		>
	{/snippet}
</PaneTabs>

<style>
	.source-name-input {
		min-width: 10ch;
		max-width: 40ch;
		margin: 2px;
		padding: 1px 4px;
		border: 1px solid var(--theme-focus, #2c679c);
		background: var(--theme-canvas, white);
		color: var(--theme-text, #17202b);
	}
</style>
