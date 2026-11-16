<script lang="ts">
  import Button from '../controls/Button.svelte';
  import { getDesktop } from '../../context/desktop.js';
  import Modal from './Modal.svelte';
  import DialogActions from './DialogActions.svelte';
  import DialogError from './DialogError.svelte';
  const { marsDataImport, workspace } = getDesktop();
  const reading = $derived(marsDataImport.pending);
  const summary = $derived(reading?.summary);
  const unsaved = $derived(workspace.unsavedNames.length);
  const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
  const exported = $derived.by(() => {
    const time = summary?.exportedAt ? new Date(summary.exportedAt) : null;
    return time && !Number.isNaN(time.getTime()) ? time.toLocaleString() : null;
  });
</script>

<!-- @component Import MARS confirmation: what a conforming payload contains and that it replaces all of this browser's MARS data, or the reasons a file was rejected. The desktop's import owner holds the pending reading, the replacement, and the restart. -->
<Modal title="Import MARS data" onclose={marsDataImport.dismiss}>
  {#if summary}
    <p class="my-2">
      Replace all MARS data in this browser with <strong data-testid="mars-data-filename"
        >{reading?.filename}</strong
      >?
    </p>
    <ul class="data-list" aria-label="Data to import">
      <li>Saved sources<span class="note">{summary.savedSources}</span></li>
      <li>
        Open files<span class="note"
          >{summary.openBuffers}{summary.unsavedBuffers
            ? ` (${summary.unsavedBuffers} unsaved)`
            : ''}</span
        >
      </li>
      <li>
        Settings<span class="note"
          >{summary.settings ? plural(summary.settings, 'record') : 'defaults'}</span
        >
      </li>
      <li>
        Session<span class="note"
          >{summary.session
            ? summary.loadedProgram
              ? `program ${summary.loadedProgram}`
              : 'no loaded program'
            : 'none'}</span
        >
      </li>
      {#if exported}<li>Exported<span class="note">{exported}</span></li>{/if}
    </ul>
    <p class="my-2" role="alert">
      The saved sources, open files, settings, and session now in this browser are removed, and MARS
      restarts with the imported data. This cannot be undone; use Export MARS first to keep a copy.
      {#if unsaved}{unsaved === 1 ? '1 open file has' : `${unsaved} open files have`} unsaved changes
        that will be lost.{/if}
    </p>
  {:else}
    <p class="my-2">
      <strong data-testid="mars-data-filename">{reading?.filename}</strong> is not a MARS data file this
      version can import. Nothing was changed.
    </p>
    <ul class="data-list" aria-label="Problems">
      {#each reading?.issues ?? [] as issue, index (index)}<li>{issue}</li>{/each}
    </ul>
  {/if}
  <DialogError message={marsDataImport.error} />
  <DialogActions>
    <Button disabled={!summary} onclick={marsDataImport.confirm}>Import</Button><Button
      onclick={marsDataImport.dismiss}>Cancel</Button
    >
  </DialogActions>
</Modal>

<style>
  .data-list {
    max-height: 200px;
    overflow: auto;
    margin: 8px 0;
    border: 1px solid var(--theme-border, #94a3b8);
    background: var(--theme-canvas, white);
    padding: 4px 8px;
  }
  .data-list li {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 2px 12px;
    padding: 2px 0;
    overflow-wrap: anywhere;
  }
  .note {
    color: var(--theme-muted, #55616f);
  }
</style>
