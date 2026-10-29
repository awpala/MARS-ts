<script lang="ts">
  import SourceEditor from './SourceEditor.svelte';
  import SourceTabs from './SourceTabs.svelte';
  import { getDesktop } from '../../context/desktop.js';
  import { bundledSource } from '#lib/browser/BundledSources.js';
  import Button from '../controls/Button.svelte';
  import MaskIcon from '../icons/MaskIcon.svelte';
  const { workspace, simulation } = getDesktop();
</script>

<!-- @component The Edit view: document tabs, a lock and copy action for protected references, and the highlighted source editor. The workspace owns buffers, selection, scroll position, and persistence. Copy creates an independent editable buffer; the bundled reference remains protected. -->
<SourceTabs />
{#if workspace.current?.readOnly}
  <div class="flex items-center gap-2 border-b border-(--theme-border,#aaa) px-2 py-1">
    <MaskIcon name="Lock" size={14} />
    <p class="min-w-0 flex-1" role="status">
      {bundledSource(workspace.current.name)?.label ?? workspace.current.name} — Read-only
    </p>
    <Button
      variant="bordered"
      class="inline-flex items-center gap-2 px-2 py-1"
      disabled={simulation.running}
      onclick={() => void workspace.copyToNewFile()}
    >
      <MaskIcon name="OpenAsNewFile" size={14} />Copy to new file
    </Button>
  </div>
{/if}
<SourceEditor />
