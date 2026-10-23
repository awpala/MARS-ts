<script lang="ts">
  import { downloadSource, downloadSourceArchive } from '#lib/browser/download.js';
  import { getDesktop } from '../../context/desktop.js';
  import { exportFilenames } from '../../utils/sources/exportFilenames.js';

  /** Export behavior for the corresponding desktop command; renders no additional control. */
  type Props = {
    /** Required scope: the current source, or saved sources merged with all open edits. */
    variant: 'single' | 'all';
  };
  let { variant }: Props = $props();
  const desktop = getDesktop();

  function exportFiles() {
    try {
      const sources = desktop.workspace.sourcesForExport(variant === 'all');
      const files = exportFilenames(sources);
      if (variant === 'all') downloadSourceArchive(files);
      else for (const file of files) downloadSource(file.name, file.source);
    } catch (error) {
      desktop.simulation.report(error);
    }
  }

  $effect(() => {
    // Re-register if a caller changes scope, and release the previous capability.
    return desktop.registerFileTransfer(variant === 'all' ? 'exportAll' : 'export', exportFiles);
  });
</script>

<!-- @component Single/all source-download behavior registered with the current desktop. Menus and toolbars share its command; teardown removes the capability. -->
