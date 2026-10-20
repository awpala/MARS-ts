<script lang="ts">
	import { getDesktop } from '../../context/desktop.js';
	import Modal from './Modal.svelte';
	import DialogActions from './DialogActions.svelte';
	const { workspace } = getDesktop();
</script>

<!-- @component Dirty-buffer closure choices; workspace context owns save, discard, and cancellation. -->
<Modal title="Save changes?" onclose={workspace.dismiss}
	><p class="my-2">Save changes to {workspace.current?.name} before closing?</p>
	{#if workspace.fileError}<p class="my-2" role="alert">{workspace.fileError}</p>{/if}
	<DialogActions>
		<button onclick={workspace.saveAndClose}>Save</button><button onclick={workspace.discard}
			>Discard</button
		><button onclick={workspace.dismiss}>Cancel</button>
	</DialogActions></Modal
>
