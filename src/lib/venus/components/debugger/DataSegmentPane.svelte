<script lang="ts">
  /**
   * Ports the view in mars/venus/DataSegmentWindow.java.
   * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
   */
  import { MIN_DATA_SEGMENT_HEIGHT } from '#lib/browser/PaneLayout.js';
  import { Binary } from '#lib/engine/formatting/Binary.js';
  import { clamp } from '../../utils/geometry/clamp.js';
  import {
    MEMORY_COLUMNS,
    MEMORY_PAGE_BYTES,
    MEMORY_ROW_BYTES,
    MEMORY_ROWS,
    pageLimits,
    pagedOffset
  } from '../../utils/debugger/memoryView.js';
  import IconButton from '../controls/IconButton.svelte';
  import SelectorToggle from '../controls/SelectorToggle.svelte';
  import InlineAlert from '../feedback/InlineAlert.svelte';
  import PaneDivider from '../layout/PaneDivider.svelte';
  import CellInput from './CellInput.svelte';
  import { getDesktop } from '../../context/desktop.js';
  import { getExecuteView } from './ExecuteView.svelte.js';
  import MachineTable from './MachineTable.svelte';
  import SegmentPane from './SegmentPane.svelte';
  /** Paged memory view and its resize divider; the persisted range, page, height, and display bases are the desktop's display preferences. */
  type Props = {
    /** Required rendered height of the Execute view, used to keep the Text Segment usable. */
    executeHeight: number;
  };
  let { executeHeight }: Props = $props();
  const { display } = getDesktop();
  const view = getExecuteView();
  // The text row keeps its 100px minimum beside the 7px divider.
  const minTextHeight = 107;
  const minDataHeight = MIN_DATA_SEGMENT_HEIGHT;
  let dataPaneHeight = $state(0);
  let dataScrollHeight = $state(0);
  let dataTableHeight = $state(0);
  let dataScroll = $state<HTMLElement>();
  let segmentSelect = $state<HTMLSelectElement>();
  // Compression changes only the scroll viewport, so this stays constant while resizing.
  const naturalDataHeight = $derived(dataPaneHeight - dataScrollHeight + dataTableHeight);
  const maxDataHeight = $derived(
    clamp(executeHeight - minTextHeight, minDataHeight, naturalDataHeight)
  );
  const displayedDataHeight = $derived(
    display.dataSegmentHeight === null
      ? Math.min(dataPaneHeight, maxDataHeight)
      : clamp(display.dataSegmentHeight, minDataHeight, maxDataHeight)
  );
  const dataHeightRestorable = $derived(
    display.dataSegmentHeight !== null && displayedDataHeight < naturalDataHeight
  );
  $effect(() => view.observeWrites());
  $effect(() => {
    // Assembly and Reset replace the statement list after initializing data memory.
    view.resetObservation();
    if (dataScroll) dataScroll.scrollTop = 0;
  });
  const segmentOptions = $derived([
    { value: 'extern', label: `${Binary.intToHexString(view.bases.extern)} (.extern)` },
    { value: 'data', label: `${Binary.intToHexString(view.bases.data)} (.data)` },
    { value: 'heap', label: `${Binary.intToHexString(view.bases.heap)} (heap)` },
    { value: 'gp', label: 'current $gp' },
    { value: 'sp', label: 'current $sp' },
    { value: 'text', label: `${Binary.intToHexString(view.bases.text)} (.text)` },
    { value: 'kernel', label: `${Binary.intToHexString(view.bases.kernel)} (.kdata)` },
    { value: 'mmio', label: `${Binary.intToHexString(view.bases.mmio)} (MMIO)` }
  ]);
  const limits = $derived.by(() => {
    void view.snapshot.revision;
    return pageLimits(view.machine.memory, display.dataSegment, view.memoryBase);
  });
  function pageMemory(bytes: number) {
    display.dataPageOffset = pagedOffset(
      view.bases,
      display.dataSegment,
      view.memoryBase,
      bytes,
      limits
    );
  }
  const dataRows = $derived.by(() => {
    void view.snapshot.revision;
    return Array.from({ length: MEMORY_ROWS }, (_, row) => {
      const address = (view.memoryBase + row * MEMORY_ROW_BYTES) | 0;
      return {
        address,
        words: Array.from({ length: MEMORY_COLUMNS }, (_, column) => {
          const location = (address + column * 4) | 0;
          return { address: location, value: view.readWord(location) };
        })
      };
    });
  });
  function restoreDataHeight() {
    display.dataSegmentHeight = null;
    display.persistLayout();
  }
  function setDataHeight(height: number) {
    // Restoring the full table returns to natural sizing, which follows later content changes.
    display.dataSegmentHeight = height >= naturalDataHeight ? null : Math.round(height);
  }
  // Native selects fire no change when an option is reselected. Opening the list selects a
  // hidden placeholder bearing the current label, so choosing the current range resets it.
  function armSegment() {
    if (segmentSelect && !view.running) segmentSelect.selectedIndex = 0;
  }
  function restoreSegment() {
    if (segmentSelect?.selectedIndex === 0) segmentSelect.value = display.dataSegment;
  }
  function segmentKey(event: KeyboardEvent) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (event.altKey) armSegment();
      else restoreSegment();
    } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'F4') armSegment();
  }
