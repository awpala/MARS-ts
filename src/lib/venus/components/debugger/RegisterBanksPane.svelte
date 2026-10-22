<script lang="ts">
  import Tooltip from '../feedback/Tooltip.svelte';
  import Button from '../controls/Button.svelte';
  import MultiSelect from '../controls/MultiSelect.svelte';
  import TabbedPane from '../layout/TabbedPane.svelte';
  import { formatInteger } from '../../utils/tableCells.js';
  import MachineTable from './MachineTable.svelte';
  import CellInput from './CellInput.svelte';
  /**
   * Ports mars/venus/RegistersPane.java, RegistersWindow.java,
   * Coprocessor0Window.java, and Coprocessor1Window.java.
   * Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
   */
  import type { RegisterFile } from '#lib/engine/hardware/registers/RegisterFile.js';
  import type { Coprocessor0 } from '#lib/engine/hardware/registers/Coprocessor0.js';
  import type { Coprocessor1 } from '#lib/engine/hardware/registers/Coprocessor1.js';
  import { AccessNotice } from '#lib/engine/hardware/notices/AccessNotice.js';
  import { Binary } from '#lib/engine/formatting/Binary.js';
  import { JavaFloatingPoint } from '#lib/engine/formatting/JavaFloatingPoint.js';
  import { SimulatorNotice } from '#lib/engine/simulator/SimulatorNotice.js';
  import type { RunController } from '../../RunController.js';
  /** Register-bank display contract; the parent session owns all hardware instances. */
  type Props = {
    /** Optional parent-owned pane ID, used by the resize separator to identify its controlled region. */
    id?: string;
    /** Parent-controlled tab; execution errors select Coproc 0 and Reset selects Registers. */
    selected: string;
    /** Required display base from the containing IDE; true shows hexadecimal words. */
    hexValues: boolean;
    /** Required session-owned general registers; never replaced while a run is active. */
    registers: RegisterFile;
    /** Required session-owned exception registers. */
    coprocessor0: Coprocessor0;
    /** Required session-owned floating-point registers. */
    coprocessor1: Coprocessor1;
    /** Required refresh sequence for silent resets and condition flag changes. */
    machineRevision: number;
    /** Required session controller supplies assembly/reset identity and explicit backstep context for write highlighting. */
    controller: RunController;
    /** True while executing; editing resumes at a paused or stepped boundary. */
    running: boolean;
    /** Notify the session after a manual register edit. */
    onedit: () => void;
  };
  let {
    hexValues,
    id,
    selected = $bindable(),
    registers,
    coprocessor0,
    coprocessor1,
    machineRevision,
    controller,
    running,
    onedit
  }: Props = $props();
  const general = $derived([
    ...registers.getRegisters(),
    registers.getProgramCounterRegister(),
    registers.getHighOrderRegister(),
    registers.getLowOrderRegister()
  ]);
  // Name-column descriptions from the three legacy register windows, in display order.
  const nameTooltips: Record<string, readonly string[]> = {
    Registers: [
      'constant 0',
      'reserved for assembler',
      'expression evaluation and results of a function',
      'expression evaluation and results of a function',
      'argument 1',
      'argument 2',
      'argument 3',
      'argument 4',
      'temporary (not preserved across call)',
      'temporary (not preserved across call)',
      'temporary (not preserved across call)',
      'temporary (not preserved across call)',
      'temporary (not preserved across call)',
      'temporary (not preserved across call)',
      'temporary (not preserved across call)',
      'temporary (not preserved across call)',
      'saved temporary (preserved across call)',
      'saved temporary (preserved across call)',
      'saved temporary (preserved across call)',
      'saved temporary (preserved across call)',
      'saved temporary (preserved across call)',
      'saved temporary (preserved across call)',
      'saved temporary (preserved across call)',
      'saved temporary (preserved across call)',
      'temporary (not preserved across call)',
      'temporary (not preserved across call)',
      'reserved for OS kernel',
      'reserved for OS kernel',
      'pointer to global area',
      'stack pointer',
      'frame pointer',
      'return address (used by function call)',
      'program counter',
      'high-order word of multiply product, or divide remainder',
      'low-order word of multiply product, or divide quotient'
    ],
    'Coproc 0': [
      'Memory address at which address exception occurred',
      'Interrupt mask and enable bits',
      'Exception type and pending interrupt bits',
      'Address of instruction that caused exception'
    ],
    'Coproc 1': [
      'floating point subprogram return value',
      'should not be referenced explicitly in your program',
      'floating point subprogram return value',
      'should not be referenced explicitly in your program',
      'temporary (not preserved across call)',
      'should not be referenced explicitly in your program',
      'temporary (not preserved across call)',
      'should not be referenced explicitly in your program',
      'temporary (not preserved across call)',
      'should not be referenced explicitly in your program',
      'temporary (not preserved across call)',
      'should not be referenced explicitly in your program',
      'floating point subprogram argument 1',
      'should not be referenced explicitly in your program',
      'floating point subprogram argument 2',
      'should not be referenced explicitly in your program',
      'temporary (not preserved across call)',
      'should not be referenced explicitly in your program',
      'temporary (not preserved across call)',
      'should not be referenced explicitly in your program',
      'saved temporary (preserved across call)',
      'should not be referenced explicitly in your program',
      'saved temporary (preserved across call)',
      'should not be referenced explicitly in your program',
      'saved temporary (preserved across call)',
      'should not be referenced explicitly in your program',
      'saved temporary (preserved across call)',
      'should not be referenced explicitly in your program',
      'saved temporary (preserved across call)',
      'should not be referenced explicitly in your program',
      'saved temporary (preserved across call)',
      'should not be referenced explicitly in your program'
    ]
  };
  let revision = $state(0);
  let error = $state('');
  let changed = $state<Record<string, string>>({});
  const rows = $derived.by(() => {
    void revision;
    void machineRevision;
    return (
      selected === 'Registers'
        ? general
        : selected === 'Coproc 0'
          ? coprocessor0.getRegisters()
          : coprocessor1.getRegisters()
    ).map((register, index) => ({
      tooltip: nameTooltips[selected][index],
      name: register.getName(),
      number: register.getNumber(),
      value: register.getValueNoNotify()
    }));
  });
  $effect(() => {
    let trackWrites = false;
    let statements = controller.getState().statements;
    const releaseController = controller.subscribe((state) => {
      if (state.statements !== statements) changed = {};
      statements = state.statements;
    });
    const releaseSimulator = controller.machine.simulator.subscribe((notice) => {
      trackWrites =
        notice.getAction() === SimulatorNotice.SIMULATOR_START &&
        (notice.getRunSpeed() !== 40 || notice.getMaxSteps() === 1);
    });
    const banks = [
      { name: 'Registers', registers: general },
      { name: 'Coproc 0', registers: coprocessor0.getRegisters() },
      { name: 'Coproc 1', registers: coprocessor1.getRegisters() }
    ];
    const releases = banks.flatMap((bank) =>
      bank.registers.map((register) =>
        register.subscribe((notice) => {
          if (notice.getAccessType() === AccessNotice.WRITE) {
            if (
              register !== registers.getProgramCounterRegister() &&
              (trackWrites || controller.isBackStepping())
            ) {
              changed[bank.name] = register.getName();
              selected = bank.name;
            }
            revision++;
          }
        })
      )
    );
    return () => {
      releases.forEach((release) => release());
      releaseSimulator();
      releaseController();
    };
  });
  function format(value: number, unsigned = false) {
    return formatInteger(value, hexValues, unsigned);
  }
  function update(number: number, input: HTMLInputElement) {
    try {
      const value = Binary.stringToInt(input.value.trim());
      if (selected === 'Registers') registers.updateRegister(number, value);
      else coprocessor0.updateRegister(number, value);
      error = '';
      onedit();
    } catch {
      error = 'Invalid 32-bit integer. Use decimal or a hexadecimal value beginning with 0x.';
    }
    input.value = format(
      selected === 'Registers'
        ? general.find((register) => register.getNumber() === number)!.getValueNoNotify()
        : coprocessor0
            .getRegisters()
            .find((register) => register.getNumber() === number)!
            .getValueNoNotify()
    );
  }
  function floatValue(number: number) {
    void revision;
    void machineRevision;
    return hexValues
      ? Binary.intToHexString(coprocessor1.getRegisters()[number].getValueNoNotify())
      : JavaFloatingPoint.formatFloat(coprocessor1.getFloatFromRegisterNoNotify(number));
  }
  function doubleValue(number: number) {
    void revision;
    void machineRevision;
    return hexValues
      ? Binary.longToHexString(
          Binary.twoIntsToLong(
            coprocessor1.getRegisters()[number + 1].getValueNoNotify(),
            coprocessor1.getRegisters()[number].getValueNoNotify()
          )
        )
      : JavaFloatingPoint.formatDouble(coprocessor1.getDoubleFromRegisterPairNoNotify(number));
  }
  function updateFloat(number: number, pair: boolean, input: HTMLInputElement) {
    try {
      const text = input.value.trim();
      if (pair) {
        if (Binary.isHex(text))
          coprocessor1.setRegisterPairToLong(number, Binary.stringToLong(text));
        else coprocessor1.setRegisterPairToDouble(number, JavaFloatingPoint.parseDouble(text));
      } else {
        if (Binary.isHex(text)) coprocessor1.updateRegister(number, Binary.stringToInt(text));
        else coprocessor1.setRegisterToFloat(number, JavaFloatingPoint.parseFloat(text));
      }
      error = '';
      onedit();
    } catch {
      error = 'Invalid floating-point value or hexadecimal bit pattern.';
    }
    input.value = pair ? doubleValue(number) : floatValue(number);
  }
  const conditionFlagOptions = $derived(
    Array.from({ length: coprocessor1.getConditionFlagCount() }, (_, flag) => ({
      value: flag,
      label: String(flag),
      accessibleLabel: `Condition flag ${flag}`,
      tooltip: 'checked == 1, unchecked == 0'
    }))
  );
  const conditionFlags = $derived.by(() => {
    void machineRevision;
    return coprocessor1.getConditionFlagsNoNotify();
  });
  const selectedConditionFlags = $derived(
    conditionFlagOptions
      .filter((option) => Binary.bitValue(conditionFlags, option.value) === 1)
      .map((option) => option.value)
  );
  // Port-specific bulk edits; the legacy panel offers only individual checkboxes. Each disables once its selection holds.
  const conditionFlagActions = $derived([
    {
      label: 'Select all',
      selection: conditionFlagOptions.map((option) => option.value),
      disabled: selectedConditionFlags.length === conditionFlagOptions.length
    },
    { label: 'Select none', selection: [], disabled: selectedConditionFlags.length === 0 }
  ]);
  // Like the legacy checkbox listener, a click writes only its own flag, even during execution.
  function updateConditionFlags(selection: number[]) {
    for (const { value: flag } of conditionFlagOptions) {
      const checked = selection.includes(flag);
      if (checked === (Binary.bitValue(conditionFlags, flag) === 1)) continue;
      if (checked) coprocessor1.setConditionFlag(flag);
      else coprocessor1.clearConditionFlag(flag);
    }
    onedit();
  }
