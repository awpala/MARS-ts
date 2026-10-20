<script lang="ts">
	import { getDesktop } from '../../context/desktop.js';
	import Modal from './Modal.svelte';
	import DialogActions from './DialogActions.svelte';
	import DialogField from './DialogField.svelte';
	const { workspace, search } = getDesktop();
</script>

<!-- @component Source search controls; search context owns matching and workspace edits. -->
<Modal title="Find / Replace" onclose={workspace.dismiss}
	><DialogField label="Find"><input bind:value={search.findText} /></DialogField><DialogField
		label="Replace with"><input bind:value={search.replacement} /></DialogField
	><label><input type="checkbox" bind:checked={search.caseSensitive} /> Case sensitive</label>
	<DialogActions>
		<button disabled={!search.findText} onclick={search.findNext}>Find Next</button><button
			disabled={!search.findText}
			onclick={() => search.replace()}>Replace</button
		><button disabled={!search.findText} onclick={() => search.replace(true)}>Replace All</button
		><button onclick={workspace.dismiss}>Close</button>
	</DialogActions>
	<p class="my-2" role="status">{search.findStatus}</p></Modal
>
