<script lang="ts">
	import { getDesktop } from '../../context/desktop.js';
	import Modal from './Modal.svelte';
	import DialogActions from './DialogActions.svelte';
	const { workspace } = getDesktop();
	const files = $derived(
		workspace.libraryFiles.toSorted((left, right) => {
			const a = left.name.toLowerCase();
			const b = right.name.toLowerCase();
			if (a !== b) return a < b ? -1 : 1;
			return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
		})
	);
</script>

<!-- @component Saved-source selection; workspace context owns opening and deletion requests. -->
<Modal title="Open" onclose={workspace.dismiss}>
	<form
		onsubmit={(event) => {
			event.preventDefault();
			workspace.confirmOpen();
		}}
	>
		<p class="my-2">Source files stored in this browser</p>
		<div class="source-files">
			{#each files as file (file.name)}
				<label
					><input type="checkbox" bind:group={workspace.selectedSources} value={file.name} />
					{file.name}</label
				>
			{:else}<p class="my-2">No saved files yet. Create a source or import .asm files.</p>{/each}
		</div>
		{#if workspace.fileError}<p class="my-2" role="alert">{workspace.fileError}</p>{/if}
		<DialogActions>
			<button type="submit" disabled={!workspace.selectedSources.length || !!workspace.fileError}
				>Open</button
			>
			<button
				type="button"
				disabled={!workspace.selectedSources.length || !!workspace.fileError}
				onclick={workspace.requestDelete}>Delete</button
			><button type="button" onclick={workspace.dismiss}>Cancel</button>
		</DialogActions>
	</form>
</Modal>

<style>
	.source-files {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-height: 120px;
		max-height: 300px;
		overflow: auto;
		margin-block: 10px;
		padding: 8px;
		border: 1px solid var(--theme-border, #94a3b8);
		background: var(--theme-canvas, white);
	}
</style>
