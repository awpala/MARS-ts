<script lang="ts">
  import Button from '../controls/Button.svelte';
  import { getDesktop } from '../../context/desktop.js';
  import Modal from './Modal.svelte';
  import DialogActions from './DialogActions.svelte';
  import DialogError from './DialogError.svelte';
  const { workspace } = getDesktop();
</script>

<!-- @component Source-deletion confirmation with dirty-buffer warnings; workspace context owns persistence. -->
<Modal title="Delete sources?" onclose={workspace.cancelDelete}>
  <p class="my-2">
    Delete these saved sources and close their open editor buffers? This cannot be undone.
  </p>
  {#if workspace.tabs.some((tab) => workspace.selectedSources.includes(tab.name) && workspace.editor.isDirty(tab))}<p
      class="my-2"
      role="alert"
    >
      Selected files have unsaved edits. Deleting these files will also discard those edits.
    </p>{/if}
  <ul>
    {#each workspace.selectedSources as name (name)}<li>
        {name}{#if workspace.tabs.some((tab) => tab.name === name && workspace.editor.isDirty(tab))}
          — unsaved edits will also be deleted{/if}
      </li>{/each}
  </ul>
  <DialogError message={workspace.fileError} />
  <DialogActions>
    <Button onclick={workspace.confirmDelete}>Delete</Button><Button
      onclick={workspace.cancelDelete}>Cancel</Button
    >
  </DialogActions>
</Modal>
