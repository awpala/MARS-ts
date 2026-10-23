<script lang="ts">
  import PaneTabs from '../controls/PaneTabs.svelte';
  import Button from '../controls/Button.svelte';
  import CloseButton from '../controls/CloseButton.svelte';
  import { getDesktop } from '../../context/desktop.js';
  import { requireAction } from '../../utils/commands/actions.js';
  import { sourceLabel } from '../../utils/sources/sourceLabel.js';
  const desktop = getDesktop();
  const { workspace } = desktop;
  const tabs = $derived(workspace.tabSummaries);
  const selected = $derived(workspace.current?.id);
  /** Rename and reorder share one availability: not while a program runs or a dialog owns interaction. */
  const editable = $derived(desktop.canEditTabs);
  const closeShortcut = requireAction('close').shortcut;
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
    if (!editable || tabs.length < 2 || editing !== undefined) {
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
    if (dragged === undefined || dragged === id || !editable) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    dropTarget = id;
    dropAfter = event.clientX >= box.left + box.width / 2;
  }
  function drop(event: DragEvent, id: number) {
    if (dragged !== undefined && dragged !== id && editable) {
      event.preventDefault();
      const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
      workspace.reorder(dragged, id, event.clientX >= box.left + box.width / 2);
    }
    clearDrag();
  }
  function reorderKey(event: KeyboardEvent, id: number) {
    if (
      !editable ||
      !event.altKey ||
      !event.shiftKey ||
      !['ArrowLeft', 'ArrowRight'].includes(event.key)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const after = event.key === 'ArrowRight';
    const target = tabs[tabs.findIndex((tab) => tab.id === id) + (after ? 1 : -1)];
    if (target) workspace.reorder(id, target.id, after);
  }

  function beginRename(id: number) {
    const tab = tabs.find((tab) => tab.id === id);
    if (!tab || !editable) return;
    workspace.select(id);
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
    if (commit && editable) workspace.rename(id, filename);
  }
</script>

<!-- @component Document navigation and transient filename editing through the generic tab strip. Selecting, closing, reordering, and renaming delegate to the desktop's source workspace, which owns the buffers, validation, and persistence. -->
<PaneTabs
  variant="documents"
  tabs={tabs.map((tab) => ({ id: tab.id, label: sourceLabel(tab.name, tab.dirty) }))}
  {selected}
  onselect={workspace.select}
>
  {#snippet tabControl(tab)}
    <div
      class="source-tab"
      role="group"
      aria-label={tab.label}
      data-drop-position={dropTarget === tab.id ? (dropAfter ? 'after' : 'before') : undefined}
      ondragover={(event) => dragOver(event, tab.id)}
      ondragleave={(event) => {
        if (
          dropTarget === tab.id &&
          !(
            event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)
          )
        )
          dropTarget = undefined;
      }}
      ondrop={(event) => drop(event, tab.id)}
    >
      {#if editing === tab.id && selected === tab.id && editable}
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
            editable && tabs.length > 1 && 'cursor-grab active:cursor-grabbing'
          ]}
          draggable={editable && tabs.length > 1 && editing === undefined}
          ondragstart={(event) => startDrag(event, tab.id)}
          ondragend={clearDrag}
          aria-pressed={selected === tab.id}
          attachment={(button) => {
            if (focusAfterRename === tab.id) {
              focusAfterRename = undefined;
              button.focus();
            }
          }}
          onclick={() => workspace.select(tab.id)}
          ondblclick={() => beginRename(tab.id)}
          onkeydown={(event) => {
            reorderKey(event, tab.id);
            if (event.key === 'F2' && editable) {
              event.preventDefault();
              beginRename(tab.id);
            }
          }}>{tab.label}</Button
        >
      {/if}
      <CloseButton
        label={`Close ${tabs.find((item) => item.id === tab.id)?.name}`}
        shortcut={closeShortcut}
        onclick={() => workspace.startClose([tab.id])}
      />
    </div>
  {/snippet}
</PaneTabs>

<style>
  .source-tab {
    position: relative;
    display: flex;
  }
  .source-tab[data-drop-position]::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--theme-focus, #2c679c);
    pointer-events: none;
  }
  .source-tab[data-drop-position='before']::after {
    left: 0;
  }
  .source-tab[data-drop-position='after']::after {
    right: 0;
  }
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
