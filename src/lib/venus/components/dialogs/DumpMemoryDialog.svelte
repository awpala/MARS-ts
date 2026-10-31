<script lang="ts">
  /* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
   * Ports mars/venus/FileDumpMemoryAction.java using the existing same-tab modal and browser save workflow. */
  import { onDestroy } from 'svelte';
  import { DumpFormatLoader } from '#lib/engine/dump/DumpFormatLoader.js';
  import { MemoryDump } from '#lib/engine/dump/MemoryDump.js';
  import { Binary } from '#lib/engine/formatting/Binary.js';
  import { sourceStem } from '#lib/browser/SourceLibrary.js';
  import { FileDownload } from '#lib/browser/FileDownload.js';
  import { errorMessage } from '#lib/browser/errorMessage.js';
  import { getDesktop } from '../../context/desktop.js';
  import Modal from './Modal.svelte';
  import DialogField from './DialogField.svelte';
  import DialogActions from './DialogActions.svelte';
  import DialogError from './DialogError.svelte';
  import Button from '../controls/Button.svelte';
  import Select from '../controls/Select.svelte';

  const desktop = getDesktop();
  const machine = desktop.simulation.machine!;
  const filenameStub = sourceStem(desktop.simulation.loadedFilename ?? 'dump');
  const segments = new MemoryDump(machine).getSegments();
  const formats = new DumpFormatLoader().loadDumpFormats(machine);
  const download = new FileDownload((status) => desktop.beginTransfer(status));
  let segmentName = $state(segments[0]?.name);
  let descriptor = $state(formats[0].descriptor);
  let error = $state('');
  let saving = $state(false);
  const format = $derived(formats.find((item) => item.descriptor === descriptor)!);

  function close() {
    if (!saving) desktop.dumpOpen = false;
  }
  async function dump() {
    const segment = segments.find((item) => item.name === segmentName);
    if (!segment || saving) return;
    error = '';
    saving = true;
    try {
      const bytes = format.dumpMemoryRange(segment.firstAddress, segment.lastAddress);
      const blob = new Blob([bytes], { type: format.mimeType });
      if (
        await download.save(
          `${filenameStub}${segment.name}.${format.extension}`,
          blob,
          format.name,
          'Dumping memory…',
          'Canceling dump…'
        )
      )
        desktop.dumpOpen = false;
    } catch (failure) {
      error = errorMessage(failure);
    } finally {
      saving = false;
    }
  }
  onDestroy(() => download.dispose());
</script>

<!-- @component Dump the current machine's populated text or data range using one of the six legacy formats. Draft choices and the save lifecycle belong to this mounted dialog; canceling the OS picker keeps the choices open. No source record or native handle is retained. -->
<Modal title="Dump Memory To File" onclose={close} initialFocus="select">
  {#if segments.length}
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void dump();
      }}
    >
      <fieldset disabled={saving}>
        <DialogField label="Memory Segment">
          <Select bind:value={segmentName}>
            {#each segments as segment (segment.name)}
              <option value={segment.name}
                >{segment.name} ({Binary.intToHexString(segment.firstAddress)} - {Binary.intToHexString(
                  segment.lastAddress
                )})</option
              >
            {/each}
          </Select>
        </DialogField>
        <DialogField label="Dump Format">
          <Select bind:value={descriptor} title={format.description}>
            {#each formats as item (item.descriptor)}<option value={item.descriptor}
                >{item.name}</option
              >{/each}
          </Select>
        </DialogField>
        <p class="my-2 text-sm">{format.description}</p>
        <DialogError message={error} />
        <DialogActions>
          <Button type="submit">Dump To File...</Button>
          <Button onclick={close}>Cancel</Button>
        </DialogActions>
      </fieldset>
    </form>
  {:else}
    <p>No populated memory segments to dump.</p>
    <DialogActions><Button onclick={close}>Close</Button></DialogActions>
  {/if}
</Modal>
