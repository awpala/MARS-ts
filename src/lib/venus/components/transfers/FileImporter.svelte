<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { whenPageActive } from '#lib/browser/pageFocus.js';
  import { IMPORT_FILE_ACCEPT, readSourceImport } from '#lib/browser/sourceImport.js';
  import { getDesktop } from '../../context/desktop.js';
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
    const release = desktop.registerFileTransfer('import', () => {
      input.click();
      takePicking()?.release();
      picking = { release: desktop.beginTransfer(WAITING) };
    });
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

<!-- @component Owns the browser import picker, the reading of selected sources and ZIP archives, and its registered desktop command. The desktop blocks interaction behind "Waiting for file selection…" from the moment the picker opens; once the browser reports the outcome it reads "Attempting import…" while the selection is read, or "Canceling import…" for a canceled picker, and it is released as soon as the page has focus again. The workspace owns the import summary, confirmation, and persistence. Superseded reads and completions after unmount are ignored. -->
<input
  class="hidden"
  type="file"
  multiple
  accept={IMPORT_FILE_ACCEPT}
  bind:this={input}
  disabled={desktop.simulation.running}
  onchange={readFiles}
  oncancel={pickerCanceled}
  aria-label="Import assembly files"
/>
