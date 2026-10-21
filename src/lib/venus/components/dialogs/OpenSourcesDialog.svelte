<script lang="ts">
  import Button from '../controls/Button.svelte';
  import MultiSelect from '../controls/MultiSelect.svelte';
  import { getDesktop } from '../../context/desktop.js';
  import Modal from './Modal.svelte';
  import DialogActions from './DialogActions.svelte';
  import DialogError from './DialogError.svelte';
  const { workspace } = getDesktop();
  const files = $derived(
    workspace.libraryFiles.toSorted((left, right) => {
      const a = left.name.toLowerCase();
      const b = right.name.toLowerCase();
      if (a !== b) return a < b ? -1 : 1;
      return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
    })
  );
</script>

<!-- @component Saved-source selection; workspace context owns opening and deletion requests. -->
<Modal title="Open" onclose={workspace.dismiss}>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      workspace.confirmOpen();
    }}
  >
    <MultiSelect
      label="Source files stored in this browser"
      options={files.map((file) => ({ value: file.name, label: file.name }))}
      bind:value={workspace.selectedSources}
      orientation="vertical"
      class="my-2"
      optionsClass="source-files my-2.5 min-h-[120px] max-h-[300px] overflow-auto border border-[var(--theme-border,#94a3b8)] bg-[var(--theme-canvas,white)] p-2 [--multi-select-gap:6px]"
    >
      {#snippet empty()}<p class="my-2">
          No saved files yet. Create a source or import .asm files.
        </p>{/snippet}
    </MultiSelect>
    <DialogError message={workspace.fileError} />
    <DialogActions>
      <Button type="submit" disabled={!workspace.selectedSources.length || !!workspace.fileError}
        >Open</Button
      >
      <Button
        type="button"
        disabled={!workspace.selectedSources.length || !!workspace.fileError}
        onclick={workspace.requestDelete}>Delete</Button
      ><Button type="button" onclick={workspace.dismiss}>Cancel</Button>
    </DialogActions>
  </form>
</Modal>
