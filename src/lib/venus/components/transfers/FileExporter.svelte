<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    downloadBlob,
    EXPORT_ALL_FILENAME,
    requestSaveTarget,
    sourceArchiveBlob,
    sourceBlob,
    writeSaveTarget
  } from '#lib/browser/download.js';
  import { whenPageActive } from '#lib/browser/pageFocus.js';
  import { getDesktop } from '../../context/desktop.js';
  import { exportFilenames } from '../../utils/sources/exportFilenames.js';

  /** Export behavior for the corresponding desktop command; renders no additional control. */
  type Props = {
    /** Required scope: the current source, or saved sources merged with all open edits. */
    variant: 'single' | 'all';
  };
  let { variant }: Props = $props();
  const desktop = getDesktop();
  const WAITING = 'Waiting for save location…';
  const EXPORTING = 'Exporting…';
  const CANCELING = 'Canceling export…';
  /** How long after a download-link hand-off a late browser save prompt may still take focus from the page. */
  const LATE_PROMPT_MS = 3000;
  let stopLatePromptGuard: (() => void) | undefined;

  /** Show the export status if the browser's save prompt takes focus after the hand-off, until the page is active again. */
  function guardLatePrompt() {
    stopLatePromptGuard?.();
    const prompted = async () => {
      stop();
      const release = desktop.beginTransfer(EXPORTING);
      await new Promise((resolve) => window.addEventListener('focus', resolve, { once: true }));
      await whenPageActive();
      release();
    };
    const timer = setTimeout(() => stop(), LATE_PROMPT_MS);
    const stop = () => {
      clearTimeout(timer);
      window.removeEventListener('blur', prompted);
      if (stopLatePromptGuard === stop) stopLatePromptGuard = undefined;
    };
    window.addEventListener('blur', prompted, { once: true });
    stopLatePromptGuard = stop;
  }

  async function exportFiles() {
    stopLatePromptGuard?.();
    let release = () => {};
    try {
      const files = exportFilenames(desktop.workspace.sourcesForExport(variant === 'all'));
      if (!files.length) return;
      const [name, blob, description] =
        variant === 'all'
          ? [EXPORT_ALL_FILENAME, sourceArchiveBlob(files), 'ZIP archive']
          : [files[0].name, sourceBlob(files[0].source), 'Assembly source'];
      // Open the save picker within the user's action, then cover the page while it is open; its outcome sets the text.
      const picked = requestSaveTarget(name, blob, description);
      release = desktop.beginTransfer(WAITING);
      const target = await picked;
      const previous = release;
      release = desktop.beginTransfer(target === 'canceled' ? CANCELING : EXPORTING);
      previous();
      if (target === 'canceled') {
        // Nothing to write; the status covers the page until the browser returns focus.
      } else if (target) await writeSaveTarget(target, blob);
      else {
        await downloadBlob(name, blob);
        guardLatePrompt();
      }
      await whenPageActive();
    } catch (error) {
      desktop.simulation.report(error);
    } finally {
      release();
    }
  }

  $effect(() => {
    // Re-register if a caller changes scope, and release the previous capability.
    return desktop.registerFileTransfer(variant === 'all' ? 'exportAll' : 'export', exportFiles);
  });
  onDestroy(() => stopLatePromptGuard?.());
</script>

<!-- @component Single/all source-export behavior registered with the current desktop. Menus and toolbars share its command. In browsers with a save picker, the desktop is covered by "Waiting for save location…" from the moment the picker opens; its outcome adds "Exporting…" while the file is written or "Canceling export…" for a canceled picker. Elsewhere "Exporting…" covers the download-link hand-off, and a save prompt that opens shortly after it brings the status back. Every status is released as soon as the page has focus again. Teardown removes the capability and the late-prompt guard. -->
