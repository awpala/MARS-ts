<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    EXPORT_ALL_FILENAME,
    sourceArchiveBlob,
    sourceBlob
  } from '#lib/browser/transfers/download.js';
  import {
    captureMarsData,
    MARS_DATA_FILENAME,
    marsDataBlob,
    validateMarsData
  } from '#lib/browser/data/marsData.js';
  import { FileDownload } from '#lib/browser/transfers/FileDownload.js';
  import { getDesktop } from '../../context/desktop.js';
  import { exportFilenames } from '../../utils/sources/exportFilenames.js';

  /** Export behavior for the corresponding desktop command; renders no additional control. */
  type Props = {
    /** Required scope: the current source, saved sources merged with all open edits, or all of this browser's MARS data. */
    variant: 'single' | 'all' | 'mars';
  };
  let { variant }: Props = $props();
  const desktop = getDesktop();
  const download = new FileDownload((status) => desktop.beginTransfer(status));
  const commands = { single: 'export', all: 'exportAll', mars: 'exportMars' } as const;

  /** Name, body, and save-picker description of the requested export, or undefined when there is nothing to export. */
  function exportFile(): [string, Blob, string] | undefined {
    if (variant === 'mars') {
      // Storage must hold the current session before it is copied as a whole.
      desktop.persistence.flush();
      const data = captureMarsData(() => window.localStorage);
      const issues = validateMarsData(data);
      if (issues.length)
        throw new Error(
          `MARS data was not exported because this browser's stored data is not valid: ${issues.join(' ')}`
        );
      return [MARS_DATA_FILENAME, marsDataBlob(data), 'MARS data'];
    }
    const files = exportFilenames(desktop.workspace.sourcesForExport(variant === 'all'));
    if (!files.length) return;
    return variant === 'all'
      ? [EXPORT_ALL_FILENAME, sourceArchiveBlob(files), 'ZIP archive']
      : [files[0].name, sourceBlob(files[0].source), 'Assembly source'];
  }

  async function exportFiles() {
    try {
      const file = exportFile();
      if (file) await download.save(...file);
    } catch (error) {
      desktop.simulation.report(error);
    }
  }

  $effect(() => {
    // This effect registers an imperative capability and returns its teardown; it does not derive state.
    return desktop.registerFileTransfer(commands[variant], exportFiles);
  });
  onDestroy(() => download.dispose());
</script>

<!-- @component Export behavior registered with the desktop for menus and toolbars: the current source, all sources as a ZIP archive, or this browser's whole MARS data as one schema-conforming JSON file, captured from storage after flushing the session and validated before it is saved. A native save picker shows Waiting for save location, followed by Exporting or Canceling export until the operation settles and the page is active. Download-link hand-off uses Exporting; a prompt opening shortly afterwards temporarily restores that status. Teardown removes the capability and late-prompt guard; an export settling afterwards installs no guard, and the disposed desktop ignores its failure report. -->