</script>

<!-- @component Editable paged memory with range selection, display bases, and a height divider; edits go through the Execute view context and the pane reports failures beneath its controls. -->
<PaneDivider
  label="Data Segment height"
  controls={`${view.id}-data`}
  orientation="horizontal"
  min={minDataHeight}
  max={maxDataHeight}
  value={displayedDataHeight}
  reverse
  onchange={setDataHeight}
  oncommit={display.persistLayout}
/>
<div
  class="data-area flex min-h-0 flex-none flex-col"
  id={`${view.id}-data`}
  bind:offsetHeight={dataPaneHeight}
  style:height={display.dataSegmentHeight === null ? undefined : `${displayedDataHeight}px`}
>
  <SegmentPane label="Data Segment" class="data-segment" flex="1 1 auto">
    {#snippet actions()}
      <IconButton
        size="sm"
        label="Restore full Data Segment height"
        icon={{ glyph: 'expandDataSegment' }}
        disabled={!dataHeightRestorable}
        onclick={restoreDataHeight}
      />
    {/snippet}
    <div
      class="data-scroll min-h-0 flex-auto overflow-auto"
      bind:this={dataScroll}
      bind:clientHeight={dataScrollHeight}
    >
      <MachineTable bind:offsetHeight={dataTableHeight}>
        {#snippet header()}
          <th>Address</th
          >{#each Array.from({ length: MEMORY_COLUMNS }, (_, i) => i * 4) as offset (offset)}<th
              >Value (+{offset})</th
            >{/each}
        {/snippet}
        <tbody
          >{#each dataRows as row (row.address)}<tr
              ><td class="numeric identifier">{view.formatAddress(row.address)}</td
              >{#each row.words as word (word.address)}<td
                  class="numeric"
                  id={view.memoryId(word.address)}
                  tabindex="-1"
                  data-selected={word.address === view.selectedLabelWord || undefined}
                  data-highlight={view.memoryHighlighting && word.address === view.editedAddress
                    ? 'memory'
                    : undefined}
                  ><CellInput
                    aria-label={`Memory ${Binary.intToHexString(word.address)}`}
                    value={view.formatWord(word.value)}
                    readonly={view.running || display.ascii}
                    onchange={(event) => view.changeWord(word.address, event.currentTarget)}
                  /></td
                >{/each}</tr
            >{/each}</tbody
        >
      </MachineTable>
    </div>
    <div class="data-controls">
      <IconButton
        size="md"
        label="Previous memory page"
        icon={{ glyph: 'previousMemoryPage' }}
        disabled={view.running || view.memoryBase >>> 0 <= limits.low}
        onclick={() => pageMemory(-MEMORY_PAGE_BYTES)}
      /><select
        aria-label="Data segment base"
        disabled={view.running}
        bind:this={segmentSelect}
        bind:value={display.dataSegment}
        onpointerdown={armSegment}
        onkeydown={segmentKey}
        onblur={restoreSegment}
        onchange={() => {
          display.dataPageOffset = 0;
        }}
        ><option value="" hidden disabled
          >{segmentOptions.find((option) => option.value === display.dataSegment)?.label}</option
        >{#each segmentOptions as option (option.value)}<option value={option.value}
            >{option.label}</option
          >{/each}</select
      ><IconButton
        size="md"
        label="Next memory page"
        icon={{ glyph: 'nextMemoryPage' }}
        disabled={view.running || view.memoryBase >>> 0 >= limits.high}
        onclick={() => pageMemory(MEMORY_PAGE_BYTES)}
      />
      <div class="control-separator" role="separator" aria-orientation="vertical"></div>
      <div class="display-options">
        <SelectorToggle bind:checked={display.hexAddresses} label="Hexadecimal Addresses" />
        <SelectorToggle bind:checked={display.hexValues} label="Hexadecimal Values" />
        <SelectorToggle bind:checked={display.ascii} label="ASCII" />
      </div>
    </div>
    <InlineAlert message={view.memoryError} />
  </SegmentPane>
</div>

<style>
  .data-controls {
    display: flex;
    gap: 10px;
    align-items: center;
    overflow-x: auto;
    background: var(--theme-chrome, #eee);
    flex-shrink: 0;
    padding: 2px 5px;
  }
  .data-controls > select {
    flex-shrink: 0;
  }
  .data-controls select {
    background: var(--theme-chrome, #eee);
    color: var(--theme-text, #17202b);
  }
  .data-controls option {
    background: var(--theme-canvas, white);
    color: var(--theme-text, #17202b);
  }
  .control-separator {
    flex: 0 0 1px;
    align-self: stretch;
    margin: 2px 0;
    background: var(--theme-divider, #b3b3b3);
  }
  .display-options {
    display: flex;
    flex-shrink: 0;
    white-space: nowrap;
    gap: 15px;
  }
</style>
