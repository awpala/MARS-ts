<script lang="ts">
  import { onDestroy } from 'svelte';
  import { EXPORT_ALL_FILENAME, sourceArchiveBlob, sourceBlob } from '#lib/browser/download.js';
  import { FileDownload } from '#lib/browser/FileDownload.js';
  import { getDesktop } from '../../context/desktop.js';
  import { exportFilenames } from '../../utils/sources/exportFilenames.js';

  /** Export behavior for the corresponding desktop command; renders no additional control. */
  type Props = {
    /** Required scope: the current source, or saved sources merged with all open edits. */
    variant: 'single' | 'all';
  };
  let { variant }: Props = $props();
  const desktop = getDesktop();
  const download = new FileDownload((status) => desktop.beginTransfer(status));

  async function exportFiles() {
    try {
      const files = exportFilenames(desktop.workspace.sourcesForExport(variant === 'all'));
      if (!files.length) return;
      const [name, blob, description] =
        variant === 'all'
          ? [EXPORT_ALL_FILENAME, sourceArchiveBlob(files), 'ZIP archive']
          : [files[0].name, sourceBlob(files[0].source), 'Assembly source'];
      await download.save(name, blob, description);
    } catch (error) {
      desktop.simulation.report(error);
    }
  }

  $effect(() => {
    // This effect registers an imperative capability and returns its teardown; it does not derive state.
    return desktop.registerFileTransfer(variant === 'all' ? 'exportAll' : 'export', exportFiles);
  });
  onDestroy(() => download.dispose());
</script>

<!-- @component Single/all source-export behavior registered with the desktop for menus and toolbars. A native save picker shows Waiting for save location, followed by Exporting or Canceling export until the operation settles and the page is active. Download-link hand-off uses Exporting; a prompt opening shortly afterwards temporarily restores that status. Teardown removes the capability and late-prompt guard; an export settling afterwards installs no guard, and the disposed desktop ignores its failure report. -->
