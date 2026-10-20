<script lang="ts">
	import { getDesktop } from '../../context/desktop.js';
	import Modal from './Modal.svelte';
	import DialogActions from './DialogActions.svelte';
	import DialogField from './DialogField.svelte';
	const { workspace } = getDesktop();
</script>

<!-- @component Local save and rename form; workspace context owns collisions and the save queue. -->
{#key workspace.saveTarget?.id}<Modal title="Save As" onclose={workspace.dismiss}
		><form
			onsubmit={(event) => {
				event.preventDefault();
				workspace.confirmSave();
			}}
		>
			<DialogField label="File name"
				><input
					bind:value={workspace.filename}
					oninput={() => {
						workspace.replaceSave = false;
						workspace.fileError = '';
					}}
					required={!workspace.renameSource}
				/></DialogField
			>
			{#if workspace.saveTarget && !workspace.saveTarget.isNew}
				<label
					><input type="checkbox" bind:checked={workspace.renameSource} /> Rename existing file</label
				>
				{#if workspace.renameSource}<DialogField label="Old filename"
						><input value={workspace.saveTarget.name} readonly /></DialogField
					>{/if}
			{/if}
			<p class="my-2">Save this source in the browser’s local library.</p>
			{#if workspace.fileError}<p class="my-2" role="alert">{workspace.fileError}</p>{/if}
			{#if workspace.replaceSave}<p class="my-2">
					A saved source named “{workspace.filename}” already exists.
				</p>
				<button type="button" onclick={() => workspace.confirmSave(true)}>Replace</button>{/if}
			<DialogActions>
				<button type="submit">Save</button><button type="button" onclick={workspace.dismiss}
					>Cancel</button
				>
			</DialogActions>
		</form></Modal
	>
{/key}
