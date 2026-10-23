<script lang="ts">
  import Button from '../controls/Button.svelte';
  import { getDesktop } from '../../context/desktop.js';
  import Modal from './Modal.svelte';
  import DialogActions from './DialogActions.svelte';
  const { workspace } = getDesktop();
</script>

<!-- @component Close All confirmation; workspace context owns the dirty-buffer queue that follows. -->
<Modal title="Close all files?" onclose={workspace.dismiss}>
  <p class="my-2">
    Close all {workspace.tabs.length} open {workspace.tabs.length === 1 ? 'file' : 'files'}?
  </p>
  {#if workspace.unsavedNames.length}<p class="my-2">
      You will be asked to save or discard unsaved changes.
    </p>{/if}
  <DialogActions>
    <Button onclick={workspace.confirmCloseAll}>Close All</Button><Button
      onclick={workspace.dismiss}>Cancel</Button
    >
  </DialogActions>
</Modal>
