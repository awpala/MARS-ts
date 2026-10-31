<script lang="ts">
  /**
   * Ports the view in mars/venus/LabelsWindow.java.
   * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
   */
  import { sourceBasename } from '#lib/browser/SourceLibrary.js';
  import {
    compareLabels,
    LABEL_COLUMNS,
    labelSortColumn,
    labelSortDescending,
    nextLabelSortState
  } from '../../utils/debugger/labelSort.js';
  import Button from '../controls/Button.svelte';
  import CloseButton from '../controls/CloseButton.svelte';
  import SelectorToggle from '../controls/SelectorToggle.svelte';
  import { getDesktop } from '../../context/desktop.js';
  import { getExecuteView } from './ExecuteView.svelte.js';
  import MachineTable from './MachineTable.svelte';
  import SegmentPane from './SegmentPane.svelte';
  const { display } = getDesktop();
  const view = getExecuteView();
  const sortColumn = $derived(labelSortColumn(display.labelSortState));
  const sortDescending = $derived(labelSortDescending(display.labelSortState));
  const labelGroups = $derived.by(() => {
    void view.snapshot.revision;
    const { machine, snapshot } = view;
    return [
      {
        owner: machine.symbolTable,
        file: '(global)',
        filename: null,
        symbols: machine.symbolTable.getAllSymbols()
      },
      ...snapshot.programs.map((program) => ({
        owner: program,
        file: program.getFilename() ?? '',
        filename: program.getFilename() ?? '',
        symbols: program.getLocalSymbolTable()?.getAllSymbols() ?? []
      }))
    ]
      .filter((group) => group.symbols.length > 0)
      .map((group) => ({
        ...group,
        name: sourceBasename(group.file),
        symbols: group.symbols
          .filter((symbol) => (symbol.getType() ? display.showDataLabels : display.showTextLabels))
          .sort((left, right) => compareLabels(left, right, display.labelSortState))
      }));
  });
</script>

<!-- @component Labels grouped by owning table, filterable by segment and sortable by column. Selecting a label pages the Data Segment and reveals its targets through the Execute view context; visibility, filters, and sort state are the desktop's persisted display preferences. -->
<SegmentPane label="Labels" headingLabel="Labels" class="labels" flex="0 0 25%">
  {#snippet actions()}
    <CloseButton label="Hide Labels Window" onclick={() => (display.showLabels = false)} />
  {/snippet}
  <div class="label-controls">
    <SelectorToggle
      tooltip="Show labels defined in the data segment"
      bind:checked={display.showDataLabels}
      label="Data"
    />
    <SelectorToggle
      tooltip="Show labels defined in the text segment"
      bind:checked={display.showTextLabels}
      label="Text"
    />
  </div>
  <div class="labels-scroll min-h-0 flex-1 overflow-auto" data-testid="labels-scroll">
    <MachineTable>
      {#snippet header()}
        {#each LABEL_COLUMNS as heading, column (heading)}
          <th
            aria-sort={sortColumn === column
              ? sortDescending
                ? 'descending'
                : 'ascending'
              : 'none'}
          >
            <Button
              class="w-full text-left"
              tooltip={`Sort by ${heading}`}
              aria-label={`Sort by ${heading}`}
              onclick={() =>
                (display.labelSortState = nextLabelSortState(display.labelSortState, column))}
            >
              {heading}{#if sortColumn === column}<span aria-hidden="true"
                  >{sortDescending ? ' ▼' : ' ▲'}</span
                >{/if}
            </Button>
          </th>
        {/each}
      {/snippet}
      {#each labelGroups as group (group.owner)}
        <tbody aria-label={group.file}>
          <tr
            ><th class="label-group" scope="rowgroup" colspan="2" data-testid="label-group-heading"
              >{group.name}</th
            ></tr
          >
          {#each group.symbols as symbol (symbol.getName())}
            <tr
              data-testid="label-row"
              id={view.labelRowId(group.filename, symbol.getName())}
              data-selected={view.isSelectedLabel(symbol, group.filename) || undefined}
            >
              <td class="identifier action" data-testid="label-name-cell">
                <Button
                  data-testid="label-name"
                  tooltip="Click on label or address to view it in Text/Data Segment"
                  class="text-left"
                  aria-pressed={view.isSelectedLabel(symbol, group.filename)}
                  onclick={() => view.navigateLabel(symbol, group.filename)}
                  >{symbol.getName()}</Button
                >
              </td>
              <td class="numeric action" data-testid="label-address-cell">
                <Button
                  data-testid="label-address"
                  class="text-right"
                  tooltip="Click on label or address to view it in Text/Data Segment"
                  aria-pressed={view.isSelectedLabel(symbol, group.filename)}
                  onclick={() => view.navigateLabel(symbol, group.filename)}
                  >{view.formatAddress(symbol.getAddress())}</Button
                >
              </td>
            </tr>
          {/each}
        </tbody>
      {/each}
    </MachineTable>
  </div>
</SegmentPane>

<style>
  .label-controls {
    display: flex;
    flex-shrink: 0;
    gap: 12px;
    padding: 3px 6px;
    background: var(--theme-chrome, #eee);
  }
  .label-group {
    background: var(--theme-heading, #dde4eb);
    color: var(--theme-text, #17202b);
    font-weight: 600;
    text-align: center;
  }
</style>
