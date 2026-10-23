<script lang="ts">
  import type { ImportedSource } from '#lib/browser/sourceImport.js';
  import Button from '../controls/Button.svelte';
  import { getDesktop } from '../../context/desktop.js';
  import Modal from './Modal.svelte';
  import DialogActions from './DialogActions.svelte';
  import DialogError from './DialogError.svelte';
  const { workspace } = getDesktop();
  const sources = $derived(workspace.importPlan.sources);
  const skipped = $derived(workspace.importPlan.skipped);
  const saved = $derived(new Set(workspace.libraryFiles.map((file) => file.name)));
  const replacing = $derived(sources.filter((file) => saved.has(file.name)).length);
  const blocked = $derived(
    sources.filter((file) => workspace.unsavedNames.includes(file.name)).length
  );
  const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
  function note(file: ImportedSource): string {
    const state = workspace.unsavedNames.includes(file.name)
      ? 'open with unsaved edits'
      : saved.has(file.name)
        ? 'replaces saved source'
        : '';
    return [file.archive && `from ${file.archive}`, state].filter(Boolean).join(' · ');
  }
</script>

<!-- @component Import summary and confirmation: the sources to import with their replacements and blocked edits, and every skipped file or archive entry with its reason. The workspace owns the pending plan and the commit. -->
<Modal title="Import sources" onclose={workspace.dismiss}>
  {#if sources.length}
    <p class="my-2">
      Import {plural(sources.length, 'source')} into this browser and open {sources.length === 1
        ? 'it'
        : 'them'}?
      {#if replacing}{replacing === 1
          ? '1 replaces a saved source'
          : `${replacing} replace saved sources`}
        with the same name.{/if}
    </p>
    {#if blocked}<p class="my-2" role="alert">
        {blocked === 1 ? 'An open source has' : `${blocked} open sources have`} unsaved edits. Save or
        close {blocked === 1 ? 'it' : 'them'} before importing.
      </p>{/if}
    <ul class="import-list" aria-label="Sources to import">
      {#each sources as file (file.name)}<li>
          {file.name}<span class="note">{note(file)}</span>
        </li>{/each}
    </ul>
  {:else}
    <p class="my-2">No sources in this selection can be imported.</p>
  {/if}
  {#if skipped.length}
    <p class="skipped-heading my-2">
      {plural(skipped.length, 'item')}
      {skipped.length === 1 ? 'is' : 'are'} not an importable source and will be skipped:
    </p>
    <ul class="import-list" aria-label="Skipped">
      {#each skipped as item, index (index)}<li>
          {item.archive ? `${item.archive} › ${item.name}` : item.name}<span class="note"
            >{item.reason}</span
          >
        </li>{/each}
    </ul>
  {/if}
  <DialogError message={workspace.fileError} />
  <DialogActions>
    <Button disabled={!sources.length || blocked > 0} onclick={workspace.confirmImport}
      >Import</Button
    ><Button onclick={workspace.dismiss}>Cancel</Button>
  </DialogActions>
</Modal>

<style>
  .import-list {
    max-height: 200px;
    overflow: auto;
    margin: 8px 0;
    border: 1px solid var(--theme-border, #94a3b8);
    background: var(--theme-canvas, white);
    padding: 4px 8px;
  }
  .import-list li {
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
  .skipped-heading {
    font-weight: 600;
  }
</style>
