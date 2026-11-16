<script lang="ts">
  import type { Component } from 'svelte';
  import type { DesktopModal, WorkspaceDialog } from '../../state/ModalState.svelte.js';
  import { getDesktop } from '../../context/desktop.js';
  import SyscallDialog from './SyscallDialog.svelte';
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
  const dialogs = {
    open: OpenSourcesDialog,
    delete: DeleteSourcesDialog,
    import: ImportSourcesDialog,
    save: SaveSourceDialog,
    'rename-warning': RenameWarningDialog,
    close: CloseSourceDialog,
    'close-all': CloseAllSourcesDialog,
    find: FindReplaceDialog,
    help: HelpDialog,
    dump: DumpMemoryDialog,
    memoryConfiguration: MemoryConfigurationDialog,
    exceptionHandler: ExceptionHandlerDialog,
    clearBreakpoints: ClearBreakpointsDialog,
    runInput: RunInputDialog,
    syscall: SyscallDialog
  } satisfies Record<
    Exclude<DesktopModal['kind'], 'workspace' | 'transfer'> | WorkspaceDialog,
    Component
  >;
</script>

<!-- @component Renders the shared modal state machine through an exhaustive registry. Underlying dialogs remain mounted while temporary overlays own interaction, preserving drafts and save lifetimes. -->
{#each desktop.modals.layers as modal (modal.kind)}
  {#if modal.kind === 'transfer'}
    <TransferStatusDialog status={modal.status} />
  {:else}
    {@const Dialog = dialogs[modal.kind === 'workspace' ? modal.name : modal.kind]}
    <Dialog />
  {/if}
{/each}
