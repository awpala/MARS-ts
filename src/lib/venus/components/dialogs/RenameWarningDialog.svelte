<script lang="ts">
  import Button from '../controls/Button.svelte';
  import { getDesktop } from '../../context/desktop.js';
  import Modal from './Modal.svelte';
  import DialogActions from './DialogActions.svelte';
  import DialogError from './DialogError.svelte';
  const { workspace } = getDesktop();
</script>

<!-- @component Invalid rename warning. The workspace retains the latest valid filename and all source content. -->
<Modal title="Invalid filename" onclose={workspace.dismiss}>
  <DialogError message={workspace.fileError} />
  <p class="my-2">The filename remains “{workspace.filename}”. Your source is unchanged.</p>
  <DialogActions>
    <Button onclick={workspace.dismiss}>OK</Button>
  </DialogActions>
</Modal>
