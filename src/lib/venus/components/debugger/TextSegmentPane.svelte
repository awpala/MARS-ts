<script lang="ts">
  /**
   * Ports the view in mars/venus/TextSegmentWindow.java.
   * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
   */
  import { Binary } from '#lib/engine/formatting/Binary.js';
  import { Settings } from '#lib/engine/Settings.js';
  import { centerBelowHeading, endsWithinViewport } from '../../utils/dom/scrollReveal.js';
  import { frozenBreakpointsHint } from '../../utils/commands/actions.js';
  import { UNLIMITED_SPEED } from '../../utils/execution/runSpeed.js';
  import Button from '../controls/Button.svelte';
  import CloseButton from '../controls/CloseButton.svelte';
  import Tooltip from '../feedback/Tooltip.svelte';
  import CellInput from './CellInput.svelte';
  import { getDesktop } from '../../context/desktop.js';
  import { getExecuteView } from './ExecuteView.svelte.js';
  import MachineTable, { type MachineHighlight } from './MachineTable.svelte';
  import SegmentPane from './SegmentPane.svelte';
  const desktop = getDesktop();
  const { simulation, workspace } = desktop;
  const lockedBreakpoint = `Breakpoint locked at maximum run speed — ${frozenBreakpointsHint}`;
  const view = getExecuteView();
  const selfModifying = $derived.by(() => {
    void view.snapshot.revision;
    return view.machine.getSettings().getBooleanSetting(Settings.SELF_MODIFYING_CODE_ENABLED);
  });
  const showProgramArguments = $derived.by(() => {
    void view.snapshot.revision;
    return view.machine.getSettings().getBooleanSetting(Settings.PROGRAM_ARGUMENTS);
  });
  const pc = $derived.by(() => {
    void view.snapshot.revision;
    const current = view.machine.registerFile.getProgramCounterRegister().getValueNoNotify();
    if (view.snapshot.status === 'terminated') return view.controller.getLastExecutedAddress();
    return view.snapshot.error ? (current - 4) | 0 : current;
  });
  const delaySlot = $derived.by(() => {
    void view.snapshot.revision;
    return view.controller.getBackstepDelaySlot() ?? view.machine.delayedBranch.isTriggered();
  });
  const pcHighlight: MachineHighlight = $derived(delaySlot ? 'delay-slot' : 'pc');
  const highlightedPC = $derived(
    view.running && view.machine.runSpeed === UNLIMITED_SPEED ? null : pc
  );
  const rows = $derived.by(() => {
    void view.snapshot.revision;
    return view.snapshot.statements.map((original) => {
      const address = original.getAddress();
      const live = view.machine.memory.getStatementNoNotify(address) ?? original;
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
  let followedStatements: typeof view.snapshot.statements | undefined;
  let centerPC = false;
  function followPC(node: HTMLElement) {
    const viewport = node.closest<HTMLElement>('.text-scroll');
    if (!viewport) return;
    if (followedStatements !== view.snapshot.statements) {
      followedStatements = view.snapshot.statements;
      centerPC = false;
      viewport.scrollTop = 0;
    }
    // Hold the opening page through its last fully visible row, then follow every move.
    if (!centerPC && endsWithinViewport(viewport, node)) return;
    centerPC = true;
    centerBelowHeading(viewport, node);
  }
</script>

<!-- @component Actual assembled statements with breakpoints, editable code, source links, and the optional program-argument draft. Follows the highlighted instruction without taking keyboard focus; machine state, selection, and navigation come from the Execute view context, and breakpoints, the argument draft, and source navigation from the desktop owners. -->
<SegmentPane label="Text Segment" class="text-segment" flex="1">
  {#if showProgramArguments}
    <div class="program-arguments">
      <Tooltip text="Arguments provided to program at runtime via $a0 (argc) and $a1 (argv)">
        {#snippet children(trigger, description)}
          <label {@attach trigger}>
            <span>Program Arguments:</span>
            <input
              type="text"
              bind:value={simulation.programArguments}
              aria-describedby={description}
              spellcheck="false"
              autocomplete="off"
            />
          </label>
        {/snippet}
      </Tooltip>
      <CloseButton
        label="Clear program arguments (argv)"
        disabled={simulation.programArguments.length === 0}
        onclick={() => (simulation.programArguments = '')}
      />
    </div>
  {/if}
  <div class="text-scroll min-h-0 flex-1 overflow-auto">
    <MachineTable>
      {#snippet header()}
        {#each ['Bkpt', 'Address', 'Code', 'Basic', 'Source'] as heading (heading)}<th>{heading}</th
          >{/each}
      {/snippet}
      <tbody>
        {#each rows as row (row.address)}<tr
            {@attach row.address === highlightedPC && followPC}
            id={view.instructionId(row.address)}
            tabindex="-1"
            data-selected={row.address === view.selectedLabelWord || undefined}
            data-highlight={row.address === highlightedPC ? pcHighlight : undefined}
            aria-current={row.address === highlightedPC ? 'step' : undefined}
          >
            <td
              ><Tooltip text={desktop.breakpointsFrozen ? lockedBreakpoint : ''}>
                {#snippet children(trigger, description)}
                  <span class="block" {@attach trigger}
                    ><input
                      class="mx-auto block"
                      type="checkbox"
                      aria-label={`Breakpoint ${Binary.intToHexString(row.address)}`}
                      aria-describedby={description}
                      checked={simulation.breakpoints.includes(row.address)}
                      disabled={desktop.breakpointsFrozen}
                      onchange={() => simulation.toggleBreakpoint(row.address)}
                    /></span
                  >
                {/snippet}
              </Tooltip></td
            >
            <td class="numeric identifier">{view.formatAddress(row.address)}</td><td class="numeric"
              ><CellInput
                aria-label={`Code ${Binary.intToHexString(row.address)}`}
                value={Binary.intToHexString(row.code)}
                readonly={view.running || !selfModifying}
                onchange={(event) => view.changeWord(row.address, event.currentTarget, true)}
              /></td
            ><td>{row.basic}</td>
            <td class={{ action: !row.modified }}
              >{#if row.modified}<span> ------ </span>{:else}<Button
                  class="source-link text-left whitespace-pre"
                  tooltip="See in source file"
                  onclick={() => workspace.showSource(row.filename, row.line)}
                  >{row.line}: {row.source}</Button
                >{/if}</td
            >
          </tr>{/each}
      </tbody>
    </MachineTable>
  </div>
</SegmentPane>

<style>
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
</style>
