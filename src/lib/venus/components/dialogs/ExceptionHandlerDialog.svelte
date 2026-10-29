<script lang="ts">
  /* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
   * Ports the dialog in mars/venus/SettingsExceptionHandlerAction.java. */
  import { SOURCE_EXTENSION_LABEL } from '#lib/browser/SourceLibrary.js';
  import { spimExceptionHandler } from '#lib/browser/BundledSources.js';
  import { getDesktop } from '../../context/desktop.js';
  import { compareSourceNames } from '../../utils/sources/compareSourceNames.js';
  import Button from '../controls/Button.svelte';
  import Toggle from '../controls/Toggle.svelte';
  import RadioSelector from '../controls/RadioSelector.svelte';
  import Modal from './Modal.svelte';
  import DialogActions from './DialogActions.svelte';

  const desktop = getDesktop();
  const { simulation, workspace } = desktop;
  const settings = simulation.machine!.getSettings();
  const id = $props.id();
  const initialName = settings.getExceptionHandler();
  let enabled = $state(settings.getExceptionHandlerEnabled());
  let name = $state(initialName);
  let customName = $state(initialName === spimExceptionHandler.name ? '' : initialName);
  let kind = $state(initialName === spimExceptionHandler.name ? 'spim' : 'custom');
  let browsing = $state(false);
  let selected = $state('');
  const files = $derived(
    workspace.libraryFiles.toSorted((left, right) => compareSourceNames(left.name, right.name))
  );

  function close() {
    desktop.exceptionHandlerOpen = false;
  }
  function browse() {
    const current = kind === 'spim' ? customName : name;
    selected = files.some((file) => file.name === current) ? current : '';
    browsing = true;
  }
</script>

<!-- @component Automatic handler settings with independent enablement, a bundled SPIM reference, and saved-library selection. Draft flag, name, and browse selection belong only to this mounted dialog; SimulationState owns commits, and Cancel/Escape discard drafts. Opening the reference closes without applying settings. -->
<Modal title="Exception Handler" onclose={close} --modal-width="min(640px, 94vw)">
  <form
    onsubmit={(event) => {
      event.preventDefault();
      simulation.updateExceptionHandler(enabled, name);
      close();
    }}
  >
    <Toggle label="Enable exception handler" variant="active" bind:checked={enabled} />
    <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
      <RadioSelector
        name={`${id}-kind`}
        label="Use SPIM default exceptions handler"
        value="spim"
        bind:selected={kind}
        disabled={!enabled}
        class={!enabled ? 'opacity-50' : ''}
        onchange={() => (name = spimExceptionHandler.name)}
      />
      <Button
        variant="bordered"
        class="shrink-0 px-2 py-1"
        title="View read-only source without applying settings"
        onclick={() => {
          close();
          void workspace.openBundledSource(spimExceptionHandler.name);
        }}>Open default <code class="font-mono font-bold">exceptions.s</code> in editor</Button
      >
    </div>
    <p class="mt-2 text-xs">
      The SPIM source includes startup code for a global <code>main</code> label and the default memory
      layout. Opening the default source closes this dialog without applying changes.
    </p>
    <RadioSelector
      name={`${id}-kind`}
      label="Use a custom exception handler"
      value="custom"
      bind:selected={kind}
      disabled={!enabled}
      onchange={() => (name = customName)}
      class={enabled ? 'mt-3' : 'mt-3 opacity-50'}
    />
    {#if kind === 'custom'}
      <div class={['my-5 flex items-center gap-2', !enabled && 'opacity-50']}>
        <Button variant="bordered" class="shrink-0 px-3 py-1" disabled={!enabled} onclick={browse}
          >Browse</Button
        >
        <p role="status" aria-label="Exception handler source" class="min-w-0 break-all">
          {name || 'No file selected'}
        </p>
      </div>
    {/if}
    <DialogActions>
      <Button type="submit">OK</Button>
      <Button onclick={close}>Cancel</Button>
    </DialogActions>
  </form>
</Modal>

{#if browsing}
  <Modal title="Select Exception Handler" onclose={() => (browsing = false)}>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        if (!files.some((file) => file.name === selected)) return;
        name = selected;
        customName = selected;
        kind = 'custom';
        browsing = false;
      }}
    >
      <fieldset>
        <legend>Source files stored in this browser</legend>
        <div
          class="my-2.5 max-h-[300px] min-h-[120px] overflow-auto border border-[var(--theme-border,#94a3b8)] bg-[var(--theme-canvas,white)] p-2"
        >
          {#each files as file (file.name)}
            <RadioSelector
              name={id}
              value={file.name}
              label={file.name}
              bind:selected
              class="py-1"
            />
          {:else}
            <p class="my-2">
              No saved files yet. Create a source or import {SOURCE_EXTENSION_LABEL} files.
            </p>
          {/each}
        </div>
      </fieldset>
      <DialogActions>
        <Button type="submit" disabled={!files.some((file) => file.name === selected)}>Open</Button>
        <Button onclick={() => (browsing = false)}>Cancel</Button>
      </DialogActions>
    </form>
  </Modal>
{/if}
