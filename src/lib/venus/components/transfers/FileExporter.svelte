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

<!-- @component Single/all source-export behavior registered with the current desktop. Menus and toolbars share its command. In browsers with a save picker, the desktop is covered by "Waiting for save location…" from the moment the picker opens; its outcome adds "Exporting…" while the file is written or "Canceling export…" for a canceled picker. Elsewhere "Exporting…" covers the download-link hand-off, and a save prompt that opens shortly after it brings the status back. Every status is released as soon as the page has focus again. Teardown removes the capability and the late-prompt guard; an export settling afterwards installs no guard, and the disposed desktop ignores its failure report. -->
