<script lang="ts">
  import Tooltip from '../feedback/Tooltip.svelte';
  import { tick } from 'svelte';
  import SelectorToggle from '../controls/SelectorToggle.svelte';
  import Button from '../controls/Button.svelte';
  import CloseButton from '../controls/CloseButton.svelte';
  import Pane from '../layout/Pane.svelte';
  import { formatInteger } from '../../utils/tableCells.js';
  import { errorMessage } from '../../utils/errorMessage.js';
  import { clamp } from '../../utils/clamp.js';
  import { sourceBasename } from '#lib/browser/SourceLibrary.js';
  /** Ports the views in mars/venus/TextSegmentWindow.java, DataSegmentWindow.java, and LabelsWindow.java.
   * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license. */
  import ToolbarIcon from '../shell/ToolbarIcon.svelte';
  import PaneDivider from '../layout/PaneDivider.svelte';
  import MachineTable, { type MachineHighlight } from './MachineTable.svelte';
  import CellInput from './CellInput.svelte';
  import type { SavedLabelSelection } from '#lib/browser/DesktopSession.js';
  import type { Globals } from '#lib/engine/Globals.js';
  import { Settings } from '#lib/engine/Settings.js';
  import type { Symbol as AssemblySymbol } from '#lib/engine/assembler/symbols/Symbol.js';
  import { AddressErrorException } from '#lib/engine/hardware/memory/AddressErrorException.js';
  import { AccessNotice } from '#lib/engine/hardware/notices/AccessNotice.js';
  import { SimulatorNotice } from '#lib/engine/simulator/SimulatorNotice.js';
  import { Binary, NumberFormatException } from '#lib/engine/formatting/Binary.js';
  import type { RunController } from '../../RunController.js';
  /** Execution tables render the parent-owned machine without owning simulation snapshot. */
  type Props = {
    /** Required initialized machine; all reads use its public, non-notifying interfaces. */
    machine: Globals;
    /** Required session controller identifies synchronous backstep writes without treating assembly or edits as execution. */
    controller: RunController;
    /** Required controller snapshot; revision invalidates views after machine changes. */
    snapshot: ReturnType<RunController['getState']>;
    /** Parent-owned selection for the loaded program, persisted with its checkpoint; null clears linked highlights. */
    selectedLabel: SavedLabelSelection | null;
    /** Parent-owned argument draft; bindable and persisted independently of loaded machine state. */
    programArguments: string;
    /** Required breakpoint addresses owned by the desktop. */
    breakpoints: readonly number[];
    /** Required callback toggles a breakpoint in the desktop. */
    ontogglebreakpoint: (address: number) => void;
    /** Required callback refreshes controller state after a manual memory edit. */
    onedit: () => void;
    /** Required callback opens the corresponding source location. */
    onsource: (filename: string, line: number) => void;
    /** Parent-owned persisted visibility, shared by Settings, the toolbar, and the pane's close button. */
    showLabels: boolean;
    /** Parent-owned persisted inclusion of data labels; toggled inside the Labels panel. */
    showDataLabels: boolean;
    /** Parent-owned persisted inclusion of text labels; toggled inside the Labels panel. */
    showTextLabels: boolean;
    /** Parent-owned LabelsWindow sort state, integer zero through seven. */
    labelSortState: number;
    /** Parent-owned address display base, bindable through the bottom checkbox. */
    hexAddresses: boolean;
    /** Parent-owned value display base, bindable through the bottom checkbox. */
    hexValues: boolean;
    /** Parent-owned persisted ASCII display setting, shared by checkbox and toolbar toggle. */
    ascii: boolean;
    /** Parent-owned requested Data Segment height in pixels; null keeps its natural height. */
    dataHeight: number | null;
    /** Parent-owned Data Segment range; defaults to data and survives view changes. */
    segment?: string;
    /** Parent-owned relative aligned memory page offset; defaults to zero. */
    pageOffset?: number;
    /** Required callback persists the Data Segment height after a completed resize. */
    onresizecommit: () => void;
  };
  let {
    machine,
    controller,
    snapshot,
    selectedLabel = $bindable(),
    programArguments = $bindable(),
    breakpoints,
    ontogglebreakpoint,
    onedit,
    onsource,
    showLabels = $bindable(),
    showDataLabels = $bindable(),
    showTextLabels = $bindable(),
    labelSortState = $bindable(),
    hexAddresses = $bindable(),
    hexValues = $bindable(),
    ascii = $bindable(),
    dataHeight = $bindable(),
    segment = $bindable('data'),
    pageOffset = $bindable(0),
    onresizecommit
  }: Props = $props();
  let memoryError = $state('');
  let editedAddress = $state<number | null>(null);
  let memoryHighlighting = $state(false);
  let memoryReveal = 0;
  let observedText: Record<number, number | undefined> = {};
  const assemblyStatements = $derived(snapshot.statements);
  const selectedLabelWord = $derived(selectedLabel === null ? null : selectedLabel.address & ~3);
  const memoryRows = 16;
  const memoryPageBytes = memoryRows * 32;
  // The text row keeps its 100px minimum beside the 7px divider.
  const minTextHeight = 107;
  const minDataHeight = 60;
  let executeHeight = $state(0);
  let dataPaneHeight = $state(0);
  let dataScrollHeight = $state(0);
  let dataTableHeight = $state(0);
  let segmentSelect = $state<HTMLSelectElement>();
  // Compression changes only the scroll viewport, so this stays constant while resizing.
  const naturalDataHeight = $derived(dataPaneHeight - dataScrollHeight + dataTableHeight);
  const maxDataHeight = $derived(
    clamp(executeHeight - minTextHeight, minDataHeight, naturalDataHeight)
  );
  const displayedDataHeight = $derived(
    dataHeight === null
      ? Math.min(dataPaneHeight, maxDataHeight)
      : clamp(dataHeight, minDataHeight, maxDataHeight)
  );
  // LabelsWindow remembers the direction of each column when switching sort columns.
  const sortTransitions = [
    [4, 1],
    [5, 0],
    [6, 3],
    [7, 2],
    [6, 0],
    [7, 1],
    [4, 2],
    [5, 3]
  ];
  const sortColumn = $derived(labelSortState < 4 ? 1 : 0);
  const sortDescending = $derived((labelSortState & (sortColumn === 0 ? 2 : 1)) !== 0);
  $effect(() => {
    let trackWrites = false;
    const releaseSimulator = machine.simulator.subscribe((notice) => {
      trackWrites =
        notice.getAction() === SimulatorNotice.SIMULATOR_START &&
        (notice.getRunSpeed() !== 40 || notice.getMaxSteps() === 1);
      if (trackWrites) memoryHighlighting = true;
    });
    const releaseMemory = machine.memory.addObserver((notice) => {
      if (notice.getAccessType() !== AccessNotice.WRITE) return;
      const address = notice.getAddress() & ~3;
      const previousCode = observedText[address];
      const currentCode =
        previousCode === undefined
          ? undefined
          : machine.memory.getStatementNoNotify(address)?.getBinaryStatement();
      // TextSegmentWindow forwards changed code even when ordinary data observation is off.
      const changedCode = previousCode !== undefined && currentCode !== previousCode;
      if (changedCode && currentCode !== undefined) observedText[address] = currentCode;
      if (!trackWrites && !controller.isBackStepping() && !changedCode) return;
      editedAddress = address;
      selectMemoryPage(address);
      const reveal = ++memoryReveal;
      void tick().then(() => {
        if (reveal === memoryReveal)
          revealLabelTarget(document.getElementById(`${id}-memory-${address >>> 0}`));
      });
    });
    return () => {
      memoryReveal++;
      releaseMemory();
      releaseSimulator();
    };
  });
  $effect(() => {
    // Assembly and Reset replace the statement list after initializing data memory.
    // Clear their writes just as the legacy run actions call clearHighlighting().
    observedText = Object.fromEntries(
      assemblyStatements.map((statement) => [
        statement.getAddress(),
        machine.memory.getStatementNoNotify(statement.getAddress())?.getBinaryStatement() ??
          statement.getBinaryStatement()
      ])
    );
    editedAddress = null;
    memoryHighlighting = false;
    memoryReveal++;
    const viewport = document.getElementById(`${id}-data`)?.querySelector('.data-scroll');
    if (viewport) viewport.scrollTop = 0;
  });
  const selfModifying = $derived.by(() => {
    void snapshot.revision;
    return machine.getSettings().getBooleanSetting(Settings.SELF_MODIFYING_CODE_ENABLED);
  });
  const showProgramArguments = $derived.by(() => {
    void snapshot.revision;
    return machine.getSettings().getBooleanSetting(Settings.PROGRAM_ARGUMENTS);
  });
  const running = $derived(snapshot.status === 'running');
  const pc = $derived.by(() => {
    void snapshot.revision;
    const current = machine.registerFile.getProgramCounterRegister().getValueNoNotify();
    if (snapshot.status === 'terminated') return controller.getLastExecutedAddress();
    return snapshot.error ? (current - 4) | 0 : current;
  });
  const delaySlot = $derived.by(() => {
    void snapshot.revision;
    return controller.getBackstepDelaySlot() ?? machine.delayedBranch.isTriggered();
  });
  const pcHighlight: MachineHighlight = $derived(delaySlot ? 'delay-slot' : 'pc');
  const highlightedPC = $derived(running && machine.runSpeed === 40 ? null : pc);
  const rows = $derived.by(() => {
    void snapshot.revision;
    void hexAddresses;
    void hexValues;
    return snapshot.statements.map((original) => {
      const address = original.getAddress();
      const live = machine.memory.getStatementNoNotify(address) ?? original;
      return {
        address,
        code: live.getBinaryStatement(),
        basic: live.getPrintableBasicAssemblyStatement(),
        source: original.getSource(),
        modified: live.getBinaryStatement() !== original.getBinaryStatement(),
        line: original.getSourceLine(),
        filename: original.getSourceFile() ?? ''
      };
    });
  });
  const labelGroups = $derived.by(() => {
    void snapshot.revision;
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
          .filter((symbol) => (symbol.getType() ? showDataLabels : showTextLabels))
          .sort((left, right) => {
            const a = sortDescending ? right : left;
            const b = sortDescending ? left : right;
            if (sortColumn === 1) return (a.getAddress() >>> 0) - (b.getAddress() >>> 0);
            const nameA = a.getName().toLowerCase(),
              nameB = b.getName().toLowerCase();
            return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
          })
      }));
  });
  const memoryBases = $derived.by(() => {
    void snapshot.revision;
    const memory = machine.memory;
    const bases: Record<string, number> = {
      data: memory.dataBaseAddress,
      extern: memory.externBaseAddress,
      heap: memory.heapBaseAddress,
      gp: machine.registerFile.getRegisters()[28].getValueNoNotify(),
      sp: machine.registerFile.getRegisters()[29].getValueNoNotify(),
      text: memory.textBaseAddress,
      kernel: memory.kernelDataBaseAddress,
      mmio: memory.memoryMapBaseAddress
    };
    return bases;
  });
  const segmentOptions = $derived([
    { value: 'extern', label: `${Binary.intToHexString(memoryBases.extern)} (.extern)` },
    { value: 'data', label: `${Binary.intToHexString(memoryBases.data)} (.data)` },
    { value: 'heap', label: `${Binary.intToHexString(memoryBases.heap)} (heap)` },
    { value: 'gp', label: 'current $gp' },
    { value: 'sp', label: 'current $sp' },
    { value: 'text', label: `${Binary.intToHexString(memoryBases.text)} (.text)` },
    { value: 'kernel', label: `${Binary.intToHexString(memoryBases.kernel)} (.kdata)` },
    { value: 'mmio', label: `${Binary.intToHexString(memoryBases.mmio)} (MMIO)` }
  ]);
  const memoryBase = $derived(((memoryBases[segment] & ~3) + pageOffset) | 0);
  const memoryLimits = $derived.by(() => {
    void snapshot.revision;
    const memory = machine.memory;
    // Linked kernel-text labels share the .text selector with user instructions.
    const kernelText = segment === 'text' && memoryBase >>> 0 >= memory.kernelTextBaseAddress >>> 0;
    const kernel = kernelText || segment === 'kernel' || segment === 'mmio';
    return {
      low: kernelText
        ? memory.kernelTextBaseAddress >>> 0
        : kernel
          ? memory.kernelDataBaseAddress >>> 0
          : Math.min(
              memory.textBaseAddress,
              memory.dataSegmentBaseAddress,
              memory.dataBaseAddress
            ) >>> 0,
      high:
        ((kernel ? memory.kernelHighAddress : memory.userHighAddress) >>> 0) - memoryPageBytes + 1
    };
  });
  function pageMemory(bytes: number) {
    const base = clamp((memoryBase >>> 0) + bytes, memoryLimits.low, memoryLimits.high);
    pageOffset = base - ((memoryBases[segment] & ~3) >>> 0);
  }
  const dataRows = $derived.by(() => {
    void snapshot.revision;
    return Array.from({ length: memoryRows }, (_, row) => {
      const address = (memoryBase + row * 32) | 0;
      return {
        address,
        words: Array.from({ length: 8 }, (_, column) => {
          const location = (address + column * 4) | 0;
          return { address: location, value: readWord(location) };
        })
      };
    });
  });
  function formatAddress(address: number) {
    return formatInteger(address, hexAddresses, true);
  }
  function readWord(address: number): number {
    return machine.withGuiAccess(() => {
      if (machine.memory.inKernelTextSegment(address))
        return machine.memory.getStatementNoNotify(address)?.getBinaryStatement() ?? 0;
      try {
        return machine.memory.getWordNoNotify(address);
      } catch (error) {
        if (!(error instanceof AddressErrorException)) throw error;
        // DataSegmentWindow temporarily enables text reads solely for display.
        const settings = machine.getSettings();
        const enabled = settings.getBooleanSetting(Settings.SELF_MODIFYING_CODE_ENABLED);
        if (machine.memory.inTextSegment(address) && !enabled) {
          settings.setBooleanSettingNonPersistent(Settings.SELF_MODIFYING_CODE_ENABLED, true);
          try {
            return machine.memory.getWordNoNotify(address);
          } catch (readError) {
            if (!(readError instanceof AddressErrorException)) throw readError;
          } finally {
            settings.setBooleanSettingNonPersistent(Settings.SELF_MODIFYING_CODE_ENABLED, enabled);
          }
        }
        return 0;
      }
    });
  }
  function formatWord(value: number) {
    return ascii ? Binary.intToAscii(value) : formatInteger(value, hexValues);
  }
  function changeWord(address: number, input: HTMLInputElement, code = false) {
    try {
      machine.withGuiAccess(() =>
        machine.memory.setRawWord(address, Binary.stringToInt(input.value.trim()))
      );
      memoryError = '';
      onedit();
    } catch (error) {
      if (error instanceof NumberFormatException) {
        input.value = 'INVALID';
        return;
      }
      memoryError = errorMessage(error);
    }
    input.value = code ? Binary.intToHexString(readWord(address)) : formatWord(readWord(address));
  }
  const dataHeightRestorable = $derived(
    dataHeight !== null && displayedDataHeight < naturalDataHeight
  );
  function restoreDataHeight() {
    dataHeight = null;
    onresizecommit();
  }
  function setDataHeight(height: number) {
    // Restoring the full table returns to natural sizing, which follows later content changes.
    dataHeight = height >= naturalDataHeight ? null : Math.round(height);
  }
  // Native selects fire no change when an option is reselected. Opening the list selects a
  // hidden placeholder bearing the current label, so choosing the current range resets it.
  function armSegment() {
    if (segmentSelect && !running) segmentSelect.selectedIndex = 0;
  }
  function restoreSegment() {
    if (segmentSelect?.selectedIndex === 0) segmentSelect.value = segment;
  }
  function segmentKey(event: KeyboardEvent) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (event.altKey) armSegment();
      else restoreSegment();
    } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'F4') armSegment();
  }
  // Both tables reveal text labels; data labels retain DataSegmentWindow's range selection.
  function isSelectedLabel(symbol: AssemblySymbol, filename: string | null) {
    return (
      selectedLabel?.filename === filename &&
      selectedLabel.name === symbol.getName() &&
      selectedLabel.address === symbol.getAddress()
    );
  }
  function selectMemoryPage(address: number) {
    const memory = machine.memory;
    const textLabel = memory.inTextSegment(address) || memory.inKernelTextSegment(address);
    if (textLabel) segment = 'text';
    else if (memory.inKernelDataSegment(address)) segment = 'kernel';
    else if (memory.inMemoryMapSegment(address)) segment = 'mmio';
    else {
      // DataSegmentWindow chooses the nearest eligible base; ties keep the earlier range.
      let shortest = 0x7fffffff;
      for (const range of ['extern', 'gp', 'data', 'heap', 'sp']) {
        const distance =
          range === 'gp' || range === 'sp'
            ? Math.abs(address - memoryBases[range])
            : address - memoryBases[range];
        if (distance >= 0 && distance < shortest) {
          shortest = distance;
          segment = range;
        }
      }
    }
    const base = memoryBases[segment] & ~31;
    const offset = address - base;
    // Keep the range's page boundaries, rather than placing every label in the first row.
    const pageBase = base + Math.floor(offset / memoryPageBytes) * memoryPageBytes;
    pageOffset = pageBase - (memoryBases[segment] & ~3);
    return textLabel;
  }
  async function navigateLabel(symbol: AssemblySymbol, filename: string | null) {
    if (isSelectedLabel(symbol, filename)) {
      selectedLabel = null;
      return;
    }
    const address = symbol.getAddress();
    const textLabel = selectMemoryPage(address);
    selectedLabel = { filename, name: symbol.getName(), address };
    await tick();
    const word = document.getElementById(`${id}-memory-${(address & ~3) >>> 0}`);
    revealLabelTarget(word);
    if (textLabel) {
      const instruction = document.getElementById(`${id}-instruction-${address >>> 0}`);
      revealLabelTarget(instruction);
      instruction?.focus({ preventScroll: true });
    } else word?.focus({ preventScroll: true });
  }
  function revealLabelTarget(target: HTMLElement | null) {
    if (!target) return;
    const viewport = target.closest<HTMLElement>('.text-scroll, .data-scroll, .labels-scroll');
    if (!viewport) return;
    const headerHeight = viewport.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    const bounds = target.getBoundingClientRect();
    // Center only the destination pane, below its sticky header, without moving the desktop.
    viewport.scrollTop +=
      bounds.top -
      viewport.getBoundingClientRect().top -
      viewport.clientTop -
      headerHeight -
      (viewport.clientHeight - headerHeight - bounds.height) / 2;
  }
  const id = $props.id();
  function labelRowId(filename: string | null, name: string) {
    return `${id}-label-${encodeURIComponent(filename ?? '(global)')}-${encodeURIComponent(name)}`;
  }
  $effect(() => {
    const selection = selectedLabel;
    if (selection === null) return;
    const address = selection.address & ~3;
    let active = true;
    void tick().then(() => {
      if (!active) return;
      // Reopening Execute or restoring a session reveals selection after the PC attachment runs.
      revealLabelTarget(document.getElementById(`${id}-instruction-${address >>> 0}`));
      revealLabelTarget(document.getElementById(`${id}-memory-${address >>> 0}`));
      revealLabelTarget(document.getElementById(labelRowId(selection.filename, selection.name)));
    });
    return () => {
      active = false;
    };
  });
  let followedStatements: Props['snapshot']['statements'] | undefined;
  let centerPC = false;
  function followPC(node: HTMLElement) {
    const viewport = node.closest<HTMLElement>('.text-scroll');
    if (!viewport) return;
    if (followedStatements !== snapshot.statements) {
      followedStatements = snapshot.statements;
      centerPC = false;
      viewport.scrollTop = 0;
    }
    const headerHeight = viewport.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    const bounds = node.getBoundingClientRect();
    const viewportTop = viewport.getBoundingClientRect().top + viewport.clientTop;
    // Hold the opening page through its last fully visible row, then follow every move.
    if (!centerPC && bounds.bottom <= viewportTop + viewport.clientHeight) return;
    centerPC = true;
    // Center below the sticky headings; native clamping pins the first and last pages.
    // Scroll only this pane, preserving horizontal position and keyboard focus.
    viewport.scrollTop +=
      bounds.top -
      viewportTop -
      headerHeight -
      (viewport.clientHeight - headerHeight - bounds.height) / 2;
  }
