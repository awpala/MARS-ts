<script lang="ts">
  import type { Component } from 'svelte';
  import { getDesktop } from '../../context/desktop.js';
  import RunInputDialog from './RunInputDialog.svelte';
  import OpenSourcesDialog from './OpenSourcesDialog.svelte';
  import DeleteSourcesDialog from './DeleteSourcesDialog.svelte';
  import ImportSourcesDialog from './ImportSourcesDialog.svelte';
  import SaveSourceDialog from './SaveSourceDialog.svelte';
  import RenameWarningDialog from './RenameWarningDialog.svelte';
  import CloseSourceDialog from './CloseSourceDialog.svelte';
  import CloseAllSourcesDialog from './CloseAllSourcesDialog.svelte';
  import FindReplaceDialog from './FindReplaceDialog.svelte';
  import DumpMemoryDialog from './DumpMemoryDialog.svelte';
  import MemoryConfigurationDialog from './MemoryConfigurationDialog.svelte';
  import ExceptionHandlerDialog from './ExceptionHandlerDialog.svelte';
  import ClearBreakpointsDialog from './ClearBreakpointsDialog.svelte';
  import HelpDialog from './HelpDialog.svelte';
  import TransferStatusDialog from './TransferStatusDialog.svelte';
  const desktop = getDesktop();
  const { workspace } = desktop;
  const dialogs = {
    open: OpenSourcesDialog,
    delete: DeleteSourcesDialog,
    import: ImportSourcesDialog,
    save: SaveSourceDialog,
    'rename-warning': RenameWarningDialog,
    close: CloseSourceDialog,
    'close-all': CloseAllSourcesDialog,
    find: FindReplaceDialog
  } satisfies Record<NonNullable<typeof workspace.modal>, Component>;
  let WorkspaceDialog = $derived(workspace.modal ? dialogs[workspace.modal] : null);
</script>

<!-- @component Selects context-owned dialog variants. Modal owns the shell; each variant renders one workflow. -->
<RunInputDialog />
{#if WorkspaceDialog}<WorkspaceDialog />{/if}
<HelpDialog />

{#if desktop.dumpOpen}<DumpMemoryDialog />{/if}
{#if desktop.memoryConfigurationOpen}<MemoryConfigurationDialog />{/if}
{#if desktop.exceptionHandlerOpen}<ExceptionHandlerDialog />{/if}
{#if desktop.clearBreakpointsOpen}<ClearBreakpointsDialog />{/if}
{#if desktop.transferStatus !== null}<TransferStatusDialog status={desktop.transferStatus} />{/if}
