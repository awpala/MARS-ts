<script lang="ts">
  import Button from '../controls/Button.svelte';
  import { getDesktop } from '../../context/desktop.js';
  import Modal from './Modal.svelte';
  import DialogActions from './DialogActions.svelte';
  import DialogError from './DialogError.svelte';
  const { workspace } = getDesktop();
</script>

<!-- @component Import collision confirmation; workspace context owns the pending source batch. -->
<Modal title="Replace imported sources?" onclose={workspace.dismiss}>
  <p class="my-2">Importing will replace saved sources with matching names:</p>
  <ul>
    {#each workspace.importSources as file (file.name)}<li>{file.name}</li>{/each}
  </ul>
  <DialogError message={workspace.fileError} />
  <DialogActions>
    <Button disabled={!workspace.importSources.length} onclick={workspace.confirmImport}
      >Replace</Button
    ><Button onclick={workspace.dismiss}>Cancel</Button>
  </DialogActions>
</Modal>