</script>

<!-- @component Actual assembled statements, breakpoints, symbol navigation, and editable paged memory for the session. -->
<div
  class="execute-pane"
  bind:clientHeight={executeHeight}
  style:--pane-border-color="var(--theme-border, #a2aab1)"
>
  <div class="text-row">
    <Pane
      class="segment text-segment"
      label="Text Segment"
      flex="1"
      height="auto"
      minHeight="0"
      overflow="hidden"
    >
      <h2 class="shrink-0">Text Segment</h2>
      {#if showProgramArguments}
        <div class="program-arguments">
          <Tooltip text="Arguments provided to program at runtime via $a0 (argc) and $a1 (argv)">
            {#snippet children(trigger, description)}
              <label {@attach trigger}>
                <span>Program Arguments:</span>
                <input
                  type="text"
                  bind:value={programArguments}
                  aria-describedby={description}
                  spellcheck="false"
                  autocomplete="off"
                />
              </label>
            {/snippet}
          </Tooltip>
          <CloseButton
            label="Clear program arguments (argv)"
            disabled={programArguments.length === 0}
            onclick={() => (programArguments = '')}
          />
        </div>
      {/if}
      <div class="text-scroll">
        <MachineTable>
          {#snippet header()}
            {#each ['Bkpt', 'Address', 'Code', 'Basic', 'Source'] as heading (heading)}<th
                >{heading}</th
              >{/each}
          {/snippet}
          <tbody>
            {#each rows as row (row.address)}<tr
                {@attach row.address === highlightedPC && followPC}
                id={`${id}-instruction-${row.address >>> 0}`}
                tabindex="-1"
                data-selected={row.address === selectedLabelWord || undefined}
                data-highlight={row.address === highlightedPC ? pcHighlight : undefined}
                aria-current={row.address === highlightedPC ? 'step' : undefined}
              >
                <td
                  ><input
                    class="mx-auto block"
                    type="checkbox"
                    aria-label={`Breakpoint ${Binary.intToHexString(row.address)}`}
                    checked={breakpoints.includes(row.address)}
                    disabled={running}
                    onchange={() => ontogglebreakpoint(row.address)}
                  /></td
                >
                <td class="numeric identifier">{formatAddress(row.address)}</td><td class="numeric"
                  ><CellInput
                    aria-label={`Code ${Binary.intToHexString(row.address)}`}
                    value={Binary.intToHexString(row.code)}
                    readonly={running || !selfModifying}
                    onchange={(event) => changeWord(row.address, event.currentTarget, true)}
                  /></td
                ><td>{row.basic}</td>
                <td
                  >{#if row.modified}<span> ------ </span>{:else}<Button
                      class="source-link text-left whitespace-pre"
                      onclick={() => onsource(row.filename, row.line)}
                      >{row.line}: {row.source}</Button
                    >{/if}</td
                >
              </tr>{/each}
          </tbody>
        </MachineTable>
      </div>
    </Pane>
    {#if showLabels}<Pane
        class="labels segment"
        label="Labels"
        flex="0 0 25%"
        height="auto"
        minHeight="0"
        overflow="hidden"
      >
        <h2 aria-label="Labels" class="flex shrink-0 items-center justify-between gap-2">
          Labels
          <CloseButton label="Hide Labels Window" onclick={() => (showLabels = false)} />
        </h2>
        <div class="label-controls">
          <SelectorToggle
            tooltip="Show labels defined in the data segment"
            bind:checked={showDataLabels}
            label="Data"
          />
          <SelectorToggle
            tooltip="Show labels defined in the text segment"
            bind:checked={showTextLabels}
            label="Text"
          />
        </div>
        <div class="labels-scroll">
          <MachineTable>
            {#snippet header()}
              {#each ['Label', 'Address'] as heading, column (heading)}
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
                    onclick={() => (labelSortState = sortTransitions[labelSortState][column])}
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
                <tr><th class="label-group" scope="rowgroup" colspan="2">{group.name}</th></tr>
                {#each group.symbols as symbol (symbol.getName())}
                  <tr
                    id={labelRowId(group.filename, symbol.getName())}
                    data-selected={isSelectedLabel(symbol, group.filename) || undefined}
                  >
                    <td class="identifier">
                      <Button
                        tooltip="Click on label or address to view it in Text/Data Segment"
                        class="block w-full text-left"
                        aria-pressed={isSelectedLabel(symbol, group.filename)}
                        onclick={() => navigateLabel(symbol, group.filename)}
                        >{symbol.getName()}</Button
                      >
                    </td>
                    <td class="numeric">
                      <Button
                        class="block w-full text-right"
                        tooltip="Click on label or address to view it in Text/Data Segment"
                        aria-pressed={isSelectedLabel(symbol, group.filename)}
                        onclick={() => navigateLabel(symbol, group.filename)}
                        >{formatAddress(symbol.getAddress())}</Button
                      >
                    </td>
                  </tr>
                {/each}
              </tbody>
            {/each}
          </MachineTable>
        </div>
      </Pane>{/if}
  </div>
  <PaneDivider
    label="Data Segment height"
    controls={`${id}-data`}
    orientation="horizontal"
    min={minDataHeight}
    max={maxDataHeight}
    value={displayedDataHeight}
    reverse
    onchange={setDataHeight}
    oncommit={onresizecommit}
  />
  <div
    class="data-area"
    id={`${id}-data`}
    bind:offsetHeight={dataPaneHeight}
    style:height={dataHeight === null ? undefined : `${displayedDataHeight}px`}
  >
    <Pane
      class="segment data-segment"
      label="Data Segment"
      flex="1 1 auto"
      height="auto"
      minHeight="0"
      overflow="hidden"
    >
      <h2 class="data-heading shrink-0">
        Data Segment<Button
          class="grid size-4.5 shrink-0 place-items-center"
          tooltip="Restore full Data Segment height"
          aria-label="Restore full Data Segment height"
          disabled={!dataHeightRestorable}
          onclick={restoreDataHeight}><ToolbarIcon name="expandDataSegment" /></Button
        >
      </h2>
      <div class="data-scroll" bind:clientHeight={dataScrollHeight}>
        <MachineTable bind:offsetHeight={dataTableHeight}>
          {#snippet header()}
            <th>Address</th>{#each Array.from({ length: 8 }, (_, i) => i * 4) as offset (offset)}<th
                >Value (+{offset})</th
              >{/each}
          {/snippet}
          <tbody
            >{#each dataRows as row (row.address)}<tr
                ><td class="numeric identifier">{formatAddress(row.address)}</td
                >{#each row.words as word (word.address)}<td
                    class="numeric"
                    id={`${id}-memory-${word.address >>> 0}`}
                    tabindex="-1"
                    data-selected={word.address === selectedLabelWord || undefined}
                    data-highlight={memoryHighlighting && word.address === editedAddress
                      ? 'memory'
                      : undefined}
                    ><CellInput
                      aria-label={`Memory ${Binary.intToHexString(word.address)}`}
                      value={formatWord(word.value)}
                      readonly={running || ascii}
                      onchange={(event) => changeWord(word.address, event.currentTarget)}
                    /></td
                  >{/each}</tr
              >{/each}</tbody
          >
        </MachineTable>
      </div>
      <div class="data-controls">
        <Button
          class="grid size-5.5 shrink-0 place-items-center"
          tooltip="Previous memory page"
          aria-label="Previous memory page"
          disabled={running || memoryBase >>> 0 <= memoryLimits.low}
          onclick={() => pageMemory(-memoryPageBytes)}
          ><ToolbarIcon name="previousMemoryPage" /></Button
        ><select
          aria-label="Data segment base"
          disabled={running}
          bind:this={segmentSelect}
          bind:value={segment}
          onpointerdown={armSegment}
          onkeydown={segmentKey}
          onblur={restoreSegment}
          onchange={() => {
            pageOffset = 0;
          }}
          ><option value="" hidden disabled
            >{segmentOptions.find((option) => option.value === segment)?.label}</option
          >{#each segmentOptions as option (option.value)}<option value={option.value}
              >{option.label}</option
            >{/each}</select
        ><Button
          class="grid size-5.5 shrink-0 place-items-center"
          tooltip="Next memory page"
          aria-label="Next memory page"
          disabled={running || memoryBase >>> 0 >= memoryLimits.high}
          onclick={() => pageMemory(memoryPageBytes)}><ToolbarIcon name="nextMemoryPage" /></Button
        >
        <div class="control-separator" role="separator" aria-orientation="vertical"></div>
        <div class="display-options">
          <SelectorToggle bind:checked={hexAddresses} label="Hexadecimal Addresses" />
          <SelectorToggle bind:checked={hexValues} label="Hexadecimal Values" />
          <SelectorToggle bind:checked={ascii} label="ASCII" />
        </div>
      </div>
      {#if memoryError}<p role="alert">{memoryError}</p>{/if}
    </Pane>
  </div>
</div>

<style>
  .execute-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: auto;
  }
  .text-row {
    display: flex;
    flex: 1 0 100px;
    min-height: 100px;
  }
  h2 {
    background: var(--theme-heading, #dde4eb);
    border-bottom: 1px solid var(--theme-border, #a2aab1);
    padding: 3px 6px;
    font-weight: 600;
  }
  .data-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .data-heading :global(svg) {
    width: 16px;
    height: 16px;
  }
  .text-scroll,
  .labels-scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .program-arguments {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    background: var(--theme-chrome, #eee);
    border-bottom: 1px solid var(--theme-border, #a2aab1);
  }
  .program-arguments span {
    white-space: nowrap;
  }
  .program-arguments label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .program-arguments input {
    width: 32ch;
    min-width: 0;
    padding: 2px 6px;
    border: 1px solid var(--theme-accent-border, #849eb5);
    border-radius: 2px;
    background: var(--theme-surface, #fff);
    color: var(--theme-text, #17202b);
  }
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
  .data-area {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    min-height: 0;
  }
  .data-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
  }
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
  p {
    flex-shrink: 0;
    color: var(--theme-error, #a11);
    padding: 4px;
  }
</style>
