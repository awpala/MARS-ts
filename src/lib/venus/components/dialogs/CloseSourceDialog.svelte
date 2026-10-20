<script lang="ts">
	import Button from '../controls/Button.svelte';
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
		<Button onclick={workspace.saveAndClose}>Save</Button><Button onclick={workspace.discard}
			>Discard</Button
		><Button onclick={workspace.dismiss}>Cancel</Button>
	</DialogActions></Modal
>
