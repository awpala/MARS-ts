<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { whenPageActive } from '#lib/browser/transfers/pageFocus.js';
  import { MARS_DATA_ACCEPT, readMarsDataFile } from '#lib/browser/data/marsData.js';
  import { IMPORT_FILE_ACCEPT, readSourceImport } from '#lib/browser/transfers/sourceImport.js';
  import { getDesktop } from '../../context/desktop.js';

  /** Import behavior for the corresponding desktop command; renders only its hidden native picker. */
  type Props = {
    /** Required scope: assembly sources and ZIP archives for the source library, or one MARS data file replacing all of this browser's MARS data. */
    variant: 'sources' | 'mars';
  };
  let { variant }: Props = $props();
  const WAITING = 'Waiting for file selection…';
  const ATTEMPTING = 'Attempting import…';
  const CANCELING = 'Canceling import…';
  /** How long after the picker returns focus to wait for its selection or cancellation, for browsers that report neither. */
  const PICKER_TIMEOUT_MS = 2000;
  const desktop = getDesktop();
  let input: HTMLInputElement;
  let disposed = false;
  let selection = 0;
  /** The status shown while the native picker is open, before its outcome is known. */
  let picking: { release: () => void; timer?: ReturnType<typeof setTimeout> } | undefined;

  onMount(() => {
    const release = desktop.registerFileTransfer(
      variant === 'mars' ? 'importMars' : 'import',
      () => {
        input.click();
        takePicking()?.release();
        picking = { release: desktop.beginTransfer(WAITING) };
      }
    );
    return () => {
      disposed = true;
      selection++;
      takePicking()?.release();
      release();
    };
  });

  /** Stop waiting on the picker and hand its status to the caller, which supersedes or releases it. */
  function takePicking() {
    const status = picking;
    picking = undefined;
    if (status) clearTimeout(status.timer);
    return status;
  }

  /** The page regains focus when the picker closes; release the status if the browser then reports no outcome. */
  function pickerReturned() {
    if (picking && !picking.timer)
      picking.timer = setTimeout(() => takePicking()?.release(), PICKER_TIMEOUT_MS);
  }

  /** Relay the browser's report that the picker was canceled until the page is active again; a later selection supersedes it. */
  async function pickerCanceled() {
    if (disposed) return;
    const pending = takePicking();
    ++selection;
    // Begun before the picker's status is released, so the status dialog stays mounted and only its text changes.
    const release = desktop.beginTransfer(CANCELING);
    pending?.release();
    try {
      await whenPageActive();
    } finally {
      release();
    }
  }

  async function readFiles(event: Event) {
    const picker = event.currentTarget as HTMLInputElement;
    const files = [...(picker.files ?? [])];
    picker.value = '';
    const pending = takePicking();
    if (!files.length) {
      pending?.release();
      return;
    }
    const request = ++selection;
    const current = () => !disposed && request === selection;
    const release = desktop.beginTransfer(ATTEMPTING);
    pending?.release();
    desktop.workspace.dismiss();
    try {
      let finish: () => void;
      if (variant === 'mars') {
        const reading = await readMarsDataFile(files[0]);
        finish = () => desktop.marsDataImport.accept(reading);
      } else
        try {
          const plan = await readSourceImport(files);
          finish = () => desktop.workspace.acceptImport(plan);
        } catch (error) {
          finish = () => desktop.workspace.importFailure(error);
        }
      await whenPageActive();
      if (!current()) return;
      // Let the status dialog restore focus before the summary dialog records where focus returns.
      release();
      await tick();
      if (current()) finish();
    } finally {
      release();
    }
  }
</script>

<svelte:window onfocus={pickerReturned} />

<!-- @component Owns one browser import picker, its selected-file reads, and its registered desktop command: assembly sources and ZIP archives, or a single MARS data file. A blocking status covers selection, reading, or cancellation until that operation finishes and the page is active; a picker that reports no outcome releases its status after a focus-return grace period. The workspace owns the source import summary, confirmation, and persistence; the desktop's MARS data import owner holds a validated or rejected data reading, its confirmation, and the replacement. Superseded reads and completions after unmount are ignored. -->
<input
  class="hidden"
  type="file"
  multiple={variant === 'sources'}
  accept={variant === 'mars' ? MARS_DATA_ACCEPT : IMPORT_FILE_ACCEPT}
  bind:this={input}
  disabled={desktop.simulation.running}
  onchange={readFiles}
  oncancel={pickerCanceled}
  aria-label={variant === 'mars' ? 'Import MARS data file' : 'Import assembly files'}
/>