</script>

<!-- @component Persistent register banks sidebar (Registers, Coproc 1, and Coproc 0), reading engine-owned hardware and releasing subscriptions on teardown. -->
<TabbedPane
  element="aside"
  label="Registers"
  tabs={['Registers', 'Coproc 1', 'Coproc 0']}
  bind:selected
  --pane-flex="0 0 auto"
  --pane-min-width="260px"
  --pane-width="var(--register-width, 310px)"
  --pane-overflow="auto"
  --pane-background="var(--theme-surface, #fafafa)"
  --tab-padding="4px 9px"
  {id}
  class="register-pane"
>
  <div class="register-scroll">
    <MachineTable>
      {#snippet header()}
        <th>Name</th><th>{selected === 'Coproc 1' ? 'Float' : 'Number'}</th><th
          >{selected === 'Coproc 1' ? 'Double' : 'Value'}</th
        >
      {/snippet}
      <tbody>
        {#each rows as row (row.number)}<tr
            data-highlight={changed[selected] === row.name ? 'register' : undefined}
            ><td class="identifier">
              <Tooltip text={row.tooltip}>
                {#snippet children(trigger, description)}
                  <span
                    class="block cursor-pointer"
                    {@attach trigger}
                    aria-describedby={description}>{row.name}</span
                  >
                {/snippet}
              </Tooltip>
            </td>{#if selected === 'Coproc 1'}<td class="numeric"
                ><CellInput
                  aria-label={`${row.name} float value`}
                  value={floatValue(row.number)}
                  readonly={running}
                  onchange={(event) => updateFloat(row.number, false, event.currentTarget)}
                /></td
              ><td class="numeric"
                >{#if row.number % 2 === 0}<CellInput
                    aria-label={`${row.name} double value`}
                    value={doubleValue(row.number)}
                    readonly={running}
                    onchange={(event) => updateFloat(row.number, true, event.currentTarget)}
                  />{/if}</td
              >{:else}<td class="numeric">{row.number < 32 ? row.number : ''}</td><td
                class="numeric"
                ><CellInput
                  aria-label={`${row.name} value`}
                  value={format(row.value, selected === 'Registers' && row.number === 32)}
                  readonly={running ||
                    (selected === 'Registers' && [0, 31, 32].includes(row.number))}
                  onchange={(event) => update(row.number, event.currentTarget)}
                /></td
              >{/if}</tr
          >{/each}
      </tbody>
    </MachineTable>
  </div>
  {#if selected === 'Coproc 1'}
    <!-- Fit-width wrapper centers the caption, flags, and bulk actions as one left-aligned group. -->
    <div class="mx-auto flex w-fit flex-col p-1.25">
      <MultiSelect
        class="flags [--selector-gap:3px]"
        label="Condition flags"
        tooltip="flags are used by certain floating point instructions, default flag is 0"
        options={conditionFlagOptions}
        value={selectedConditionFlags}
        onchange={updateConditionFlags}
      />
      <div class="mt-1 flex gap-2">
        {#each conditionFlagActions as action (action.label)}
          <Button
            class="border border-(--theme-border,#929eaa) bg-(--theme-surface,#f8f8f8) px-2 py-0.5 hover:enabled:border-(--theme-accent-border,#849eb5) hover:enabled:bg-(--theme-hover,#dbe8f2)"
            disabled={action.disabled}
            onclick={() => updateConditionFlags(action.selection)}>{action.label}</Button
          >
        {/each}
      </div>
    </div>
  {/if}
  {#if error}<p role="alert">{error}</p>{/if}
</TabbedPane>

<style>
  .register-scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  p {
    color: var(--theme-error, #a11);
    padding: 5px;
  }
</style>
