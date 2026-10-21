<script lang="ts">
  import Button from '../controls/Button.svelte';
  import SelectorToggle from '../controls/SelectorToggle.svelte';
  import { getDesktop } from '../../context/desktop.js';
  import Modal from './Modal.svelte';
  import DialogActions from './DialogActions.svelte';
  import DialogError from './DialogError.svelte';
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
        <SelectorToggle bind:checked={workspace.renameSource} label="Rename existing file" />
        {#if workspace.renameSource}<DialogField label="Old filename"
            ><input value={workspace.saveTarget.name} readonly /></DialogField
          >{/if}
      {/if}
      <p class="my-2">Save this source in the browser’s local library.</p>
      <DialogError message={workspace.fileError} />
      {#if workspace.replaceSave}<p class="my-2">
          A saved source named “{workspace.filename}” already exists.
        </p>
        <Button type="button" onclick={() => workspace.confirmSave(true)}>Replace</Button>{/if}
      <DialogActions>
        <Button type="submit">Save</Button><Button type="button" onclick={workspace.dismiss}
          >Cancel</Button
        >
      </DialogActions>
    </form></Modal
  >
{/key}
