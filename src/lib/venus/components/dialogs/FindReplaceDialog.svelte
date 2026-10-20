<script lang="ts">
	import Button from '../controls/Button.svelte';
	import SelectorToggle from '../controls/SelectorToggle.svelte';
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
	><SelectorToggle bind:checked={search.caseSensitive} label="Case sensitive" />
	<DialogActions>
		<Button disabled={!search.findText} onclick={search.findNext}>Find Next</Button><Button
			disabled={!search.findText}
			onclick={() => search.replace()}>Replace</Button
		><Button disabled={!search.findText} onclick={() => search.replace(true)}>Replace All</Button
		><Button onclick={workspace.dismiss}>Close</Button>
	</DialogActions>
	<p class="my-2" role="status">{search.findStatus}</p></Modal
>
