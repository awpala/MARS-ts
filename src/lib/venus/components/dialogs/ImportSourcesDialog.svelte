<script lang="ts">
	import { getDesktop } from '../../context/desktop.js';
	import Modal from './Modal.svelte';
	import DialogActions from './DialogActions.svelte';
	const { workspace } = getDesktop();
</script>

<!-- @component Import collision confirmation; workspace context owns the pending source batch. -->
<Modal title="Replace imported sources?" onclose={workspace.dismiss}>
	<p class="my-2">Importing will replace saved sources with matching names:</p>
	<ul>
		{#each workspace.importSources as file (file.name)}<li>{file.name}</li>{/each}
	</ul>
	{#if workspace.fileError}<p class="my-2" role="alert">{workspace.fileError}</p>{/if}
	<DialogActions>
		<button disabled={!workspace.importSources.length} onclick={workspace.confirmImport}
			>Replace</button
		><button onclick={workspace.dismiss}>Cancel</button>
	</DialogActions>
</Modal>
