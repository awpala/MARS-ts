<script lang="ts">
  import PaneTabs from '../controls/PaneTabs.svelte';
  import Button from '../controls/Button.svelte';
  import CloseButton from '../controls/CloseButton.svelte';
  import { fileActions } from '../../utils/commands.js';
  import { sourceLabel } from '../../utils/sourceLabel.js';
  /** Open-document navigation; buffers, dirty state, and close confirmation belong to the owner. */
  type Props = {
    /** Required ordered document summaries with unique IDs. */
    tabs: readonly { id: number; name: string; dirty: boolean }[];
    /** Selected document ID; absent when no source is open. */
    selected?: number;
    /** Required callback selecting a buffer. */
    onselect: (id: number) => void;
    /** Required callback requesting the owning desktop's close workflow. */
    onclose: (id: number) => void;
    /** Required availability of inline renaming; false while execution or another desktop workflow blocks it. */
    canRename: boolean;
    /** Required reorder availability; false during execution or a blocking desktop workflow. */
    canReorder: boolean;
    /** Required callback moving a buffer before or after its target without changing selection. */
    onreorder: (id: number, targetId: number, after: boolean) => void;
    /** Required callback committing a proposed filename through the workspace's validation and rename workflow. */
    onrename: (id: number, filename: string) => void;
  };
  let { tabs, selected, onselect, onclose, canRename, onrename, canReorder, onreorder }: Props =
    $props();
  const closeShortcut = fileActions.find((action) => action.command === 'close')?.shortcut;
  let editing = $state<number>();
  let filename = $state('');
  let focusAfterRename: number | undefined;

  let dragged = $state<number>();
  let dropTarget = $state<number>();
  let dropAfter = $state(false);
  function clearDrag() {
    dragged = undefined;
    dropTarget = undefined;
  }
  function startDrag(event: DragEvent, id: number) {
    if (!canReorder || tabs.length < 2 || editing !== undefined) {
      event.preventDefault();
      return;
    }
    dragged = id;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-mars-source-tab', String(id));
    }
  }
  function dragOver(event: DragEvent, id: number) {
    if (dragged === undefined || dragged === id || !canReorder) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    dropTarget = id;
    dropAfter = event.clientX >= box.left + box.width / 2;
  }
  function drop(event: DragEvent, id: number) {
    if (dragged !== undefined && dragged !== id && canReorder) {
      event.preventDefault();
      const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
      onreorder(dragged, id, event.clientX >= box.left + box.width / 2);
    }
    clearDrag();
  }
  function reorderKey(event: KeyboardEvent, id: number) {
    if (
      !canReorder ||
      !event.altKey ||
      !event.shiftKey ||
      !['ArrowLeft', 'ArrowRight'].includes(event.key)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const after = event.key === 'ArrowRight';
    const target = tabs[tabs.findIndex((tab) => tab.id === id) + (after ? 1 : -1)];
    if (target) onreorder(id, target.id, after);
  }

  function beginRename(id: number) {
    const tab = tabs.find((tab) => tab.id === id);
    if (!tab || !canRename) return;
    onselect(id);
    filename = tab.name;
    editing = id;
  }

  function renameKeydown(event: KeyboardEvent, id: number) {
    if (event.isComposing || !['Enter', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    focusAfterRename = id;
    finishRename(id, event.key === 'Enter');
  }

  function finishRename(id: number, commit = true) {
    if (editing !== id) return;
    editing = undefined;
    if (commit && canRename) onrename(id, filename);
  }
</script>

<!-- @component Document navigation and transient filename editing through the generic tab strip. Closing and renaming delegate to the desktop's file workflows. -->
<PaneTabs
  variant="documents"
  tabs={tabs.map((tab) => ({ id: tab.id, label: sourceLabel(tab.name, tab.dirty) }))}
  {selected}
  {onselect}
>
  {#snippet tabControl(tab)}
    {#if editing === tab.id && selected === tab.id && canRename}
      <input
        class="source-name-input"
        aria-label="Rename source file"
        bind:value={filename}
        size={Math.max(12, filename.length)}
        {@attach (input) => {
          input.focus();
          input.select();
        }}
        onkeydown={(event) => renameKeydown(event, tab.id)}
        onblur={() => finishRename(tab.id)}
        autocomplete="off"
        spellcheck="false"
      />
    {:else}
      <Button
        class={[
          'source-name px-[7px] py-1 whitespace-nowrap',
          selected === tab.id && 'font-bold',
          canReorder && tabs.length > 1 && 'cursor-grab active:cursor-grabbing'
        ]}
        draggable={canReorder && tabs.length > 1 && editing === undefined}
        style={dropTarget === tab.id
          ? `box-shadow: inset ${dropAfter ? '-2px' : '2px'} 0 var(--theme-focus, #2c679c)`
          : undefined}
        ondragstart={(event) => startDrag(event, tab.id)}
        ondragover={(event) => dragOver(event, tab.id)}
        ondragleave={() => {
          if (dropTarget === tab.id) dropTarget = undefined;
        }}
        ondrop={(event) => drop(event, tab.id)}
        ondragend={clearDrag}
        aria-pressed={selected === tab.id}
        attachment={(button) => {
          if (focusAfterRename === tab.id) {
            focusAfterRename = undefined;
            button.focus();
          }
        }}
        onclick={() => onselect(tab.id)}
        ondblclick={() => beginRename(tab.id)}
        onkeydown={(event) => {
          reorderKey(event, tab.id);
          if (event.key === 'F2' && canRename) {
            event.preventDefault();
            beginRename(tab.id);
          }
        }}>{tab.label}</Button
      >
    {/if}
  {/snippet}
  {#snippet tabActions(id)}
    <CloseButton
      label={`Close ${tabs.find((tab) => tab.id === id)?.name}`}
      shortcut={closeShortcut}
      onclick={() => onclose(id)}
    />
  {/snippet}
</PaneTabs>

<style>
  .source-name-input {
    min-width: 10ch;
    max-width: 40ch;
    margin: 2px;
    padding: 1px 4px;
    border: 1px solid var(--theme-focus, #2c679c);
    background: var(--theme-canvas, white);
    color: var(--theme-text, #17202b);
  }
</style>
